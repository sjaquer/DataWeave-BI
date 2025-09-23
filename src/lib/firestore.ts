'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';

// Definición local del tipo Order para que coincida con la respuesta de la API de Shopify
interface Order {
  id: number;
  created_at: string;
  name: string; // Este es el número de pedido, ej: "#1001"
  total_price: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
}

// Helper para obtener el ID de documento de métrica diaria en formato DD-MM-YYYY
function getDailyMetricDocId(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Procesa un nuevo pedido de Shopify.
 * Esta función es la ÚNICA responsable de incrementar `totalOrders`.
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
      
      const orderPayload = {
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
      };

      if (!orderDoc.exists()) {
        // --- El pedido NO existe ---
        // Lo creamos y establecemos 'confirmed' en false por defecto.
        transaction.set(orderDocRef, {
          ...orderPayload,
          confirmed: false, 
        });

        // Actualizamos las métricas diarias
        if (dailyMetricDoc.exists()) {
          const currentTotal = dailyMetricDoc.data().totalOrders || 0;
          transaction.update(dailyMetricDocRef, {
            totalOrders: currentTotal + 1,
          });
        } else {
          transaction.set(dailyMetricDocRef, {
            date: dailyMetricId,
            totalOrders: 1,
            confirmedOrders: 0,
          });
        }
      } else {
        // --- El pedido SÍ existe ---
        // Esto significa que probablemente fue creado por el webhook de Sheets.
        // Lo actualizamos con la información completa de Shopify.
        // No tocamos el campo 'confirmed' ya que Sheets es la fuente de verdad para eso.
        transaction.update(orderDocRef, orderPayload);

        // MUY IMPORTANTE: Nos aseguramos de que totalOrders se incremente
        // si el pedido fue creado por Sheets (que ya no lo hace).
        if (dailyMetricDoc.exists()) {
            // Solo incrementamos si el pedido que existía no había sido contado.
            // Una forma de inferirlo es si fue creado por sheets, el campo `createdAt` estaría ausente.
            const existingData = orderDoc.data();
            if (!existingData.createdAt) {
                 const currentTotal = dailyMetricDoc.data().totalOrders || 0;
                 transaction.update(dailyMetricDocRef, {
                    totalOrders: currentTotal + 1,
                 });
            }
        } else {
            // Si el documento de métricas no existe, lo creamos.
             transaction.set(dailyMetricDocRef, {
                date: dailyMetricId,
                totalOrders: 1,
                // El pedido existente podría estar confirmado, así que leemos su estado.
                confirmedOrders: orderDoc.data().confirmed ? 1 : 0,
            });
        }
      }
    });
    console.log(`[Firestore] Pedido ${order.name} procesado exitosamente por Shopify Flow.`);
  } catch (error) {
    console.error(`Error procesando el pedido ${order.name} en Firestore:`, error);
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

  const batch = writeBatch(db);
  const metricsToUpdate: { [key: string]: number } = {};

  try {
    for (const item of confirmedOrderNumbers) {
      const orderId = String(item.PEDIDO).replace('#', '').trim();
      if (!orderId) continue;
      
      const orderDocRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderDocRef);

      const confirmationDate = new Date();
      const dailyMetricId = getDailyMetricDocId(confirmationDate);
      
      if (!orderDoc.exists()) {
        // El pedido no existe, lo creamos como confirmado, pero SIN afectar las métricas.
        // Shopify flow se encargará de `totalOrders`.
        batch.set(orderDocRef, {
          id: orderId,
          orderNumber: `#${orderId}`,
          confirmed: true,
          source: 'sheets', // Marcamos que fue creado desde sheets
        });

        // Preparamos la actualización de la métrica de confirmación
        metricsToUpdate[dailyMetricId] = (metricsToUpdate[dailyMetricId] || 0) + 1;

      } else if (!orderDoc.data().confirmed) {
        // El pedido existe y no estaba confirmado, lo actualizamos.
        batch.update(orderDocRef, { confirmed: true });

        // Preparamos la actualización de la métrica de confirmación
        metricsToUpdate[dailyMetricId] = (metricsToUpdate[dailyMetricId] || 0) + 1;
      }
    }

    // Aplicamos las actualizaciones de métricas en un bucle separado
    for (const [dateId, increment] of Object.entries(metricsToUpdate)) {
        if (increment === 0) continue;

        const dailyMetricDocRef = doc(db, 'daily_metrics', dateId);
        const metricDoc = await getDoc(dailyMetricDocRef);

        if (metricDoc.exists()) {
            const currentConfirmed = metricDoc.data().confirmedOrders || 0;
            batch.update(dailyMetricDocRef, {
                confirmedOrders: currentConfirmed + increment,
            });
        } else {
            // Si no existe, lo creamos. totalOrders será 0 y se llenará con el flow de shopify
             batch.set(dailyMetricDocRef, {
                date: dateId,
                totalOrders: 0,
                confirmedOrders: increment,
            });
        }
    }
    
    await batch.commit();

    const processedCount = confirmedOrderNumbers.length;
    console.log(`[Firestore] ${processedCount} pedidos de Sheets procesados para confirmación.`);
    return {
      status: 'success',
      message: `${processedCount} pedidos confirmados fueron procesados.`,
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
