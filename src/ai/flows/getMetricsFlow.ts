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
import { GetMetricsInputSchema, GetMetricsOutputSchema, type GetMetricsInput, type GetMetricsOutput } from '@/ai/schemas/getMetricsSchema';

// Función para ajustar la zona horaria. UTC-5 para ser consistente con la región.
const adjustToLocalTimezone = (date: Date): Date => {
  const offset = 5 * 60; // Desfase de 5 horas en minutos
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate;
};


// Define el flujo de Genkit.
const getMetricsFlow = ai.defineFlow(
  {
    name: 'getMetricsFlow',
    inputSchema: GetMetricsInputSchema,
    outputSchema: GetMetricsOutputSchema,
  },
  async (input) => {
    // --- CONSULTAS A FIRESTORE ---
    let ordersQuery = db.collection('shopify_orders');
    let inventoryQuery = db.collection('inventory_movements');

    // Aplicar filtro de fecha si se proporciona
    if (input && input.startDate && input.endDate) {
      const startDate = new Date(input.startDate);
      const endDate = new Date(input.endDate);
      ordersQuery = ordersQuery.where('createdAt', '>=', startDate).where('createdAt', '<=', endDate);
      inventoryQuery = inventoryQuery.where('timestamp', '>=', startDate).where('timestamp', '<=', endDate);
    } else {
      // Por defecto, últimos 6 meses si no hay filtro
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      ordersQuery = ordersQuery.where('createdAt', '>=', sixMonthsAgo);
      inventoryQuery = inventoryQuery.where('timestamp', '>=', sixMonthsAgo);
    }
    
    const [ordersSnapshot, inventorySnapshot] = await Promise.all([
      ordersQuery.get(),
      inventoryQuery.get()
    ]);
    
    // --- INICIALIZACIÓN DE DATOS AGREGADOS ---
    const orders: any[] = ordersSnapshot.docs.map(doc => doc.data());
    const inventoryMovements: any[] = inventorySnapshot.docs.map(doc => doc.data());

    let totalConfirmed = 0;
    let totalUnconfirmed = 0;
    const dailyData: { [key: string]: { confirmed: number; unconfirmed: number, byStore: { [store: string]: { confirmed: number, unconfirmed: number } } } } = {};
    const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
    const requestedProductData: { [key: string]: number } = {};
    const purchasedProductData: { [key: string]: number } = {};
    const storeData: { [key: string]: { totalOrders: number, confirmedOrders: number, totalSpent: number, topProducts: {[key: string]: number} } } = {};
    const personnelData: { [key: string]: number } = {};
    
    // --- INVENTARIO ---
    const inventoryFlowData: { [key: string]: { inflow: number; outflow: number } } = {};
    const mostMovedProductsData: { [key: string]: number } = {};
    const inventoryPersonnelData: { [key: string]: { entries: number; exits: number } } = {};


    // --- PROCESAMIENTO DE PEDIDOS (Orders) ---
    orders.forEach((order) => {
      const isOrderConfirmed = order.isConfirmed === true;
      const storeName = order.storeId || 'Desconocida';
      
      isOrderConfirmed ? totalConfirmed++ : totalUnconfirmed++;
      
      // Daily Metrics con ajuste de zona horaria
      if (order.createdAt && typeof order.createdAt.toDate === 'function') {
        const utcDate = order.createdAt.toDate();
        const localDate = adjustToLocalTimezone(utcDate); // Ajustamos a UTC-5
        
        const dateStr = `${String(localDate.getUTCDate()).padStart(2, '0')}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${localDate.getUTCFullYear()}`;
        
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
      if (!provinceData[rawProvince]) {
        provinceData[rawProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
      }
      provinceData[rawProvince].totalOrders++;
      provinceData[rawProvince].totalSpent += order.totalPrice || 0;
      if (isOrderConfirmed) provinceData[rawProvince].confirmedOrders++;
      
      // Product Metrics
      if (order.products && Array.isArray(order.products)) {
          order.products.forEach((product: { title: string }) => {
              if (!product || !product.title) return;
              const rawProduct = product.title;
              const cleanedProduct = rawProduct.replace(/^[0-9]+\s*x\s+/i, '').trim();
              
              requestedProductData[cleanedProduct] = (requestedProductData[cleanedProduct] || 0) + 1;
              if (isOrderConfirmed) {
                  purchasedProductData[cleanedProduct] = (purchasedProductData[cleanedProduct] || 0) + 1;

                  // Store-specific top products
                  if (storeData[storeName]) {
                    storeData[storeName].topProducts[cleanedProduct] = (storeData[storeName].topProducts[cleanedProduct] || 0) + 1;
                  }
              }
          });
      }
      
      // Personnel Metrics (from confirmed orders)
      if (isOrderConfirmed && order.confirmedBy) {
          const person = order.confirmedBy || 'No especificado';
          personnelData[person] = (personnelData[person] || 0) + 1;
      }

      // Store Metrics
      if (!storeData[storeName]) {
          storeData[storeName] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0, topProducts: {} };
      }
      storeData[storeName].totalOrders++;
      storeData[storeName].totalSpent += order.totalPrice || 0;
      if (isOrderConfirmed) {
          storeData[storeName].confirmedOrders++;
      }
    });

    // --- PROCESAMIENTO DE INVENTARIO (Inventory Movements) ---
    inventoryMovements.forEach((mov) => {
        const movDate = mov.timestamp?.toDate();
        const quantity = Math.abs(mov.quantity || 0);
        const user = mov.user || 'No especificado';

        if (movDate) {
             const localDate = adjustToLocalTimezone(movDate);
             const dateStr = `${String(localDate.getUTCDate()).padStart(2, '0')}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${localDate.getUTCFullYear()}`;
             
            if (!inventoryFlowData[dateStr]) {
                inventoryFlowData[dateStr] = { inflow: 0, outflow: 0 };
            }

            if (mov.type === 'ENTRADA') {
                inventoryFlowData[dateStr].inflow += quantity;
            } else if (mov.type === 'SALIDA') {
                inventoryFlowData[dateStr].outflow += quantity;
            }
        }
        
        if (mov.type === 'SALIDA') {
            if (mov.productName) {
                mostMovedProductsData[mov.productName] = (mostMovedProductsData[mov.productName] || 0) + 1;
            }
        }

        if (!inventoryPersonnelData[user]) {
            inventoryPersonnelData[user] = { entries: 0, exits: 0 };
        }
        if (mov.type === 'ENTRADA') {
            inventoryPersonnelData[user].entries++;
        } else if (mov.type === 'SALIDA') {
            inventoryPersonnelData[user].exits++;
        }
    });
    
    // --- PREPARACIÓN DE DATOS PARA EL UI ---
    const aggregatedDailyMetrics: any[] = Object.entries(dailyData).map(([date, data]) => ({ 
        date, 
        totalOrders: data.confirmed + data.unconfirmed, 
        confirmed: data.confirmed, 
        unconfirmed: data.unconfirmed, 
        confirmationRate: (data.confirmed + data.unconfirmed) > 0 ? (data.confirmed / (data.confirmed + data.unconfirmed)) * 100 : 0,
        byStore: data.byStore 
    })).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

    const aggregatedProvinceMetrics: any[] = Object.entries(provinceData).map(([name, data]) => ({
      name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
    })).sort((a, b) => b.totalOrders - a.totalOrders);

    const aggregatedRequestedProducts: any[] = Object.entries(requestedProductData).map(([name, totalOrders]) => ({ name, totalOrders })).sort((a, b) => b.totalOrders - a.totalOrders);
    const aggregatedPurchasedProducts: any[] = Object.entries(purchasedProductData).map(([name, totalOrders]) => ({ name, totalOrders })).sort((a, b) => b.totalOrders - a.totalOrders);
    
    const aggregatedPersonnelMetrics: any[] = Object.entries(personnelData).map(([name, confirmedOrders]) => ({ name, confirmedOrders })).sort((a, b) => b.confirmedOrders - a.confirmedOrders);
    
    const aggregatedStoreMetrics = Object.entries(storeData).map(([name, data]) => {
      const topProducts = Object.entries(data.topProducts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([productName, count]) => ({ name: productName, count: count }));

      return {
          name,
          totalOrders: data.totalOrders,
          confirmedOrders: data.confirmedOrders,
          totalSpent: data.totalSpent,
          confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
          averageTicket: data.totalOrders > 0 ? data.totalSpent / data.totalOrders : 0,
          topProducts
      };
    });

    const aggregatedInventoryFlow: any[] = Object.entries(inventoryFlowData).map(([date, {inflow, outflow}]) => ({ date, Entradas: inflow, Salidas: outflow })).sort((a, b) => new Date(a.date.split('-').reverse().join('-')).getTime() - new Date(b.date.split('-').reverse().join('-')).getTime());
    
    const aggregatedMostMovedProducts: any[] = Object.entries(mostMovedProductsData).map(([name, movements]) => ({ name, movements })).sort((a, b) => b.movements - a.movements);
    
    const aggregatedInventoryPersonnel: any[] = Object.entries(inventoryPersonnelData).map(([name, data]) => ({ name, ...data })).sort((a,b) => (b.entries + b.exits) - (a.entries + a.exits));


    const miscMetrics = { globalConfirmed: totalConfirmed, globalUnconfirmed: totalUnconfirmed };

    return {
      dailyMetrics: aggregatedDailyMetrics,
      provinceMetrics: aggregatedProvinceMetrics,
      mostRequestedProducts: aggregatedRequestedProducts,
      mostPurchasedProducts: aggregatedPurchasedProducts,
      personnelMetrics: aggregatedPersonnelMetrics,
      storeMetrics: aggregatedStoreMetrics,
      miscMetrics: miscMetrics,
      inventoryFlowTrend: aggregatedInventoryFlow,
      mostMovedProducts: aggregatedMostMovedProducts,
      inventoryPersonnelMetrics: aggregatedInventoryPersonnel,
    };
  }
);

// Exporta una función wrapper para ser llamada desde el cliente.
export async function getMetrics(input: GetMetricsInput): Promise<GetMetricsOutput> {
    return getMetricsFlow(input);
}
