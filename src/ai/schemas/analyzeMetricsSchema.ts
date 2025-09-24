/**
 * @fileOverview Define los esquemas y tipos para el flujo de análisis de métricas.
 * 
 * - AnalyzeMetricsInputSchema - El esquema de Zod para la entrada de la función analyzeMetrics.
 * - AnalyzeMetricsInput - El tipo de entrada para la función analyzeMetrics.
 * - AnalyzeMetricsOutputSchema - El esquema de Zod para la salida de la función analyzeMetrics.
 * - AnalyzeMetricsOutput - El tipo de retorno para la función analyzeMetrics.
 */
import {z} from 'genkit';

// Este esquema define lo que el CLIENTE envía al SERVIDOR.
export const AnalyzeMetricsInputSchema = z.object({
  storeId: z.string().min(1, "El ID de la tienda es requerido."),
  shopifyDataUris: z
    .array(z.string())
    .min(1, "Se requiere al menos un archivo de Shopify.")
    .describe(
      "Un array de reportes de pedidos de Shopify (CSV), como data URIs. Formato: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type AnalyzeMetricsInput = z.infer<typeof AnalyzeMetricsInputSchema>;


// El DailyMetricSchema ya no es necesario aquí, porque la agregación se hace en el cliente.
export const DailyMetricSchema = z.object({
  date: z.string(),
  totalOrders: z.number(),
  confirmedOrders: z.number(),
  confirmationRate: z.number(),
});
export type DailyMetric = z.infer<typeof DailyMetricSchema>;


// Este esquema define lo que el SERVIDOR devuelve al CLIENTE.
export const AnalyzeMetricsOutputSchema = z.object({
  status: z.string().describe('El estado del análisis (success o error).'),
  message: z.string().describe('Un mensaje describiendo el resultado.'),
  // El campo dashboardData se elimina del output porque el servidor ya no devuelve datos agregados.
  // Se mantiene vacío por si alguna parte del código aún lo espera.
  dashboardData: z.array(DailyMetricSchema).describe('Este campo ya no se utiliza pero se mantiene por compatibilidad.'),
});
export type AnalyzeMetricsOutput = z.infer<typeof AnalyzeMetricsOutputSchema>;
