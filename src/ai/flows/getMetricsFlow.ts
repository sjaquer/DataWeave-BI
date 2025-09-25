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
    const storeData: { [key: string]: { totalOrders: number, confirmedOrders: number } } = {};
    const personnelData: { [key: string]: number } = {}; // Para Rendimiento del Personal (Pedidos)
    const inventoryOutflowData: { [key: string]: number } = {}; // Para Tendencia de Salida
    const mostMovedProductsData: { [key: string]: number } = {}; // Para Productos con más rotación

    // --- PROCESAMIENTO DE PEDIDOS (Orders) ---
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
          storeData[storeName] = { totalOrders: 0, confirmedOrders: 0 };
      }
      storeData[storeName].totalOrders++;
      if (isOrderConfirmed) {
          storeData[storeName].confirmedOrders++;
      }
    });

    // --- PROCESAMIENTO DE INVENTARIO (Inventory Movements) ---
    inventoryMovements.forEach((mov) => {
        if (mov.type === 'SALIDA') {
            const movDate = mov.timestamp?.toDate();
            if (movDate) {
                const dateStr = `${String(movDate.getDate()).padStart(2, '0')}-${String(movDate.getMonth() + 1).padStart(2, '0')}-${movDate.getFullYear()}`;
                const quantity = Math.abs(mov.quantity || 0); // Usamos valor absoluto para salidas

                // Tendencia de Salida
                inventoryOutflowData[dateStr] = (inventoryOutflowData[dateStr] || 0) + quantity;
            }

            // Productos más movidos
            if (mov.productName) {
                mostMovedProductsData[mov.productName] = (mostMovedProductsData[mov.productName] || 0) + 1;
            }
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
    
    const aggregatedStoreMetrics: any[] = Object.entries(storeData).map(([name, data]) => ({
        name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
    }));

    const aggregatedInventoryOutflow: any[] = Object.entries(inventoryOutflowData).map(([date, units]) => ({ date, units })).sort((a, b) => new Date(a.date.split('-').reverse().join('-')).getTime() - new Date(b.date.split('-').reverse().join('-')).getTime());
    
    const aggregatedMostMovedProducts: any[] = Object.entries(mostMovedProductsData).map(([name, movements]) => ({ name, movements })).sort((a, b) => b.movements - a.movements);

    const miscMetrics = { globalConfirmed: totalConfirmed, globalUnconfirmed: totalUnconfirmed };

    return {
      dailyMetrics: aggregatedDailyMetrics,
      provinceMetrics: aggregatedProvinceMetrics,
      mostRequestedProducts: aggregatedRequestedProducts,
      mostPurchasedProducts: aggregatedPurchasedProducts,
      personnelMetrics: aggregatedPersonnelMetrics,
      storeMetrics: aggregatedStoreMetrics,
      miscMetrics: miscMetrics,
      inventoryOutflowTrend: aggregatedInventoryOutflow,
      mostMovedProducts: aggregatedMostMovedProducts,
    };
  }
);

// Exporta una función wrapper para ser llamada desde el cliente.
export async function getMetrics(input: GetMetricsInput): Promise<GetMetricsOutput> {
    return getMetricsFlow(input);
}
