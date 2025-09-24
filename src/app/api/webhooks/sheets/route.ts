import { NextResponse } from 'next/server';
import { updateConfirmedOrders } from '@/lib/firestore';
import type { ConfirmedOrderInfo } from '@/lib/firestore';

/**
 * Endpoint para recibir los webhooks desde Google Sheets cuando se confirma un pedido.
 * Acepta un objeto JSON con la clave "orders", que contiene un array de objetos.
 * Ej: { "orders": [ { "PEDIDO": "123", "TIENDA": "tienda-1", ... } ] }
 * Puede manejar tanto un array con múltiples pedidos (carga masiva) como un array con un solo pedido (actualización en tiempo real).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // El webhook espera un objeto contenedor con una clave "orders" que es un array.
    const confirmedOrders: ConfirmedOrderInfo[] = body.orders;

    if (!Array.isArray(confirmedOrders) || confirmedOrders.length === 0) {
      return NextResponse.json({ status: 'error', message: 'El payload está vacío o no contiene un array "orders" válido.' }, { status: 400 });
    }

    // Validar que los campos mínimos existan en el primer objeto como muestra.
    // El script de Apps Script se asegura de que las cabeceras coincidan con estas claves.
    const sample = confirmedOrders[0];
    if (typeof sample.PEDIDO === 'undefined' || typeof sample.TIENDA === 'undefined') {
      return NextResponse.json({ status: 'error', message: 'Los objetos de pedido deben contener al menos los campos PEDIDO y TIENDA.' }, { status: 400 });
    }

    const result = await updateConfirmedOrders(confirmedOrders);

    if (result.status === 'error') {
      // Devolvemos 500 si hay un error en la lógica de actualización.
      return NextResponse.json(result, { status: 500 });
    }

    // Devolvemos 200 si todo fue exitoso.
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
