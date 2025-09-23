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

/**
 * Parsea una fecha de varios formatos posibles y la devuelve como DD-MM-YYYY.
 * Formatos soportados:
 * - YYYY-MM-DDTHH:mm:ss...
 * - DD/MM/YYYY HH:mm...
 * - DD/MM/YYYY
 * - MM/DD/YYYY ...
 * - YYYY-MM-DD ...
 * - DD HH:MM:SS -MM-YYYY
 */
function formatDate(dateString: string): string | null {
  if (!dateString) return null;

  // Caso 1: DD HH:MM:SS -MM-YYYY
  const specialFormatMatch = dateString.match(/^(\d{2})\s\d{2}:\d{2}:\d{2}\s-(\d{2})-(\d{4})$/);
  if (specialFormatMatch) {
    const day = specialFormatMatch[1];
    const month = specialFormatMatch[2];
    const year = specialFormatMatch[3];
    return `${day}-${month}-${year}`;
  }

  // Tomar solo la parte de la fecha antes del espacio o 'T'
  const datePart = dateString.split(/[\sT]/)[0];
  const separators = datePart.match(/[\/\-]/g);
  
  if (!separators) { // Si no hay separadores, podría ser un formato no esperado
    return null;
  }
  
  const separator = separators[0];
  const parts = datePart.split(separator).map(p => parseInt(p, 10));

  let day, month, year;

  if (parts.length === 3) {
    const [p1, p2, p3] = parts;

    // Asumir YYYY-MM-DD
    if (p1 > 1000) {
      year = p1;
      month = p2;
      day = p3;
    } 
    // Asumir DD-MM-YYYY o MM-DD-YYYY (priorizamos DD-MM si es ambiguo)
    else if (p3 > 1000) {
      year = p3;
      day = p1;
      month = p2;
    }
    // Si no es claro, no se puede procesar con seguridad
    else {
      return null;
    }
    
    if (day > 31 || month > 12) { // Intenta cambiar a formato MM/DD/YYYY si el día es > 12
        if (p1 <= 12 && p2 <=31) {
            day = p2;
            month = p1;
        } else {
             return null;
        }
    }

    const finalDay = String(day).padStart(2, '0');
    const finalMonth = String(month).padStart(2, '0');
    return `${finalDay}-${finalMonth}-${year}`;
  }

  return null;
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

      // 1. Crear un Set con todos los números de pedidos confirmados para una búsqueda rápida.
      const confirmedOrderNumbers = new Set(
        logisticsRecords.map((record) => normalizeOrderNumber(record['PEDIDO']))
      );
      confirmedOrderNumbers.delete(''); // Eliminar valores vacíos si los hubiera

      const dailyData: Record<string, DailyMetric> = {};

      // 2. Procesar archivo de Shopify
      for (const record of shopifyRecords) {
        const orderNumberWithPrefix = record['Name'];
        const createdAt = record['Created at'];

        if (!createdAt || !orderNumberWithPrefix) continue;
        
        const formattedDate = formatDate(createdAt);
        if (!formattedDate) continue;

        const orderNumber = normalizeOrderNumber(orderNumberWithPrefix);
        if (!orderNumber) continue;

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
