'use server';

import { db } from '@/lib/firebase-admin';
import { parse } from 'csv-parse/sync';
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


export interface AnalyzeAndStoreMetricsInput {
  storeId: string;
  shopifyDataUris: string[];
}

export interface AnalyzeAndStoreMetricsOutput {
  status: string;
  message: string;
}

export interface ConfirmedOrderInfo {
  PEDIDO: string;
  TIENDA: string;
  ATENDIDO?: string;
  COURIER?: string;
}


function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    const digits = String(name).match(/\d+/g);
    return digits ? digits.join('') : name;
}


function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    const normalizedStoreId = storeId.toLowerCase().replace(/\s+/g, '-');
    return `${normalizedStoreId}-${normalizedNumber}`;
}


export async function processNewShopifyOrder(order: any, storeId: string) {
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
      courier: null,
  };

  try {
    const batch = writeBatch(db);
    batch.set(orderDocRef, orderData, { merge: true });
    await batch.commit();
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

  let orders = confirmedOrders;

  if (!Array.isArray(orders)) {
    orders = [orders];
  }

  if (!orders || orders.length === 0) {
    return { status: 'success', message: 'No se encontraron pedidos válidos para procesar.' };
  }
  
  const batch = writeBatch(db);
  let processedCount = 0;
  let notFoundCount = 0;
  let alreadyConfirmedCount = 0;

  for (const item of orders) {
    const rawOrderName = String(item.PEDIDO || '');
    const storeId = item.TIENDA;
    const courier = item.COURIER;

    if (!rawOrderName || !storeId) {
        console.warn(`[Firestore] Item ignorado por falta de PEDIDO o TIENDA:`, item);
        continue;
    };
    
    const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
    const orderDocRef = doc(db, 'shopify_orders', orderDocId);

    try {
      const docSnap = await getDoc(orderDocRef);
      
      if (docSnap.exists()) {
          if (!docSnap.data().isConfirmed) {
              batch.update(orderDocRef, {
                  isConfirmed: true,
                  confirmedAt: Timestamp.now(),
                  confirmedBy: item.ATENDIDO || 'No especificado',
                  courier: courier || 'No especificado'
              });
              processedCount++;
          } else {
              alreadyConfirmedCount++;
          }
      } else {
        notFoundCount++;
        console.warn(`[Firestore] Pedido ${rawOrderName} de la tienda ${storeId} no fue encontrado.`);
      }
    } catch (e) {
       console.error(`Error al obtener el documento ${orderDocId}:`, e);
       continue;
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


export async function analyzeAndStoreMetrics(
  input: AnalyzeAndStoreMetricsInput
): Promise<AnalyzeAndStoreMetricsOutput> {
  let totalProcessedOrders = 0;
  const { storeId, shopifyDataUris } = input;
  
  if (!shopifyDataUris || shopifyDataUris.length === 0) {
    return { status: 'error', message: 'No se proporcionaron archivos de Shopify.' };
  }
  if (!storeId) {
    return { status: 'error', message: 'No se proporcionó el ID de la tienda.' };
  }

  const batch = writeBatch(db);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  try {
    for (const dataUri of shopifyDataUris) {
      const csvData = Buffer.from(dataUri.split(',')[1], 'base64').toString('utf-8');
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
      });
      
      for (const r of records) {
        const orderDateStr = r['Created at'] || '';
        const orderDate = orderDateStr ? new Date(orderDateStr) : null;
        if (!orderDate || isNaN(orderDate.getTime()) || orderDate < sixMonthsAgo) {
          continue; 
        }

        const orderId = r.Id || null;
        const orderName = r.Name || '';
        if (!orderId || !orderName) {
            continue; 
        }

        const orderDocId = getShopifyOrderDocId(orderName, storeId);
        const orderDocRef = doc(db, 'shopify_orders', orderDocId);
        
        const products = r['Lineitem name'] ? [{ 
            title: r['Lineitem name'] || 'N/A', 
            quantity: parseInt(r['Lineitem quantity'] || '0', 10),
            price: parseFloat(r['Lineitem price'] || '0')
        }] : [];


        const orderData = {
          storeId: storeId,
          orderId: orderId,
          orderName: orderName,
          createdAt: Timestamp.fromDate(orderDate),
          totalPrice: parseFloat(r.Total || '0'),
          customerName: r['Billing Name'] || 'N/A',
          province: r['Shipping Province Name'] || 'N/A',
          city: r['Shipping City'] || 'N/A',
          zip: r['Shipping Zip'] || 'N/A',
          country: r['Shipping Country'] || 'N/A',
          products: products,
        };
        batch.set(orderDocRef, orderData, { merge: true });
        totalProcessedOrders++;
      }
    }
    
    await batch.commit();

    return {
      status: 'success',
      message: `Se procesaron y guardaron ${totalProcessedOrders} pedidos de Shopify para la tienda ${storeId}.`,
    };

  } catch (e: any) {
    const errorMessage = `Error procesando los archivos de Shopify: ${e.message}`;
    console.error(errorMessage, e);
    return { status: 'error', message: errorMessage };
  }
}
