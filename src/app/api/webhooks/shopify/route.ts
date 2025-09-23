// ESTE ARCHIVO YA NO SE UTILIZA Y SERÁ ELIMINADO EN FUTURAS VERSIONES.
// La lógica ha sido reemplazada por un flujo activo en el dashboard.

import { processNewShopifyOrder } from '@/lib/firestore';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';

// Definición de tipos para los datos del webhook de Shopify
export interface Customer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface Order {
  id: number;
  created_at: string;
  name: string; // Este es el número de pedido, ej: "#1001"
  total_price: string;
  customer: Customer | null;
}

/**
 * Verifica la firma HMAC de un webhook de Shopify para asegurar su autenticidad.
 */
async function verifyShopifyWebhook(request: NextRequest): Promise<boolean> {
  const hmac = request.headers.get('x-shopify-hmac-sha256');
  const secret = process.env.SHOPIFY_API_SECRET_KEY;
  
  if (!hmac || !secret) {
    return false;
  }

  // Se necesita el cuerpo de la petición en formato raw (texto)
  const requestBody = await request.text();

  const generatedHash = crypto
    .createHmac('sha256', secret)
    .update(requestBody)
    .digest('base64');
  
  try {
    return crypto.timingSafeEqual(Buffer.from(generatedHash), Buffer.from(hmac));
  } catch (error) {
    console.warn("Error en la comparación de HMACs:", error);
    return false;
  }
}


export async function POST(request: NextRequest) {
  try {
    const isVerified = await verifyShopifyWebhook(request.clone());

    if (!isVerified) {
      console.warn('[Webhook Shopify] Verificación de HMAC fallida. Petición ignorada.');
      return new Response('Verificación de HMAC fallida.', { status: 401 });
    }

    const orderData: Order = await request.json();
    console.log(`[Webhook Shopify] Pedido recibido y verificado: ${orderData.name}`);

    await processNewShopifyOrder(orderData);
    
    return new Response('Webhook procesado exitosamente.', { status: 200 });
  } catch (error) {
    console.error('[Error en Webhook Shopify]', error);
    const errorMessage = error instanceof Error ? error.message : "Un error desconocido ocurrió.";
    return new Response(`Error interno del servidor: ${errorMessage}`, { status: 500 });
  }
}
