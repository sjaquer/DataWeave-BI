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
 * Procesa una lista de pedidos de Shopify para actualizar las métricas de `totalOrders`.
 * Esta función es la ÚNICA responsable de establecer el recuento total de pedidos
 * y de almacenar los números de pedido para referencia futura.
 */
export async function processShopifyOrders(orders: Order[]) {
  // Mapa para agrupar los números de pedido por día.
  const dailyOrderNumbers: { [key: string]: string[] } = {};

  // 1. Agrupar los números de pedido (`name`) por su fecha de creación
  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    const dailyMetricId = getDailyMetricDocId(orderDate);
    if (!dailyOrderNumbers[dailyMetricId]) {
      dailyOrderNumbers[dailyMetricId] = [];
    }
    // Guardamos el `name` del pedido (ej: "#1001")
    dailyOrderNumbers[dailyMetricId].push(order.name);
  }

  // 2. Actualizar Firestore en un batch
  const batch = writeBatch(db);
  for (const [dateId, orderNumbers] of Object.entries(dailyOrderNumbers)) {
    const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
    // Usamos `set` con `merge: true` para crear o actualizar el documento.
    // Esto establece `totalOrders` y la lista de `orderNumbers` sin afectar a `confirmedOrders`.
    batch.set(
      dailyMetricDocRef,
      {
        date: dateId,
        totalOrders: orderNumbers.length,
        orderNumbers: orderNumbers, // Guardamos la lista de identificadores de pedido
      },
      { merge: true }
    );
  }

  try {
    await batch.commit();
    console.log(`[Firestore] Métricas de 'totalOrders' actualizadas para ${Object.keys(dailyOrderNumbers).length} días.`);
  } catch (error) {
    console.error(`Error al procesar el lote de pedidos de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Actualiza los pedidos como confirmados, encontrando su fecha de creación original.
 */
export async function updateConfirmedOrders(
  confirmedOrderNumbers: { PEDIDO: string }[]
): Promise<{ status: string; message: string }> {
  if (!confirmedOrderNumbers || confirmedOrderNumbers.length === 0) {
    return { status: 'success', message: 'No hay pedidos para confirmar.' };
  }

  // Filtra y limpia los números de pedido recibidos de la hoja de cálculo
  const validOrderNames = confirmedOrderNumbers
    .map(item => String(item.PEDIDO || '').trim())
    .filter(name => name.startsWith('#'));

  if (validOrderNames.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar (deben empezar con #).' };
  }
  
  // Mapa para contar cuántos pedidos se confirmaron por fecha original.
  const confirmationsByDate: { [key: string]: number } = {};

  // Busca en la colección 'daily_metrics' los documentos que contienen los números de pedido
  const metricsRef = collection(db, 'daily_metrics');
  const q = query(metricsRef, where('orderNumbers', 'array-contains-any', validOrderNames));
  
  try {
    const querySnapshot = await getDocs(q);

    // Itera sobre los pedidos confirmados válidos
    for (const orderName of validOrderNames) {
      let found = false;
      // Busca en los resultados de la consulta el día al que pertenece este pedido
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.orderNumbers && data.orderNumbers.includes(orderName)) {
          const dateId = data.date; // Esta es la fecha de creación original
          confirmationsByDate[dateId] = (confirmationsByDate[dateId] || 0) + 1;
          found = true;
        }
      });
      if (!found) {
        console.warn(`[Firestore] No se encontró el pedido ${orderName} en 'daily_metrics'. No se pudo asignar fecha de confirmación.`);
      }
    }

    if (Object.keys(confirmationsByDate).length === 0) {
        return { status: 'success', message: 'Los pedidos confirmados no coincidieron con ningún pedido existente en la base de datos.' };
    }

    // Usamos una transacción para actualizar los contadores de forma segura
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
          // Este caso es improbable si la lógica de Shopify se ejecuta primero, pero es un buen respaldo.
          transaction.set(dailyMetricDocRef, {
            date: dateId,
            totalOrders: 0,
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