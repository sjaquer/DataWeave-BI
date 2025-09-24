import { NextResponse } from 'next/server';
import { updateConfirmedOrders } from '@/lib/firestore';
import type { ConfirmedOrderInfo } from '@/lib/firestore';

/**
 * Endpoint para recibir los webhooks desde Google Sheets cuando se confirma un pedido.
 * Acepta un objeto único o un array de objetos con `PEDIDO`, `TIENDA`, `ATENDIDO` y `COURIER`.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Hacemos el endpoint más flexible. Si recibimos un solo objeto, lo convertimos en un array.
    const confirmedOrders: ConfirmedOrderInfo[] = Array.isArray(body) ? body : [body];

    if (confirmedOrders.length === 0) {
      return NextResponse.json({ status: 'error', message: 'El payload está vacío o no es válido.' }, { status: 400 });
    }

    // Validar que los campos mínimos existan en el primer objeto como muestra
    const sample = confirmedOrders[0];
    if (typeof sample.PEDIDO === 'undefined' || typeof sample.TIENDA === 'undefined') {
      return NextResponse.json({ status: 'error', message: 'El payload debe contener al menos los campos PEDIDO y TIENDA.' }, { status: 400 });
    }

    const result = await updateConfirmedOrders(confirmedOrders);

    if (result.status === 'error') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
