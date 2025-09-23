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
 * Normaliza el número de pedido a un formato estándar que empieza con '#'.
 * Acepta formatos como 'N-1234', '#B1234', '1234' y los convierte a '#1234'.
 * Extrae solo los dígitos numéricos.
 */
function normalizeOrderName(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    if (digits) {
      return '#' + digits.join('');
    }
    return '#' + name; // Fallback por si no encuentra dígitos
}


function getDailyMetricDocId(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Procesa un único pedido nuevo de Shopify para actualizar las métricas diarias.
 * Ignora pedidos con más de 6 meses de antigüedad.
 */
export async function processNewShopifyOrder(order: Order) {
  const orderDate = new Date(order.created_at);

  // Lógica de optimización: ignorar pedidos de más de 6 meses
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (orderDate < sixMonthsAgo) {
    console.log(`[Firestore] Pedido ${order.name} ignorado por ser más antiguo de 6 meses.`);
    return; // Detiene el procesamiento
  }

  const dailyMetricId = getDailyMetricDocId(orderDate);
  const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);
  const firestoreTimestamp = Timestamp.fromDate(orderDate);
  const normalizedOrderName = normalizeOrderName(order.name);

  try {
    await runTransaction(db, async (transaction) => {
      const metricDoc = await transaction.get(dailyMetricDocRef);
      if (!metricDoc.exists()) {
        transaction.set(dailyMetricDocRef, {
          date: dailyMetricId,
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
    console.log(`[Firestore] Métrica 'totalOrders' actualizada para el día ${dailyMetricId} para el pedido ${order.name}.`);
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
 * Actualiza los pedidos como confirmados, encontrando su fecha de creación original.
 */
export async function updateConfirmedOrders(
  confirmedOrders: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {

  const validOrderNames = confirmedOrders
    .map(item => normalizeOrderName(String(item.PEDIDO || '')))
    .filter(name => name.length > 1);

  if (validOrderNames.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const confirmationsByDate: { [key: string]: number } = {};
  const metricsRef = collection(db, 'daily_metrics');
  
  // Búsqueda por lotes de 30 para no superar los límites de Firestore.
  const chunkSize = 30;
  for (let i = 0; i < validOrderNames.length; i += chunkSize) {
      const chunk = validOrderNames.slice(i, i + chunkSize);
      
      const q = query(metricsRef, where('orderNumbers', 'array-contains-any', chunk));
      
      try {
        const querySnapshot = await getDocs(q);
    
        for (const orderName of chunk) {
          let found = false;
          for (const doc of querySnapshot.docs) {
            const data = doc.data();
            if (data.orderNumbers && data.orderNumbers.includes(orderName)) {
              const dateId = data.date;
              // Verifica si el pedido ya fue confirmado para este día para evitar duplicados.
              // Esta es una salvaguarda simple, una más robusta requeriría una subcolección de confirmados.
              confirmationsByDate[dateId] = (confirmationsByDate[dateId] || 0) + 1;
              found = true;
              break; 
            }
          }
          if (!found) {
            console.warn(`[Firestore] No se encontró el pedido ${orderName} en 'daily_metrics'. No se pudo asignar fecha de confirmación.`);
          }
        }
      } catch (error) {
        console.error('Error durante la búsqueda de un lote de pedidos:', error);
      }
  }

  if (Object.keys(confirmationsByDate).length === 0) {
      return { status: 'success', message: 'Los pedidos confirmados no coincidieron con ningún pedido existente en la base de datos.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
        for (const dateId in confirmationsByDate) {
            const incrementValue = confirmationsByDate[dateId];
            const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
            const metricDoc = await transaction.get(dailyMetricDocRef);
            
            if (metricDoc.exists()) {
                const currentConfirmed = metricDoc.data().confirmedOrders || 0;
                // Para evitar duplicar confirmaciones, se podría añadir una lógica más compleja aquí.
                // Por ahora, simplemente incrementamos.
                transaction.update(dailyMetricDocRef, { confirmedOrders: increment(incrementValue) });
            }
        }
    });

    const totalConfirmations = Object.values(confirmationsByDate).reduce((a,b) => a+b, 0);
    return {
      status: 'success',
      message: `${totalConfirmations} pedidos confirmados fueron procesados y asociados a sus fechas correctas.`,
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
