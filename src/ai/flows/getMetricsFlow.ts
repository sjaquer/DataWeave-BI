
'use server';
/**
 * @fileOverview Flujo para obtener y consolidar todas las métricas de Firestore.
 * Este flujo actúa como una capa de abstracción para leer los datos pre-agregados
 * desde Firestore, preparándolos para ser consumidos por el dashboard.
 * No utiliza IA, pero se mantiene dentro de la estructura de flujos para consistencia.
 */

import { db } from '@/lib/firebase-admin';
import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { GetMetricsOutputSchema, type GetMetricsOutput } from '@/ai/schemas/getMetricsSchema';


// Define el flujo de Genkit.
const getMetricsFlow = ai.defineFlow(
  {
    name: 'getMetricsFlow',
    inputSchema: z.void(),
    outputSchema: GetMetricsOutputSchema,
  },
  async () => {

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const ordersCollectionRef = db.collection('shopify_orders').where('createdAt', '>=', sixMonthsAgo);
    const querySnapshot = await ordersCollectionRef.get();

    if (querySnapshot.empty) {
      return {
        dailyMetrics: [],
        provinceMetrics: [],
        productMetrics: [],
        personnelMetrics: [],
        storeMetrics: [],
        miscMetrics: { globalConfirmed: 0, globalUnconfirmed: 0 },
      };
    }
    
    const orders: any[] = querySnapshot.docs.map(doc => doc.data());

    // --- Agregación de Datos ---
    let totalConfirmed = 0;
    let totalUnconfirmed = 0;
    const dailyData: { [key: string]: { confirmed: number; unconfirmed: number, byStore: { [store: string]: { confirmed: number, unconfirmed: number } } } } = {};
    const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
    const productData: { [key: string]: number } = {};
    const personnelData: { [key: string]: number } = {};
    const storeData: { [key: string]: { totalOrders: number, confirmedOrders: number } } = {};


    orders.forEach((order) => {
      const isOrderConfirmed = order.isConfirmed === true;
      const storeName = order.storeId || 'Desconocida';
      
      isOrderConfirmed ? totalConfirmed++ : totalUnconfirmed++;
      
      // Daily Metrics
      if (order.createdAt && typeof order.createdAt.toDate === 'function') {
        const orderDate = order.createdAt.toDate();
        const dateStr = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;
        
        if (!dailyData[dateStr]) {
            dailyData[dateStr] = { confirmed: 0, unconfirmed: 0, byStore: {} };
        }
        if (!dailyData[dateStr].byStore[storeName]) {
            dailyData[dateStr].byStore[storeName] = { confirmed: 0, unconfirmed: 0 };
        }

        if (isOrderConfirmed) {
            dailyData[dateStr].confirmed++;
            dailyData[dateStr].byStore[storeName].confirmed++;
        } else {
            dailyData[dateStr].unconfirmed++;
            dailyData[dateStr].byStore[storeName].unconfirmed++;
        }
      }

      // Province Metrics
      const rawProvince = order.province || 'Desconocida';
      if (!provinceData[rawProvince]) provinceData[rawProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
      provinceData[rawProvince].totalOrders++;
      provinceData[rawProvince].totalSpent += order.totalPrice || 0;
      if (isOrderConfirmed) provinceData[rawProvince].confirmedOrders++;
      
      // Product Metrics
      if (order.products && Array.isArray(order.products)) {
          order.products.forEach((product: { title: string }) => {
              const rawProduct = product.title || 'Producto Desconocido';
              const cleanedProduct = rawProduct.replace(/^[0-9]+\s*x\s+/i, '').trim();
              productData[cleanedProduct] = (productData[cleanedProduct] || 0) + 1;
          });
      }
      
      // Personnel Metrics
      if (isOrderConfirmed && order.confirmedBy) {
          const person = order.confirmedBy || 'No especificado';
          personnelData[person] = (personnelData[person] || 0) + 1;
      }

      // Store Metrics
      if (!storeData[storeName]) {
          storeData[storeName] = { totalOrders: 0, confirmedOrders: 0 };
      }
      storeData[storeName].totalOrders++;
      if (isOrderConfirmed) {
          storeData[storeName].confirmedOrders++;
      }
    });
    
    // --- Preparación de Datos para el UI ---
    const aggregatedDailyMetrics: any[] = Object.entries(dailyData).map(([date, data]) => {
        const dailyTotal = data.confirmed + data.unconfirmed;
        return { 
          date, 
          totalOrders: dailyTotal, 
          confirmed: data.confirmed, 
          unconfirmed: data.unconfirmed, 
          confirmationRate: dailyTotal > 0 ? (data.confirmed / dailyTotal) * 100 : 0,
          byStore: data.byStore 
        };
    }).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

    const aggregatedProvinceMetrics: any[] = Object.entries(provinceData).map(([name, data]) => ({
      name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
    })).sort((a, b) => b.totalOrders - a.totalOrders);

    const aggregatedProductMetrics: any[] = Object.entries(productData).map(([name, totalOrders]) => ({
        name, totalOrders
    })).sort((a, b) => b.totalOrders - a.totalOrders);

    const aggregatedPersonnelMetrics: any[] = Object.entries(personnelData).map(([name, confirmedOrders]) => ({
        name, confirmedOrders
    })).sort((a, b) => b.confirmedOrders - a.confirmedOrders);
    
    const aggregatedStoreMetrics: any[] = Object.entries(storeData).map(([name, data]) => ({
        name,
        ...data,
        confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
    }));

    const miscMetrics = {
        globalConfirmed: totalConfirmed,
        globalUnconfirmed: totalUnconfirmed
    };

    return {
      dailyMetrics: aggregatedDailyMetrics,
      provinceMetrics: aggregatedProvinceMetrics,
      productMetrics: aggregatedProductMetrics,
      personnelMetrics: aggregatedPersonnelMetrics,
      storeMetrics: aggregatedStoreMetrics,
      miscMetrics: miscMetrics,
    };
  }
);


// Exporta una función wrapper para ser llamada desde el cliente.
export async function getMetrics(): Promise<GetMetricsOutput> {
    return getMetricsFlow();
}
