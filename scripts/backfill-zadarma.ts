/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE BACKFILL MANUAL - ZADARMA CALLS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ----------
 * Poblar la base de datos Firestore con datos históricos de llamadas desde
 * la API de Zadarma, respetando los límites de tasa (rate limits).
 * 
 * USO:
 * ----
 * # Poblar últimos 30 días (sin incluir hoy)
 * npm run backfill-zadarma
 * 
 * # Poblar número específico de días
 * npm run backfill-zadarma -- --days=60
 * 
 * # Rango de fechas específico
 * npm run backfill-zadarma -- --start=2025-10-01 --end=2025-10-31
 * 
 * # Forzar sobrescritura de datos existentes
 * npm run backfill-zadarma -- --force
 * 
 * CARACTERÍSTICAS:
 * ----------------
 * ✅ Respeta rate limit de Zadarma (espera 30s entre días)
 * ✅ Guarda en colección zadarma_calls con estructura completa
 * ✅ Muestra progreso en tiempo real
 * ✅ Genera reporte final con estadísticas
 * ✅ Manejo de errores robusto
 * ✅ Skip de días que ya tienen datos (opcional con --force)
 * 
 * NOTAS IMPORTANTES:
 * ------------------
 * - NO incluye el día actual (usar auto-refresh del dashboard para hoy)
 * - Espera 30 segundos entre cada día para respetar API limits
 * - Los datos se guardan con merge: true para no sobrescribir webhooks
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { format, subDays, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';
import { db } from '../src/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

dotenv.config();

// Mapeo de agentes para enriquecer datos
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

interface BackfillOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  force?: boolean;
  dryRun?: boolean;
}

interface DayResult {
  date: string;
  success: boolean;
  calls: number;
  skipped: boolean;
  error?: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Contadores globales y flags
let API_CALL_COUNT = 0; // contará las llamadas al endpoint /api/zadarma/stats
let DRY_RUN = false;    // se activa con --dry-run

/**
 * Parsea argumentos de línea de comandos
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {
    days: 30,
    force: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--days=')) {
      options.days = parseInt(args[i].split('=')[1], 10);
    }
    if (args[i].startsWith('--start=')) {
      options.startDate = args[i].split('=')[1];
    }
    if (args[i].startsWith('--end=')) {
      options.endDate = args[i].split('=')[1];
    }
    if (args[i] === '--force') {
      options.force = true;
    }
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

/**
 * Verifica si un día ya tiene datos en Firestore
 */
async function dayHasData(date: string): Promise<boolean> {
  try {
    const isDryRun = DRY_RUN || process.argv.includes('--dry-run');
    if (isDryRun) {
      // En dry-run no consultamos Firestore: simulamos que NO hay datos para permitir pruebas locales
      console.log(`   (dry-run) No se consultará Firestore para ${date}; asumiendo: no hay datos.`);
      return false;
    }

    if (!db || typeof db.collection !== 'function') {
      console.warn(`   ⚠️  Firebase Admin SDK no está inicializado correctamente (db es null). Omitiendo verificación en Firestore para ${date}.`);
      return false;
    }

    const snapshot = await db.collection('zadarma_calls')
      .where('callDate', '==', date)
      .limit(1)
      .get();

    return !snapshot.empty;
  } catch (error: any) {
    // Si falla la lectura (credenciales o conexión), retornar false pero avisar.
    console.warn(`   ⚠️  No fue posible leer Firestore para ${date}. Continuando como si no hubiera datos. Error: ${error.message || error}`);
    return false;
  }
}

/**
 * Guarda una llamada en Firestore
 */
async function saveCallToFirestore(call: any): Promise<void> {
  try {
    const callId = call.pbx_call_id || call.call_id_with_rec || `call_${Date.now()}_${Math.random()}`;
    const startTimeUTC = new Date(call.callstart + (call.callstart.includes('Z') ? '' : 'Z'));
    const callDate = call.callstart.substring(0, 10);
    
    const firestoreDoc = {
      call_id: callId,
      pbx_call_id: call.pbx_call_id || callId,
      call_id_with_rec: call.call_id_with_rec || callId,
      
      callstart: call.callstart,
      start_time_utc: Timestamp.fromDate(startTimeUTC),
      callDate,
      
      duration: typeof call.duration === 'string' ? parseInt(call.duration, 10) : (call.duration || 0),
      seconds: typeof call.seconds === 'string' ? parseInt(call.seconds, 10) : (call.seconds || 0),
      disposition: call.disposition || 'unknown',
      status_code: call.status_code,
      
      caller_id: call.caller_id || '',
      called_did: call.called_did || '',
      from: call.from || call.caller_id || '',
      to: call.to || call.called_did || '',
      destination: call.destination || call.to || call.called_did || '',
      
      sip: call.sip || 'unknown',
      agentId: call.sip || 'unknown',
      agentName: AGENT_MAP[call.sip || ''] || 'Desconocido',
      
      is_recorded: call.is_recorded,
      internal: call.internal,
      redirection: call.redirection,
      
      last_updated_by: 'backfill-script',
      syncedAt: new Date().toISOString(),
      updatedAt: Timestamp.now(),
    };

    if (DRY_RUN) {
      // En modo dry-run no escribimos en Firestore
      // Sólo mostramos un punto de verificación breve
      process.stdout.write('.');
      return;
    }

    // 🔧 CRITICAL FIX: Firestore NO acepta valores undefined
    // Sanitizamos el documento removiendo todos los campos undefined
    const sanitizedDoc = Object.entries(firestoreDoc).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    await db.collection('zadarma_calls')
      .doc(callId)
      .set(sanitizedDoc, { merge: true });
    
  } catch (error) {
    console.error('[SAVE ERROR]:', error);
    throw error;
  }
}

/**
 * Procesa un día específico
 */
async function processDay(date: string, force: boolean): Promise<DayResult> {
  const result: DayResult = {
    date,
    success: false,
    calls: 0,
    skipped: false
  };

  try {
    // Verificar si ya tiene datos (skip si no es force)
    if (!force) {
      const hasData = await dayHasData(date);
      if (hasData) {
        console.log(`   ⏭️  Día ${date} ya tiene datos. Omitiendo...`);
        result.skipped = true;
        result.success = true;
        return result;
      }
    }

    // Llamar al endpoint de stats
    const isDryRun = DRY_RUN || process.argv.includes('--dry-run');

    let calls: any[] = [];

    if (isDryRun) {
      // No llamamos al API en dry-run. Simulamos un conjunto de llamadas para probar guardado y progreso.
      console.log(`   (dry-run) Simulando consulta API para ${date}...`);
      const simulatedCount = Math.floor(Math.random() * 50) + 1; // 1..50 llamadas simuladas
      for (let i = 0; i < simulatedCount; i++) {
        calls.push({
          pbx_call_id: `dry_${date}_${i}`,
          callstart: `${date} 12:00:00`,
          duration: 60,
          seconds: 60,
          disposition: 'answered',
          caller_id: '999',
          called_did: '100',
          sip: '101'
        });
      }
      // No incrementamos API_CALL_COUNT ni aplicamos sleeps en dry-run
    } else {
      console.log(`   📞 Consultando API para ${date}...`);
      const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      // Contamos la llamada y aplicamos throttling a nivel de script:
      // Hacemos 2 llamadas seguidas y luego esperamos 120s para respetar rate limit global.
      API_CALL_COUNT += 1;

      const response = await fetch(
        `${apiUrl}/api/zadarma/stats?startDate=${date}&endDate=${date}`
      );

      // Si alcanzamos un múltiplo de 2 llamadas, esperar 120s.
      if (API_CALL_COUNT > 0 && API_CALL_COUNT % 2 === 0) {
        console.log(`   ⚖️  Se alcanzaron ${API_CALL_COUNT} llamadas. Esperando 120 segundos para respetar rate limit...`);
        await sleep(120000);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'Error desconocido');
      }

      calls = data.stats || [];
    }
    console.log(`   💾 Guardando ${calls.length} llamadas en Firestore...`);

    // Guardar cada llamada. Si estamos en dry-run, saveCallToFirestore hará sólo prints.
    let savedCount = 0;
    if (calls.length > 0) process.stdout.write('    ');
    for (const call of calls) {
      await saveCallToFirestore(call);
      savedCount += 1;
      // Para no saturar la salida, cada 50 llamadas hacemos un pequeño avance
      if (savedCount % 50 === 0) process.stdout.write(`${savedCount}`);
    }
    if (calls.length > 0) process.stdout.write('\n');

    result.success = true;
    result.calls = calls.length;
    console.log(`   ✅ ${date}: ${calls.length} llamadas guardadas`);

  } catch (error: any) {
    result.success = false;
    result.error = error.message;
    console.error(`   ❌ ${date}: Error - ${error.message}`);
  }

  return result;
}

/**
 * Función principal de backfill
 */
async function backfill() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 ZADARMA BACKFILL - Población de Datos Históricos');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const options = parseArgs();
  const results: DayResult[] = [];

  // Activar modo dry-run globalmente si fue pedido (aceptamos flag, env var o npm config)
  DRY_RUN = !!options.dryRun
    || process.env.BACKFILL_DRY_RUN === '1'
    || process.env.DRY_RUN === '1'
    || process.env.npm_config_dry_run === 'true'
    || process.argv.join(' ').includes('--dry-run');

  // Determinar rango de fechas
  let datesToProcess: string[] = [];

  if (options.startDate && options.endDate) {
    // Rango específico
    const start = parseISO(options.startDate);
    const end = parseISO(options.endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i <= daysDiff; i++) {
      const date = format(subDays(end, daysDiff - i), 'yyyy-MM-dd');
      datesToProcess.push(date);
    }
  } else {
    // Últimos N días (sin incluir hoy)
    const days = options.days || 30;
    for (let i = 1; i <= days; i++) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      datesToProcess.push(date);
    }
  }

  console.log(`📅 Rango de fechas: ${datesToProcess[0]} → ${datesToProcess[datesToProcess.length - 1]}`);
  console.log(`📊 Total de días a procesar: ${datesToProcess.length}`);
  console.log(`⚡ Modo forzado: ${options.force ? 'SÍ (sobrescribirá datos)' : 'NO (omitirá días existentes)'}`);
  // Estimación basada en throttling: 2 llamadas -> 120s. Cada día hace 1 llamada, así que cada 2 días ~2 minutos.
  const estimatedSeconds = Math.ceil(datesToProcess.length / 2) * 120;
  console.log(`⏱️  Tiempo estimado: ~${Math.ceil(estimatedSeconds/60)} minutos (throttling: 2 llamadas -> 2 minutos)`);
  console.log('');
  console.log('⚠️  IMPORTANTE: No interrumpas este proceso. Respeta los rate limits.');
  console.log('');

  // Procesar cada día
  for (let i = 0; i < datesToProcess.length; i++) {
    const date = datesToProcess[i];
    const progress = ((i + 1) / datesToProcess.length * 100).toFixed(1);
    
    console.log(`[${i + 1}/${datesToProcess.length}] (${progress}%) Procesando: ${date}`);
    
    const result = await processDay(date, options.force || false);
    results.push(result);

    // Nota: el throttling se maneja dentro de processDay (contador API_CALL_COUNT).
    // No hacemos una espera fija aquí para evitar esperas duplicadas.
  }

  // Generar reporte final
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 REPORTE FINAL');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  const successful = results.filter(r => r.success && !r.skipped);
  const skipped = results.filter(r => r.skipped);
  const failed = results.filter(r => !r.success);
  const totalCalls = successful.reduce((sum, r) => sum + r.calls, 0);

  console.log(`✅ Días procesados correctamente: ${successful.length}`);
  console.log(`⏭️  Días omitidos (ya tenían datos): ${skipped.length}`);
  console.log(`❌ Días fallidos: ${failed.length}`);
  console.log(`📞 Total de llamadas guardadas: ${totalCalls}`);
  console.log('');

  if (failed.length > 0) {
    console.log('❌ Días con errores:');
    failed.forEach(r => {
      console.log(`   - ${r.date}: ${r.error}`);
    });
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎉 BACKFILL COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  process.exit(failed.length > 0 ? 1 : 0);
}

// Ejecutar backfill
backfill().catch((error) => {
  console.error('');
  console.error('💥 ERROR FATAL:',error);
  console.error('');
  process.exit(1);
});
