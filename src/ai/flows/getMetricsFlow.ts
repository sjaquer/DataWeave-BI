
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

// Función para formatear fecha de YYYY-MM-DD a DD-MM-YYYY
const formatChartDate = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${day}-${month}-${year}`;
}


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
    
    // Período de 14 días para cálculo de tendencias
    const trendEndDate = input?.endDate ? new Date(input.endDate) : new Date();
    const trendStartDate = new Date(trendEndDate);
    trendStartDate.setDate(trendEndDate.getDate() - 14);
    
    let trendOrdersQuery = db.collection('shopify_orders')
        .where('createdAt', '>=', trendStartDate)
        .where('createdAt', '<=', trendEndDate);


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
    
    const [ordersSnapshot, inventorySnapshot, trendOrdersSnapshot] = await Promise.all([
      ordersQuery.get(),
      inventoryQuery.get(),
      trendOrdersQuery.get()
    ]);
    
    // --- INICIALIZACIÓN DE DATOS AGREGADOS ---
    const orders: any[] = ordersSnapshot.docs.map(doc => doc.data());
    const inventoryMovements: any[] = inventorySnapshot.docs.map(doc => doc.data());
    const trendOrders: any[] = trendOrdersSnapshot.docs.map(doc => doc.data());

    let totalConfirmed = 0;
    let totalUnconfirmed = 0;
    const dailyData: { [key: string]: { confirmed: number; unconfirmed: number, byStore: { [store: string]: { confirmed: number, unconfirmed: number } } } } = {};
    const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
    const provinceDataByStore: { [store: string]: { [province: string]: { totalOrders: number, confirmedOrders: number, totalSpent: number } } } = {};
    const requestedProductData: { [key: string]: number } = {};
    const purchasedProductData: { [key: string]: number } = {};
    const storeData: { [key: string]: { totalOrders: number, confirmedOrders: number, totalSpent: number, topProducts: {[key: string]: number} } } = {};
    const personnelData: { [key: string]: number } = {};
    
    // --- INVENTARIO ---
    const inventoryFlowData: { [date: string]: { [store: string]: { inflow: number; outflow: number } } } = {};
    const mostMovedProductsData: { [store: string]: { [product: string]: number } } = {};
    const mostIncomingProductsData: { [store: string]: { [product: string]: number } } = {};
    const inventoryPersonnelData: { [user: string]: { entries: number; exits: number } } = {};
    const customerReturnsData: any[] = [];
    const mostReturnedProductsData: { [store: string]: { [product: string]: number } } = {};
    const latestMovements: { [sku: string]: any } = {};


    // --- PROCESAMIENTO DE PEDIDOS (Orders) ---
    orders.forEach((order) => {
      const isOrderConfirmed = order.isConfirmed === true;
      const storeName = order.storeId || 'Desconocida';
      
      isOrderConfirmed ? totalConfirmed++ : totalUnconfirmed++;
      
      // Daily Metrics con ajuste de zona horaria
      if (order.createdAt && typeof order.createdAt.toDate === 'function') {
        const utcDate = order.createdAt.toDate();
        const localDate = adjustToLocalTimezone(utcDate); // Ajustamos a UTC-5
        
        const dateStr = `${String(localDate.getUTCFullYear())}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`;
        
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

      // Province Metrics By Store
      if (storeName !== 'Desconocida') {
        if (!provinceDataByStore[storeName]) provinceDataByStore[storeName] = {};
        if (!provinceDataByStore[storeName][rawProvince]) {
          provinceDataByStore[storeName][rawProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
        }
        provinceDataByStore[storeName][rawProvince].totalOrders++;
        provinceDataByStore[storeName][rawProvince].totalSpent += order.totalPrice || 0;
        if (isOrderConfirmed) provinceDataByStore[storeName][rawProvince].confirmedOrders++;
      }
      
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
        const quantity = Number(mov.quantity || 0);
        const user = mov.user || 'No especificado';
        const store = mov.store || 'N/A';
        let dateStr = "";

        if (movDate) {
             const localDate = adjustToLocalTimezone(movDate);
             dateStr = `${String(localDate.getUTCFullYear())}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`;
             
            if (!inventoryFlowData[dateStr]) inventoryFlowData[dateStr] = {};
            if (!inventoryFlowData[dateStr][store]) inventoryFlowData[dateStr][store] = { inflow: 0, outflow: 0 };
            
            if (quantity > 0) {
                inventoryFlowData[dateStr][store].inflow += quantity;
            } else if (quantity < 0) {
                inventoryFlowData[dateStr][store].outflow += Math.abs(quantity);
            }
        }
        
        if (mov.productName) {
            if (!mostMovedProductsData[store]) mostMovedProductsData[store] = {};
            if (!mostIncomingProductsData[store]) mostIncomingProductsData[store] = {};
            
            if (quantity < 0) {
                mostMovedProductsData[store][mov.productName] = (mostMovedProductsData[store][mov.productName] || 0) + Math.abs(quantity);
            }
            if (quantity > 0) {
                mostIncomingProductsData[store][mov.productName] = (mostIncomingProductsData[store][mov.productName] || 0) + quantity;
            }
        }

        if (!inventoryPersonnelData[user]) {
            inventoryPersonnelData[user] = { entries: 0, exits: 0 };
        }
        if (quantity > 0) {
            inventoryPersonnelData[user].entries += quantity;
        } else if (quantity < 0) {
            inventoryPersonnelData[user].exits += Math.abs(quantity);
        }

        if (mov.reason === "DEVOLUCION DE CLIENTE") {
            customerReturnsData.push({
                date: dateStr ? formatChartDate(dateStr) : 'Fecha Desconocida',
                productName: mov.productName || 'N/A',
                quantity: quantity,
                user: user,
                orderNumber: mov.orderNumber || 'N/A',
                store: store
            });

            if (mov.productName && quantity > 0) {
                if (!mostReturnedProductsData[store]) mostReturnedProductsData[store] = {};
                mostReturnedProductsData[store][mov.productName] = (mostReturnedProductsData[store][mov.productName] || 0) + quantity;
            }
        }
        
        const sku = mov.sku;
        if (sku) {
            if (!latestMovements[sku] || (movDate && latestMovements[sku].timestamp?.toDate() && movDate > latestMovements[sku].timestamp?.toDate())) {
                latestMovements[sku] = mov;
            }
        }
    });

    // --- CÁLCULO DE TENDENCIAS ---
    const storeTrendData: { [key: string]: { currentWeek: number, previousWeek: number } } = {};
    const sevenDaysAgo = new Date(trendEndDate);
    sevenDaysAgo.setDate(trendEndDate.getDate() - 7);

    trendOrders.forEach(order => {
        const storeName = order.storeId || 'Desconocida';
        if (order.isConfirmed) {
            const orderDate = order.createdAt.toDate();
            if (!storeTrendData[storeName]) {
                storeTrendData[storeName] = { currentWeek: 0, previousWeek: 0 };
            }
            if (orderDate >= sevenDaysAgo) {
                storeTrendData[storeName].currentWeek++;
            } else {
                storeTrendData[storeName].previousWeek++;
            }
        }
    });
    
    // --- PREPARACIÓN DE DATOS PARA EL UI ---
    
    const aggregatedDailyMetrics: any[] = Object.entries(dailyData).map(([date, data]) => ({ 
        date: formatChartDate(date), 
        totalOrders: data.confirmed + data.unconfirmed, 
        confirmed: data.confirmed, 
        unconfirmed: data.unconfirmed, 
        confirmationRate: (data.confirmed + data.unconfirmed) > 0 ? (data.confirmed / (data.confirmed + data.unconfirmed)) * 100 : 0,
        byStore: data.byStore 
    })).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

    const aggregatedProvinceMetrics: any[] = Object.entries(provinceData).map(([name, data]) => ({
      name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
    })).sort((a, b) => b.totalOrders - a.totalOrders);
    
    const aggregatedProvinceMetricsByStore: { [key: string]: any[] } = {};
    Object.entries(provinceDataByStore).forEach(([store, provinces]) => {
      aggregatedProvinceMetricsByStore[store] = Object.entries(provinces).map(([name, data]) => ({
        name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
      })).sort((a,b) => b.totalOrders - a.totalOrders);
    });

    const aggregatedRequestedProducts: any[] = Object.entries(requestedProductData).map(([name, totalOrders]) => ({ name, totalOrders })).sort((a, b) => b.totalOrders - a.totalOrders);
    const aggregatedPurchasedProducts: any[] = Object.entries(purchasedProductData).map(([name, totalOrders]) => ({ name, totalOrders })).sort((a, b) => b.totalOrders - a.totalOrders);
    
    const aggregatedPersonnelMetrics: any[] = Object.entries(personnelData).map(([name, confirmedOrders]) => ({ name, confirmedOrders })).sort((a, b) => b.confirmedOrders - a.confirmedOrders);
    
    const aggregatedStoreMetrics = Object.entries(storeData).map(([name, data]) => {
      const topProducts = Object.entries(data.topProducts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([productName, count]) => ({ name: productName, count: count }));

      const trend = storeTrendData[name];
      let sevenDayTrend = 0;
      if (trend && trend.previousWeek > 0) {
        sevenDayTrend = ((trend.currentWeek - trend.previousWeek) / trend.previousWeek) * 100;
      } else if (trend && trend.currentWeek > 0) {
        sevenDayTrend = 100; // Crecimiento "infinito" si antes era 0
      }

      return {
          name,
          totalOrders: data.totalOrders,
          confirmedOrders: data.confirmedOrders,
          totalSpent: data.totalSpent,
          confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
          averageTicket: data.totalOrders > 0 ? data.totalSpent / data.totalOrders : 0,
          topProducts,
          sevenDayTrend
      };
    });

    const aggregatedInventoryFlow: any[] = [];
    Object.entries(inventoryFlowData).forEach(([date, stores]) => {
        Object.entries(stores).forEach(([store, {inflow, outflow}]) => {
            aggregatedInventoryFlow.push({ date: formatChartDate(date), Entradas: inflow, Salidas: outflow, store });
        });
    });
    aggregatedInventoryFlow.sort((a, b) => new Date(a.date.split('-').reverse().join('-')).getTime() - new Date(b.date.split('-').reverse().join('-')).getTime());

    const aggregatedMostMovedProducts: any[] = [];
    Object.entries(mostMovedProductsData).forEach(([store, products]) => {
        Object.entries(products).forEach(([name, movements]) => {
            aggregatedMostMovedProducts.push({ name, movements, store });
        });
    });
    aggregatedMostMovedProducts.sort((a, b) => b.movements - a.movements);

    const aggregatedMostIncomingProducts: any[] = [];
    Object.entries(mostIncomingProductsData).forEach(([store, products]) => {
        Object.entries(products).forEach(([name, movements]) => {
            aggregatedMostIncomingProducts.push({ name, movements, store });
        });
    });
    aggregatedMostIncomingProducts.sort((a, b) => b.movements - a.movements);
    
    const aggregatedInventoryPersonnel: any[] = Object.entries(inventoryPersonnelData).map(([name, data]) => ({ name, ...data })).sort((a,b) => (b.entries + b.exits) - (a.entries + a.exits));

    const aggregatedCustomerReturns = customerReturnsData.sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

    const aggregatedMostReturnedProducts: any[] = [];
    Object.entries(mostReturnedProductsData).forEach(([store, products]) => {
        Object.entries(products).forEach(([name, returns]) => {
            aggregatedMostReturnedProducts.push({ name, returns, store });
        });
    });
    aggregatedMostReturnedProducts.sort((a, b) => b.returns - a.returns);
    
    const aggregatedCurrentInventory: any[] = Object.values(latestMovements).map(mov => {
        const movDate = mov.timestamp?.toDate();
        const localDate = movDate ? adjustToLocalTimezone(movDate) : new Date();
        return {
            sku: String(mov.sku || 'N/A'),
            productName: String(mov.productName || 'N/A'),
            store: mov.store || 'N/A',
            currentStock: mov.stockAfter,
            lastMovementDate: formatChartDate(`${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`),
        };
    }).sort((a,b) => String(a.productName || '').localeCompare(String(b.productName || '')));

    // --- NUEVA LOGICA: PREVISIÓN DE COMPRA ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOutflows: { [productName: string]: number } = {};

    const recentMovementsSnapshot = await db.collection('inventory_movements')
        .where('timestamp', '>=', thirtyDaysAgo)
        .get();
        
    recentMovementsSnapshot.docs.forEach(doc => {
        const mov = doc.data();
        if (Number(mov.quantity) < 0 && mov.productName) {
            recentOutflows[mov.productName] = (recentOutflows[mov.productName] || 0) + Math.abs(Number(mov.quantity));
        }
    });
    
    const purchaseForecast: any[] = Object.entries(recentOutflows).map(([productName, last30dSales]) => {
        const currentStockItem = aggregatedCurrentInventory.find(item => item.productName === productName);
        const currentStock = currentStockItem ? currentStockItem.currentStock : 0;
        const suggestedPurchase = Math.max(0, last30dSales - currentStock);

        return {
            productName,
            last30dSales,
            currentStock,
            suggestedPurchase,
        };
    }).sort((a, b) => b.suggestedPurchase - a.suggestedPurchase);

    // --- NUEVA LÓGICA: TASA DE CONFIRMACIÓN POR PRODUCTO ---
    const aggregatedProductConfirmationRates = Object.keys(requestedProductData).map(name => {
        const requested = requestedProductData[name] || 0;
        const confirmed = purchasedProductData[name] || 0;
        const confirmationRate = requested > 0 ? (confirmed / requested) * 100 : 0;
        return { name, requested, confirmed, confirmationRate };
    }).sort((a, b) => b.requested - a.requested); // Ordenar por los más pedidos


    // Cálculo de variación diaria
    let dailyOrderVariation = 0;
    if (aggregatedDailyMetrics.length >= 2) {
        const todayOrders = aggregatedDailyMetrics[0].totalOrders;
        const yesterdayOrders = aggregatedDailyMetrics[1].totalOrders;
        if (yesterdayOrders > 0) {
            dailyOrderVariation = ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100;
        } else if (todayOrders > 0) {
            dailyOrderVariation = 100;
        }
    }
    
    // --- NUEVA LÓGICA PARA GRÁFICO COMPARATIVO DE TIENDAS ---
    const storePerformanceData = Object.entries(dailyData).map(([date, data]) => {
      const dailyStoreValues: { [key: string]: any } = { date: formatChartDate(date) };
      Object.entries(data.byStore).forEach(([storeName, storeData]) => {
          dailyStoreValues[storeName] = storeData.confirmed;
      });
      return dailyStoreValues;
    }).sort((a, b) => new Date(a.date.split('-').reverse().join('-')).getTime() - new Date(b.date.split('-').reverse().join('-')).getTime());


    const miscMetrics = { 
      globalConfirmed: totalConfirmed, 
      globalUnconfirmed: totalUnconfirmed,
      dailyOrderVariation: dailyOrderVariation
    };

    return {
      dailyMetrics: aggregatedDailyMetrics,
      provinceMetrics: aggregatedProvinceMetrics,
      provinceMetricsByStore: aggregatedProvinceMetricsByStore,
      mostRequestedProducts: aggregatedRequestedProducts,
      mostPurchasedProducts: aggregatedPurchasedProducts,
      productConfirmationRates: aggregatedProductConfirmationRates,
      personnelMetrics: aggregatedPersonnelMetrics,
      storeMetrics: aggregatedStoreMetrics,
      miscMetrics: miscMetrics,
      inventoryFlowTrend: aggregatedInventoryFlow,
      mostMovedProducts: aggregatedMostMovedProducts,
      mostIncomingProducts: aggregatedMostIncomingProducts,
      inventoryPersonnelMetrics: aggregatedInventoryPersonnel,
      dailyStorePerformance: storePerformanceData,
      customerReturns: aggregatedCustomerReturns,
      mostReturnedProducts: aggregatedMostReturnedProducts,
      currentInventory: aggregatedCurrentInventory,
      purchaseForecast: purchaseForecast,
    };
  }
);

// Exporta una función wrapper para ser llamada desde el cliente.
export async function getMetrics(input: GetMetricsInput): Promise<GetMetricsOutput> {
    return getMetricsFlow(input);
}

    