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
} from 'firebase/firestore';

// Definición local del tipo Order para que coincida con la respuesta de la API de Shopify
interface Order {
  id: number;
  created_at: string;
  name: string; // Este es el nombre del pedido, ej: "#1001"
}

// Helper para obtener el ID de documento de métrica diaria en formato DD-MM-YYYY
function getDailyMetricDocId(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Procesa una lista de pedidos de Shopify para actualizar las métricas de `totalOrders`
 * y guardar los números de pedido para referencia futura.
 */
export async function processShopifyOrders(orders: Order[]) {
  const dailyOrderData: { [key: string]: { numbers: string[]; date: Date } } = {};

  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    const dailyMetricId = getDailyMetricDocId(orderDate);

    if (!dailyOrderData[dailyMetricId]) {
      dailyOrderData[dailyMetricId] = { numbers: [], date: orderDate };
    }
    dailyOrderData[dailyMetricId].numbers.push(order.name);
  }

  const batch = writeBatch(db);
  for (const [dateId, data] of Object.entries(dailyOrderData)) {
    const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
    const firestoreTimestamp = Timestamp.fromDate(data.date);

    // Usamos `set` con `merge: true` para crear o actualizar el documento.
    // Esto establece `totalOrders` y la lista de `orderNumbers` sin afectar a `confirmedOrders`.
    batch.set(
      dailyMetricDocRef,
      {
        date: dateId,
        createdAt: firestoreTimestamp,
        totalOrders: data.numbers.length,
        orderNumbers: data.numbers,
      },
      { merge: true }
    );
  }

  try {
    await batch.commit();
    console.log(`[Firestore] Métricas de 'totalOrders' actualizadas para ${Object.keys(dailyOrderData).length} días.`);
  } catch (error) {
    console.error(`Error al procesar el lote de pedidos de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Actualiza los pedidos como confirmados, encontrando su fecha de creación original
 * a través de la lista de `orderNumbers`.
 */
export async function updateConfirmedOrders(
  confirmedOrderNumbers: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {
  if (!confirmedOrderNumbers || confirmedOrderNumbers.length === 0) {
    return { status: 'success', message: 'No hay pedidos para confirmar.' };
  }

  const validOrderNames = confirmedOrderNumbers
    .map(item => String(item.PEDIDO || '').trim())
    .filter(name => name.startsWith('#'));

  if (validOrderNames.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar (deben empezar con #).' };
  }
  
  const confirmationsByDate: { [key: string]: number } = {};
  const metricsRef = collection(db, 'daily_metrics');
  
  // Optimización: Partimos la búsqueda en los últimos 90 días (más probable) y el resto.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoTimestamp = Timestamp.fromDate(ninetyDaysAgo);

  const recentQuery = query(metricsRef, where('createdAt', '>=', ninetyDaysAgoTimestamp), where('orderNumbers', 'array-contains-any', validOrderNames));
  const oldQuery = query(metricsRef, where('createdAt', '<', ninetyDaysAgoTimestamp), where('orderNumbers', 'array-contains-any', validOrderNames));
  
  try {
    const [recentSnapshot, oldSnapshot] = await Promise.all([getDocs(recentQuery), getDocs(oldQuery)]);
    const allSnapshots = [...recentSnapshot.docs, ...oldSnapshot.docs];

    for (const orderName of validOrderNames) {
      let found = false;
      for (const doc of allSnapshots) {
        const data = doc.data();
        if (data.orderNumbers && data.orderNumbers.includes(orderName)) {
          const dateId = data.date;
          confirmationsByDate[dateId] = (confirmationsByDate[dateId] || 0) + 1;
          found = true;
          break; // Optimización: si ya lo encontré, paso al siguiente pedido.
        }
      }
      if (!found) {
        console.warn(`[Firestore] No se encontró el pedido ${orderName} en 'daily_metrics'. No se pudo asignar fecha de confirmación.`);
      }
    }

    if (Object.keys(confirmationsByDate).length === 0) {
        return { status: 'success', message: 'Los pedidos confirmados no coincidieron con ningún pedido existente en la base de datos.' };
    }

    await runTransaction(db, async (transaction) => {
      for (const [dateId, increment] of Object.entries(confirmationsByDate)) {
        if (increment === 0) continue;

        const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
        const metricDoc = await transaction.get(dailyMetricDocRef);

        if (metricDoc.exists()) {
          const currentConfirmed = metricDoc.data().confirmedOrders || 0;
          transaction.update(dailyMetricDocRef, {
            confirmedOrders: currentConfirmed + increment,
          });
        } else {
          // Esto no debería ocurrir si la sincronización de Shopify se ejecuta primero, pero es una salvaguarda.
          transaction.set(dailyMetricDocRef, {
            date: dateId,
            confirmedOrders: increment,
          }, { merge: true });
        }
      }
    });

    const totalConfirmations = Object.values(confirmationsByDate).reduce((a,b) => a+b, 0);
    console.log(`[Firestore] ${totalConfirmations} pedidos confirmados procesados y agrupados por su fecha de creación.`);
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

/**
 * Resetea el contador `confirmedOrders` a 0 para todos los documentos en `daily_metrics`.
 */
export async function resetConfirmedOrders(): Promise<{ status: string; message: string }> {
  const metricsRef = collection(db, 'daily_metrics');
  const batch = writeBatch(db);
  let docsUpdated = 0;

  try {
    const querySnapshot = await getDocs(metricsRef);
    if (querySnapshot.empty) {
      return { status: 'success', message: 'No hay métricas para resetear.' };
    }

    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, { confirmedOrders: 0 });
      docsUpdated++;
    });

    await batch.commit();

    console.log(`[Firestore] Se resetearon los 'confirmedOrders' para ${docsUpdated} documentos.`);
    return {
      status: 'success',
      message: `Se reinició el contador de pedidos confirmados para ${docsUpdated} días.`,
    };
  } catch (error) {
    console.error('Error al resetear los pedidos confirmados:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    return {
      status: 'error',
      message: `Error al resetear los contadores: ${errorMessage}`,
    };
  }
}
