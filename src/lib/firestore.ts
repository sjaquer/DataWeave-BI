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
  CONFIRMADO_POR?: string;
}


function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    return digits ? digits.join('') : name;
}


function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    return `${storeId}-${normalizedNumber}`;
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
  };

  try {
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
    return { status: 'success', message: 'No se encontraron números de pedido válidos para procesar.' };
  }
  
  const batch = writeBatch(db);
  let processedCount = 0;
  let notFoundCount = 0;

  const storeIds = Array.from({length: 5}, (_, i) => `tienda-${i+1}`);
  storeIds.push('dearel'); // Añadimos dearel

  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    if (!rawOrderName) continue;
    
    let orderFound = false;
    for (const storeId of storeIds) {
        const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
        const orderDocRef = doc(db, 'shopify_orders', orderDocId);

        const docSnap = await getDoc(orderDocRef);
        
        if (docSnap.exists() && !docSnap.data().isConfirmed) {
            batch.update(orderDocRef, {
                isConfirmed: true,
                confirmedAt: Timestamp.now(),
                confirmedBy: item.CONFIRMADO_POR || 'No especificado'
            });
            processedCount++;
            orderFound = true;
            break; 
        } else if (docSnap.exists() && docSnap.data().isConfirmed) {
            orderFound = true; 
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



export async function processShopifyCsv(orders: Order[], storeId: string) {
  const batch = writeBatch(db);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  for (const order of orders) {
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
        isConfirmed: false,
        confirmedAt: null,
        confirmedBy: null,
    };

    batch.set(orderDocRef, orderData, { merge: true });
  }

  await batch.commit();
}
