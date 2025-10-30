#!/usr/bin/env tsx
/**
 * ZADARMA BACKFILL SCRIPT
 * 
 * Propósito: Cargar datos históricos de Zadarma respetando el límite de rate (3 llamadas/min)
 *            y manejando correctamente la zona horaria UTC.
 * 
 * Uso:
 *   - Carga masiva local:
 *     npx tsx scripts/zadarma-backfill.ts --from="2024-01-01" --to="2025-10-30" --timezone="America/Lima"
 * 
 *   - Rectificación diaria (últimas 24h):
 *     npx tsx scripts/zadarma-backfill.ts --days=1 --timezone="America/Lima"
 * 
 * CRÍTICO: Este script usa pausa de 21 segundos entre llamadas para respetar el límite de 3/min
 */

import { db } from '../src/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, subDays, addHours } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import CryptoJS from 'crypto-js';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const ZADARMA_API_KEY = process.env.ZADARMA_API_KEY!;
const ZADARMA_API_SECRET = process.env.ZADARMA_API_SECRET!;
const DEFAULT_TIMEZONE = 'America/Lima'; // Zona horaria por defecto
const RATE_LIMIT_PAUSE_MS = 21000; // 21 segundos = ~2.8 llamadas/min (margen de seguridad)

// Mapeo de agentes (mismo que webhook y helpers)
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

// ============================================================================
// UTILIDADES
// ============================================================================

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function validateCredentials() {
  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    console.error('❌ ERROR: Variables de entorno ZADARMA_API_KEY y ZADARMA_API_SECRET no configuradas');
    process.exit(1);
  }
}

// ============================================================================
// CLIENTE API ZADARMA
// ============================================================================

interface ZadarmaAPIResponse {
  status: string;
  message?: string;
  stats?: any[];
}

async function fetchZadarmaStats(startUTC: string, endUTC: string): Promise<any[]> {
  const method = '/v1/statistics/pbx/';
  const params: Record<string, string> = {
    start: startUTC,
    end: endUTC,
    format: 'json',
    version: '2',
  };

  // Ordenar parámetros alfabéticamente (requerido por Zadarma)
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, params[key]));
  const queryString = sortedParams.toString();

  // Generar firma (MD5 + HMAC-SHA1 + Base64)
  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  const hmac = CryptoJS.HmacSHA1(dataToSign, ZADARMA_API_SECRET);
  const signature = CryptoJS.enc.Base64.stringify(
    CryptoJS.enc.Utf8.parse(hmac.toString(CryptoJS.enc.Hex))
  );

  const authHeader = `${ZADARMA_API_KEY}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: ZadarmaAPIResponse = await response.json();

    if (data.status === 'error') {
      throw new Error(`API Error: ${data.message || 'Unknown error'}`);
    }

    return data.stats || [];
  } catch (error: any) {
    console.error(`❌ Error llamando API Zadarma:`, error.message);
    throw error;
  }
}

// ============================================================================
// GUARDADO EN FIRESTORE (UPSERT)
// ============================================================================

async function saveCallToFirestore(call: any): Promise<void> {
  try {
    // Usar call_id_with_rec o pbx_call_id como ID del documento (mismo criterio que webhook)
    const callId = call.call_id_with_rec || call.pbx_call_id || call.id || `backfill_${Date.now()}`;
    
    // Convertir callstart a Timestamp (asumimos que viene en UTC desde la API)
    // Formato esperado: "2025-10-29 14:30:00"
    const startTimeUTC = new Date(call.callstart + 'Z');
    const callDate = call.callstart.substring(0, 10);

    const firestoreDoc = {
      // IDs
      call_id: callId,
      pbx_call_id: call.pbx_call_id || callId,
      call_id_with_rec: call.call_id_with_rec || callId,
      
      // Timestamps
      callstart: call.callstart, // String "YYYY-MM-DD HH:MM:SS"
      start_time_utc: Timestamp.fromDate(startTimeUTC),
      callDate,
      
      // Datos de llamada
      duration: Number(call.duration) || Number(call.seconds) || 0,
      seconds: Number(call.duration) || Number(call.seconds) || 0,
      disposition: call.disposition || 'unknown',
      status_code: call.status_code,
      
      // Números
      caller_id: call.caller_id || call.from,
      called_did: call.called_did || call.to,
      from: call.from || call.caller_id,
      to: call.to || call.called_did,
      destination: call.destination || call.to || call.called_did,
      
      // Agente
      sip: call.sip || 'unknown',
      agentId: call.sip || 'unknown',
      agentName: AGENT_MAP[call.sip || ''] || 'Desconocido',
      
      // Metadata
      is_recorded: call.is_recorded,
      internal: call.internal,
      redirection: call.redirection,
      
      // Origen
      last_updated_by: 'backfill',
      backfill_processed_at: Timestamp.now(),
      syncedAt: new Date().toISOString(),
      createdAt: Timestamp.now(),
    };

    // CRÍTICO: set con merge: true permite convivencia con webhook
    // Si el webhook ya creó este documento, solo se actualizarán campos faltantes
    await db.collection('zadarma_calls')
      .doc(callId)
      .set(firestoreDoc, { merge: true });

  } catch (error: any) {
    console.error(`  ❌ Error guardando call ${call.pbx_call_id}:`, error.message);
    throw error;
  }
}

// ============================================================================
// LÓGICA DE BACKFILL (HORA POR HORA)
// ============================================================================

async function runBackfill(
  localStartDate: Date,
  localEndDate: Date,
  timezone: string
) {
  console.log('\n🚀 Iniciando Backfill de Zadarma');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`📅 Rango local (${timezone}):`);
  console.log(`   Desde: ${format(localStartDate, 'yyyy-MM-dd HH:mm:ss')}`);
  console.log(`   Hasta: ${format(localEndDate, 'yyyy-MM-dd HH:mm:ss')}\n`);

  // Convertir fechas locales a UTC usando fromZonedTime (date-fns-tz v3+)
  let currentHourUTC = fromZonedTime(localStartDate, timezone);
  const endUTC = fromZonedTime(localEndDate, timezone);

  console.log(`🌍 Rango UTC (para API de Zadarma):`);
  console.log(`   Desde: ${format(currentHourUTC, 'yyyy-MM-dd HH:mm:ss')}`);
  console.log(`   Hasta: ${format(endUTC, 'yyyy-MM-dd HH:mm:ss')}\n`);

  let totalCalls = 0;
  let totalHours = 0;
  let errors = 0;

  while (currentHourUTC < endUTC) {
    totalHours++;

    // Crear ventana de 1 hora (00:00:00 a 00:59:59)
    const startRange = format(currentHourUTC, 'yyyy-MM-dd HH:mm:ss');
    const endHour = addHours(currentHourUTC, 1);
    const endHourMinusOne = new Date(endHour.getTime() - 1000); // -1s para no solapar
    const endRange = format(endHourMinusOne, 'yyyy-MM-dd HH:mm:ss');

    // Convertir a hora local para mostrar al usuario usando toZonedTime
    const localStart = toZonedTime(currentHourUTC, timezone);
    
    console.log(`⏳ [${totalHours}] Procesando: ${format(localStart, 'yyyy-MM-dd HH:mm')} (${timezone})`);
    console.log(`   UTC: ${startRange} → ${endRange}`);

    try {
      // 1. Llamar a la API
      const calls = await fetchZadarmaStats(startRange, endRange);
      
      console.log(`   📞 Llamadas obtenidas: ${calls.length}`);

      // 2. Guardar cada llamada en Firestore
      if (calls.length > 0) {
        for (const call of calls) {
          await saveCallToFirestore(call);
        }
        totalCalls += calls.length;
        console.log(`   ✅ Guardadas en Firestore\n`);
      } else {
        console.log(`   ℹ️  Sin llamadas en esta hora\n`);
      }

    } catch (error: any) {
      errors++;
      console.error(`   ❌ ERROR: ${error.message}\n`);
      // Continuar con la siguiente hora en caso de error
    }

    // 3. Avanzar a la siguiente hora
    currentHourUTC = endHour;

    // 4. PAUSA PREVENTIVA CRÍTICA (respetar rate limit de 3/min)
    if (currentHourUTC < endUTC) {
      console.log(`   ⏸️  Pausando ${RATE_LIMIT_PAUSE_MS / 1000}s (rate limit: 3 llamadas/min)...`);
      await sleep(RATE_LIMIT_PAUSE_MS);
      console.log('');
    }
  }

  // Resumen final
  console.log('\n════════════════════════════════════════════════════════');
  console.log('✅ BACKFILL COMPLETADO');
  console.log('════════════════════════════════════════════════════════\n');
  console.log(`📊 Estadísticas:`);
  console.log(`   Horas procesadas: ${totalHours}`);
  console.log(`   Llamadas totales: ${totalCalls}`);
  console.log(`   Errores: ${errors}`);
  console.log(`   Promedio: ${(totalCalls / totalHours).toFixed(1)} llamadas/hora\n`);
}

// ============================================================================
// PARSEO DE ARGUMENTOS Y EJECUCIÓN
// ============================================================================

async function main() {
  validateCredentials();

  const args = process.argv.slice(2);
  const argsMap: Record<string, string> = {};

  // Parsear argumentos --key=value
  args.forEach(arg => {
    const match = arg.match(/--(.+)=(.+)/);
    if (match) {
      argsMap[match[1]] = match[2];
    }
  });

  const timezone = argsMap.timezone || DEFAULT_TIMEZONE;

  let localStartDate: Date;
  let localEndDate: Date;

  if (argsMap.days) {
    // Modo: últimas N días (para cron diario)
    const days = parseInt(argsMap.days, 10);
    localEndDate = new Date(); // Ahora
    localStartDate = subDays(localEndDate, days);
    
    console.log(`\n📅 Modo: Últimas ${days} día(s)`);
  } else if (argsMap.from && argsMap.to) {
    // Modo: rango específico (para carga masiva)
    localStartDate = new Date(argsMap.from + ' 00:00:00');
    localEndDate = new Date(argsMap.to + ' 23:59:59');
    
    console.log(`\n📅 Modo: Rango específico`);
  } else {
    console.error('\n❌ ERROR: Debes proporcionar argumentos válidos:\n');
    console.log('Ejemplos:');
    console.log('  - Carga masiva:');
    console.log('    npx tsx scripts/zadarma-backfill.ts --from="2024-01-01" --to="2025-10-30" --timezone="America/Lima"\n');
    console.log('  - Últimas 24 horas:');
    console.log('    npx tsx scripts/zadarma-backfill.ts --days=1 --timezone="America/Lima"\n');
    process.exit(1);
  }

  await runBackfill(localStartDate, localEndDate, timezone);
}

// Ejecutar
main().catch((error) => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
