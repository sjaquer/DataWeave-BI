// src/lib/firestore.ts
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
  PRODUCTO?: string;
}

export interface DeliveredOrderInfo {
  ID: string;
  PEDIDO: string;
  TIENDA: string;
  TOTAL?: number;
  'MONTO PENDIENTE'?: number;
  'FECHA ENVIADO'?: string;
  'FECHA ENTREGADO'?: string;
  'FORMA DE PAGO'?: string; // YAPE, PLIN, AGENTE BOP, etc.
  'USUARIO'?: string; // Quien registró la entrega
}

export interface InventoryMovement {
  ID_MOVIMIENTO: string;
  TIMESTAMP: string;
  USUARIO_REGISTRADOR: string;
  SKU: string;
  PRODUCTO: string;
  VARIANTE: string;
  CANTIDAD: number;
  STOCK_ANTERIOR: number;
  STOCK_POSTERIOR: number;
  TIPO_MOVIMIENTO: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  MOTIVO_DETALLE: string;
  ID_REFERENCIA?: string;
  ALMACEN?: string;
  'NUM _PEDIDO'?: string;
  TIENDA?: string;
}

export interface Order {
    id: number | string;
    name: string;
    created_at: string;
    updated_at?: string;
    total_price: string;
    financial_status?: string; 
    fulfillment_status?: string | null;
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

function normalizeOrderNumber(name: string): string {
    if (!name) return '';
    // Extraer solo el número del pedido (ej: "#12161" → "12161")
    const match = String(name).match(/[0-9]+(-[0-9]+)*$/);
    return match ? match[0] : name.replace(/[^0-9a-zA-Z-]/g, '');
}

function normalizeStoreId(storeId: string): string {
    return (storeId || 'sin-tienda')
        .toLowerCase()
        .trim()
        .replace(/perú/g, '') // Eliminar 'perú'
        .replace(/peru/g, '')  // Eliminar 'peru'
        .replace(/\s+/g, '-')  // Reemplazar espacios con guion simple
        .replace(/-+/g, '-')   // Reemplazar múltiples guiones con uno solo
        .replace(/^-|-$/g, ''); // Eliminar guiones al inicio y final
}

function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    const normalizedStoreId = normalizeStoreId(storeId);
    
    return `${normalizedStoreId}-${normalizedNumber}`;
}


// --- Lógica de Webhooks ---

export async function processNewShopifyOrder(order: Order, storeId: string) {
  const orderDate = new Date(order.created_at);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  if (orderDate < sixMonthsAgo) {
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} ignorado por ser más antiguo de 6 meses.`);
    return;
  }

  const orderDocId = getShopifyOrderDocId(order.name, storeId);
  
  // IMPORTANTE: Normalizar el storeId antes de guardarlo
  const normalizedStoreId = normalizeStoreId(storeId);
  
  const orderData = {
      storeId: normalizedStoreId, // ← Usar el normalizado
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
      isDelivered: false,
      deliveredAt: null,
      paymentMethod: null,
  };

  try {
    await db.collection('shopify_orders').doc(orderDocId).set(orderData, { merge: true });
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} guardado/actualizado en 'shopify_orders' con ID: ${orderDocId}`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

export async function processUpdatedShopifyOrder(order: Order, storeId: string) {
  const orderDocId = getShopifyOrderDocId(order.name, storeId);
  const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
  
  const isPaid = order.financial_status === 'paid' || order.financial_status === 'partially_paid';
  const isFulfilled = order.fulfillment_status === 'fulfilled' || order.fulfillment_status === 'partial';

  if (isPaid || isFulfilled) {
    try {
      const orderDoc = await orderDocRef.get();
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

    const confirmationData: any = {
        isConfirmed: true,
        confirmedAt: confirmedAtTimestamp,
        confirmedBy: item.ATENDIDO || 'No especificado',
        courier: item.COURIER || 'No especificado',
        province: item.PROVINCIA || 'N/A', // Siempre actualizar la provincia desde la confirmación
    };

    batch.set(orderDocRef, confirmationData, { merge: true });
    processedCount++;
  }

  if (processedCount > 0) {
    await batch.commit();
  }

  const message = `${processedCount} pedidos fueron actualizados con datos del sheet REPORTE_ENVIADOS (merge mode).`;
  console.log(`[Firestore] ${message}`);
  
  return { status: 'success', message };
}

/**
 * Actualiza pedidos con información de la hoja "ENTREGADO".
 */
export async function updateDeliveredOrders(
  deliveredOrders: DeliveredOrderInfo[]
): Promise<{ status: string; message: string }> {
  if (!Array.isArray(deliveredOrders) || deliveredOrders.length === 0) {
    return { status: 'success', message: 'No se encontraron registros de entrega para procesar.' };
  }
  
  const batch: WriteBatch = db.batch();
  let processedCount = 0;

  for (const item of deliveredOrders) {
    const rawOrderName = String(item.PEDIDO || '');
    const storeId = item.TIENDA;

    if (!rawOrderName || !storeId) {
        console.warn(`[Firestore] Item de entrega ignorado por falta de PEDIDO o TIENDA:`, item);
        continue;
    };
    
    const orderDocId = getShopifyOrderDocId(rawOrderName, storeId);
    const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
    
    // Obtener forma de pago directamente del sheet
    const paymentMethod = item['FORMA DE PAGO'] || 'No especificado';
    const pending = Number(item['MONTO PENDIENTE'] || 0);

    // Calcular tiempo de entrega
    let deliveryTimeInHours = null;
    if (item['FECHA ENVIADO'] && item['FECHA ENTREGADO']) {
      try {
        const shippedDate = new Date(item['FECHA ENVIADO']);
        const deliveredDate = new Date(item['FECHA ENTREGADO']);
        if (!isNaN(shippedDate.getTime()) && !isNaN(deliveredDate.getTime())) {
          const diffMs = deliveredDate.getTime() - shippedDate.getTime();
          deliveryTimeInHours = diffMs / (1000 * 60 * 60);
        }
      } catch (e) {
        console.warn(`[Firestore] No se pudo calcular el tiempo de entrega para el pedido ${rawOrderName}.`);
      }
    }

    const deliveryData = {
        isDelivered: true,
        deliveredAt: item['FECHA ENTREGADO'] ? Timestamp.fromDate(new Date(item['FECHA ENTREGADO'])) : null,
        shippedAt: item['FECHA ENVIADO'] ? Timestamp.fromDate(new Date(item['FECHA ENVIADO'])) : null,
        paymentMethod: paymentMethod,
        pendingAmount: pending,
        deliveryTimeInHours: deliveryTimeInHours,
        deliveredBy: item.USUARIO || 'No especificado', // Quien registró la entrega
    };

    batch.set(orderDocRef, deliveryData, { merge: true });
    processedCount++;
  }

  if (processedCount > 0) {
    await batch.commit();
  }

  const message = `${processedCount} registros de entrega fueron actualizados con datos del sheet ENTREGADO (merge mode).`;
  console.log(`[Firestore] ${message}`);
  
  return { status: 'success', message };
}


export async function processInventoryMovements(
  movements: InventoryMovement[]
): Promise<{ status: string; message: string }> {
  if (!Array.isArray(movements) || movements.length === 0) {
    return { status: 'success', message: 'No se encontraron movimientos válidos para procesar.' };
  }

  const batch: WriteBatch = db.batch();
  let processedCount = 0;

  for (const item of movements) {
    const movementId = item.ID_MOVIMIENTO;
    if (!movementId) {
      console.warn('[Firestore] Item de inventario ignorado por falta de ID_MOVIMIENTO:', item);
      continue;
    }
    
    let movementTimestamp: Timestamp;
    try {
        const [datePart, timePart] = item.TIMESTAMP.split(' ');
        const [day, month, year] = datePart.split('/');
        const [hour, minute, second] = timePart.split(':');
        const parsedDate = new Date(+year, +month - 1, +day, +hour, +minute, +second);
        movementTimestamp = Timestamp.fromDate(parsedDate);
    } catch(e) {
        console.warn(`[Firestore] Timestamp inválido para ${movementId}. Usando fecha actual.`, e);
        movementTimestamp = Timestamp.now();
    }


    const movementDocRef = db.collection('inventory_movements').doc(movementId);
    
    const movementData = {
      timestamp: movementTimestamp,
      user: item.USUARIO_REGISTRADOR || 'N/A',
      sku: item.SKU || 'N/A',
      productName: item.PRODUCTO || 'N/A',
      variant: item.VARIANTE || 'N/A',
      quantity: Number(item.CANTIDAD || 0),
      stockBefore: Number(item.STOCK_ANTERIOR || 0),
      stockAfter: Number(item.STOCK_POSTERIOR || 0),
      type: item.TIPO_MOVIMIENTO || 'AJUSTE',
      reason: item.MOTIVO_DETALLE || 'N/A',
      referenceId: item.ID_REFERENCIA || null,
      warehouse: item.ALMACEN || 'N/A',
      orderNumber: item['NUM _PEDIDO'] || null,
      store: item.TIENDA || 'N/A',
    };

    batch.set(movementDocRef, movementData, { merge: true });
    processedCount++;
  }

  if (processedCount > 0) {
    await batch.commit();
  }

  const message = `${processedCount} movimientos de inventario fueron guardados.`;
  console.log(`[Firestore] ${message}`);
  
  return { status: 'success', message };
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
