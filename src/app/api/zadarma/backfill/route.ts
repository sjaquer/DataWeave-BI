/**
 * API Endpoint para ejecutar Backfill de Zadarma
 * 
 * GET /api/zadarma/backfill?days=7
 * 
 * Propósito:
 * - Permitir ejecutar backfill desde el navegador
 * - No requiere credenciales locales
 * - Usa las credenciales de Vercel
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, subDays } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import CryptoJS from 'crypto-js';

const ZADARMA_API_KEY = process.env.ZADARMA_API_KEY!;
const ZADARMA_API_SECRET = process.env.ZADARMA_API_SECRET!;
const DEFAULT_TIMEZONE = 'America/Lima';

// Mapeo de agentes
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

/**
 * Genera firma HMAC para autenticación Zadarma
 */
function generateZadarmaSignature(method: string, params: Record<string, any>): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const message = `${method}/${paramString}`;
  return CryptoJS.HmacSHA1(message, ZADARMA_API_SECRET).toString(CryptoJS.enc.Base64);
}

/**
 * Llama a la API de Zadarma
 */
async function fetchZadarmaAPI(endpoint: string, params: Record<string, any>) {
  const signature = generateZadarmaSignature(endpoint, params);
  const queryString = new URLSearchParams(params).toString();
  const url = `https://api.zadarma.com${endpoint}?${queryString}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `${ZADARMA_API_KEY}:${signature}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Zadarma API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Obtiene llamadas de Zadarma
 */
async function getZadarmaCalls(startDate: Date, endDate: Date, timezone: string) {
  // Convertir a UTC para la API
  const startUTC = fromZonedTime(startDate, timezone);
  const endUTC = fromZonedTime(endDate, timezone);

  const params = {
    start: format(startUTC, "yyyy-MM-dd HH:mm:ss"),
    end: format(endUTC, "yyyy-MM-dd HH:mm:ss"),
  };

  console.log(`[BACKFILL] Consultando API: ${params.start} → ${params.end} (UTC)`);

  const data = await fetchZadarmaAPI('/v1/statistics/', params);
  return data.stats || [];
}

/**
 * Guarda una llamada en Firestore
 */
async function saveCallToFirestore(call: any, timezone: string) {
  try {
    // Usar call_id_with_rec o pbx_call_id como ID único
    const docId = call.call_id_with_rec || call.pbx_call_id;
    if (!docId) {
      console.warn('[BACKFILL] Llamada sin ID único, saltando:', call);
      return false;
    }

    // Convertir call_start a zona horaria local
    const callStartDate = toZonedTime(new Date(call.call_start), timezone);
    const callStartFormatted = format(callStartDate, 'yyyy-MM-dd HH:mm:ss');

    // Preparar datos
    const callData = {
      ...call,
      call_start: callStartFormatted,
      agent: AGENT_MAP[call.internal] || call.internal,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Guardar con merge (upsert)
    await db.collection('zadarma_calls').doc(docId).set(callData, { merge: true });
    return true;
  } catch (error) {
    console.error('[BACKFILL] Error guardando llamada:', error);
    return false;
  }
}

/**
 * Endpoint GET
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days') || '7';
    const days = parseInt(daysParam, 10);

    if (isNaN(days) || days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'El parámetro days debe ser un número entre 1 y 90' },
        { status: 400 }
      );
    }

    console.log(`[BACKFILL] Iniciando backfill de ${days} días...`);

    // Calcular rango de fechas
    const timezone = DEFAULT_TIMEZONE;
    const now = new Date();
    const endDate = toZonedTime(now, timezone);
    const startDate = subDays(endDate, days);

    console.log(`[BACKFILL] Rango: ${format(startDate, 'yyyy-MM-dd')} → ${format(endDate, 'yyyy-MM-dd')}`);

    // Obtener llamadas de Zadarma
    const calls = await getZadarmaCalls(startDate, endDate, timezone);
    console.log(`[BACKFILL] Llamadas obtenidas de API: ${calls.length}`);

    if (calls.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No hay llamadas en el rango especificado',
        data: {
          days,
          range: {
            start: format(startDate, 'yyyy-MM-dd'),
            end: format(endDate, 'yyyy-MM-dd'),
          },
          callsProcessed: 0,
          callsSaved: 0,
        },
      });
    }

    // Guardar en Firestore
    let savedCount = 0;
    for (const call of calls) {
      const saved = await saveCallToFirestore(call, timezone);
      if (saved) savedCount++;
    }

    console.log(`[BACKFILL] Guardadas en Firestore: ${savedCount}/${calls.length}`);

    return NextResponse.json({
      status: 'success',
      message: `Backfill completado: ${savedCount} llamadas guardadas`,
      data: {
        days,
        range: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
        },
        callsProcessed: calls.length,
        callsSaved: savedCount,
      },
    });
  } catch (error) {
    console.error('[BACKFILL] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
