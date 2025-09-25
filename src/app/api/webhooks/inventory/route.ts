
import { NextResponse } from 'next/server';
import { processInventoryMovements } from '@/lib/firestore';
import type { InventoryMovement } from '@/lib/firestore';

/**
 * Endpoint para recibir webhooks desde Google Sheets con movimientos de inventario.
 * Acepta un objeto JSON con la clave "movements", que contiene un array de objetos.
 * Ej: { "movements": [ { "ID_MOVIMIENTO": "mov_123", "USUARIO_REGISTRADOR": "ALEXIS", ... } ] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // El webhook espera un objeto contenedor con una clave "movements"
    const movements: InventoryMovement[] = body.movements;

    if (!Array.isArray(movements) || movements.length === 0) {
      return NextResponse.json({ status: 'error', message: 'El payload está vacío o no contiene un array "movements" válido.' }, { status: 400 });
    }

    // Validar que los campos mínimos existan en el primer objeto como muestra.
    const sample = movements[0];
    if (typeof sample.ID_MOVIMIENTO === 'undefined' || typeof sample.PRODUCTO === 'undefined') {
      return NextResponse.json({ status: 'error', message: 'Los objetos de movimiento deben contener al menos los campos ID_MOVIMIENTO y PRODUCTO.' }, { status: 400 });
    }

    const result = await processInventoryMovements(movements);

    if (result.status === 'error') {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de inventario de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
