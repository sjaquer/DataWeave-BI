
import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  getZadarmaCallsFromFirestore,
  hasDataForDateRange,
  getSyncMetadata,
  consolidateCalls,
  validateZadarmaCredentials,
} from '@/lib/zadarma-helpers';

dotenv.config();

/**
 * Función auxiliar para llamar a la API de Zadarma
 */
async function fetchZadarmaAPI(
  start: Date,
  end: Date,
  apiKey: string,
  apiSecret: string
): Promise<any[]> {
  const formattedStartDate = format(start, 'yyyy-MM-dd HH:mm:ss');
  const formattedEndDate = format(end, 'yyyy-MM-dd HH:mm:ss');
  
  const method = '/v1/statistics/pbx/';
  const params: { [key: string]: string } = {
    start: formattedStartDate,
    end: formattedEndDate,
    format: 'json',
    version: '2'
  };
  
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, params[key]));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const hmacHex = hmac.toString(CryptoJS.enc.Hex);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmacHex));
  
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
  
  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'Authorization': authHeader
    }
  });

  const data = await response.json();
  
  if (data.status === 'error' || !response.ok) {
    const errorMessage = data.message || `El servidor de Zadarma respondió con un error: ${response.statusText}`;
    console.error("[ZADARMA API ERROR]:", data);
    throw new Error(`Error de Zadarma: ${errorMessage}`);
  }

  return data.stats || [];
}

/**
 * Endpoint OPTIMIZADO para obtener estadísticas de llamadas de Zadarma.
 * 
 * 🚀 ESTRATEGIA DE CACHÉ INTELIGENTE POR FECHAS:
 * 
 * 1. **FECHAS PASADAS** (antes de hoy):
 *    - Solo lee de Firestore (caché)
 *    - NUNCA llama a la API para datos históricos
 *    - Si no hay datos en caché, retorna error pidiendo sincronización
 * 
 * 2. **FECHA DE HOY**:
 *    - Siempre llama a la API para datos frescos
 *    - Ignora caché (los datos cambian constantemente)
 * 
 * 3. **RANGOS MIXTOS** (incluye hoy + días pasados):
 *    - Lee fechas pasadas de Firestore
 *    - Llama a API solo para hoy
 *    - Combina ambos resultados
 * 
 * Parámetros de consulta:
 * - startDate: Fecha de inicio (ISO string)
 * - endDate: Fecha de fin (ISO string)
 * - forceRefresh: Forzar llamada a API incluso para fechas pasadas (opcional, default: false)
 */
export async function GET(req: Request) {
  // Validar credenciales
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({
      status: 'error',
      message: credentialsCheck.message,
    }, { status: 500 });
  }

  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    // Si no hay fecha de fin, usar la misma fecha de inicio
    const start = startDateQuery ? new Date(startDateQuery) : new Date();
    const end = endDateQuery ? new Date(endDateQuery) : new Date(start);

    // Normalizar fechas para comparación (solo día, sin hora)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const endDateOnly = new Date(end);
    endDateOnly.setHours(0, 0, 0, 0);
    
    const startDateOnly = new Date(start);
    startDateOnly.setHours(0, 0, 0, 0);

    // 🔥 CACHÉ INTELIGENTE: Determinar estrategia según las fechas
    const isEndToday = endDateOnly.getTime() === today.getTime();
    const isStartToday = startDateOnly.getTime() === today.getTime();
    const isPastOnly = endDateOnly < today;
    const isMixedRange = startDateOnly < today && endDateOnly >= today;

    console.log(`[ZADARMA STATS] Análisis de fechas:`, {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      today: format(today, 'yyyy-MM-dd'),
      isPastOnly,
      isEndToday,
      isStartToday,
      isMixedRange,
      forceRefresh,
    });

    // CASO 1: Solo fechas pasadas - CACHÉ O API COMO FALLBACK
    if (isPastOnly && !forceRefresh) {
      console.log(`[ZADARMA STATS] ✅ Fechas pasadas detectadas - Intentando leer de Firestore (caché)`);
      
      const hasData = await hasDataForDateRange(start, end);
      
      if (hasData) {
        // Si hay datos en caché, usarlos
        const calls = await getZadarmaCallsFromFirestore(start, end);
        const metadata = await getSyncMetadata(start, end);
        const consolidatedCalls = consolidateCalls(calls);
        
        console.log(`[ZADARMA STATS] ✅ ${consolidatedCalls.length} llamadas obtenidas de Firestore`);
        
        return NextResponse.json({
          status: 'success',
          stats: consolidatedCalls,
          fromCache: true,
          dataSource: 'firestore-only',
          lastSync: metadata?.lastSyncTimestamp?.toDate().toISOString(),
          totalCalls: consolidatedCalls.length,
          message: '✅ Datos históricos obtenidos de caché (Firestore)',
        }, { status: 200 });
      }
      
      // Si NO hay datos en caché, llamar a la API como fallback
      console.log(`[ZADARMA STATS] ⚠️ No hay datos en caché - Llamando a API como fallback`);
      
      try {
        const apiCalls = await fetchZadarmaAPI(start, end, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        const consolidatedCalls = consolidateCalls(apiCalls);
        
        console.log(`[ZADARMA STATS] ✅ ${consolidatedCalls.length} llamadas obtenidas de API`);

        return NextResponse.json({ 
          status: 'success', 
          stats: consolidatedCalls,
          fromCache: false,
          dataSource: 'api-fallback',
          totalCalls: consolidatedCalls.length,
          message: `⚠️ Datos obtenidos de API (no había caché para ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}). Considere sincronizar con "Guardar en DB".`,
        }, { status: 200 });
      } catch (apiError: any) {
        console.error(`[ZADARMA STATS] ❌ Error al llamar API:`, apiError);
        return NextResponse.json({
          status: 'error',
          message: `No hay datos en caché y falló la llamada a API: ${apiError.message}`,
          fromCache: false,
        }, { status: 500 });
      }
    }

    // CASO 2: Rango mixto (pasado + hoy) - COMBINAR CACHÉ + API
    if (isMixedRange && !forceRefresh) {
      console.log(`[ZADARMA STATS] 🔄 Rango mixto detectado - Combinando Firestore (histórico) + API (hoy)`);
      
      // Leer datos pasados de Firestore
      const pastEnd = new Date(today);
      pastEnd.setDate(pastEnd.getDate() - 1);
      pastEnd.setHours(23, 59, 59, 999);
      
      const pastCalls = await getZadarmaCallsFromFirestore(start, pastEnd);
      console.log(`[ZADARMA STATS] 📦 Obtenidas ${pastCalls.length} llamadas históricas de Firestore`);
      
      // Llamar a API solo para hoy
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      
      const todayEnd = new Date(end);
      todayEnd.setHours(23, 59, 59, 999);
      
      const todayCallsFromAPI = await fetchZadarmaAPI(todayStart, todayEnd, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
      console.log(`[ZADARMA STATS] 🌐 Obtenidas ${todayCallsFromAPI.length} llamadas de hoy desde API`);
      
      // Combinar y consolidar
      const allCalls = [...pastCalls, ...todayCallsFromAPI];
      const consolidatedCalls = consolidateCalls(allCalls);
      
      return NextResponse.json({
        status: 'success',
        stats: consolidatedCalls,
        fromCache: 'mixed',
        dataSource: 'firestore+api',
        totalCalls: consolidatedCalls.length,
        breakdown: {
          historicalCalls: pastCalls.length,
          todayCalls: todayCallsFromAPI.length,
          consolidated: consolidatedCalls.length,
        },
        message: '✅ Datos combinados: históricos desde caché + hoy desde API',
      }, { status: 200 });
    }

    // CASO 3: Solo hoy o forceRefresh - LLAMAR API
    if (isEndToday || forceRefresh) {
      const reason = forceRefresh ? 'forceRefresh activado' : 'fecha de hoy';
      console.log(`[ZADARMA STATS] 🌐 Llamando a API de Zadarma (${reason})`);
      
      const apiCalls = await fetchZadarmaAPI(start, end, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
      const consolidatedCalls = consolidateCalls(apiCalls);

      return NextResponse.json({ 
        status: 'success', 
        stats: consolidatedCalls,
        fromCache: false,
        dataSource: 'api-only',
        totalCalls: consolidatedCalls.length,
        message: `✅ Datos frescos obtenidos de API (${reason})`,
      }, { status: 200 });
    }

    // CASO 4: Fallback - Intentar caché
    if (!forceRefresh) {
      const hasData = await hasDataForDateRange(start, end);
      
      if (hasData) {
        console.log(`[ZADARMA STATS] 📦 Leyendo de Firestore (fallback)`);
        
        const calls = await getZadarmaCallsFromFirestore(start, end);
        const metadata = await getSyncMetadata(start, end);
        const consolidatedCalls = consolidateCalls(calls);
        
        return NextResponse.json({
          status: 'success',
          stats: consolidatedCalls,
          fromCache: true,
          dataSource: 'firestore-fallback',
          lastSync: metadata?.lastSyncTimestamp?.toDate().toISOString(),
          totalCalls: consolidatedCalls.length,
        }, { status: 200 });
      }
    }

    // Si no hay datos en caché o se fuerza refresh, llamar a la API
    console.log(`[ZADARMA STATS] 🌐 Llamando a API de Zadarma (fallback final)`);

    try {
      const apiCalls = await fetchZadarmaAPI(start, end, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
      const consolidatedCalls = consolidateCalls(apiCalls);

      return NextResponse.json({ 
        status: 'success', 
        stats: consolidatedCalls,
        fromCache: false,
        dataSource: 'api-final-fallback',
        totalCalls: consolidatedCalls.length,
        message: '✅ Datos obtenidos de API. Use POST /api/zadarma/sync para guardar en Firestore.',
      }, { status: 200 });
    } catch (apiError: any) {
      return NextResponse.json({
        status: 'error',
        message: apiError.message,
        fromCache: false,
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error en el endpoint /api/zadarma/stats:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: `Error interno del servidor: ${error.message}`,
      fromCache: false,
    }, { status: 500 });
  }
}

