import { NextResponse } from 'next/server';
import { processNewShopifyOrder, processUpdatedShopifyOrder } from '@/lib/firestore';
import type { Order } from '@/lib/firestore';

/**
 * Endpoint dinámico para recibir webhooks de múltiples tiendas Shopify.
 * La URL será /api/webhooks/shopify/[storeId]
 */
export async function POST(req: Request, { params }: { params: { storeId: string } }) {
  const { storeId } = params;
  if (!storeId) {
    return NextResponse.json({ status: 'error', message: 'No se especificó storeId en la URL.' }, { status: 400 });
  }

  const body = await req.text();
  const topic = req.headers.get('x-shopify-topic'); // 'orders/create', 'orders/updated', etc.
  
  try {
    const orderPayload: Order = JSON.parse(body);

    if (!orderPayload || !orderPayload.id) {
       return NextResponse.json({ status: 'error', message: 'Datos del pedido inválidos.' }, { status: 400 });
    }

    // Lógica para diferenciar el evento (topic)
    switch (topic) {
        case 'orders/create':
            await processNewShopifyOrder(orderPayload, storeId);
            return NextResponse.json({ status: 'success', message: `Pedido ${orderPayload.name} (nuevo) de ${storeId} procesado.` }, { status: 200 });
        
        case 'orders/updated':
            await processUpdatedShopifyOrder(orderPayload, storeId);
            return NextResponse.json({ status: 'success', message: `Pedido ${orderPayload.name} (actualizado) de ${storeId} procesado.` }, { status: 200 });
            
        default:
            // Ignoramos otros eventos que no nos interesan
            return NextResponse.json({ status: 'ignored', message: `Evento de webhook '${topic}' no manejado.` }, { status: 200 });
    }

  } catch (error) {
    console.error(`Error en el webhook de Shopify para la tienda ${storeId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Ocurrió un error desconocido.';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}
