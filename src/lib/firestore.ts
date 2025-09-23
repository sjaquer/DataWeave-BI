
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
}

/**
 * Normaliza el número de pedido a un formato estándar único para todo el sistema.
 * Acepta formatos como 'N-1234', '#B1234', '1234' y los convierte a un prefijo de tienda + '#1234'.
 * Ej: para storeId 'tienda-1' y pedido 'N-1234' -> 'tienda-1_#1234'
 */
function normalizeOrderName(name: string, storeId?: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    const numericPart = digits ? '#' + digits.join('') : '#' + name;
    
    if (storeId) {
      return `${storeId}_${numericPart}`;
    }
    return numericPart; // Para búsquedas desde Google Sheet
}


function getDailyMetricDocId(date: Date, storeId: string): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  // El ID del documento ahora incluye el storeId para garantizar unicidad.
  return `${storeId}_${year}-${month}-${day}`;
}

/**
 * Procesa un único pedido nuevo de una tienda Shopify para actualizar las métricas diarias.
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

  const dailyMetricId = getDailyMetricDocId(orderDate, storeId);
  const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);
  const firestoreTimestamp = Timestamp.fromDate(orderDate);
  const normalizedOrderName = normalizeOrderName(order.name, storeId);

  try {
    await runTransaction(db, async (transaction) => {
      const metricDoc = await transaction.get(dailyMetricDocRef);
      if (!metricDoc.exists()) {
        transaction.set(dailyMetricDocRef, {
          date: `${String(orderDate.getUTCDate()).padStart(2, '0')}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}-${orderDate.getUTCFullYear()}`,
          storeId: storeId,
          createdAt: firestoreTimestamp,
          totalOrders: 1,
          confirmedOrders: 0,
          orderNumbers: [normalizedOrderName],
        });
      } else {
        const data = metricDoc.data();
        const existingNumbers = data.orderNumbers || [];
        if (!existingNumbers.includes(normalizedOrderName)) {
            transaction.update(dailyMetricDocRef, {
                totalOrders: increment(1),
                orderNumbers: [...existingNumbers, normalizedOrderName],
            });
        }
      }
    });
    console.log(`[Firestore] Métrica 'totalOrders' actualizada para el día y tienda ${dailyMetricId} para el pedido ${order.name}.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Elimina todos los registros de 'daily_metrics' con más de 6 meses de antigüedad.
 */
export async function deleteOldMetrics(): Promise<{ status: string; message: string; deletedCount: number }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const firestoreTimestampLimit = Timestamp.fromDate(sixMonthsAgo);

    const metricsRef = collection(db, 'daily_metrics');
    const q = query(metricsRef, where('createdAt', '<', firestoreTimestampLimit));
    
    let deletedCount = 0;
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return { status: 'success', message: 'No se encontraron registros antiguos para eliminar.', deletedCount: 0 };
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
        });

        await batch.commit();
        
        return { 
            status: 'success', 
            message: `Se eliminaron ${deletedCount} registros de métricas con más de 6 meses de antigüedad.`,
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
 * Actualiza los pedidos como confirmados, encontrando su tienda y fecha de creación original.
 * Google Sheet NO sabe de qué tienda es el pedido, así que debemos buscarlo.
 */
export async function updateConfirmedOrders(
  confirmedOrders: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {

  if (confirmedOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const confirmationsByDocId: { [key: string]: number } = {};
  const metricsRef = collection(db, 'daily_metrics');
  
  // Para cada pedido confirmado desde Sheets, intentamos encontrar su documento correspondiente.
  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    if (rawOrderName.length < 1) continue;
    
    // Extraemos solo el número, ej: '#1234'
    const partialOrderName = normalizeOrderName(rawOrderName); 

    // Creamos una consulta para buscar documentos cuyo array 'orderNumbers' contenga un string que TERMINE con el número de pedido.
    // Esto es propenso a errores si dos tiendas tienen el mismo número de pedido.
    // La estrategia correcta es buscar en una lista de posibles nombres de pedido normalizados.
    
    // Asumimos un máximo de 5 tiendas, podrías hacer esto más dinámico si es necesario.
    const possibleNormalizedNames = ['tienda-1', 'tienda-2', 'tienda-3', 'tienda-4', 'tienda-5'].map(storeId => `${storeId}_${partialOrderName}`);

    const q = query(metricsRef, where('orderNumbers', 'array-contains-any', possibleNormalizedNames));


    try {
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // Asumimos que un número de pedido solo puede existir en una tienda.
        const doc = querySnapshot.docs[0];
        const docId = doc.id;
        confirmationsByDocId[docId] = (confirmationsByDocId[docId] || 0) + 1;
      } else {
        console.warn(`[Firestore] No se encontró el pedido ${rawOrderName} en ninguna tienda.`);
      }
    } catch (error) {
      console.error(`Error buscando el pedido ${rawOrderName}:`, error);
    }
  }


  if (Object.keys(confirmationsByDocId).length === 0) {
      return { status: 'success', message: 'Los pedidos confirmados no coincidieron con ningún pedido existente en la base de datos.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
        for (const docId in confirmationsByDocId) {
            const incrementValue = confirmationsByDocId[docId];
            const dailyMetricDocRef = doc(db, 'daily_metrics', docId);
            transaction.update(dailyMetricDocRef, { confirmedOrders: increment(incrementValue) });
        }
    });

    const totalConfirmations = Object.values(confirmationsByDocId).reduce((a,b) => a+b, 0);
    return {
      status: 'success',
      message: `${totalConfirmations} pedidos confirmados fueron procesados y asociados a sus tiendas y fechas correctas.`,
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
  const ordersByDay: { [key: string]: { orders: Order[], normalizedNames: string[] } } = {};

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    if (orderDate < sixMonthsAgo) {
      continue; // Ignora pedidos antiguos
    }

    const dateStr = `${String(orderDate.getUTCDate()).padStart(2, '0')}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}-${orderDate.getUTCFullYear()}`;
    if (!ordersByDay[dateStr]) {
      ordersByDay[dateStr] = { orders: [], normalizedNames: [] };
    }
    ordersByDay[dateStr].orders.push(order);
    ordersByDay[dateStr].normalizedNames.push(normalizeOrderName(order.name, storeId));
  }

  for (const dateStr in ordersByDay) {
    const dayData = ordersByDay[dateStr];
    const orderDate = new Date(dateStr.split('-').reverse().join('-'));
    const dailyMetricId = getDailyMetricDocId(orderDate, storeId);
    const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);

    batch.set(dailyMetricDocRef, {
      date: dateStr,
      storeId: storeId,
      createdAt: Timestamp.fromDate(orderDate),
      totalOrders: dayData.orders.length,
      confirmedOrders: 0, // Se resetea para evitar duplicados si se re-importa
      orderNumbers: dayData.normalizedNames,
    }, { merge: true }); // Usar merge para no sobrescribir confirmados si ya existen
  }

  await batch.commit();
}

    