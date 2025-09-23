/**
 * @fileOverview Define los esquemas y tipos para el flujo de análisis de métricas.
 * 
 * - AnalyzeMetricsInputSchema - El esquema de Zod para la entrada de la función analyzeMetrics.
 * - AnalyzeMetricsInput - El tipo de entrada para la función analyzeMetrics.
 * - AnalyzeMetricsOutputSchema - El esquema de Zod para la salida de la función analyzeMetrics.
 * - AnalyzeMetricsOutput - El tipo de retorno para la función analyzeMetrics.
 */
import {z} from 'genkit';

export const AnalyzeMetricsInputSchema = z.object({
  shopifyDataUri: z
    .string()
    .describe(
      "El reporte de pedidos de Shopify, como un data URI que debe incluir un tipo MIME y usar codificación Base64. Formato esperado: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  sheetsDataUri: z
    .string()
    .describe(
      "El reporte de logística de Google Sheets, como un data URI que debe incluir un tipo MIME y usar codificación Base64. Formato esperado: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeMetricsInput = z.infer<typeof AnalyzeMetricsInputSchema>;

export const AnalyzeMetricsOutputSchema = z.object({
  status: z.string().describe('El estado del análisis.'),
  message: z.string().describe('Un mensaje describiendo el resultado.'),
  // Aquí definiremos la estructura de los datos del dashboard.
  // Por ahora, es un placeholder.
  dashboardData: z.any().optional().describe('Los datos procesados para el dashboard.'),
});
export type AnalyzeMetricsOutput = z.infer<typeof AnalyzeMetricsOutputSchema>;
