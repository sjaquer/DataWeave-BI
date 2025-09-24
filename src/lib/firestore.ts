'use server';

import { db } from '@/lib/firebase-admin';
import { parse } from 'csv-parse/sync';
import {
  Timestamp,
  WriteBatch,
} from 'firebase-admin/firestore';


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
  PROVINCIA?: string; 
  'FECHA DE ATENCIÓN'?: string;
}

export interface Order {
    id: number | string;
    name: string;
    created_at: string;
    updated_at?: string;
    total_price: string;
    financial_status?: string; // paid, pending, partially_paid, refunded, etc.
    fulfillment_status?: string | null; // fulfilled, null, partial
    customer?: {
        first_name: string;
        last_name: string;
    };
    shipping_address?: {
        province: string;
        city: string;
        zip: string;
        country: string;
    };
    line_items: {
        title: string;
        quantity: number;
        price: string;
    }[];
}


// --- Funciones de Normalización y Creación de ID ---

/**
 * Extrae solo los dígitos de un número de pedido (ej: "#1001" -> "1001").
 */
function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    const match = String(name).match(/[0-9]+(-[0-9]+)*$/);
    return match ? match[0] : name.replace(/[^0-9a-zA-Z-]/g, '');
}

/**
 * Crea un ID de documento único y consistente para cada pedido.
 * Formato: "idDeTienda-numeroDePedidoNormalizado" (ej: "tienda-1-1001")
 */
function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    const normalizedStoreId = (storeId || 'sin-tienda').toLowerCase().replace(/\s+/g, '-');
    return `${normalizedStoreId}-${normalizedNumber}`;
}


// --- Lógica de Webhooks (Shopify y Google Sheets) ---

/**
 * Procesa un nuevo pedido que llega en tiempo real desde un webhook de Shopify.
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
    // Usamos set con merge:true para crear o actualizar el pedido sin sobreescribir datos de confirmación
    await db.collection('shopify_orders').doc(orderDocId).set(orderData, { merge: true });
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} guardado/actualizado en 'shopify_orders'.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Procesa una actualización de pedido que llega en tiempo real desde un webhook de Shopify.
 */
export async function processUpdatedShopifyOrder(order: Order, storeId: string) {
  const orderDocId = getShopifyOrderDocId(order.name, storeId);
  const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
  
  // Define las condiciones para que un pedido se considere "confirmado" desde Shopify.
  const isPaid = order.financial_status === 'paid' || order.financial_status === 'partially_paid';
  const isFulfilled = order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'partial';

  if (isPaid || isFulfilled) {
    try {
      const orderDoc = await orderDocRef.get();
      // Solo actualiza si el pedido ya existe y no está confirmado, para evitar sobreescribir confirmaciones de Google Sheets.
      if (orderDoc.exists && orderDoc.data()?.isConfirmed !== true) {
        const updateData: { isConfirmed: boolean; confirmedAt: Timestamp; confirmedBy: string; } = {
          isConfirmed: true,
          confirmedAt: order.updated_at ? Timestamp.fromDate(new Date(order.updated_at)) : Timestamp.now(),
          confirmedBy: 'Shopify Automation'
        };
        await orderDocRef.update(updateData);
        console.log(`[Firestore] Pedido ${order.name} de ${storeId} marcado como CONFIRMADO vía webhook de actualización.`);
      }
    } catch (error) {
       console.error(`Error al actualizar el pedido de Shopify en Firestore:`, error);
       throw error;
    }
  }
}


/**
 * Crea o actualiza los pedidos en Firestore desde Google Sheets.
 */
export async function updateConfirmedOrders(
  confirmedOrders: ConfirmedOrderInfo[]
): Promise<{ status: string; message: string }> {

  if (!Array.isArray(confirmedOrders) || confirmedOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron pedidos válidos para procesar.' };
  }
  
  const batch: WriteBatch = db.batch();
  let processedCount = 0;

  for (const item of confirmedOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    const storeId = item.TIENDA;

    if (!rawOrderName || !storeId) {
        console.warn(`[Firestore] Item ignorado por falta de PEDIDO o TIENDA:`, item);
        continue;
    };
    
    const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
    const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
    
    const dateString = item['FECHA DE ATENCIÓN'];
    const confirmedAtTimestamp = dateString ? Timestamp.fromDate(new Date(dateString)) : Timestamp.now();

    const orderData = {
        isConfirmed: true,
        confirmedAt: confirmedAtTimestamp,
        confirmedBy: item.ATENDIDO || 'No especificado',
        courier: item.COURIER || 'No especificado',
        province: item.PROVINCIA || 'N/A', 
    };

    batch.set(orderDocRef, orderData, { merge: true });
    processedCount++;
  }

  if (processedCount > 0) {
    await batch.commit();
  }

  const message = `${processedCount} pedidos fueron creados o actualizados como confirmados en la base de datos.`;
  console.log(`[Firestore] ${message}`);
  
  return {
    status: 'success',
    message,
  };
}


// --- Lógica de Carga Masiva (CSV) y Limpieza ---

/**
 * Procesa archivos CSV de Shopify, los transforma y los guarda en Firestore.
 */
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

  const batch: WriteBatch = db.batch();
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
        const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
        
        const orderData = {
          storeId: storeId,
          orderId: String(orderId),
          orderName: orderName,
          createdAt: Timestamp.fromDate(orderDate),
          totalPrice: parseFloat(r.Total || '0'),
          customerName: (r['Billing Name'] || '').trim(),
          province: r['Shipping Province Name'] || 'N/A', 
          city: r['Shipping City'] || 'N/A',
          zip: r['Shipping Zip'] || 'N/A',
          country: r['Shipping Country'] || 'N/A',
           products: [{ 
              title: r['Lineitem name'] || 'N/A', 
              quantity: parseInt(r['Lineitem quantity'] || '0', 10),
              price: parseFloat(r['Lineitem price'] || '0')
          }],
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

/**
 * Elimina todos los registros de pedidos con más de 6 meses de antigüedad.
 */
export async function deleteOldMetrics(): Promise<{ status: string; message: string; deletedCount: number }> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const firestoreTimestampLimit = Timestamp.fromDate(sixMonthsAgo);
    let deletedCount = 0;

    try {
        const ordersRef = db.collection('shopify_orders');
        const qOrders = ordersRef.where('createdAt', '<', firestoreTimestampLimit);
        const ordersSnapshot = await qOrders.get();
        
        if (ordersSnapshot.empty) {
             return { status: 'success', message: 'No se encontraron registros antiguos para eliminar.', deletedCount: 0 };
        }

        const batch: WriteBatch = db.batch();
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

    