import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';

dotenv.config();

/**
 * Endpoint para obtener estadísticas de llamadas desde la API de Zadarma.
 * Acepta parámetros de consulta 'startDate' y 'endDate' (en formato ISO).
 */
export async function GET(req: Request) {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    console.error("Error: Las credenciales de la API de Zadarma no están configuradas en .env.");
    return NextResponse.json({
      status: 'error',
      message: 'La configuración del servidor está incompleta. Faltan las credenciales de la API.'
    }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    // CORRECCIÓN: Usar las fechas proporcionadas. Usar hoy solo como fallback.
    const start = startDateQuery ? new Date(startDateQuery) : new Date();
    const end = endDateQuery ? new Date(endDateQuery) : new Date();

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
    
    const hmac = CryptoJS.HmacSHA1(dataToSign, ZADARMA_API_SECRET);
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
        return NextResponse.json({ status: 'error', message: `Error de Zadarma: ${errorMessage}` }, { status: response.status });
    }

    return NextResponse.json({ status: 'success', stats: data.stats || [] }, { status: 200 });

  } catch (error: any) {
    console.error('Error en el endpoint /api/zadarma/stats:', error);
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${error.message}` }, { status: 500 });
  }
}
