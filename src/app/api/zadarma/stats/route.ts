
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
// CORRECCIÓN: Se importan los nombres de función correctos para la versión actual de date-fns-tz
// Timezone imports removed - using Zadarma data directly without conversions
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  validateZadarmaCredentials,
  saveZadarmaCalls,
  getZadarmaCallsFromFirestore,
  hasDataForDateRange,
  saveSyncMetadata,
} from '@/lib/zadarma-helpers';

dotenv.config();

// Timezone constants removed - using Zadarma data directly

async function fetchZadarmaAPI(
  start: Date, // Se espera una fecha que representa la hora de Madrid
  end: Date,   // Se espera una fecha que representa la hora de Madrid
  apiKey: string,
  apiSecret: string
): Promise<any[]> {
  // La función format usará la representación local de la fecha, que ya está ajustada a Madrid
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
  
  // RETORNAR LOS DATOS TAL COMO LOS DA ZADARMA (SIN TOCAR NADA)
  return (data.stats || []);
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
    const forceRefresh = searchParams.get('forceRefresh') === 'true';

    if (!startDateQuery || !endDateQuery) {
        return NextResponse.json({ status: 'error', message: 'Los parámetros startDate y endDate son requeridos.' }, { status: 400 });
    }

    // USAR LAS FECHAS TAL COMO LAS ENVÍA EL USUARIO (SIN CONVERSIONES DE MIERDA)
    const startDate = parseISO(startDateQuery);
    const endDate = parseISO(endDateQuery);

    console.log('[ZADARMA DEBUG] Parámetros recibidos:');
    console.log('  startDateQuery:', startDateQuery);
    console.log('  endDateQuery:', endDateQuery);
    console.log('  startDate:', startDate.toISOString());
    console.log('  endDate:', endDate.toISOString());

    // 2. CACHÉ INTELIGENTE: Lógica basada en fechas
    const today = format(new Date(), 'yyyy-MM-dd');
    const isRequestingToday = format(startDate, 'yyyy-MM-dd') === today || format(endDate, 'yyyy-MM-dd') === today;
    
    if (!forceRefresh && !isRequestingToday) {
      // Solo usar caché para datos históricos (no de hoy)
      const hasCache = await hasDataForDateRange(startDate, endDate);
      
      if (hasCache) {
        console.log('[ZADARMA STATS] Usando datos históricos desde caché de Firestore');
        const cachedCalls = await getZadarmaCallsFromFirestore(startDate, endDate);
        
        console.log('[ZADARMA DEBUG] Datos de caché histórico:');
        console.log('  Total llamadas:', cachedCalls.length);
        console.log('  Rango de fechas:', format(startDate, 'yyyy-MM-dd'), 'a', format(endDate, 'yyyy-MM-dd'));
        
        return NextResponse.json({
          status: 'success',
          stats: cachedCalls,
          fromCache: true,
          totalCalls: cachedCalls.length,
          message: 'Datos históricos obtenidos desde caché de Firestore',
        });
      }
    }
    
    // Para datos de HOY o si no hay caché: usar API en tiempo real
    if (isRequestingToday) {
      console.log('[ZADARMA STATS] Datos de HOY detectados - usando API en tiempo real');
    } else {
      console.log('[ZADARMA STATS] No hay caché para datos históricos - consultando API');
    }

    console.log('[ZADARMA STATS] Obteniendo datos desde API de Zadarma');

    // 3. USAR LAS FECHAS DIRECTAMENTE SIN CONVERSIONES
    console.log('[ZADARMA DEBUG] Enviando a Zadarma:');
    console.log('  startDate:', startDate.toISOString());
    console.log('  endDate:', endDate.toISOString());
    
    // 4. Pedir los datos a Zadarma SIN conversiones de timezone
    const rawCalls = await fetchZadarmaAPI(startDate, endDate, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);

    console.log('[ZADARMA DEBUG] Datos de API:');
    console.log('  Total llamadas:', rawCalls.length);
    if (rawCalls.length > 0) {
      console.log('  Primera llamada:', rawCalls[0].callstart);
      console.log('  Última llamada:', rawCalls[rawCalls.length - 1].callstart);
      
      // Log de ejemplo simple sin conversiones
      const exampleCall = rawCalls[0];
      console.log('  Ejemplo de llamada:');
      console.log('    callstart:', exampleCall.callstart);
    }

    // 5. GUARDAR EN CACHÉ EN BACKGROUND (async, no bloquea respuesta)
    if (rawCalls.length > 0) {
      saveZadarmaCalls(rawCalls)
        .then(() => {
          // Guardar metadata de sincronización exitosa para hoy si consultamos solo hoy
          if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
            return saveSyncMetadata(startDate, rawCalls.length, 'success');
          }
        })
        .catch((err: any) => console.error('[AUTO-SYNC BKG] Error:', err));
    } else {
      // Si no hay llamadas, aún así marcar como sincronizado para evitar llamadas futuras innecesarias
      if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
        saveSyncMetadata(startDate, 0, 'success').catch((err: any) => console.error('[SYNC METADATA] Error:', err));
      }
    }

    return NextResponse.json({
      status: 'success',
      stats: rawCalls, // ✅ RETORNAR TODOS los datos sin consolidar
      fromCache: false,
      totalCalls: rawCalls.length,
      message: forceRefresh ? 
        'Datos actualizados desde API de Zadarma (force refresh)' : 
        isRequestingToday ? 
          'Datos en tiempo real desde API de Zadarma' : 
          'Datos históricos obtenidos desde API de Zadarma y guardados en caché',
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS FATAL ERROR]:', error);
    return NextResponse.json({ status: 'error', message: `Error fatal del servidor: ${error.message}` }, { status: 500 });
  }
}
