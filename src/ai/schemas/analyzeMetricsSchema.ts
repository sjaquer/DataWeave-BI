
/**
 * @fileOverview Define los esquemas y tipos para el flujo de análisis de métricas.
 * 
 * - AnalyzeMetricsInputSchema - El esquema de Zod para la entrada de la función analyzeMetrics.
 * - AnalyzeMetricsInput - El tipo de entrada para la función analyzeMetrics.
 * - DailyMetricSchema - El esquema para los datos de un solo día.
 * - DailyMetric - El tipo para los datos de un solo día.
 * - AnalyzeMetricsOutputSchema - El esquema de Zod para la salida de la función analyzeMetrics.
 * - AnalyzeMetricsOutput - El tipo de retorno para la función analyzeMetrics.
 */
import {z} from 'genkit';

export const AnalyzeMetricsInputSchema = z.object({
  storeId: z.string().optional().describe("El identificador único de la tienda (ej: 'tienda-1'). Requerido si se sube archivo de Shopify."),
  shopifyDataUri: z
    .string()
    .optional()
    .describe(
      "El reporte de pedidos de Shopify (CSV), como un data URI. Formato: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  sheetsDataUri: z
    .string()
    .optional()
    .describe(
      "El reporte de logística de Google Sheets (CSV), como un data URI. Formato: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeMetricsInput = z.infer<typeof AnalyzeMetricsInputSchema>;

export const DailyMetricSchema = z.object({
  date: z.string().describe('La fecha para esta métrica (YYYY-MM-DD).'),
  totalOrders: z.number().describe('El número total de pedidos de Shopify para esta fecha.'),
  confirmedOrders: z.number().describe('El número de pedidos confirmados en logística para esta fecha.'),
  confirmationRate: z.number().describe('El porcentaje de pedidos confirmados (confirmados/totales * 100).'),
});

export type DailyMetric = z.infer<typeof DailyMetricSchema>;


export const AnalyzeMetricsOutputSchema = z.object({
  status: z.string().describe('El estado del análisis (success o error).'),
  message: z.string().describe('Un mensaje describiendo el resultado.'),
  dashboardData: z.array(DailyMetricSchema).describe('Un array de objetos con las métricas diarias procesadas.'),
});
export type AnalyzeMetricsOutput = z.infer<typeof AnalyzeMetricsOutputSchema>;

    