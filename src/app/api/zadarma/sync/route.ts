/**
 * Endpoint para sincronizar datos de Zadarma desde la API a Firestore
 * POST /api/zadarma/sync
 * 
 * Este endpoint:
 * 1. Llama a la API de Zadarma para obtener datos del rango de fechas
 * 2. Guarda los datos en Firestore
 * 3. Retorna estadísticas de la sincronización
 * 
 * Parámetros:
 * - startDate: Fecha de inicio (ISO string)
 * - endDate: Fecha de fin (ISO string)
 * - forceSync: Forzar sincronización aunque ya existan datos (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import CryptoJS from 'crypto-js';
import {
  saveZadarmaCalls,
  saveSyncMetadata,
  hasDataForDateRange,
  getSyncMetadata,
  validateZadarmaCredentials,
} from '@/lib/zadarma-helpers';

export async function POST(req: NextRequest) {
  try {
    // Validar credenciales
    const credentialsCheck = validateZadarmaCredentials();
    if (!credentialsCheck.valid) {
      return NextResponse.json({
        status: 'error',
        message: credentialsCheck.message,
      }, { status: 500 });
    }

    const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

    // Parsear body
    const body = await req.json();
    const { startDate: startDateQuery, endDate: endDateQuery, forceSync = false } = body;

    if (!startDateQuery) {
      return NextResponse.json({
        status: 'error',
        message: 'Se requiere el parámetro startDate',
      }, { status: 400 });
    }

    const start = new Date(startDateQuery);
    const end = endDateQuery ? new Date(endDateQuery) : new Date(start);

    // Verificar si ya existen datos para este rango (a menos que sea forceSync)
    if (!forceSync) {
      const hasData = await hasDataForDateRange(start, end);
      if (hasData) {
        const metadata = await getSyncMetadata(start, end);
        return NextResponse.json({
          status: 'success',
          message: 'Los datos ya existen en Firestore. Use forceSync=true para actualizar.',
          fromCache: true,
          lastSync: metadata?.lastSyncTimestamp?.toDate().toISOString(),
          totalCalls: metadata?.totalCallsSynced || 0,
        }, { status: 200 });
      }
    }

    console.log(`[ZADARMA SYNC] Iniciando sincronización: ${format(start, 'yyyy-MM-dd')} - ${format(end, 'yyyy-MM-dd')}`);

    // Preparar llamada a API de Zadarma
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
    
    // Llamar a API de Zadarma
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader
      }
    });

    const data = await response.json();
    
    if (data.status === 'error' || !response.ok) {
      const errorMessage = data.message || `El servidor de Zadarma respondió con un error: ${response.statusText}`;
      console.error("[ZADARMA SYNC ERROR]:", data);
      
      await saveSyncMetadata(start, end, 0, 'error', errorMessage);
      
      return NextResponse.json({
        status: 'error',
        message: `Error de Zadarma: ${errorMessage}`
      }, { status: response.status });
    }

    const calls = data.stats || [];
    console.log(`[ZADARMA SYNC] Recibidas ${calls.length} llamadas de la API`);

    // Guardar en Firestore
    const savedCount = await saveZadarmaCalls(calls);
    console.log(`[ZADARMA SYNC] Guardadas ${savedCount} llamadas en Firestore`);

    // Guardar metadata de sincronización
    await saveSyncMetadata(start, end, savedCount, 'success');

    return NextResponse.json({
      status: 'success',
      message: `Sincronización completada: ${savedCount} llamadas guardadas`,
      totalCallsSynced: savedCount,
      dateRange: {
        start: format(start, 'yyyy-MM-dd'),
        end: format(end, 'yyyy-MM-dd'),
      },
      fromCache: false,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[ZADARMA SYNC ERROR]:', error);
    return NextResponse.json({
      status: 'error',
      message: `Error interno del servidor: ${error.message}`
    }, { status: 500 });
  }
}
