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
  deleteDoc,
  getDoc
} from 'firebase/firestore';

export interface Order {
  id: number;
  name: string; // El número de pedido, ej: '#1001'
  created_at: string;
  total_price: string;
  customer?: {
    first_name?: string;
    last_name?: string;
  };
  shipping_address?: {
      province?: string;
  };
  line_items?: {
      title?: string;
      quantity?: number;
      price?: string;
  }[];
}


export interface ConfirmedOrderInfo {
  PEDIDO: string;
  CONFIRMADO_POR?: string;
}

/**
 * Normaliza el número de pedido a un formato estándar único para todo el sistema.
 * Extrae solo la parte numérica, ignorando prefijos como '#', 'N-', '#B', etc.
 * Ej: 'N-1234', '#B1234', '1234' -> '1234'
 */
function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    return digits ? digits.join('') : name;
}

/**
 * Crea un ID de documento único para un pedido en la colección `shopify_orders`.
 * Usa el storeId y el número de pedido normalizado para garantizar que no haya colisiones.
 */
function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    return `${storeId}-${normalizedNumber}`;
}


/**
 * Procesa un único pedido nuevo de una tienda Shopify.
 * Lo guarda o actualiza en la colección `shopify_orders`.
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

  const orderDocId = getShopifyOrderDocId(order.name, storeId);
  const orderDocRef = doc(db, 'shopify_orders', orderDocId);
  
  const orderData = {
      storeId: storeId,
      orderId: order.id,
      orderName: order.name,
      createdAt: Timestamp.fromDate(orderDate),
      totalPrice: parseFloat(order.total_price || '0'),
      customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
      province: order.shipping_address?.province || 'N/A',
      products: order.line_items?.map(item => ({ 
          title: item.title || 'N/A', 
          quantity: item.quantity || 0,
          price: parseFloat(item.price || '0')
      })) || [],
      // Campos de confirmación (inicialmente vacíos)
      isConfirmed: false,
      confirmedAt: null,
      confirmedBy: null,
  };

  try {
    // Usamos `set` con `merge: true` para no sobrescribir los datos de confirmación si ya existen.
    await writeBatch(db).set(orderDocRef, orderData, { merge: true }).commit();
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} guardado/actualizado en 'shopify_orders'.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Elimina todos los registros de 'shopify_orders' con más de 6 meses.
 */
export async function deleteOldMetrics(): Promise<{ status: string; message: string; deletedCount: number }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const firestoreTimestampLimit = Timestamp.fromDate(sixMonthsAgo);
    let deletedCount = 0;

    try {
        const ordersRef = collection(db, 'shopify_orders');
        const qOrders = query(ordersRef, where('createdAt', '<', firestoreTimestampLimit));
        const ordersSnapshot = await getDocs(qOrders);
        
        if (ordersSnapshot.empty) {
             return { status: 'success', message: 'No se encontraron registros antiguos para eliminar.', deletedCount: 0 };
        }

        const batch = writeBatch(db);
        ordersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
        });
        await batch.commit();
        
        return { 
            status: 'success', 
            message: `Se eliminaron ${deletedCount} registros de pedidos con más de 6 meses de antigüedad.`,
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
 * Actualiza los pedidos como confirmados en la colección `shopify_orders`.
 * Busca el pedido a través de las 5 tiendas posibles y lo actualiza.
 */
export async function updateConfirmedOrders(
  confirmedOrders: ConfirmedOrderInfo[]
): Promise<{ status: string; message: string }> {

  if (!confirmedOrders || confirmedOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const batch = writeBatch(db);
  let processedCount = 0;
  let notFoundCount = 0;

  // Asumimos que los storeId son 'tienda-1', 'tienda-2', ..., 'tienda-5'.
  const storeIds = Array.from({length: 5}, (_, i) => `tienda-${i+1}`);

  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    if (!rawOrderName) continue;
    
    let orderFound = false;
    for (const storeId of storeIds) {
        const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
        const orderDocRef = doc(db, 'shopify_orders', orderDocId);

        // Usamos getDoc para verificar si el documento existe antes de intentar actualizarlo.
        // Esto es más lento pero más seguro para un webhook que puede recibir datos incorrectos.
        const docSnap = await getDoc(orderDocRef);
        
        if (docSnap.exists() && !docSnap.data().isConfirmed) {
            batch.update(orderDocRef, {
                isConfirmed: true,
                confirmedAt: Timestamp.now(),
                confirmedBy: item.CONFIRMADO_POR || 'No especificado'
            });
            processedCount++;
            orderFound = true;
            break; // Salimos del bucle de tiendas una vez que encontramos y actualizamos el pedido.
        } else if (docSnap.exists() && docSnap.data().isConfirmed) {
            orderFound = true; // El pedido ya estaba confirmado, no hacemos nada pero lo contamos como encontrado.
            break;
        }
    }
    if (!orderFound) {
      notFoundCount++;
      console.warn(`[Firestore] Pedido ${rawOrderName} no fue encontrado en ninguna de las tiendas o ya estaba confirmado.`);
    }
  }

  if (processedCount === 0 && notFoundCount > 0) {
      return { status: 'success', message: `No se actualizó ningún pedido. ${notFoundCount} pedidos no fueron encontrados o ya estaban confirmados.` };
  }
  
  if (processedCount === 0 && notFoundCount === 0) {
      return { status: 'success', message: 'No se recibieron pedidos para procesar.' };
  }

  await batch.commit();

  return {
    status: 'success',
    message: `${processedCount} pedidos fueron marcados como confirmados. ${notFoundCount > 0 ? `${notFoundCount} no se encontraron o ya estaban confirmados.` : ''}`,
  };
}


/**
 * Procesa un lote de pedidos desde un archivo CSV de Shopify para una tienda específica.
 */
export async function processShopifyCsv(orders: Order[], storeId: string) {
  const batch = writeBatch(db);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const order of orders) {
    const orderDate = new Date(order.created_at);
    if (orderDate < sixMonthsAgo) continue;

    const orderDocId = getShopifyOrderDocId(order.name, storeId);
    const orderDocRef = doc(db, 'shopify_orders', orderDocId);
    
    // Prepara el mismo objeto de datos que el webhook en tiempo real.
    const orderData = {
        storeId: storeId,
        orderId: order.id,
        orderName: order.name,
        createdAt: Timestamp.fromDate(orderDate),
        totalPrice: parseFloat(order.total_price || '0'),
        customerName: `${order.customer?.first_name || ''} ${order.customer?.last_name || ''}`.trim(),
        province: order.shipping_address?.province || 'N/A',
        products: order.line_items?.map(item => ({ 
            title: item.title || 'N/A', 
            quantity: item.quantity || 0,
            price: parseFloat(item.price || '0')
        })) || [],
        isConfirmed: false,
        confirmedAt: null,
        confirmedBy: null,
    };
    // `set` con `merge: true` es crucial aquí para no borrar los datos de confirmación
    // si accidentalmente volvemos a subir un CSV con pedidos ya confirmados.
    batch.set(orderDocRef, orderData, { merge: true });
  }

  await batch.commit();
}