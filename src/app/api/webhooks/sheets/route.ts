// /src/app/api/webhooks/sheets/route.ts
import { NextResponse } from 'next/server';
import { updateConfirmedOrders } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para recibir actualizaciones de datos desde Google Sheets.
 * El Google Apps Script enviará una petición POST a esta ruta con los datos
 * de los pedidos confirmados.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body && body.logisticsData && Array.isArray(body.logisticsData)) {
      const recordCount = body.logisticsData.length;
      console.log(`[Webhook Google Sheets] Datos recibidos. Número de registros: ${recordCount}`);
      
      if (recordCount > 0) {
        console.log('[Webhook Google Sheets] Muestra de datos:', JSON.stringify(body.logisticsData[0]));
        // Extraer solo los números de pedido de la columna "PEDIDO"
        const orderNumbers = body.logisticsData
          .map((record: any) => record['PEDIDO']?.match(/\d+/g)?.join(''))
          .filter(Boolean); // Filtra nulos o vacíos

        if (orderNumbers.length > 0) {
           await updateConfirmedOrders(orderNumbers);
           console.log(`[Webhook Google Sheets] ${orderNumbers.length} pedidos confirmados procesados y actualizados en Firestore.`);
        }
      }
      
      return NextResponse.json({ status: 'success', message: `Datos recibidos y procesados.` });

    } else {
      console.warn('[Webhook Google Sheets] Petición recibida pero el formato de datos es incorrecto.', body);
      return NextResponse.json({ status: 'error', message: 'Formato de datos no esperado.' }, { status: 400 });
    }

  } catch (error) {
    console.error('[Webhook Google Sheets] Error al procesar la petición:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}

    