
'use server';
/**
 * @fileOverview Flujo para analizar métricas de Shopify y Google Sheets.
 *
 * - analyzeMetrics - Procesa los archivos CSV y actualiza la base de datos.
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
import {processShopifyCsv, updateConfirmedOrders} from '@/lib/firestore';

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
    let sheetsMessage = 'No se proporcionó archivo de Google Sheets.';

    // Procesar datos de Shopify si se proporcionaron
    if (input.shopifyDataUri && input.storeId) {
      try {
        const csvData = Buffer.from(input.shopifyDataUri.split(',')[1], 'base64').toString('utf-8');
        const records = parse(csvData, {
          columns: true,
          skip_empty_lines: true,
        });
        
        // Mapear los nombres de columna del CSV a la interfaz Order
        const orders = records.map((r: any) => ({
            id: r.id,
            name: r.Name,
            created_at: r['Created at']
        }));

        await processShopifyCsv(orders, input.storeId);
        shopifyMessage = `Se procesaron y guardaron ${orders.length} pedidos de Shopify para la tienda ${input.storeId}.`;
      } catch (e: any) {
        shopifyMessage = `Error procesando el archivo de Shopify: ${e.message}`;
        throw new Error(shopifyMessage);
      }
    }

    // Procesar datos de Google Sheets si se proporcionaron
    if (input.sheetsDataUri) {
        try {
            const csvData = Buffer.from(input.sheetsDataUri.split(',')[1], 'base64').toString('utf-8');
            const records = parse(csvData, {
                columns: true,
                skip_empty_lines: true,
            });
            const result = await updateConfirmedOrders(records.map((r: any) => ({ PEDIDO: r.PEDIDO })));
            sheetsMessage = result.message;
        } catch (e: any) {
            sheetsMessage = `Error procesando el archivo de Google Sheets: ${e.message}`;
            throw new Error(sheetsMessage);
        }
    }

    return {
      status: 'success',
      message: `Shopify: ${shopifyMessage}\nSheets: ${sheetsMessage}`,
      dashboardData: [], // Ya no devolvemos datos al dashboard, se leen en tiempo real.
    };
  }
);

    