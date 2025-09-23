'use server';
/**
 * @fileOverview Flow para analizar métricas de negocio desde archivos de Shopify y Google Sheets.
 *
 * - analyzeMetrics - Una función que procesa los datos de los archivos para generar métricas.
 */

import { ai } from '@/ai/genkit';
import type {
  AnalyzeMetricsInput,
  AnalyzeMetricsOutput,
  DailyMetric,
} from '@/ai/schemas/analyzeMetricsSchema';
import {
  AnalyzeMetricsInputSchema,
  AnalyzeMetricsOutputSchema,
} from '@/ai/schemas/analyzeMetricsSchema';
import { parse } from 'csv-parse/sync';

// Función para decodificar y parsear el CSV
function parseCsv(dataUri: string): any[] {
  // Extrae el contenido Base64 del Data URI
  const base64String = dataUri.split(',')[1];
  // Decodifica de Base64 a un string normal
  const csvString = Buffer.from(base64String, 'base64').toString('utf8');
  // Parsea el string CSV a un array de objetos
  const records = parse(csvString, {
    columns: true,
    skip_empty_lines: true,
  });
  return records;
}

export async function analyzeMetrics(
  input: AnalyzeMetricsInput
): Promise<AnalyzeMetricsOutput> {
  return analyzeMetricsFlow(input);
}

const analyzeMetricsFlow = ai.defineFlow(
  {
    name: 'analyzeMetricsFlow',
    inputSchema: AnalyzeMetricsInputSchema,
    outputSchema: AnalyzeMetricsOutputSchema,
  },
  async (input) => {
    try {
      // 1. Procesar ambos archivos
      const shopifyRecords = parseCsv(input.shopifyDataUri);
      const logisticsRecords = parseCsv(input.sheetsDataUri);

      const dailyData: Record<string, DailyMetric> = {};

      // 2. Procesar archivo de Shopify para pedidos totales
      for (const record of shopifyRecords) {
        const createdAt = record['Created at'];
        if (!createdAt) continue;

        // Extraer solo la fecha (YYYY-MM-DD)
        const date = createdAt.split('T')[0];

        if (!dailyData[date]) {
          dailyData[date] = {
            date,
            totalOrders: 0,
            confirmedOrders: 0,
            confirmationRate: 0,
          };
        }
        dailyData[date].totalOrders++;
      }

      // 3. Procesar archivo de logística para pedidos confirmados
      for (const record of logisticsRecords) {
        const fechaCreado = record['FECHA CREADO'];
        const pedido = record['PEDIDO'];
        if (!fechaCreado || !pedido) continue;
        
        // Extraer solo la fecha de la columna 'FECHA CREADO'
        // Asumiendo que el formato puede ser 'DD/MM/YYYY' o similar y necesitamos convertirlo a 'YYYY-MM-DD'
        // Esta es una suposición, puede que necesitemos ajustar el parseo de fecha.
        const dateParts = fechaCreado.split(' ')[0].split('/');
        let date: string;
        if (dateParts.length === 3) {
            // Suponiendo formato D/M/YYYY o DD/MM/YYYY
             const day = dateParts[0].padStart(2, '0');
             const month = dateParts[1].padStart(2, '0');
             const year = dateParts[2];
             // Formato esperado 'YYYY-MM-DD'
             date = `${year}-${month}-${day}`;
        } else {
            // Si el formato es diferente, lo ignoramos por ahora.
            console.warn(`Formato de fecha no reconocido: ${fechaCreado}`);
            continue;
        }

        if (dailyData[date]) {
          dailyData[date].confirmedOrders++;
        }
      }

      // 4. Calcular tasa de confirmación y preparar la salida
      const dashboardData = Object.values(dailyData).map((data) => {
        if (data.totalOrders > 0) {
          data.confirmationRate = parseFloat(
            ((data.confirmedOrders / data.totalOrders) * 100).toFixed(2)
          );
        }
        return data;
      });

      // Ordenar los datos por fecha para la visualización
      dashboardData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());


      return {
        status: 'success',
        message: 'Análisis completado exitosamente.',
        dashboardData: dashboardData,
      };
    } catch (error) {
      console.error('Error en el flujo de análisis:', error);
      // Asegurarse de que el error es un objeto Error
      const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
      return {
        status: 'error',
        message: `Hubo un problema al procesar los archivos: ${errorMessage}`,
        dashboardData: [],
      };
    }
  }
);
