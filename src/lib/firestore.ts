'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  writeBatch,
  getDocs,
  Timestamp,
  deleteDoc,
  getDoc,
  query,
  where,
} from 'firebase/firestore';

export interface Order {
  id: number;
  name: string;
  created_at: string;
  total_price: string;
  customer?: {
    first_name?: string;
    last_name?: string;
  };
  shipping_address?: {
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
  };
  line_items?: {
    title?: string;
    quantity?: number;
    price?: string;
  }[];
}


export interface ConfirmedOrderInfo {
  PEDIDO: string;
  TIENDA: string;
  ATENDIDO?: string;
  COURIER?: string; // Nuevo campo para el courier
}


function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    return digits ? digits.join('') : name;
}


function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    // Normalizamos el storeId para que sea apto para un ID de documento.
    const normalizedStoreId = storeId.toLowerCase().replace(/\s+/g, '-');
    return `${normalizedStoreId}-${normalizedNumber}`;
}


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
      city: order.shipping_address?.city || 'N/A',
      zip: order.shipping_address?.zip || 'N/A',
      country: order.shipping_address?.country || 'N/A',
      products: order.line_items?.map(item => ({ 
          title: item.title || 'N/A', 
          quantity: item.quantity || 0,
          price: parseFloat(item.price || '0')
      })) || [],
      isConfirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      courier: null, // Campo courier inicializado
  };

  try {
    // Usamos merge: true para no sobrescribir los datos de confirmación si ya existen.
    await writeBatch(db).set(orderDocRef, orderData, { merge: true }).commit();
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} guardado/actualizado en 'shopify_orders'.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}


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



export async function updateConfirmedOrders(
  confirmedOrders: ConfirmedOrderInfo[]
): Promise<{ status: string; message: string }> {

  if (!confirmedOrders || confirmedOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron pedidos válidos para procesar.' };
  }
  
  const batch = writeBatch(db);
  let processedCount = 0;
  let notFoundCount = 0;
  let alreadyConfirmedCount = 0;

  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    const storeId = item.TIENDA;
    const courier = item.COURIER; // Obtenemos el courier

    if (!rawOrderName || !storeId) {
        console.warn(`[Firestore] Item ignorado por falta de PEDIDO o TIENDA:`, item);
        continue;
    };
    
    const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
    const orderDocRef = doc(db, 'shopify_orders', orderDocId);

    const docSnap = await getDoc(orderDocRef);
    
    if (docSnap.exists()) {
        if (!docSnap.data().isConfirmed) {
            batch.update(orderDocRef, {
                isConfirmed: true,
                confirmedAt: Timestamp.now(),
                confirmedBy: item.ATENDIDO || 'No especificado',
                courier: courier || 'No especificado' // Guardamos el courier
            });
            processedCount++;
        } else {
            alreadyConfirmedCount++;
        }
    } else {
      notFoundCount++;
      console.warn(`[Firestore] Pedido ${rawOrderName} de la tienda ${storeId} no fue encontrado.`);
    }
  }

  if (processedCount > 0) {
    await batch.commit();
  }

  let message = `${processedCount} pedidos fueron marcados como confirmados.`;
  if (notFoundCount > 0) message += ` ${notFoundCount} no se encontraron.`;
  if (alreadyConfirmedCount > 0) message += ` ${alreadyConfirmedCount} ya estaban confirmados.`;

  return {
    status: 'success',
    message,
  };
}



export async function processShopifyCsv(orders: Order[], storeId: string) {
  const batch = writeBatch(db);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const order of orders) {
    // Asegurarse de que el objeto order y created_at existen.
    if (!order || !order.created_at) continue;

    const orderDate = new Date(order.created_at);
    if (orderDate < sixMonthsAgo) continue;

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
        city: order.shipping_address?.city || 'N/A',
        zip: order.shipping_address?.zip || 'N/A',
        country: order.shipping_address?.country || 'N/A',
        products: order.line_items?.map(item => ({ 
            title: item.title || 'N/A', 
            quantity: item.quantity || 0,
            price: parseFloat(item.price || '0')
        })) || [],
    };

    // Usamos merge: true para no sobrescribir los datos de confirmación
    // si un pedido se sube dos veces.
    batch.set(orderDocRef, orderData, { merge: true });
  }

  await batch.commit();
}
