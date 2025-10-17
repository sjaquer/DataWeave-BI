/**
 * 🤖 CRON JOB: Sincronización Automática Diaria de Zadarma
 * 
 * Este endpoint se ejecuta automáticamente cada día a la 1:00 AM (horario del servidor)
 * para sincronizar los datos del día anterior desde la API de Zadarma a Firestore.
 * 
 * Configuración en vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/zadarma-daily-sync",
 *     "schedule": "0 1 * * *"
 *   }]
 * }
 * 
 * IMPORTANTE:
 * - Solo se ejecuta en producción con CRON_SECRET válido
 * - Sincroniza automáticamente el día anterior (completo)
 * - Permite sincronización manual con parámetros de fecha
 * 
 * Endpoint: GET /api/cron/zadarma-daily-sync
 * Headers: Authorization: Bearer <CRON_SECRET>
 * Query params (opcionales):
 * - date: Fecha específica a sincronizar (ISO string, default: ayer)
 * - daysBack: Número de días atrás a sincronizar (default: 1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { format, subDays } from 'date-fns';
import CryptoJS from 'crypto-js';
import {
  saveZadarmaCalls,
  saveSyncMetadata,
  validateZadarmaCredentials,
  hasDataForDateRange,
} from '@/lib/zadarma-helpers';

export async function GET(req: NextRequest) {
  try {
    // 🔐 SEGURIDAD: Validar que el cron job es legítimo (solo en producción)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production') {
      if (!cronSecret) {
        console.error('[CRON] CRON_SECRET no configurado en variables de entorno');
        return NextResponse.json({
          status: 'error',
          message: 'Configuración de seguridad incompleta'
        }, { status: 500 });
      }

      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        console.error('[CRON] Intento de acceso no autorizado al cron job');
        return NextResponse.json({
          status: 'error',
          message: 'No autorizado'
        }, { status: 401 });
      }
    }

    // Validar credenciales de Zadarma
    const credentialsCheck = validateZadarmaCredentials();
    if (!credentialsCheck.valid) {
      return NextResponse.json({
        status: 'error',
        message: credentialsCheck.message,
      }, { status: 500 });
    }

    const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

    // Determinar qué fecha sincronizar
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const daysBackParam = searchParams.get('daysBack');

    let targetDate: Date;

    if (dateParam) {
      // Sincronizar fecha específica
      targetDate = new Date(dateParam);
      console.log(`[CRON] Sincronización manual para fecha: ${format(targetDate, 'yyyy-MM-dd')}`);
    } else {
      // Por defecto: sincronizar el día anterior
      const daysBack = daysBackParam ? parseInt(daysBackParam) : 1;
      targetDate = subDays(new Date(), daysBack);
      console.log(`[CRON] Sincronización automática para ayer: ${format(targetDate, 'yyyy-MM-dd')}`);
    }

    // Configurar rango del día completo
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    // Verificar si ya existen datos (skip si ya fue sincronizado)
    const hasData = await hasDataForDateRange(startDate, endDate);
    if (hasData) {
      console.log(`[CRON] ⏭️ Datos ya existen para ${format(targetDate, 'yyyy-MM-dd')}, omitiendo sincronización`);
      return NextResponse.json({
        status: 'success',
        message: `Datos ya sincronizados para ${format(targetDate, 'yyyy-MM-dd')}`,
        skipped: true,
        date: format(targetDate, 'yyyy-MM-dd'),
      }, { status: 200 });
    }

    console.log(`[CRON] 🔄 Iniciando sincronización para ${format(targetDate, 'yyyy-MM-dd')}`);

    // Preparar llamada a API de Zadarma
    const formattedStartDate = format(startDate, 'yyyy-MM-dd HH:mm:ss');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd HH:mm:ss');
    
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
    
    const authHeader_Zadarma = `${ZADARMA_API_KEY}:${signature}`;
    const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
    
    // Llamar a API de Zadarma
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader_Zadarma
      }
    });

    const data = await response.json();
    
    if (data.status === 'error' || !response.ok) {
      const errorMessage = data.message || `El servidor de Zadarma respondió con un error: ${response.statusText}`;
      console.error("[CRON ERROR]:", data);
      
      await saveSyncMetadata(startDate, endDate, 0, 'error', errorMessage);
      
      return NextResponse.json({
        status: 'error',
        message: `Error de Zadarma: ${errorMessage}`,
        date: format(targetDate, 'yyyy-MM-dd'),
      }, { status: response.status });
    }

    const calls = data.stats || [];
    console.log(`[CRON] 📥 Recibidas ${calls.length} llamadas de la API`);

    // Guardar en Firestore
    const savedCount = await saveZadarmaCalls(calls);
    console.log(`[CRON] ✅ Guardadas ${savedCount} llamadas en Firestore`);

    // Guardar metadata de sincronización
    await saveSyncMetadata(startDate, endDate, savedCount, 'success');

    return NextResponse.json({
      status: 'success',
      message: `✅ Sincronización completada para ${format(targetDate, 'yyyy-MM-dd')}`,
      totalCallsSynced: savedCount,
      date: format(targetDate, 'yyyy-MM-dd'),
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[CRON ERROR]:', error);
    return NextResponse.json({
      status: 'error',
      message: `Error interno del servidor: ${error.message}`
    }, { status: 500 });
  }
}

// También permitir POST para compatibilidad con algunos servicios de cron
export async function POST(req: NextRequest) {
  return GET(req);
}
