
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  writeBatch,
  runTransaction,
  query,
  where,
  getDocs,
  Timestamp,
  increment,
  deleteDoc
} from 'firebase/firestore';

export interface Order {
  id: number;
  created_at: string;
  name: string;
  shipping_address?: {
      province?: string;
  };
  line_items?: {
      title?: string;
      quantity?: number;
  }[];
}

/**
 * Normaliza el número de pedido a un formato estándar único para todo el sistema.
 * Extrae solo la parte numérica y le antepone '#'.
 * Ej: 'N-1234', '#B1234', '1234' -> '#1234'
 */
function normalizeOrderName(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    return digits ? '#' + digits.join('') : '#' + name;
}

/**
 * Crea un ID de documento único para un pedido en la colección `shopify_orders`.
 * Usa el storeId y el número de pedido para garantizar que no haya colisiones.
 */
function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedName = normalizeOrderName(orderName).replace('#', '');
    return `${storeId}-${normalizedName}`;
}


function getDailyMetricDocId(date: Date, storeId: string): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${storeId}_${year}-${month}-${day}`;
}

/**
 * Procesa un único pedido nuevo de una tienda Shopify.
 * 1. Lo guarda en la colección `shopify_orders` con detalles.
 * 2. Actualiza las métricas agregadas en `daily_metrics`.
 * Ignora pedidos con más de 6 meses de antigüedad.
 */
export async function processNewShopifyOrder(order: Order, storeId: string) {
  const orderDate = new Date(order.created_at);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (orderDate < sixMonthsAgo) {
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} ignorado por ser más antiguo de 6 meses.`);
    return;
  }

  // --- 1. Guardar en `shopify_orders` ---
  const orderDocId = getShopifyOrderDocId(order.name, storeId);
  const orderDocRef = doc(db, 'shopify_orders', orderDocId);
  
  const orderData = {
      storeId: storeId,
      orderId: order.id,
      orderName: order.name,
      createdAt: Timestamp.fromDate(orderDate),
      province: order.shipping_address?.province || 'N/A',
      products: order.line_items?.map(item => ({ 
          title: item.title || 'N/A', 
          quantity: item.quantity || 0 
      })) || [],
      isConfirmed: false,
  };

  // --- 2. Actualizar `daily_metrics` ---
  const dailyMetricId = getDailyMetricDocId(orderDate, storeId);
  const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);
  const firestoreTimestamp = Timestamp.fromDate(orderDate);
  // El ID único del pedido dentro del sistema es la combinación de tienda + número normalizado
  const uniqueSystemOrderId = `${storeId}_${normalizeOrderName(order.name)}`;

  try {
    await runTransaction(db, async (transaction) => {
      // Escritura en `shopify_orders`
      transaction.set(orderDocRef, orderData, { merge: true });

      // Lógica de `daily_metrics`
      const metricDoc = await transaction.get(dailyMetricDocRef);
      if (!metricDoc.exists()) {
        transaction.set(dailyMetricDocRef, {
          date: `${String(orderDate.getUTCDate()).padStart(2, '0')}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}-${orderDate.getUTCFullYear()}`,
          storeId: storeId,
          createdAt: firestoreTimestamp,
          totalOrders: 1,
          confirmedOrders: 0,
          orderNumbers: [uniqueSystemOrderId],
        });
      } else {
        const data = metricDoc.data();
        const existingNumbers = data.orderNumbers || [];
        if (!existingNumbers.includes(uniqueSystemOrderId)) {
            transaction.update(dailyMetricDocRef, {
                totalOrders: increment(1),
                orderNumbers: [...existingNumbers, uniqueSystemOrderId],
            });
        }
      }
    });
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} procesado y guardado en 'shopify_orders' y 'daily_metrics'.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Elimina todos los registros de 'daily_metrics' y 'shopify_orders' con más de 6 meses.
 */
export async function deleteOldMetrics(): Promise<{ status: string; message: string; deletedCount: number }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const firestoreTimestampLimit = Timestamp.fromDate(sixMonthsAgo);

    let deletedCount = 0;
    try {
        // Limpiar daily_metrics
        const metricsRef = collection(db, 'daily_metrics');
        const qMetrics = query(metricsRef, where('createdAt', '<', firestoreTimestampLimit));
        const metricsSnapshot = await getDocs(qMetrics);
        const batch1 = writeBatch(db);
        metricsSnapshot.forEach(doc => {
            batch1.delete(doc.ref);
            deletedCount++;
        });
        await batch1.commit();

        // Limpiar shopify_orders
        const ordersRef = collection(db, 'shopify_orders');
        const qOrders = query(ordersRef, where('createdAt', '<', firestoreTimestampLimit));
        const ordersSnapshot = await getDocs(qOrders);
        const batch2 = writeBatch(db);
        ordersSnapshot.forEach(doc => {
            batch2.delete(doc.ref);
            deletedCount++;
        });
        await batch2.commit();

        if (deletedCount === 0) {
             return { status: 'success', message: 'No se encontraron registros antiguos para eliminar.', deletedCount: 0 };
        }
        
        return { 
            status: 'success', 
            message: `Se eliminaron ${deletedCount} registros de ambas colecciones con más de 6 meses de antigüedad.`,
            deletedCount 
        };
    } catch (error) {
        console.error('Error al eliminar métricas antiguas:', error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
        return { 
            status: 'error', 
            message: `Error interno al eliminar datos: ${errorMessage}`,
            deletedCount: 0
        };
    }
}


/**
 * Actualiza los pedidos como confirmados en ambas colecciones.
 */
export async function updateConfirmedOrders(
  confirmedOrders: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {

  if (confirmedOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const confirmationsByMetricDocId: { [key: string]: { increment: number, orderDocIds: string[] } } = {};
  const metricsRef = collection(db, 'daily_metrics');
  
  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    if (rawOrderName.length < 1) continue;
    
    const partialOrderName = normalizeOrderName(rawOrderName);
    
    // Suponemos que los storeId son 'tienda-1', 'tienda-2', etc. hasta 5.
    const possibleNormalizedNames = Array.from({length: 5}, (_, i) => `tienda-${i+1}_${partialOrderName}`);
    
    const q = query(metricsRef, where('orderNumbers', 'array-contains-any', possibleNormalizedNames));

    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const metricDocId = doc.id;
        const storeId = doc.data().storeId;
        const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);

        if (!confirmationsByMetricDocId[metricDocId]) {
            confirmationsByMetricDocId[metricDocId] = { increment: 0, orderDocIds: [] };
        }
        confirmationsByMetricDocId[metricDocId].increment += 1;
        confirmationsByMetricDocId[metricDocId].orderDocIds.push(orderDocId);

      } else {
        console.warn(`[Firestore] No se encontró el pedido ${rawOrderName} en ninguna métrica diaria.`);
      }
    } catch (error) {
      console.error(`Error buscando el pedido ${rawOrderName}:`, error);
    }
  }


  if (Object.keys(confirmationsByMetricDocId).length === 0) {
      return { status: 'success', message: 'Los pedidos confirmados no coincidieron con ningún pedido existente en la base de datos.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
        for (const metricDocId in confirmationsByMetricDocId) {
            const data = confirmationsByMetricDocId[metricDocId];
            const incrementValue = data.increment;
            const dailyMetricDocRef = doc(db, 'daily_metrics', metricDocId);
            
            // Actualizar el contador en `daily_metrics`
            transaction.update(dailyMetricDocRef, { confirmedOrders: increment(incrementValue) });

            // Marcar como confirmado en `shopify_orders`
            for (const orderDocId of data.orderDocIds) {
                const orderDocRef = doc(db, 'shopify_orders', orderDocId);
                transaction.update(orderDocRef, { isConfirmed: true });
            }
        }
    });

    const totalConfirmations = Object.values(confirmationsByMetricDocId).reduce((a,b) => a.increment + b.increment, 0);
    return {
      status: 'success',
      message: `${totalConfirmations} pedidos confirmados fueron procesados y actualizados en 'daily_metrics' y 'shopify_orders'.`,
    };

  } catch (error) {
    console.error('Error al actualizar los pedidos confirmados:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    return {
      status: 'error',
      message: `Error interno al actualizar los pedidos en Firestore: ${errorMessage}`,
    };
  }
}

/**
 * Procesa un lote de pedidos desde un archivo CSV de Shopify para una tienda específica.
 */
export async function processShopifyCsv(orders: Order[], storeId: string) {
  const batch = writeBatch(db);
  const ordersByDay: { [key: string]: { orders: Order[], uniqueSystemOrderIds: string[] } } = {};

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    if (orderDate < sixMonthsAgo) continue;

    // --- 1. Guardar cada pedido en `shopify_orders` ---
    const orderDocId = getShopifyOrderDocId(order.name, storeId);
    const orderDocRef = doc(db, 'shopify_orders', orderDocId);
    batch.set(orderDocRef, {
        storeId: storeId,
        orderId: order.id,
        orderName: order.name,
        createdAt: Timestamp.fromDate(orderDate),
        province: order.shipping_address?.province || 'N/A',
        products: order.line_items?.map(item => ({ 
            title: item.title || 'N/A', 
            quantity: item.quantity || 0 
        })) || [],
        isConfirmed: false,
    }, { merge: true });

    // --- 2. Agrupar para `daily_metrics` ---
    const dateStr = `${String(orderDate.getUTCDate()).padStart(2, '0')}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}-${orderDate.getUTCFullYear()}`;
    if (!ordersByDay[dateStr]) {
      ordersByDay[dateStr] = { orders: [], uniqueSystemOrderIds: [] };
    }
    ordersByDay[dateStr].orders.push(order);
    ordersByDay[dateStr].uniqueSystemOrderIds.push(`${storeId}_${normalizeOrderName(order.name)}`);
  }

  // --- 3. Consolidar `daily_metrics` ---
  for (const dateStr in ordersByDay) {
    const dayData = ordersByDay[dateStr];
    const orderDate = new Date(dateStr.split('-').reverse().join('-'));
    const dailyMetricId = getDailyMetricDocId(orderDate, storeId);
    const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);

    // Con `set` y `merge: true` sobrescribimos los pedidos totales pero respetamos los confirmados si ya existían.
    batch.set(dailyMetricDocRef, {
      date: dateStr,
      storeId: storeId,
      createdAt: Timestamp.fromDate(orderDate),
      totalOrders: dayData.orders.length,
      confirmedOrders: 0, 
      orderNumbers: dayData.uniqueSystemOrderIds,
    }, { merge: true });
  }

  await batch.commit();
}
