'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';

// Definición local del tipo Order para que coincida con la respuesta de la API de Shopify
interface Order {
  id: number;
  created_at: string;
  name: string;
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
 * Esta función es la ÚNICA responsable de establecer el recuento total de pedidos.
 */
export async function processShopifyOrders(orders: Order[]) {
  const dailyTotals: { [key: string]: number } = {};

  // 1. Calcular los totales por día en memoria
  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    const dailyMetricId = getDailyMetricDocId(orderDate);
    dailyTotals[dailyMetricId] = (dailyTotals[dailyMetricId] || 0) + 1;
  }

  // 2. Actualizar Firestore en un batch
  const batch = writeBatch(db);
  for (const [dateId, total] of Object.entries(dailyTotals)) {
    const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
    // Usamos `set` con `merge: true` para crear o actualizar el documento
    // estableciendo `totalOrders` sin afectar a `confirmedOrders`.
    batch.set(dailyMetricDocRef, { 
      date: dateId,
      totalOrders: total 
    }, { merge: true });
  }

  try {
    await batch.commit();
    console.log(`[Firestore] Métricas de 'totalOrders' actualizadas para ${Object.keys(dailyTotals).length} días.`);
  } catch (error) {
    console.error(`Error al procesar el lote de pedidos de Shopify en Firestore:`, error);
    throw error; // Re-lanzar el error para que el flujo principal lo maneje
  }
}

/**
 * Actualiza una lista de pedidos como confirmados.
 * Esta función es la ÚNICA responsable de incrementar `confirmedOrders`.
 */
export async function updateConfirmedOrders(
  confirmedOrderNumbers: { [key: string]: string }[]
): Promise<{ status: string; message: string }> {

  if (!confirmedOrderNumbers || confirmedOrderNumbers.length === 0) {
    return { status: 'success', message: 'No hay pedidos para confirmar.' };
  }

  const metricsToUpdate: { [key: string]: number } = {};
  const confirmationDate = new Date(); // Usar la fecha actual para la confirmación
  const dailyMetricId = getDailyMetricDocId(confirmationDate);

  // Simplemente contamos cuántos pedidos se confirmaron hoy.
  // No necesitamos verificar cada pedido individualmente contra la base de datos.
  const validConfirmations = confirmedOrderNumbers.filter(item => {
    const orderId = String(item.PEDIDO || '').trim();
    return orderId !== '';
  }).length;

  if (validConfirmations === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para confirmar.' };
  }

  metricsToUpdate[dailyMetricId] = validConfirmations;

  try {
    // Usamos una transacción para actualizar el contador de forma segura.
    await runTransaction(db, async (transaction) => {
      for (const [dateId, increment] of Object.entries(metricsToUpdate)) {
        if (increment === 0) continue;

        const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
        const metricDoc = await transaction.get(dailyMetricDocRef);

        if (metricDoc.exists()) {
            const currentConfirmed = metricDoc.data().confirmedOrders || 0;
            transaction.update(dailyMetricDocRef, {
                confirmedOrders: currentConfirmed + increment,
            });
        } else {
            // Si el documento del día no existe, lo creamos.
            // `totalOrders` se llenará con la sincronización de Shopify.
             transaction.set(dailyMetricDocRef, {
                date: dateId,
                totalOrders: 0,
                confirmedOrders: increment,
            });
        }
      }
    });

    console.log(`[Firestore] ${validConfirmations} pedidos confirmados en Sheets procesados.`);
    return {
      status: 'success',
      message: `${validConfirmations} pedidos confirmados fueron procesados.`,
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
