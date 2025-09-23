'use server';
/**
 * @fileOverview Flujo para procesar cargas masivas de archivos CSV de Shopify.
 *
 * - analyzeMetrics - Procesa el archivo CSV y lo guarda en la colección `shopify_orders`.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
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
    let shopifyMessage = 'No se proporcionó archivo de Shopify.';

    // Procesar datos de Shopify si se proporcionaron
    if (input.shopifyDataUri && input.storeId) {
      try {
        const csvData = Buffer.from(input.shopifyDataUri.split(',')[1], 'base64').toString('utf-8');
        const records = parse(csvData, {
          columns: true,
          skip_empty_lines: true,
        });
        
        // El mapeo de nombres de columna del CSV a la interfaz Order ahora es más detallado
        const orders: Order[] = records.map((r: any) => ({
            id: r.id,
            name: r.Name,
            created_at: r['Created at'],
            total_price: r['Total'],
            customer: {
              first_name: r['Billing Name']?.split(' ')[0],
              last_name: r['Billing Name']?.split(' ').slice(1).join(' '),
            },
            shipping_address: {
                province: r['Shipping Province Name']
            },
            line_items: [{ // Esto sigue siendo una simplificación. La lógica real podría manejar múltiples items.
                title: r['Lineitem name'],
                quantity: parseInt(r['Lineitem quantity'], 10),
                price: r['Lineitem price']
            }]
        }));

        await processShopifyCsv(orders, input.storeId);
        shopifyMessage = `Se procesaron y guardaron ${orders.length} pedidos de Shopify para la tienda ${input.storeId}.`;
      } catch (e: any) {
        shopifyMessage = `Error procesando el archivo de Shopify: ${e.message}`;
        throw new Error(shopifyMessage);
      }
    }
    
    // El procesamiento de sheets se elimina de este flujo manual, se maneja solo por su propio webhook.
    return {
      status: 'success',
      message: shopifyMessage,
      dashboardData: [], 
    };
  }
);
