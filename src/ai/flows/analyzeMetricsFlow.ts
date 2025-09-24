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
            
            const orders: Order[] = records.map((r: any) => {
              // Lógica de mapeo robusta para evitar errores con 'undefined'
              const billingName = r['Billing Name'] || '';
              const nameParts = billingName.split(' ');
              const firstName = nameParts.shift() || '';
              const lastName = nameParts.join(' ');

              return {
                id: r.id || r.ID || r['Order ID'] || 0,
                name: r.Name || '',
                created_at: r['Created at'] || new Date().toISOString(),
                total_price: r['Total'] || '0',
                customer: {
                  first_name: firstName,
                  last_name: lastName,
                },
                shipping_address: {
                    province: r['Shipping Province Name'] || '',
                    city: r['Shipping City'] || '',
                    zip: r['Shipping Zip'] || '',
                    country: r['Shipping Country'] || '',
                },
                line_items: [{
                    title: r['Lineitem name'] || 'N/A',
                    quantity: parseInt(r['Lineitem quantity'] || '0', 10),
                    price: r['Lineitem price'] || '0'
                }]
              };
            });
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
