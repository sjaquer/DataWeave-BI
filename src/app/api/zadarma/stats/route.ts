
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, addDays } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  getZadarmaCallsFromFirestore,
  consolidateCalls,
  validateZadarmaCredentials,
} from '@/lib/zadarma-helpers';

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

    const start = startOfDay(new Date(startDateQuery));
    const end = startOfDay(new Date(endDateQuery));
    const today = startOfDay(new Date());

    let calls: any[] = [];
    let fromCache: boolean | 'mixed' = false;
    let message = '';

    const isTodayIncluded = end >= today;
    const pastEndDate = isTodayIncluded ? addDays(today, -1) : end;

    // --- LÓGICA DE FUSIÓN (CACHE + API) ---

    // 1. Obtener todos los días pasados del caché
    if (start <= pastEndDate) {
        const pastCalls = await getZadarmaCallsFromFirestore(start, pastEndDate);
        calls.push(...pastCalls);
        fromCache = true;
        console.log(`[ZADARMA STATS] ✅ Obtenidas ${pastCalls.length} llamadas históricas del caché.`);
    }

    // 2. Si se incluye hoy, obtener solo los datos de hoy de la API
    if (isTodayIncluded) {
        const todayCalls = await fetchZadarmaAPI(today, today, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        calls.push(...todayCalls);
        fromCache = fromCache === true ? 'mixed' : false; // Si ya teníamos datos del caché, es mixto
        console.log(`[ZADARMA STATS] 🌐 Obtenidas ${todayCalls.length} llamadas de hoy desde la API.`);
    }

    // 3. Disparar auto-sincronización en segundo plano para los días pasados (no bloquea la respuesta)
    if (start < today) {
        fetch(`${req.nextUrl.origin}/api/zadarma/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate: start.toISOString(), endDate: pastEndDate.toISOString() }),
        }).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
    }
    
    // 4. Determinar el mensaje final para el usuario
    if (fromCache === 'mixed') {
        message = 'Datos combinados: históricos desde caché y de hoy desde API.';
    } else if (fromCache === true) {
        message = 'Datos históricos obtenidos de caché.';
    } else {
        message = 'Datos en tiempo real obtenidos de API.';
    }

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
