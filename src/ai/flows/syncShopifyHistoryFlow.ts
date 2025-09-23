'use server';
/**
 * @fileOverview Flujo para sincronizar el historial de pedidos de una tienda Shopify.
 *
 * - syncShopifyHistory: Inicia la sincronización para una tienda específica.
 */

import { ai } from '@/ai/genkit';
import { getShopifyClient } from '@/lib/shopify';
import { processShopifyCsv } from '@/lib/firestore';
import type { Order } from '@/lib/firestore';
import { SyncShopifyHistoryInputSchema, SyncShopifyHistoryOutputSchema, type SyncShopifyHistoryInput, type SyncShopifyHistoryOutput } from '@/ai/schemas/syncShopifyHistorySchema';


export async function syncShopifyHistory(input: SyncShopifyHistoryInput): Promise<SyncShopifyHistoryOutput> {
  return syncShopifyHistoryFlow(input);
}


const syncShopifyHistoryFlow = ai.defineFlow(
  {
    name: 'syncShopifyHistoryFlow',
    inputSchema: SyncShopifyHistoryInputSchema,
    outputSchema: SyncShopifyHistoryOutputSchema,
  },
  async ({ storeId }) => {
    try {
      const client = getShopifyClient(storeId);
      
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const queryDate = sixMonthsAgo.toISOString();

      let allOrders: Order[] = [];
      let hasNextPage = true;
      let cursor = null;

      console.log(`[Shopify Sync] Iniciando sincronización para la tienda: ${storeId}. Buscando pedidos desde ${queryDate}`);

      while (hasNextPage) {
        const query = `
          query($cursor: String) {
            orders(first: 50, after: $cursor, query: "created_at:>=${queryDate}") {
              pageInfo {
                hasNextPage
                endCursor
              }
              edges {
                node {
                  id
                  name
                  createdAt
                  totalPriceSet {
                    shopMoney {
                      amount
                    }
                  }
                  customer {
                    firstName
                    lastName
                  }
                  shippingAddress {
                    city
                    province
                    zip
                    country
                  }
                  lineItems(first: 10) {
                    edges {
                      node {
                        title
                        quantity
                        originalUnitPriceSet {
                          shopMoney {
                            amount
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const response: any = await client.query({
          data: {
            query,
            variables: { cursor },
          },
        });

        const ordersData = response.body.data.orders;
        const formattedOrders: Order[] = ordersData.edges.map((edge: any) => ({
          id: parseInt(edge.node.id.split('/').pop(), 10),
          name: edge.node.name,
          created_at: edge.node.createdAt,
          total_price: edge.node.totalPriceSet.shopMoney.amount,
          customer: {
            first_name: edge.node.customer?.firstName,
            last_name: edge.node.customer?.lastName,
          },
          shipping_address: edge.node.shippingAddress ? {
            city: edge.node.shippingAddress.city,
            province: edge.node.shippingAddress.province,
            zip: edge.node.shippingAddress.zip,
            country: edge.node.shippingAddress.country,
          } : undefined,
          line_items: edge.node.lineItems.edges.map((lineItemEdge: any) => ({
            title: lineItemEdge.node.title,
            quantity: lineItemEdge.node.quantity,
            price: lineItemEdge.node.originalUnitPriceSet.shopMoney.amount,
          })),
        }));
        
        allOrders.push(...formattedOrders);

        hasNextPage = ordersData.pageInfo.hasNextPage;
        cursor = ordersData.pageInfo.endCursor;
        console.log(`[Shopify Sync] ${allOrders.length} pedidos cargados...`);
      }

      console.log(`[Shopify Sync] Total de ${allOrders.length} pedidos obtenidos. Procesando y guardando en Firestore...`);
      
      // Usamos la misma función que el cargador de CSV para mantener la consistencia.
      await processShopifyCsv(allOrders, storeId);

      return {
        status: 'success',
        message: `Sincronización completada. Se procesaron ${allOrders.length} pedidos para la tienda ${storeId}.`,
        ordersProcessed: allOrders.length,
      };

    } catch (error: any) {
      console.error(`[Shopify Sync] Error sincronizando la tienda ${storeId}:`, error);
      return {
        status: 'error',
        message: `Error al sincronizar: ${error.message}`,
        ordersProcessed: 0,
      };
    }
  }
);
