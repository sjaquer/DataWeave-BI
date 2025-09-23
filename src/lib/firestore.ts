'use server';

import type { Order } from '@/app/api/webhooks/shopify/route';
import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  setDoc,
} from 'firebase/firestore';

// Helper para obtener el ID de documento de métrica diaria
function getDailyMetricDocId(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Procesa un nuevo pedido de Shopify.
 * Crea el documento del pedido y actualiza/crea las métricas diarias.
 */
export async function processNewShopifyOrder(order: Order) {
  const orderDate = new Date(order.created_at);
  const dailyMetricId = getDailyMetricDocId(orderDate);
  const orderDocRef = doc(db, 'orders', String(order.id));
  const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);

  try {
    await runTransaction(db, async (transaction) => {
      const orderDoc = await transaction.get(orderDocRef);
      const dailyMetricDoc = await transaction.get(dailyMetricDocRef);

      // Si el pedido no existe, lo creamos y actualizamos las métricas
      if (!orderDoc.exists()) {
        transaction.set(orderDocRef, {
          id: order.id,
          orderNumber: order.name,
          createdAt: order.created_at,
          totalPrice: order.total_price,
          customer: order.customer ? {
            id: order.customer.id,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
            email: order.customer.email,
          } : null,
          confirmed: false, // Por defecto, no está confirmado
        });

        if (dailyMetricDoc.exists()) {
          // Si existe el doc de métricas, incrementa el total de pedidos
          transaction.update(dailyMetricDocRef, {
            totalOrders: dailyMetricDoc.data().totalOrders + 1,
          });
        } else {
          // Si no existe, crea el documento de métricas
          transaction.set(dailyMetricDocRef, {
            date: dailyMetricId,
            totalOrders: 1,
            confirmedOrders: 0,
            confirmationRate: 0,
          });
        }
      } else {
        // Si el pedido ya existe (creado por webhook de sheets), solo lo actualizamos
        // No incrementamos 'totalOrders' porque ya lo hizo 'updateConfirmedOrders'
        transaction.update(orderDocRef, {
          id: order.id,
          orderNumber: order.name,
          totalPrice: order.total_price,
           customer: order.customer ? {
            id: order.customer.id,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
            email: order.customer.email,
          } : null,
        });
      }
    });
    console.log(`[Firestore] Pedido ${order.name} procesado exitosamente.`);
  } catch (error) {
    console.error(`Error procesando el pedido ${order.name} en Firestore:`, error);
  }
}

/**
 * Actualiza una lista de pedidos como confirmados.
 */
export async function updateConfirmedOrders(
  confirmedOrderNumbers: string[]
): Promise<{ status: string; message: string }> {
  if (!confirmedOrderNumbers || confirmedOrderNumbers.length === 0) {
    return { status: 'success', message: 'No hay pedidos para confirmar.' };
  }

  const ordersCollection = collection(db, 'orders');

  try {
    let processedCount = 0;
    await runTransaction(db, async (transaction) => {
      for (const orderNumber of confirmedOrderNumbers) {
        // Asumimos que `orderNumber` viene sin '#', pero la lógica debería ser robusta
        const cleanOrderNumber = `#${orderNumber.replace('#', '')}`;
        const orderDocRef = doc(ordersCollection, cleanOrderNumber);
        
        const orderDoc = await transaction.get(orderDocRef);
        const orderData = orderDoc.data();
        
        const now = new Date();
        const dailyMetricId = getDailyMetricDocId(now);
        const dailyMetricDocRef = doc(db, 'daily_metrics', dailyMetricId);
        const dailyMetricDoc = await transaction.get(dailyMetricDocRef);
        
        if (!orderDoc.exists()) {
          // Si el pedido no existe, lo crea
          transaction.set(orderDocRef, {
            id: cleanOrderNumber, // Usamos el número de pedido como ID temporal
            orderNumber: cleanOrderNumber,
            createdAt: now.toISOString(),
            confirmed: true,
            source: 'sheets', // Marcamos que fue creado desde sheets
          });

          // Actualiza las métricas
           if (dailyMetricDoc.exists()) {
            const currentConfirmed = dailyMetricDoc.data().confirmedOrders || 0;
            const currentTotal = dailyMetricDoc.data().totalOrders || 0;
            transaction.update(dailyMetricDocRef, {
                totalOrders: currentTotal + 1,
                confirmedOrders: currentConfirmed + 1,
            });
          } else {
            transaction.set(dailyMetricDocRef, {
                date: dailyMetricId,
                totalOrders: 1,
                confirmedOrders: 1,
                confirmationRate: 100
            });
          }
        } else if (!orderData?.confirmed) {
            // Si el pedido existe y no está confirmado, lo confirma
            transaction.update(orderDocRef, { confirmed: true });

            if (dailyMetricDoc.exists()) {
                const currentConfirmed = dailyMetricDoc.data().confirmedOrders || 0;
                 transaction.update(dailyMetricDocRef, {
                    confirmedOrders: currentConfirmed + 1,
                });
            } else {
                 transaction.set(dailyMetricDocRef, {
                    date: dailyMetricId,
                    totalOrders: 1, // Asumimos que si hay confirmados debe haber totales
                    confirmedOrders: 1,
                    confirmationRate: 0 // Se calculará en el cliente
                });
            }
        }
        processedCount++;
      }
    });

    console.log(`[Firestore] ${processedCount} pedidos confirmados procesados.`);
    return {
      status: 'success',
      message: `${processedCount} pedidos confirmados fueron procesados.`,
    };
  } catch (error) {
    console.error('Error al actualizar los pedidos confirmados:', error);
    return {
      status: 'error',
      message: 'Error interno al actualizar los pedidos en Firestore.',
    };
  }
}
