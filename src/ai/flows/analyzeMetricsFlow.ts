'use server';
/**
 * @fileOverview Flujo para procesar cargas masivas de archivos CSV de Shopify.
 *
 * - analyzeMetrics - Procesa el archivo CSV y lo guarda en la colección `shopify_orders`.
 */
import {ai} from '@/ai/genkit';
import {parse} from 'csv-parse/sync';
import {
  AnalyzeMetricsInputSchema,
  AnalyzeMetricsOutputSchema,
  type AnalyzeMetricsInput,
  type AnalyzeMetricsOutput,
} from '@/ai/schemas/analyzeMetricsSchema';
import {processShopifyCsv} from '@/lib/firestore';
import type { Order } from '@/lib/firestore';

// Función que será llamada desde la UI
export async function analyzeMetrics(input: AnalyzeMetricsInput): Promise<AnalyzeMetricsOutput> {
  return analyzeMetricsFlow(input);
}

const analyzeMetricsFlow = ai.defineFlow(
  {
    name: 'analyzeMetricsFlow',
    inputSchema: AnalyzeMetricsInputSchema,
    outputSchema: AnalyzeMetricsOutputSchema,
  },
  async (input) => {
    let totalProcessedOrders = 0;
    
    if (!input.shopifyDataUris || input.shopifyDataUris.length === 0) {
        throw new Error('No se proporcionaron archivos de Shopify.');
    }

    // Procesar datos de Shopify si se proporcionaron
    if (input.shopifyDataUris && input.storeId) {
      try {
        let allOrders: Order[] = [];

        for (const dataUri of input.shopifyDataUris) {
            const csvData = Buffer.from(dataUri.split(',')[1], 'base64').toString('utf-8');
            const records = parse(csvData, {
              columns: true,
              skip_empty_lines: true,
            });
            
            const orders: Order[] = records.map((r: any) => ({
                // Robust ID handling: check for common variations of the ID column name.
                id: r.id || r.ID || r['Order ID'] || 0,
                name: r.Name,
                created_at: r['Created at'],
                total_price: r['Total'],
                customer: {
                  first_name: r['Billing Name']?.split(' ')[0],
                  last_name: r['Billing Name']?.split(' ').slice(1).join(' '),
                },
                shipping_address: {
                    province: r['Shipping Province Name'],
                    city: r['Shipping City'],
                    zip: r['Shipping Zip'],
                    country: r['Shipping Country'],
                },
                line_items: [{ // This is a simplification. Real logic might handle multiple items.
                    title: r['Lineitem name'],
                    quantity: parseInt(r['Lineitem quantity'], 10),
                    price: r['Lineitem price']
                }]
            }));
            allOrders.push(...orders);
        }
        
        totalProcessedOrders = allOrders.length;
        await processShopifyCsv(allOrders, input.storeId);

      } catch (e: any) {
        const errorMessage = `Error procesando los archivos de Shopify: ${e.message}`;
        console.error(errorMessage, e);
        throw new Error(errorMessage);
      }
    }
    
    return {
      status: 'success',
      message: `Se procesaron y guardaron ${totalProcessedOrders} pedidos de Shopify para la tienda ${input.storeId}.`,
      dashboardData: [], 
    };
  }
);
