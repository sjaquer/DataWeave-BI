import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';

dotenv.config();

/**
 * Endpoint para obtener estadísticas de llamadas desde la API de Zadarma.
 * Recrea la lógica de autenticación del cliente de Python.
 */
export async function GET() {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    console.error("Error: Las credenciales de la API de Zadarma no están configuradas en .env.");
    return NextResponse.json({
      status: 'error',
      message: 'La configuración del servidor está incompleta. Faltan las credenciales de la API.'
    }, { status: 500 });
  }

  try {
    const method = '/v1/statistics/pbx/';
    const now = new Date();
    const startDate = format(now, 'yyyy-MM-dd 00:00:00');
    const endDate = format(now, 'yyyy-MM-dd 23:59:59');

    const params: { [key: string]: string } = {
      start: startDate,
      end: endDate,
      format: 'json',
      version: '2'
    };
    
    // 1. Ordenar los parámetros alfabéticamente por clave.
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = new URLSearchParams();
    sortedKeys.forEach(key => sortedParams.append(key, params[key]));
    const queryString = sortedParams.toString();

    // 2. Crear la cadena para la firma.
    const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
    const dataToSign = method + queryString + md5Hash;
    
    // 3. Generar la firma HMAC-SHA1.
    const hmac = CryptoJS.HmacSHA1(dataToSign, ZADARMA_API_SECRET);
    const hmacHex = hmac.toString(CryptoJS.enc.Hex);

    // 4. Codificar la firma en Base64.
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
    
    // *** AÑADIDO PARA DEPURACIÓN ***
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
