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
  const base64String = dataUri.split(',')[1];
  const csvString = Buffer.from(base64String, 'base64').toString('utf8');
  const records = parse(csvString, {
    columns: true,
    skip_empty_lines: true,
  });
  return records;
}

// Función para normalizar el número de pedido extrayendo solo los dígitos
function normalizeOrderNumber(orderId: string): string {
  if (!orderId) return '';
  // Extrae todos los dígitos del string.
  const numericPart = orderId.match(/\d+/g);
  return numericPart ? numericPart.join('') : '';
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
      const shopifyRecords = parseCsv(input.shopifyDataUri);
      const logisticsRecords = parseCsv(input.sheetsDataUri);

      const dailyData: Record<string, DailyMetric> = {};

      // 1. Crear un Set con todos los números de pedidos confirmados para una búsqueda rápida.
      const confirmedOrderNumbers = new Set(
        logisticsRecords.map((record) => normalizeOrderNumber(record['PEDIDO']))
      );
      // Eliminar valores vacíos si los hubiera
      confirmedOrderNumbers.delete('');

      // 2. Procesar archivo de Shopify
      for (const record of shopifyRecords) {
        const orderNumberWithPrefix = record['Name'];
        const createdAt = record['Created at'];

        if (!createdAt || !orderNumberWithPrefix) continue;

        const orderNumber = normalizeOrderNumber(orderNumberWithPrefix);
        if (!orderNumber) continue;

        // Extraer la fecha y formatearla como DD-MM-YYYY
        // El formato de entrada puede ser "YYYY-MM-DDTHH:mm:ss..." o "DD HH:mm:ss -MM-YYYY"
        let formattedDate: string;
        if (createdAt.includes('T')) {
          // Formato "YYYY-MM-DDTHH:mm:ss..."
          const datePart = createdAt.split('T')[0]; // "YYYY-MM-DD"
          const [year, month, day] = datePart.split('-');
          formattedDate = `${day}-${month}-${year}`;
        } else {
          // Formato "22 06:45:14 -09-2025"
          const parts = createdAt.split(' ');
          const day = parts[0];
          const monthYear = parts[2].split('-'); // ["", "09", "2025"]
          const month = monthYear[1];
          const year = monthYear[2];
          formattedDate = `${day}-${month}-${year}`;
        }


        // Inicializar el objeto para el día si no existe
        if (!dailyData[formattedDate]) {
          dailyData[formattedDate] = {
            date: formattedDate,
            totalOrders: 0,
            confirmedOrders: 0,
            confirmationRate: 0,
          };
        }
        
        // Incrementar el total de pedidos para el día
        dailyData[formattedDate].totalOrders++;

        // Verificar si el pedido está en la lista de confirmados
        if (confirmedOrderNumbers.has(orderNumber)) {
          dailyData[formattedDate].confirmedOrders++;
        }
      }

      // 3. Calcular tasa de confirmación y preparar la salida
      const dashboardData = Object.values(dailyData).map((data) => {
        if (data.totalOrders > 0) {
          data.confirmationRate = parseFloat(
            ((data.confirmedOrders / data.totalOrders) * 100).toFixed(2)
          );
        }
        return data;
      });

      // Ordenar los datos por fecha para la visualización (más recientes primero)
      // Se convierte la fecha DD-MM-YYYY a un objeto Date para ordenar correctamente
      dashboardData.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('-').map(Number);
        const [dayB, monthB, yearB] = b.date.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateB.getTime() - dateA.getTime();
      });


      return {
        status: 'success',
        message: 'Análisis completado exitosamente.',
        dashboardData: dashboardData,
      };
    } catch (error) {
      console.error('Error en el flujo de análisis:', error);
      const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
      return {
        status: 'error',
        message: `Hubo un problema al procesar los archivos: ${errorMessage}`,
        dashboardData: [],
      };
    }
  }
);
