'use server';

/**
 * @fileOverview This file defines a Genkit flow for analyzing inventory movement data and generating insights.
 *
 * It includes:
 * - `analyzeInventoryMovement`: A function that takes inventory movement data as input and returns insights and suggestions.
 * - `InventoryMovementInput`: The input type for the analyzeInventoryMovement function.
 * - `InventoryInsightsOutput`: The output type for the analyzeInventoryMovement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const InventoryMovementInputSchema = z.object({
  inventoryData: z.string().describe("Inventory movement data in a tabular format, including fields such as ID_MOVIMIENTO, TIMESTAMP, USUARIO_REGISTRADOR, SKU, PRODUCTO, VARIANTE, CANTIDAD, STOCK_ANTERIOR, STOCK_POSTERIOR, TIPO_MOVIMIENTO, MOTIVO_DETALLE, ID_REFERENCIA, ALMACEN, NUM_PEDIDO, TIENDA."),
});
export type InventoryMovementInput = z.infer<typeof InventoryMovementInputSchema>;

const InventoryInsightsOutputSchema = z.object({
  insights: z.array(z.string()).describe("Key insights regarding warehouse efficiency, including stock turnover rate, slow-moving items, and potential issues."),
  suggestions: z.array(z.string()).describe("Suggestions for areas of optimization in warehouse operations."),
});
export type InventoryInsightsOutput = z.infer<typeof InventoryInsightsOutputSchema>;

export async function analyzeInventoryMovement(input: InventoryMovementInput): Promise<InventoryInsightsOutput> {
  return inventoryInsightsGeneratorFlow(input);
}

const inventoryInsightsPrompt = ai.definePrompt({
  name: 'inventoryInsightsPrompt',
  input: {schema: InventoryMovementInputSchema},
  output: {schema: InventoryInsightsOutputSchema},
  prompt: `You are an expert warehouse operations analyst.

  Analyze the following inventory movement data and provide key insights regarding warehouse efficiency and suggest areas for optimization.

  Data:\n{{{inventoryData}}}

  Format your response as a numbered list of insights and suggestions.  Be concise and actionable.
  Do not include any introductory or concluding remarks.
  Be specific about which fields are being analyzed and how they impact efficiency.
  Be sure to highlight any metrics that can be easily calculated to track the efficiency.
  For example:
  1.  Insight: Stock turnover rate is low for product X, indicating overstocking.
  Suggestion: Reduce orders of product X and implement promotional discounts.
  2.  Insight: High frequency of 'SALIDA' movements with 'PREPARACIÓN PEDIDO' for SKU Y, suggesting efficient order fulfillment.
  Suggestion: Maintain current practices for SKU Y and identify other SKUs for similar optimization.
  3.  Insight: Large discrepancies between STOCK_ANTERIOR and STOCK_POSTERIOR for SKU Z, indicating potential inventory management issues.
  Suggestion: Investigate the root cause of discrepancies for SKU Z and implement stricter inventory control measures.
  `,
});

const inventoryInsightsGeneratorFlow = ai.defineFlow(
  {
    name: 'inventoryInsightsGeneratorFlow',
    inputSchema: InventoryMovementInputSchema,
    outputSchema: InventoryInsightsOutputSchema,
  },
  async input => {
    const {output} = await inventoryInsightsPrompt(input);
    return output!;
  }
);
