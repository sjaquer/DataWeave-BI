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
  increment
} from 'firebase/firestore';

export interface Order {
  id: number;
  created_at: string;
  name: string; 
}

function getDailyMetricDocId(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Procesa un único pedido nuevo de Shopify para actualizar las métricas diarias.
 */
export async function processNewShopifyOrder(order: Order) {
  const orderDate = new Date(order.created_at);
  const dailyMetricId = getDailyMetricDocId(orderDate);
  const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);
  const firestoreTimestamp = Timestamp.fromDate(orderDate);

  try {
    await runTransaction(db, async (transaction) => {
      const metricDoc = await transaction.get(dailyMetricDocRef);
      if (!metricDoc.exists()) {
        transaction.set(dailyMetricDocRef, {
          date: dailyMetricId,
          createdAt: firestoreTimestamp,
          totalOrders: 1,
          confirmedOrders: 0,
          orderNumbers: [order.name],
        });
      } else {
        const data = metricDoc.data();
        const existingNumbers = data.orderNumbers || [];
        if (!existingNumbers.includes(order.name)) {
            transaction.update(dailyMetricDocRef, {
                totalOrders: increment(1),
                orderNumbers: [...existingNumbers, order.name],
            });
        }
      }
    });
    console.log(`[Firestore] Métrica de 'totalOrders' actualizada para el día ${dailyMetricId} para el pedido ${order.name}.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Normaliza el número de pedido a un formato estándar que empieza con '#'.
 * Acepta formatos como 'N-1234' o '#1234' y los convierte a '#1234'.
 */
function normalizeOrderName(name: string): string {
  let normalized = name.trim().toUpperCase();
  
  // Maneja formatos 'N-1234', '#B1234', etc.
  if (normalized.startsWith('N-')) {
    normalized = '#' + normalized.substring(2);
  } else if (!normalized.startsWith('#') && /^[A-Z]?-?\d+$/.test(normalized)) {
    // Si tiene un prefijo opcional y luego números
    const match = normalized.match(/(\d+)$/);
    if (match) {
        normalized = '#' + match[1];
    }
  } else if (!normalized.startsWith('#')) {
     normalized = '#' + normalized;
  }
  
  return normalized;
}

/**
 * Actualiza los pedidos como confirmados, encontrando su fecha de creación original
 * a través de la lista de `orderNumbers` para incrementar el contador del día correcto.
 */
export async function updateConfirmedOrders(
  confirmedOrders: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {

  const validOrderNames = confirmedOrders
    .map(item => normalizeOrderName(String(item.PEDIDO || '')))
    .filter(name => name.startsWith('#'));

  if (validOrderNames.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const confirmationsByDate: { [key: string]: number } = {};
  const metricsRef = collection(db, 'daily_metrics');
  
  const chunkSize = 30;
  for (let i = 0; i < validOrderNames.length; i += chunkSize) {
      const chunk = validOrderNames.slice(i, i + chunkSize);
      
      const recentQuery = query(metricsRef, where('orderNumbers', 'array-contains-any', chunk));
      
      try {
        const querySnapshot = await getDocs(recentQuery);
    
        for (const orderName of chunk) {
          let found = false;
          for (const doc of querySnapshot.docs) {
            const data = doc.data();
            if (data.orderNumbers && data.orderNumbers.includes(orderName)) {
              const dateId = data.date;
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
      for (const [dateId, incrementValue] of Object.entries(confirmationsByDate)) {
        if (incrementValue === 0) continue;

        const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
        const metricDoc = await transaction.get(dailyMetricDocRef);

        if (metricDoc.exists()) {
          const currentConfirmed = metricDoc.data().confirmedOrders || 0;
          transaction.update(dailyMetricDocRef, {
            confirmedOrders: currentConfirmed + incrementValue,
          });
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