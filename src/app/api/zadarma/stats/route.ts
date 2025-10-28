
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  consolidateCalls,
  validateZadarmaCredentials,
  saveZadarmaCalls,
  hasDataForDateRange,
  getZadarmaCallsFromFirestore,
  getLastSyncedHour,
  fetchZadarmaAdaptive,
} from '@/lib/zadarma-helpers';

dotenv.config();

async function fetchZadarmaAPI(
  start: Date,
  end: Date,
  apiKey: string,
  apiSecret: string,
  skipConversion = true // Por defecto devolvemos datos raw sin conversión
): Promise<any[]> {
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
  
  const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });

  if (!response.ok) throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(`Error de API de Zadarma: ${data.message}`);
  
  // Devolver datos raw tal como vienen de la API, sin ninguna conversión de zona horaria
  return (data.stats || []).map((call: any) => ({
    ...call,
    callstart: call.callstart,
  }));
}

export async function GET(req: NextRequest) {
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({ status: 'error', message: credentialsCheck.message }, { status: 500 });
  }

  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  try {
    console.log('[ZADARMA STATS] Request received');
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    if (!startDateQuery || !endDateQuery) {
        return NextResponse.json({ status: 'error', message: 'Los parámetros startDate y endDate son requeridos.' }, { status: 400 });
    }

    console.log('[ZADARMA STATS] Parsing dates:', { startDateQuery, endDateQuery });
    const startDate = startOfDay(parseISO(startDateQuery));
    const endDate = endOfDay(parseISO(endDateQuery));
    const skipSave = searchParams.get('skipSave') === 'true' || searchParams.get('skip_save') === 'true' || searchParams.get('noSave') === 'true';
    const today = startOfDay(new Date());

    // Verificar si tenemos datos en caché (Firestore) para el rango solicitado
    console.log('[ZADARMA STATS] Checking cache for date range');
    const hasHistoricalData = await hasDataForDateRange(startDate, endDate);
    const isRequestingToday = startOfDay(endDate).getTime() === today.getTime();
    console.log('[ZADARMA STATS] Cache check result:', { hasHistoricalData, isRequestingToday });
    
    let finalStats: any[] = [];
    let dataSource: boolean | 'mixed' = false;

    if (hasHistoricalData && !isRequestingToday) {
      // Datos históricos completos disponibles en caché
      finalStats = await getZadarmaCallsFromFirestore(startDate, endDate);
      dataSource = true;
    } else if (hasHistoricalData && isRequestingToday) {
      // Modo mixto inteligente: datos históricos del caché + sincronización desde última hora
      const historicalEnd = startOfDay(today);
      const historicalData = startDate < historicalEnd ? 
        await getZadarmaCallsFromFirestore(startDate, new Date(historicalEnd.getTime() - 1)) : [];
      
      // Determinar desde qué hora sincronizar para evitar redundancia
      console.log('[ZADARMA STATS] Getting last synced hour');
      const lastSyncedHour = await getLastSyncedHour(today);
      let syncStartTime = today;
      console.log('[ZADARMA STATS] Last synced hour:', lastSyncedHour);
      
      if (lastSyncedHour) {
        // Sincronizar desde la hora siguiente a la última guardada (con 1h de overlap por seguridad)
        syncStartTime = new Date(lastSyncedHour.getTime() + 60 * 60 * 1000); // +1 hora
        // Pero asegurar que no retrocedamos antes del inicio del día
        if (syncStartTime < today) syncStartTime = today;
      }
      
      // Obtener datos nuevos desde la API usando fetch adaptativo
      console.log('[ZADARMA STATS] Fetching new data from API:', { syncStartTime, endDate });
      const todayData = syncStartTime <= endDate ? 
        await fetchZadarmaAdaptive(syncStartTime, endDate, ZADARMA_API_KEY!, ZADARMA_API_SECRET!) : [];
      console.log('[ZADARMA STATS] API fetch result:', todayData.length, 'calls');
      
      // Obtener también datos ya guardados de hoy para evitar huecos
      const todayCachedData = await getZadarmaCallsFromFirestore(today, endDate);
      
      // Combinar todos los datos y deduplicar por pbx_call_id + callstart
      const allData = [...historicalData, ...todayCachedData, ...consolidateCalls(todayData)];
      const deduplicatedMap = new Map<string, any>();
      
      for (const call of allData) {
        const key = `${call.pbx_call_id}__${call.callstart}`;
        if (!deduplicatedMap.has(key)) {
          deduplicatedMap.set(key, call);
        }
      }
      
      finalStats = Array.from(deduplicatedMap.values()).sort((a, b) => (a.callstart || '').localeCompare(b.callstart || ''));
      dataSource = 'mixed';
      
      // Guardar datos nuevos si los hay y no se especifica skipSave
      if (todayData.length > 0 && !skipSave) {
        saveZadarmaCalls(consolidateCalls(todayData)).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
      }
    } else {
      // No hay datos en caché, obtener todo desde la API usando fetch adaptativo
      const apiData = await fetchZadarmaAdaptive(startDate, endDate, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
      finalStats = consolidateCalls(apiData); // consolidateCalls ya ordena internamente
      dataSource = false;
      
      // Guardar datos obtenidos si no se especifica skipSave
      if (finalStats.length > 0 && !skipSave) {
        saveZadarmaCalls(finalStats).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
      }
    }

    // METADATOS ADICIONALES para mejorar la información
    const metadata = {
      totalCalls: finalStats.length,
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      agents: [...new Set(finalStats.map(call => call.sip))].length,
      callTypes: {
        outbound: finalStats.filter(call => String(call.destination || '').length >= 5).length,
        answered: finalStats.filter(call => call.disposition === 'answered').length,
        effectiveness: finalStats.length > 0 ? 
          (finalStats.filter(call => call.disposition === 'answered').length / finalStats.filter(call => String(call.destination || '').length >= 5).length * 100).toFixed(1) + '%' : '0%'
      },
      timeRange: finalStats.length > 0 ? {
        first: finalStats[0]?.callstart || null,
        last: finalStats[finalStats.length - 1]?.callstart || null
      } : null,
      processed: new Date().toISOString()
    };

    return NextResponse.json({
      status: 'success',
      stats: finalStats,
      fromCache: dataSource,
      metadata,
      message: dataSource === 'mixed' ? 
        `Datos combinados: históricos desde caché + hoy desde API. ${metadata.totalCalls} llamadas procesadas.` :
        dataSource ? 
        `Datos obtenidos desde caché histórico. ${metadata.totalCalls} llamadas recuperadas.` : 
        `Datos obtenidos desde API y guardados en caché. ${metadata.totalCalls} llamadas procesadas.`,
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS FATAL ERROR]:', error);
    console.error('[ZADARMA STATS STACK]:', error.stack);
    return NextResponse.json({ 
      status: 'error', 
      message: `Error fatal del servidor: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
