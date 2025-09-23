import { NextResponse } from 'next/server';
import { processNewShopifyOrder } from '@/lib/firestore';
import type { Order } from '@/lib/firestore';
import * as crypto from 'crypto';

/**
 * Endpoint para recibir los webhooks de Shopify cuando se crea un nuevo pedido.
 */
export async function POST(req: Request) {
  const body = await req.text();
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!shopifySecret) {
      console.error("El secreto del webhook de Shopify no está configurado en las variables de entorno (SHOPIFY_WEBHOOK_SECRET).");
      return NextResponse.json({ status: 'error', message: 'Configuración de servidor incompleta.' }, { status: 500 });
  }

  // Verificar la firma del webhook para seguridad
  const hash = crypto.createHmac('sha256', shopifySecret).update(body, 'utf-8').digest('base64');

  if (hash !== hmacHeader) {
    return NextResponse.json({ status: 'error', message: 'Firma de webhook inválida.' }, { status: 401 });
  }

  try {
    const newOrder: Order = JSON.parse(body);

    if (!newOrder || !newOrder.id) {
       return NextResponse.json({ status: 'error', message: 'Datos del pedido inválidos.' }, { status: 400 });
    }

    await processNewShopifyOrder(newOrder);

    return NextResponse.json({ status: 'success', message: `Pedido ${newOrder.name} procesado.` }, { status: 200 });

  } catch (error) {
    console.error('Error en el webhook de Shopify:', error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
