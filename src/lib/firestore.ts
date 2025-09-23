import { db } from './firebase';
import { collection, doc, getDoc, setDoc, runTransaction, DocumentReference, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';

/**
 * Formatea una fecha de varios formatos posibles y la devuelve como DD-MM-YYYY.
 * Esta versión es más robusta para el entorno de servidor.
 */
function formatDate(dateString: string | Date): string | null {
    if (!dateString) return null;
    try {
        // Si es un string, intenta parsearlo como ISO 8601 primero.
        // Si no, crea una nueva instancia de Date.
        const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
        if (isNaN(date.getTime())) {
          console.warn("La fecha proporcionada no es válida y no pudo ser parseada:", dateString);
          return null;
        };
        // format de date-fns es seguro de usar para formatear
        return format(date, 'dd-MM-yyyy');
    } catch (error) {
        console.error("Error al formatear fecha:", dateString, error);
        return null;
    }
}

/**
 * Procesa un nuevo pedido de Shopify, lo guarda en la colección 'orders'
 * y actualiza las métricas diarias en 'daily_metrics'.
 */
export async function processNewShopifyOrder(orderData: any) {
    const orderId = String(orderData.id);
    const orderNumber = orderData.name.replace('#', '');
    // ¡CORRECCIÓN! Usar formatDate para asegurar el formato DD-MM-YYYY
    const formattedDate = formatDate(orderData.created_at);

    if (!formattedDate) {
        console.error(`Fecha inválida para pedido ${orderId}: ${orderData.created_at}`);
        return;
    }

    const orderRef = doc(db, 'orders', orderId);
    const dailyMetricRef = doc(db, 'daily_metrics', formattedDate);

    try {
        await runTransaction(db, async (transaction) => {
            const orderDoc = await transaction.get(orderRef);

            // Si el pedido ya existe, podría haber sido creado por el webhook de sheets.
            // Lo actualizamos con los datos de Shopify pero no contamos dos veces.
            if (orderDoc.exists()) {
                console.log(`El pedido ${orderId} ya existe. Actualizando con datos de Shopify.`);
                transaction.set(orderRef, {
                    ...orderDoc.data(), // Mantiene 'confirmed' si ya estaba
                    orderId: orderId,
                    orderNumber: orderNumber,
                    date: formattedDate,
                    createdAt: new Date(orderData.created_at),
                }, { merge: true }); // Usamos merge para no sobrescribir el estado 'confirmed'
                return; 
            }

            // 1. Guardar los datos del nuevo pedido
            transaction.set(orderRef, {
                orderId: orderId,
                orderNumber: orderNumber,
                date: formattedDate,
                confirmed: false, // Inicialmente no está confirmado
                createdAt: new Date(orderData.created_at),
            });

            // 2. Actualizar las métricas diarias para totalOrders
            const dailyMetricDoc = await transaction.get(dailyMetricRef);
            if (dailyMetricDoc.exists()) {
                const currentTotal = dailyMetricDoc.data().totalOrders || 0;
                transaction.update(dailyMetricRef, {
                    totalOrders: currentTotal + 1,
                });
            } else {
                transaction.set(dailyMetricRef, {
                    date: formattedDate,
                    totalOrders: 1,
                    confirmedOrders: 0,
                });
            }
        });
        console.log(`Pedido de Shopify ${orderId} (${orderNumber}) del ${formattedDate} procesado.`);

    } catch (error) {
        console.error(`Error en la transacción para el pedido de Shopify ${orderId}:`, error);
    }
}


/**
 * Actualiza los pedidos a 'confirmado' basado en una lista de números de pedido
 * y recalcula las métricas diarias correspondientes.
 * ¡NUEVO!: Si un pedido no existe, lo crea.
 */
export async function updateConfirmedOrders(confirmedOrderData: { orderNumber: string, date: string | null }[]) {
    if (confirmedOrderData.length === 0) return;

    const dailyMetricsToUpdate: Record<string, { confirmedIncrement: number, totalIncrement: number }> = {};

    const ordersRef = collection(db, 'orders');
    const CHUNK_SIZE = 30;
    const dataChunks = [];
    for (let i = 0; i < confirmedOrderData.length; i += CHUNK_SIZE) {
        dataChunks.push(confirmedOrderData.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of dataChunks) {
        const orderNumbersInChunk = chunk.map(d => d.orderNumber);
        if (orderNumbersInChunk.length === 0) continue;

        const q = query(ordersRef, where('orderNumber', 'in', orderNumbersInChunk));
        const querySnapshot = await getDocs(q);

        const foundOrderNumbers = new Set(querySnapshot.docs.map(doc => doc.data().orderNumber));
        const batch = writeBatch(db);

        // Caso 1: Pedidos encontrados que no estaban confirmados. Actualizarlos.
        querySnapshot.forEach(doc => {
            if (doc.data().confirmed === false) {
                batch.update(doc.ref, { confirmed: true });
                const date = doc.data().date;
                if (date) {
                    if (!dailyMetricsToUpdate[date]) dailyMetricsToUpdate[date] = { confirmedIncrement: 0, totalIncrement: 0 };
                    dailyMetricsToUpdate[date].confirmedIncrement++;
                }
            }
        });

        // Caso 2: Pedidos no encontrados. Crearlos como confirmados.
        const ordersToCreate = chunk.filter(d => !foundOrderNumbers.has(d.orderNumber));
        ordersToCreate.forEach(data => {
            // Usamos la fecha de la hoja si está disponible, si no, la de hoy.
            const date = data.date ? formatDate(data.date) : format(new Date(), 'dd-MM-yyyy');
            if (!date) return;
            
            const newOrderRef = doc(collection(db, 'orders')); // Firestore generará un ID
            batch.set(newOrderRef, {
                orderId: newOrderRef.id,
                orderNumber: data.orderNumber,
                date: date,
                confirmed: true,
                createdAt: new Date(), // Fecha de creación en nuestro sistema
                createdBy: 'sheets_webhook' // Para saber su origen
            });

            if (!dailyMetricsToUpdate[date]) dailyMetricsToUpdate[date] = { confirmedIncrement: 0, totalIncrement: 0 };
            dailyMetricsToUpdate[date].confirmedIncrement++;
            dailyMetricsToUpdate[date].totalIncrement++; // Contar también como pedido total
        });
        
        await batch.commit();
    }

    // Actualizar las métricas diarias en transacciones separadas
    for (const [date, increments] of Object.entries(dailyMetricsToUpdate)) {
        if (increments.confirmedIncrement === 0 && increments.totalIncrement === 0) continue;

        const dailyMetricRef = doc(db, 'daily_metrics', date);
        try {
            await runTransaction(db, async (transaction) => {
                const dailyDoc = await transaction.get(dailyMetricRef);
                if (dailyDoc.exists()) {
                    const currentConfirmed = dailyDoc.data().confirmedOrders || 0;
                    const currentTotal = dailyDoc.data().totalOrders || 0;
                    transaction.update(dailyMetricRef, {
                        confirmedOrders: currentConfirmed + increments.confirmedIncrement,
                        totalOrders: currentTotal + increments.totalIncrement
                    });
                } else {
                    transaction.set(dailyMetricRef, {
                        date: date,
                        totalOrders: increments.totalIncrement,
                        confirmedOrders: increments.confirmedIncrement
                    });
                }
            });
        } catch(e) {
            console.error(`Error actualizando métricas para el día ${date}:`, e);
        }
    }
}