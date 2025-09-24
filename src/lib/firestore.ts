'use server';

import { db } from '@/lib/firebase-admin';
import { parse } from 'csv-parse/sync';
import {
  Timestamp,
  writeBatch,
  getDocs,
  deleteDoc,
  query,
  where,
  collection,
  doc,
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
}

export interface Order {
    id: number | string;
    name: string;
    created_at: string;
    total_price: string;
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
    const digits = String(name).match(/\d+/g);
    return digits ? digits.join('') : name;
}

/**
 * Crea un ID de documento único y consistente para cada pedido.
 * Formato: "idDeTienda-numeroDePedidoNormalizado" (ej: "tienda-1-1001")
 */
function getShopifyOrderDocId(orderName: string, storeId: string): string {
    const normalizedNumber = normalizeOrderNumber(orderName);
    const normalizedStoreId = storeId.toLowerCase().replace(/\s+/g, '-');
    return `${normalizedStoreId}-${normalizedNumber}`;
}


// --- Lógica de Webhooks (Shopify y Google Sheets) ---

/**
 * Procesa un nuevo pedido que llega en tiempo real desde un webhook de Shopify.
 */
export async function processNewShopifyOrder(order: Order, storeId: string) {
  const orderDate = new Date(order.created_at);

  // Ignorar pedidos con más de 6 meses de antigüedad
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
      // Campos de confirmación que se llenarán después
      isConfirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      courier: null,
  };

  try {
    // Usamos merge: true para crear o actualizar el pedido sin sobrescribir los datos de confirmación si ya existen.
    await db.collection('shopify_orders').doc(orderDocId).set(orderData, { merge: true });
    console.log(`[Firestore] Pedido ${order.name} de ${storeId} guardado/actualizado en 'shopify_orders'.`);
  } catch (error) {
    console.error(`Error al procesar el nuevo pedido de Shopify en Firestore:`, error);
    throw error;
  }
}

/**
 * Actualiza los pedidos en Firestore que han sido confirmados en Google Sheets.
 */
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
  
  const batch = db.batch();
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
    const orderDocRef = db.collection('shopify_orders').doc(orderDocId);

    try {
      const docSnap = await orderDocRef.get();
      
      if (docSnap.exists) {
          const docData = docSnap.data();
          // Solo actualizamos si el pedido NO estaba confirmado previamente
          if (docData && !docData.isConfirmed) {
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


// --- Lógica de Carga Masiva (CSV) y Limpieza ---

/**
 * CEREBRO DE LA CARGA CSV: Procesa archivos CSV, los transforma y los guarda en Firestore.
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

  const batch = db.batch();
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
        // --- 1. Validación y Filtrado ---
        const orderDateStr = r['Created at'] || '';
        const orderDate = orderDateStr ? new Date(orderDateStr) : null;
        if (!orderDate || isNaN(orderDate.getTime()) || orderDate < sixMonthsAgo) {
          continue; // Ignorar si la fecha es inválida o es de hace más de 6 meses
        }

        const orderId = r.Id || r.id || r['Order ID'] || null;
        const orderName = r.Name || '';
        if (!orderId || !orderName) {
            continue; // Ignorar si no tiene un ID o Nombre de pedido
        }

        // --- 2. Creación del Documento y Mapeo ---
        const orderDocId = getShopifyOrderDocId(orderName, storeId);
        const orderDocRef = db.collection('shopify_orders').doc(orderDocId);
        
        // --- 3. Construcción del Objeto Limpio para Firestore ---
        const orderData = {
          storeId: storeId,
          orderId: String(orderId),
          orderName: orderName,
          createdAt: Timestamp.fromDate(orderDate),
          totalPrice: parseFloat(r.Total || '0'),
          customerName: r['Billing Name'] || 'N/A',
          province: r['Shipping Province Name'] || 'N/A',
          city: r['Shipping City'] || 'N/A',
          zip: r['Shipping Zip'] || 'N/A',
          country: r['Shipping Country'] || 'N/A',
          // Simplificamos los datos del producto
          productTitle: r['Lineitem name'] || 'N/A',
          productQuantity: parseInt(r['Lineitem quantity'] || '0', 10),
          productPrice: parseFloat(r['Lineitem price'] || '0'),
          // Se usa `merge: true` para no sobrescribir la info de confirmación
        };

        // --- 4. Añadir al Lote ---
        // `merge: true` es crucial: si el pedido ya existe, solo actualiza los campos
        // de este objeto, pero NO borra `isConfirmed`, `confirmedAt`, etc. si ya existen.
        batch.set(orderDocRef, orderData, { merge: true });
        totalProcessedOrders++;
      }
    }
    
    // --- 5. Guardar Todo en la Base de Datos ---
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
        const ordersRef = collection(db, 'shopify_orders');
        const qOrders = query(ordersRef, where('createdAt', '<', firestoreTimestampLimit));
        const ordersSnapshot = await getDocs(qOrders);
        
        if (ordersSnapshot.empty) {
             return { status: 'success', message: 'No se encontraron registros antiguos para eliminar.', deletedCount: 0 };
        }

        const batch = db.batch();
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
