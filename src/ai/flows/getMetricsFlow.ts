
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
    
    const startDate = input?.startDate ? new Date(input.startDate) : null;
    const endDate = input?.endDate ? new Date(input.endDate) : null;

    // --- CONSULTAS A FIRESTORE ---
    let confirmedOrdersQuery = db.collection('shopify_orders').where('isConfirmed', '==', true);
    if (startDate && endDate) {
      confirmedOrdersQuery = confirmedOrdersQuery.where('confirmedAt', '>=', startDate).where('confirmedAt', '<=', endDate);
    }

    let deliveredOrdersQuery = db.collection('shopify_orders').where('isDelivered', '==', true);
    if (startDate && endDate) {
        deliveredOrdersQuery = deliveredOrdersQuery.where('deliveredAt', '>=', startDate).where('deliveredAt', '<=', endDate);
    }
    
    let allOrdersQuery = db.collection('shopify_orders');
     if (startDate && endDate) {
      allOrdersQuery = allOrdersQuery.where('createdAt', '>=', startDate).where('createdAt', '<=', endDate);
    }

    let inventoryQuery = db.collection('inventory_movements');
    if (startDate && endDate) {
      inventoryQuery = inventoryQuery.where('timestamp', '>=', startDate).where('timestamp', '<=', endDate);
    }
    
    const [confirmedOrdersSnapshot, deliveredOrdersSnapshot, allOrdersSnapshot, inventorySnapshot] = await Promise.all([
      confirmedOrdersQuery.get(),
      deliveredOrdersQuery.get(),
      allOrdersQuery.get(),
      inventoryQuery.get(),
    ]);
    
    // --- INICIALIZACIÓN DE DATOS AGREGADOS ---
    const confirmedOrders: any[] = confirmedOrdersSnapshot.docs.map(doc => doc.data());
    const deliveredOrders: any[] = deliveredOrdersSnapshot.docs.map(doc => doc.data());
    const allOrders: any[] = allOrdersSnapshot.docs.map(doc => doc.data());
    const inventoryMovements: any[] = inventorySnapshot.docs.map(doc => doc.data());

    let totalConfirmed = 0;
    let totalUnconfirmed = 0;
    const dailyData: { [key: string]: { confirmed: number; unconfirmed: number, byStore: { [store: string]: { confirmed: number, unconfirmed: number } }, revenue: number } } = {};
    const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
    const provinceDataByStore: { [store: string]: { [province: string]: { totalOrders: number, confirmedOrders: number, totalSpent: number } } } = {};
    const requestedProductData: { [key: string]: number } = {};
    const purchasedProductData: { [key: string]: number } = {};
    const storeData: { [key: string]: { totalOrders: number, confirmedOrders: number, totalSpent: number, topProducts: {[key: string]: number}, dailyConfirmed: {[date: string]: {confirmed: number, total: number, rate: number}} } } = {};
    const personnelData: { [key: string]: number } = {};
    const courierData: { [key: string]: { shipments: number, revenue: number, provinces: Set<string> } } = {};
    const paymentMethodData: { [key: string]: { orders: number, revenue: number } } = {};
    
    // --- INVENTARIO ---
    const inventoryFlowData: { [date: string]: { [store: string]: { inflow: number; outflow: number } } } = {};
    const mostMovedProductsData: { [store: string]: { [product: string]: number } } = {};
    const mostIncomingProductsData: { [store: string]: { [product: string]: number } } = {};
    const inventoryPersonnelData: { [user: string]: { entries: number; exits: number } } = {};
    const customerReturnsData: any[] = [];
    const mostReturnedProductsData: { [store: string]: { [product: string]: number } } = {};
    const latestMovements: { [sku: string]: any } = {};


    // --- PROCESAMIENTO DE TODOS LOS PEDIDOS (para métricas globales) ---
    allOrders.forEach((order) => {
        const isOrderConfirmed = order.isConfirmed === true;
        const storeName = order.storeId || 'Desconocida';

        // Conteo global
        isOrderConfirmed ? totalConfirmed++ : totalUnconfirmed++;

        // Daily Metrics para todos los pedidos
        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
            const utcDate = order.createdAt.toDate();
            const localDate = adjustToLocalTimezone(utcDate);
            const dateStr = `${String(localDate.getUTCFullYear())}-${String(localDate.getUTCMonth() + 1).padStart(2, '0')}-${String(localDate.getUTCDate()).padStart(2, '0')}`;
            
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { confirmed: 0, unconfirmed: 0, revenue: 0, byStore: {} };
            }
            if (!dailyData[dateStr].byStore[storeName]) {
                dailyData[dateStr].byStore[storeName] = { confirmed: 0, unconfirmed: 0 };
            }

            if (isOrderConfirmed) {
                dailyData[dateStr].confirmed++;
                dailyData[dateStr].byStore[storeName].confirmed++;
                dailyData[dateStr].revenue += order.totalPrice || 0;
            } else {
                dailyData[dateStr].unconfirmed++;
                dailyData[dateStr].byStore[storeName].unconfirmed++;
            }
        }
        
        // Product Metrics (solo pedidos)
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product: { title: string }) => {
                if (!product || !product.title) return;
                const rawProduct = product.title;
                const cleanedProduct = rawProduct.replace(/^[0-9]+\s*x\s+/i, '').trim();
                requestedProductData[cleanedProduct] = (requestedProductData[cleanedProduct] || 0) + 1;
            });
        }
    });

    // --- PROCESAMIENTO DE PEDIDOS CONFIRMADOS (para métricas de envío) ---
    confirmedOrders.forEach((order) => {
      const storeName = order.storeId || 'Desconocida';
      
      // Province Metrics
      const rawProvince = order.province || 'Desconocida';
      if (!provinceData[rawProvince]) {
        provinceData[rawProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
      }
      provinceData[rawProvince].totalOrders++; // Aquí usamos todos, pero el source ya está filtrado
      provinceData[rawProvince].confirmedOrders++;
      provinceData[rawProvince].totalSpent += order.totalPrice || 0;

      // Province Metrics By Store
      if (storeName !== 'Desconocida') {
        const lowerCaseStoreName = storeName.toLowerCase();
        if (!provinceDataByStore[lowerCaseStoreName]) provinceDataByStore[lowerCaseStoreName] = {};
        if (!provinceDataByStore[lowerCaseStoreName][rawProvince]) {
          provinceDataByStore[lowerCaseStoreName][rawProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
        }
        provinceDataByStore[lowerCaseStoreName][rawProvince].totalOrders++;
        provinceDataByStore[lowerCaseStoreName][rawProvince].confirmedOrders++;
        provinceDataByStore[lowerCaseStoreName][rawProvince].totalSpent += order.totalPrice || 0;
      }
      
      // Purchased Product Metrics
      if (order.products && Array.isArray(order.products)) {
          order.products.forEach((product: { title: string }) => {
              if (!product || !product.title) return;
              const rawProduct = product.title;
              const cleanedProduct = rawProduct.replace(/^[0-9]+\s*x\s+/i, '').trim();
              
              purchasedProductData[cleanedProduct] = (purchasedProductData[cleanedProduct] || 0) + 1;

              // Store-specific top products
               if (!storeData[storeName]) {
                  storeData[storeName] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0, topProducts: {}, dailyConfirmed: {} };
               }
               storeData[storeName].topProducts[cleanedProduct] = (storeData[storeName].topProducts[cleanedProduct] || 0) + 1;
          });
      }
      
      // Personnel Metrics
      if (order.confirmedBy) {
          const person = order.confirmedBy || 'No especificado';
          personnelData[person] = (personnelData[person] || 0) + 1;
      }

      // Courier Metrics
      const courierName = order.courier;
      if (courierName && courierName !== 'No especificado') {
          if (!courierData[courierName]) {
              courierData[courierName] = { shipments: 0, revenue: 0, provinces: new Set() };
          }
          courierData[courierName].shipments++;
          courierData[courierName].revenue += order.totalPrice || 0;
          if (order.province) {
              courierData[courierName].provinces.add(order.province);
          }
      }

      // Store Metrics
      if (!storeData[storeName]) {
          storeData[storeName] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0, topProducts: {}, dailyConfirmed: {} };
      }
      storeData[storeName].totalOrders++;
      storeData[storeName].confirmedOrders++;
      storeData[storeName].totalSpent += order.totalPrice || 0;
    });

    // --- PROCESAMIENTO DE PEDIDOS ENTREGADOS (para métodos de pago) ---
    deliveredOrders.forEach((order) => {
        if (order.paymentMethod) {
            const method = order.paymentMethod;
            if (!paymentMethodData[method]) {
                paymentMethodData[method] = { orders: 0, revenue: 0 };
            }
            paymentMethodData[method].orders++;
            paymentMethodData[method].revenue += order.totalPrice || 0;
        }
    });

    // --- Rellenar datos diarios para cada tienda ---
    const allStoreNames = Object.keys(storeData);
    const allDates = Object.keys(dailyData).sort();

    if (allDates.length > 0) {
      const startDate = new Date(allDates[0]);
      const endDate = new Date(allDates[allDates.length - 1]);
      
      for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        
        for (const storeName of allStoreNames) {
          const dailyStoreData = dailyData[dateStr]?.byStore?.[storeName] || { confirmed: 0, unconfirmed: 0 };
          const total = dailyStoreData.confirmed + dailyStoreData.unconfirmed;
          
          if (!storeData[storeName].dailyConfirmed[dateStr]) {
            storeData[storeName].dailyConfirmed[dateStr] = {
              total: total,
              confirmed: dailyStoreData.confirmed,
              rate: total > 0 ? (dailyStoreData.confirmed / total) * 100 : 0
            };
          } else {
             storeData[storeName].dailyConfirmed[dateStr].total = total;
             storeData[storeName].dailyConfirmed[dateStr].confirmed = dailyStoreData.confirmed;
             storeData[storeName].dailyConfirmed[dateStr].rate = total > 0 ? (dailyStoreData.confirmed / total) * 100 : 0;
          }
        }
      }
    }

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

    // --- PREPARACIÓN DE DATOS PARA EL UI ---
    
    const aggregatedDailyMetrics: any[] = Object.entries(dailyData).map(([date, data]) => ({ 
        date: formatChartDate(date), 
        totalOrders: data.confirmed + data.unconfirmed, 
        confirmed: data.confirmed, 
        unconfirmed: data.unconfirmed, 
        ingresos: data.revenue,
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
    
    // Aggregate Courier Metrics
    const totalShipments = Object.values(courierData).reduce((sum, c) => sum + c.shipments, 0);
    const aggregatedCourierMetrics: any[] = Object.entries(courierData).map(([name, data]) => ({
        name,
        totalShipments: data.shipments,
        totalRevenue: data.revenue,
        averageOrderValue: data.shipments > 0 ? data.revenue / data.shipments : 0,
        provinceCount: data.provinces.size,
        percentageOfTotal: totalShipments > 0 ? (data.shipments / totalShipments) * 100 : 0,
    })).sort((a, b) => b.totalShipments - a.totalShipments);

    // Aggregate Payment Method Metrics
    const totalPaymentOrders = Object.values(paymentMethodData).reduce((sum, p) => sum + p.orders, 0);
    const aggregatedPaymentMethodMetrics: any[] = Object.entries(paymentMethodData).map(([method, data]) => ({
        method,
        totalOrders: data.orders,
        totalRevenue: data.revenue,
        averageOrderValue: data.orders > 0 ? data.revenue / data.orders : 0,
        percentageOfTotal: totalPaymentOrders > 0 ? (data.orders / totalPaymentOrders) * 100 : 0,
    })).sort((a, b) => b.totalOrders - a.totalOrders);
    
    const aggregatedStoreMetrics = Object.entries(storeData).map(([name, data]) => {
      const topProducts = Object.entries(data.topProducts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([productName, count]) => ({ name: productName, count: count }));

      const sortedDailyKeys = Object.keys(data.dailyConfirmed).sort((a,b) => new Date(b).getTime() - new Date(a).getTime());
      
      let dailyOrderVariation = 0;
      let confirmationRateTrend = 0;

      if (sortedDailyKeys.length >= 2) {
          const todayData = data.dailyConfirmed[sortedDailyKeys[0]];
          const yesterdayData = data.dailyConfirmed[sortedDailyKeys[1]];
          
          if (todayData && yesterdayData) {
            if (yesterdayData.total > 0) {
              dailyOrderVariation = ((todayData.total - yesterdayData.total) / yesterdayData.total) * 100;
            } else if (todayData.total > 0) {
                dailyOrderVariation = 100;
            }
            confirmationRateTrend = todayData.rate - yesterdayData.rate;
          }
      }

      return {
          name,
          totalOrders: data.totalOrders,
          confirmedOrders: data.confirmedOrders,
          totalSpent: data.totalSpent,
          confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
          averageTicket: data.totalOrders > 0 ? data.totalSpent / data.totalOrders : 0,
          topProducts,
          dailyOrderVariation,
          confirmationRateTrend,
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

    // --- NUEVA LOGICA: PREVISIÓN DE COMPRA (MODELO PREDICTIVO) ---
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
    
    const purchaseForecast: any[] = Object.values(aggregatedCurrentInventory).map(item => {
        const productName = item.productName;
        const last30dSales = recentOutflows[productName] || 0;
        const currentStock = item.currentStock || 0;
        const dailyVelocity = last30dSales / 30;
        const daysLeft = dailyVelocity > 0 ? Math.floor(currentStock / dailyVelocity) : 365;

        let urgency;
        if (daysLeft <= 7) {
            urgency = 'Urgente (Comprar Ya)';
        } else if (daysLeft <= 15) {
            urgency = 'Pronto (Próxima Semana)';
        } else if (daysLeft <= 30) {
            urgency = 'Revisar (Próximo Mes)';
        } else {
            urgency = 'Stock Saludable';
        }
        
        return {
            productName,
            last30dSales,
            currentStock,
            daysLeft,
            urgency,
            suggestedPurchase: Math.max(0, last30dSales - currentStock),
        };
    }).sort((a, b) => a.daysLeft - b.daysLeft);


    // --- NUEVA LÓGICA: TASA DE CONFIRMACIÓN POR PRODUCTO ---
    const aggregatedProductConfirmationRates = Object.keys(requestedProductData).map(name => {
        const requested = requestedProductData[name] || 0;
        const confirmed = purchasedProductData[name] || 0;
        const confirmationRate = requested > 0 ? (confirmed / requested) * 100 : 0;
        return { name, requested, confirmed, confirmationRate };
    }).sort((a, b) => b.requested - a.requested); // Ordenar por los más pedidos

    // --- NUEVA LÓGICA: REPORTE MENSUAL DE PRODUCTOS ---
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevMonth = new Date(today.getFullYear(), today.getMonth() - 2, 1);

    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59);

    const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
    const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59);

    const monthlySales: { [sku: string]: { lastMonth: number, prevMonth: number } } = {};

    inventoryMovements.forEach(mov => {
        const movDate = mov.timestamp?.toDate();
        const quantity = Math.abs(Number(mov.quantity || 0));

        if (mov.sku && quantity > 0 && mov.type === 'SALIDA' && movDate) {
             if (!monthlySales[mov.sku]) {
                monthlySales[mov.sku] = { lastMonth: 0, prevMonth: 0 };
            }
            if (movDate >= lastMonthStart && movDate <= lastMonthEnd) {
                monthlySales[mov.sku].lastMonth += quantity;
            }
            if (movDate >= prevMonthStart && movDate <= prevMonthEnd) {
                monthlySales[mov.sku].prevMonth += quantity;
            }
        }
    });

    const monthlyProductReport = aggregatedCurrentInventory.map(item => {
        const sales = monthlySales[item.sku] || { lastMonth: 0, prevMonth: 0 };
        const trend = sales.prevMonth > 0
            ? ((sales.lastMonth - sales.prevMonth) / sales.prevMonth) * 100
            : sales.lastMonth > 0 ? 100 : 0;
        
        return {
            sku: item.sku,
            productName: item.productName,
            currentStock: item.currentStock,
            monthlySales: sales.lastMonth,
            previousMonthSales: sales.prevMonth,
            salesTrend: trend,
            suggestedPurchase: Math.max(0, sales.lastMonth - item.currentStock)
        };
    }).sort((a,b) => b.monthlySales - a.monthlySales);


    // Cálculo de variación diaria global
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
      globalConfirmed: confirmedOrders.length,
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
      courierMetrics: aggregatedCourierMetrics,
      paymentMethodMetrics: aggregatedPaymentMethodMetrics,
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
      monthlyProductReport: monthlyProductReport,
    };
  }
);

// Exporta una función wrapper para ser llamada desde el cliente.
export async function getMetrics(input: GetMetricsInput): Promise<GetMetricsOutput> {
    return getMetricsFlow(input);
}
