
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { format } from 'date-fns';

/**
 * Endpoint para obtener estadísticas de llamadas desde la API de Zadarma.
 * Utiliza las credenciales almacenadas de forma segura en variables de entorno.
 */
export async function GET(req: Request) {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    console.error("Error: Las credenciales de la API de Zadarma no están configuradas en .env o están vacías.");
    return NextResponse.json({
      status: 'error',
      message: 'La configuración del servidor está incompleta. Faltan las credenciales de la API de Zadarma.'
    }, { status: 500 });
  }

  try {
    const method = '/v1/statistics/pbx/';
    const now = new Date();
    // Por defecto, obtenemos las estadísticas del día actual.
    const startDate = format(now, 'yyyy-MM-dd 00:00:00');
    const endDate = format(now, 'yyyy-MM-dd 23:59:59');

    const params: { [key: string]: string } = {
      start: startDate,
      end: endDate,
      format: 'json',
      version: '2' // Usamos la versión 2 que es la más reciente
    };
    
    // 1. Ordenar los parámetros alfabéticamente por clave.
    const sortedKeys = Object.keys(params).sort();
    
    // 2. Crear la cadena de consulta (query string).
    const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');

    // 3. Crear la cadena completa para la firma.
    const dataToSign = method + queryString + crypto.createHash('md5').update(queryString).digest('hex');
    
    // 4. Generar la firma HMAC-SHA1 y codificarla en Base64.
    const hmac = crypto.createHmac('sha1', ZADARMA_API_SECRET);
    hmac.update(dataToSign);
    const signature = hmac.digest('base64');

    // Construcción de la URL final para la petición.
    const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
    
    // Realización de la petición a la API de Zadarma
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `${ZADARMA_API_KEY}:${signature}`
      }
    });

    const data = await response.json();
    
    if (data.status === 'error' || !response.ok) {
        const errorMessage = data.message || `El servidor de Zadarma respondió con un error: ${response.statusText}`;
        console.error("Respuesta de error de la API de Zadarma:", errorMessage, data);
        // Devuelve un error más específico para que el frontend lo pueda manejar.
        return NextResponse.json({ status: 'error', message: `Error de Zadarma: ${errorMessage}` }, { status: response.status });
    }

    // Devolvemos las estadísticas encontradas. El campo `stats` contiene el array de llamadas.
    return NextResponse.json({ status: 'success', stats: data.stats || [] }, { status: 200 });

  } catch (error: any) {
    console.error('Error en el endpoint /api/zadarma/stats:', error);
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${error.message}` }, { status: 500 });
  }
}
