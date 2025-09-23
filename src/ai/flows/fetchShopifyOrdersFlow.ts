'use server';
/**
 * @fileOverview Flujo para obtener y procesar pedidos de Shopify de forma activa.
 *
 * - fetchAndProcessShopifyOrders - Obtiene los últimos pedidos de la API de Shopify y los guarda en Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { processShopifyOrders } from '@/lib/firestore';

// Definición local del tipo Order para que coincida con la respuesta de la API
interface Order {
  id: number;
  created_at: string;
  name: string;
}

const FetchShopifyOrdersOutputSchema = z.object({
  status: z.string().describe('El estado de la operación (success o error).'),
  message: z.string().describe('Un mensaje describiendo el resultado.'),
  ordersProcessed: z.number().optional().describe('El número de pedidos procesados.'),
});

type FetchShopifyOrdersOutput = z.infer<typeof FetchShopifyOrdersOutputSchema>;

// Esta función es la que se llama desde el cliente.
export async function fetchAndProcessShopifyOrders(): Promise<FetchShopifyOrdersOutput> {
  return fetchAndProcessShopifyOrdersFlow();
}

const fetchAndProcessShopifyOrdersFlow = ai.defineFlow(
  {
    name: 'fetchAndProcessShopifyOrdersFlow',
    outputSchema: FetchShopifyOrdersOutputSchema,
  },
  async () => {
    const storeName = process.env.SHOPIFY_STORE_NAME;
    const accessToken = process.env.SHOPIFY_API_ACCESS_TOKEN;

    if (!storeName || !accessToken) {
      console.error("Credenciales de Shopify no configuradas en .env");
      return {
        status: 'error',
        message: 'Las credenciales de Shopify (SHOPIFY_STORE_NAME, SHOPIFY_API_ACCESS_TOKEN) no están configuradas.',
      };
    }

    const shopifyApiUrl = `https://${storeName}/admin/api/2024-04/orders.json?status=any`;

    try {
      const response = await fetch(shopifyApiUrl, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error al obtener pedidos de Shopify: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const { orders } = await response.json() as { orders: Order[] };

      if (!orders || orders.length === 0) {
        return {
          status: 'success',
          message: 'No se encontraron pedidos nuevos para procesar.',
          ordersProcessed: 0,
        };
      }
      
      console.log(`[Shopify Flow] Se encontraron ${orders.length} pedidos. Procesando...`);
      // Llamamos a la nueva función que procesa el lote completo
      await processShopifyOrders(orders);

      return {
        status: 'success',
        message: `Se procesaron exitosamente las métricas para ${orders.length} pedidos.`,
        ordersProcessed: orders.length,
      };

    } catch (error) {
      console.error('Error en el flujo de obtención de pedidos de Shopify:', error);
      const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
      return {
        status: 'error',
        message: `Hubo un problema al obtener o procesar los pedidos de Shopify: ${errorMessage}`,
      };
    }
  }
);
