
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
 * Endpoint OPTIMIZADO para obtener estadísticas de llamadas de Zadarma.
 * 
 * Estrategia de caché inteligente:
 * 1. Primero busca datos en Firestore (caché)
 * 2. Si no hay datos O se fuerza refresh, llama a la API de Zadarma
 * 3. Retorna datos con indicador de fuente (cache/api)
 * 
 * Parámetros de consulta:
 * - startDate: Fecha de inicio (ISO string)
 * - endDate: Fecha de fin (ISO string)
 * - forceRefresh: Forzar llamada a API (opcional, default: false)
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

    // 🔥 OPTIMIZACIÓN: Intentar leer de Firestore primero
    if (!forceRefresh) {
      const hasData = await hasDataForDateRange(start, end);
      
      if (hasData) {
        console.log(`[ZADARMA STATS] Leyendo de Firestore (caché) para ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);
        
        const calls = await getZadarmaCallsFromFirestore(start, end);
        const metadata = await getSyncMetadata(start, end);
        
        // Consolidar llamadas duplicadas
        const consolidatedCalls = consolidateCalls(calls);
        
        return NextResponse.json({
          status: 'success',
          stats: consolidatedCalls,
          fromCache: true,
          lastSync: metadata?.lastSyncTimestamp?.toDate().toISOString(),
          totalCalls: consolidatedCalls.length,
        }, { status: 200 });
      }
    }

    // Si no hay datos en caché o se fuerza refresh, llamar a la API
    console.log(`[ZADARMA STATS] Llamando a API de Zadarma para ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);


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
    
    const hmac = CryptoJS.HmacSHA1(dataToSign, ZADARMA_API_SECRET!);
    const hmacHex = hmac.toString(CryptoJS.enc.Hex);

    const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmacHex));
    
    const authHeader = `${ZADARMA_API_KEY}:${signature}`;

    const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    const data = await response.json();
    
    console.log('[ZADARMA API RESPONSE]:', JSON.stringify(data, null, 2));

    if (data.status === 'error' || !response.ok) {
        const errorMessage = data.message || `El servidor de Zadarma respondió con un error: ${response.statusText}`;
        console.error("Respuesta de error de la API de Zadarma:", data);
        return NextResponse.json({ 
          status: 'error', 
          message: `Error de Zadarma: ${errorMessage}`,
          fromCache: false,
        }, { status: response.status });
    }

    const apiCalls = data.stats || [];
    
    // Consolidar llamadas duplicadas
    const consolidatedCalls = consolidateCalls(apiCalls);

    // 🔥 NOTA: No guardamos automáticamente en Firestore desde GET
    // Para eso usar el endpoint POST /api/zadarma/sync
    // Esto mantiene separadas las responsabilidades

    return NextResponse.json({ 
      status: 'success', 
      stats: consolidatedCalls,
      fromCache: false,
      totalCalls: consolidatedCalls.length,
      message: 'Datos obtenidos directamente de la API. Use POST /api/zadarma/sync para guardar en Firestore.',
    }, { status: 200 });

  } catch (error: any) {
    console.error('Error en el endpoint /api/zadarma/stats:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: `Error interno del servidor: ${error.message}`,
      fromCache: false,
    }, { status: 500 });
  }
}

