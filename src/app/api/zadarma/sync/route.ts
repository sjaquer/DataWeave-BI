
import { NextRequest, NextResponse } from 'next/server';
import { format, startOfDay } from 'date-fns';
import CryptoJS from 'crypto-js';
import {
  saveZadarmaCalls,
  saveSyncMetadata,
  validateZadarmaCredentials,
  getMissingDaysFromFirestore,
  setSyncLock,
  isSyncLocked,
  removeSyncLock,
  convertZadarmaCallToUTC,
} from '@/lib/zadarma-helpers';

const API_RETRY_DELAY_MS = 10000;
const API_REQUEST_DELAY_MS = 300;
const LOCK_TTL_MINUTES = 5;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchZadarmaForDay(date: Date, apiKey: string, apiSecret: string, retries = 1): Promise<any[]> {
  const start = startOfDay(date);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  
  const formattedStartDate = format(start, 'yyyy-MM-dd HH:mm:ss');
  const formattedEndDate = format(end, 'yyyy-MM-dd HH:mm:ss');
  
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
  
  try {
    const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });

    if (response.status === 429 && retries > 0) {
      await delay(API_RETRY_DELAY_MS);
      return fetchZadarmaForDay(date, apiKey, apiSecret, retries - 1);
    }
    
    const data = await response.json();
    if (data.status === 'error' || !response.ok) {
      throw new Error(data.message || `Error del servidor de Zadarma: ${response.statusText}`);
    }
    return data.stats || [];
  } catch (error) {
    console.error(`[ZADARMA SYNC] Error al obtener datos para ${format(date, 'yyyy-MM-dd')}:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({ status: 'error', message: credentialsCheck.message }, { status: 500 });
  }

  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  try {
    const body = await req.json();
    const { startDate: startDateQuery, endDate: endDateQuery } = body;

    if (!startDateQuery) {
      return NextResponse.json({ status: 'error', message: 'startDate es requerido' }, { status: 400 });
    }

    const rangeStart = startOfDay(new Date(startDateQuery));
    const rangeEnd = endDateQuery ? startOfDay(new Date(endDateQuery)) : rangeStart;

    const missingDays = await getMissingDaysFromFirestore(rangeStart, rangeEnd);
    
    if (missingDays.length === 0) {
      return NextResponse.json({ status: 'success', message: 'Todos los datos para el rango seleccionado ya existen en el caché.', totalCallsSynced: 0, }, { status: 200 });
    }
    
    let totalSyncedCalls = 0;
    const errors: string[] = [];

    for (const day of missingDays) {
      const dayStr = format(day, 'yyyy-MM-dd');
      try {
        if (await isSyncLocked(day, LOCK_TTL_MINUTES)) {
          continue;
        }
        await setSyncLock(day);
        
        const rawCalls = await fetchZadarmaForDay(day, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        
        if (rawCalls.length > 0) {
          // 🔧 CORRECCIÓN: Convertir zona horaria Madrid → UTC
          const callsInUTC = rawCalls.map((call: any) => convertZadarmaCallToUTC(call));
          
          // Guardar TODOS los datos sin consolidar
          const savedCount = await saveZadarmaCalls(callsInUTC);
          totalSyncedCalls += savedCount;
          await saveSyncMetadata(day, savedCount, 'success');
        } else {
          await saveSyncMetadata(day, 0, 'success');
        }
        await delay(API_REQUEST_DELAY_MS);
      } catch (error: any) {
        const errorMessage = `Fallo al sincronizar ${dayStr}: ${error.message}`;
        errors.push(errorMessage);
        await saveSyncMetadata(day, 0, 'error', error.message);
      } finally {
        await removeSyncLock(day);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ status: 'partial_error', message: `Sincronización completada con errores. ${totalSyncedCalls} llamadas guardadas.`, totalCallsSynced: totalSyncedCalls, errors, }, { status: 207 });
    }

    return NextResponse.json({ status: 'success', message: `Sincronización inteligente completada. ${totalSyncedCalls} nuevas llamadas guardadas.`, totalCallsSynced: totalSyncedCalls, }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ status: 'error', message: `Error fatal del servidor: ${error.message}` }, { status: 500 });
  }
}
