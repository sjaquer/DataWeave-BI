
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, addDays, differenceInCalendarDays, getHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  getZadarmaCallsFromFirestore,
  consolidateCalls,
  validateZadarmaCredentials,
  updateZadarmaCallsInFirestore, // Importar la función para actualizar
} from '@/lib/zadarma-helpers';

const LIMA_TIME_ZONE = 'America/Lima';
const RESYNC_THRESHOLD_HOUR = 23; // 11 PM

dotenv.config();

async function fetchZadarmaAPI(
  start: Date,
  end: Date,
  apiKey: string,
  apiSecret: string
): Promise<any[]> {
  const formattedStartDate = format(start, 'yyyy-MM-dd HH:mm:ss');
  const fullEndDate = new Date(end);
  fullEndDate.setHours(23, 59, 59, 999);
  const formattedEndDate = format(fullEndDate, 'yyyy-MM-dd HH:mm:ss');
  
  const method = '/v1/statistics/pbx/';
  const params = { start: formattedStartDate, end: formattedEndDate, format: 'json', version: '2' };
  
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, (params as any)[key]));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmac.toString(CryptoJS.enc.Hex)));
  
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
  
  const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });

  if (!response.ok) {
      throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(`Error de API de Zadarma: ${data.message}`);
  }
  return data.stats || [];
}

export async function GET(req: NextRequest) {
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({ status: 'error', message: credentialsCheck.message }, { status: 500 });
  }

  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    if (!startDateQuery || !endDateQuery) {
        return NextResponse.json({ status: 'error', message: 'Los parámetros startDate y endDate son requeridos.' }, { status: 400 });
    }

    const limaDate = toZonedTime(new Date(), LIMA_TIME_ZONE);
    const today = startOfDay(limaDate);
    
    const start = startOfDay(new Date(startDateQuery));
    const end = startOfDay(new Date(endDateQuery));

    let calls: any[] = [];
    let fromCache: boolean | 'mixed' = false;
    let message = '';

    const isTodayIncluded = end >= today;
    const pastEndDate = isTodayIncluded ? addDays(today, -1) : end;

    // 1. Obtener datos pasados del caché
    if (start <= pastEndDate) {
        calls = await getZadarmaCallsFromFirestore(start, pastEndDate);
        fromCache = true;

        // *** NUEVA REGLA DE VERIFICACIÓN AUTOMÁTICA ***
        const isSinglePastDay = differenceInCalendarDays(end, start) === 0;
        if (isSinglePastDay && calls.length > 0) {
            const lastCallUTC = new Date(calls.reduce((max, call) => call.callstart > max ? call.callstart : max, calls[0].callstart));
            const lastCallLima = toZonedTime(lastCallUTC, LIMA_TIME_ZONE);

            if (getHours(lastCallLima) < RESYNC_THRESHOLD_HOUR) {
                message = 'Caché de día pasado incompleto detectado. Forzando resincronización... ';
                console.log(`[AUTO-HEAL]: Incomplete cache for ${format(start, 'yyyy-MM-dd')}. Last call at ${format(lastCallLima, 'HH:mm')}. Fetching fresh data.`);

                const freshCalls = await fetchZadarmaAPI(start, start, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
                await updateZadarmaCallsInFirestore(freshCalls, start);
                calls = freshCalls; // Usar los datos frescos
                message += '¡Caché actualizado! ';
            }
        }
    }

    // 2. Si se incluye hoy, obtener solo los datos de hoy de la API
    if (isTodayIncluded) {
        const todayCalls = await fetchZadarmaAPI(today, today, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        if (fromCache) {
          calls.push(...todayCalls);
          fromCache = 'mixed';
        } else {
          calls = todayCalls;
        }
    }

    // 3. Disparar auto-sincronización en segundo plano para los días pasados (si no se forzó ya)
    if (start < today && !message.includes('Forzando resincronización')) {
        fetch(`${req.nextUrl.origin}/api/zadarma/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: start.toISOString(), endDate: pastEndDate.toISOString() }),
        }).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
    }
    
    // 4. Determinar el mensaje final
    if (fromCache === 'mixed') message += 'Datos combinados: históricos desde caché y de hoy desde API.';
    else if (fromCache === true) message += 'Datos históricos obtenidos de caché.';
    else message = 'Datos en tiempo real obtenidos de API.';

    return NextResponse.json({
      status: 'success',
      stats: consolidateCalls(calls),
      fromCache,
      message,
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS FATAL ERROR]:', error);
    return NextResponse.json({ status: 'error', message: `Error fatal del servidor: ${error.message}` }, { status: 500 });
  }
}
