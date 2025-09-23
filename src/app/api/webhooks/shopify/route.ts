// /src/app/api/webhooks/shopify/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { processNewShopifyOrder } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

/**
 * Verifica la firma del webhook de Shopify para asegurar que la petición es legítima.
 */
async function verifyShopifyWebhook(request: Request): Promise<boolean> {
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  const shop = request.headers.get('x-shopify-shop-domain');
  const secret = process.env.SHOPIFY_API_SECRET_KEY; // Tu clave secreta

  if (!hmac || !shop || !secret) {
    console.warn('Faltan encabezados o clave secreta para la verificación del webhook de Shopify.');
    return false;
  }

  const body = await request.clone().text(); // Clonamos para poder leer el cuerpo varias veces
  
  const genHash = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');

  return genHash === hmac;
}


/**
 * Endpoint para recibir webhooks de nuevos pedidos desde Shopify.
 */
export async function POST(request: Request) {
  try {
    // 1. Verificar la autenticidad del webhook
    // const isValid = await verifyShopifyWebhook(request);
    // if (!isValid) {
    //   console.warn('[Webhook Shopify] Verificación de HMAC fallida. Petición no autorizada.');
    //   return NextResponse.json({ status: 'error', message: 'No autorizado.' }, { status: 401 });
    // }

    // 2. Procesar los datos del pedido
    const orderData = await request.json();
    console.log(`[Webhook Shopify] Pedido recibido: ${orderData.name} (ID: ${orderData.id})`);

    await processNewShopifyOrder(orderData);
    
    return NextResponse.json({ status: 'success', message: 'Pedido recibido y procesado.' });

  } catch (error) {
    console.error('[Webhook Shopify] Error al procesar la petición:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', message: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}

    