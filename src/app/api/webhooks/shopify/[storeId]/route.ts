import { NextResponse } from 'next/server';
import { processNewShopifyOrder, processUpdatedShopifyOrder } from '@/lib/firestore';
import type { Order } from '@/lib/firestore';
import * as crypto from 'crypto';

function getShopifyWebhookSecret(storeId: string): string | undefined {
  // Las variables de entorno se nombran SHOPIFY_WEBHOOK_SECRET_BLUMI, SHOPIFY_WEBHOOK_SECRET_CUMBRE, etc.
  const envVarName = `SHOPIFY_WEBHOOK_SECRET_${storeId.toUpperCase()}`;
  return process.env[envVarName];
}

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
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256');
  const topic = req.headers.get('x-shopify-topic'); // 'orders/create', 'orders/updated', etc.
  
  const shopifySecret = getShopifyWebhookSecret(storeId);

  if (!shopifySecret) {
      console.error(`El secreto del webhook para la tienda '${storeId}' no está configurado.`);
      return NextResponse.json({ status: 'error', message: `Configuración de servidor incompleta para la tienda: ${storeId}` }, { status: 500 });
  }

  // Verificar la firma del webhook
  const hash = crypto.createHmac('sha256', shopifySecret).update(body, 'utf-8').digest('base64');

  if (hash !== hmacHeader) {
    return NextResponse.json({ status: 'error', message: 'Firma de webhook inválida.' }, { status: 401 });
  }

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

    