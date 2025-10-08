// src/app/api/webhooks/delivered/route.ts
import { NextResponse } from 'next/server';
import { updateDeliveredOrders } from '@/lib/firestore';
import type { DeliveredOrderInfo } from '@/lib/firestore';

/**
 * Endpoint para recibir los webhooks desde Google Sheets (hoja "ENTREGADOS").
 * Acepta un objeto JSON con la clave "data", que contiene un array de objetos de pedido.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // El script de Apps Script envía un objeto con una clave "data".
    const deliveredOrders: DeliveredOrderInfo[] = body.data;

    if (!Array.isArray(deliveredOrders) || deliveredOrders.length === 0) {
      return NextResponse.json({ status: 'error', message: 'El payload está vacío o no contiene un array "data" válido.' }, { status: 400 });
    }

    const sample = deliveredOrders[0];
    if (typeof sample.ID === 'undefined' || typeof sample.PEDIDO === 'undefined') {
      return NextResponse.json({ status: 'error', message: 'Los objetos de pedido deben contener al menos los campos ID y PEDIDO.' }, { status: 400 });
    }

    const result = await updateDeliveredOrders(deliveredOrders);

    if (result.status === 'error') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de entregados de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
