// /src/app/api/webhooks/sheets/route.ts
import { NextResponse } from 'next/server';

/**
 * Endpoint para recibir actualizaciones de datos desde Google Sheets.
 * El Google Apps Script enviará una petición POST a esta ruta con los datos
 * de los pedidos confirmados.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Verificación de que los datos tienen la estructura esperada
    if (body && body.logisticsData && Array.isArray(body.logisticsData)) {
      const recordCount = body.logisticsData.length;
      
      // Log detallado para confirmar la recepción
      console.log(`[Webhook Google Sheets] Datos recibidos exitosamente. Número de registros: ${recordCount}`);
      
      // Log de una muestra de los datos para verificación
      if (recordCount > 0) {
        console.log('[Webhook Google Sheets] Muestra de datos (primer registro):', JSON.stringify(body.logisticsData[0]));
      }
      
      // TODO: Aquí irá la futura lógica para procesar los datos y guardarlos en Firestore.

      return NextResponse.json({ status: 'success', message: `Datos recibidos correctamente. ${recordCount} registros.` });

    } else {
      // Log de error si los datos no tienen el formato esperado
      console.warn('[Webhook Google Sheets] Se recibió una petición pero el formato de los datos es incorrecto o está vacío.', body);
      return NextResponse.json({ status: 'error', message: 'El formato de los datos recibidos no es el esperado.' }, { status: 400 });
    }

  } catch (error) {
    // Log de error si la petición falla (ej. JSON mal formado)
    console.error('[Webhook Google Sheets] Error al procesar la petición:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
