import { NextResponse } from 'next/server';
import { updateConfirmedOrders } from '@/lib/firestore';

/**
 * Endpoint para recibir los webhooks desde Google Sheets cuando se confirma un pedido.
 */
export async function POST(req: Request) {
  try {
    // El script de Google Apps Script envía el array de filas directamente en el cuerpo.
    const confirmedOrders = await req.json();

    if (!Array.isArray(confirmedOrders)) {
      return NextResponse.json({ status: 'error', message: 'El formato de datos es inválido. Se esperaba un array de pedidos.' }, { status: 400 });
    }

    const result = await updateConfirmedOrders(confirmedOrders);

    if (result.status === 'error') {
      // Si la función interna ya manejó el error, pasamos su mensaje y estado.
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
