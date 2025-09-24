'use server';
/**
 * @fileOverview Este archivo está obsoleto para la carga de CSV. La lógica se ha movido a /lib/firestore.ts.
 * Se mantiene por si se reutiliza para otras funcionalidades de Genkit en el futuro.
 */
import {ai} from '@/ai/genkit';
import {
  AnalyzeMetricsInputSchema,
  AnalyzeMetricsOutputSchema,
  type AnalyzeMetricsInput,
  type AnalyzeMetricsOutput,
} from '@/ai/schemas/analyzeMetricsSchema';

// Esta función ya no debe ser llamada desde la UI para la carga de CSV.
export async function analyzeMetrics(input: AnalyzeMetricsInput): Promise<AnalyzeMetricsOutput> {
  // Se podría implementar una nueva funcionalidad aquí en el futuro.
  // Por ahora, devuelve un mensaje indicando que está obsoleto o no hace nada.
  return {
    status: 'success',
    message: 'Esta función de Genkit no procesa CSV. La lógica ha sido migrada.',
    dashboardData: [],
  };
}

const analyzeMetricsFlow = ai.defineFlow(
  {
    name: 'analyzeMetricsFlow',
    inputSchema: AnalyzeMetricsInputSchema,
    outputSchema: AnalyzeMetricsOutputSchema,
  },
  async (input) => {
    // La lógica de procesamiento de CSV fue movida a /lib/firestore.ts en la función analyzeAndStoreMetrics.
    // Este flujo de Genkit ahora está vacío y no realiza ninguna acción de carga de archivos.
    return {
      status: 'success',
      message: `El flujo de Genkit 'analyzeMetricsFlow' fue ejecutado, pero ya no procesa archivos CSV.`,
      dashboardData: [], 
    };
  }
);
