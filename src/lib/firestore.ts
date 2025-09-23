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
        const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
        if (isNaN(date.getTime())) {
          console.warn("La fecha proporcionada no es válida y no pudo ser parseada:", dateString);
          return null;
        };
        return format(date, 'dd-MM-yyyy');
    } catch (error) {
        console.error("Error al formatear fecha:", dateString, error);
        return null;
    }
}

/**
 * Procesa un nuevo pedido de Shopify. Es el ÚNICO responsable de incrementar totalOrders.
 */
export async function processNewShopifyOrder(orderData: any) {
    const orderId = String(orderData.id);
    const orderNumber = orderData.name.replace('#', '');
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
            let isNewOrder = false;

            if (orderDoc.exists()) {
                // El pedido ya existe (probablemente creado por webhook de sheets).
                // Actualizamos con datos de Shopify pero NO contamos de nuevo.
                transaction.set(orderRef, {
                    ...orderDoc.data(),
                    orderId: orderId,
                    orderNumber: orderNumber,
                    date: formattedDate,
                    createdAt: new Date(orderData.created_at),
                }, { merge: true });
                 console.log(`Pedido ${orderId} ya existía, actualizado con datos de Shopify.`);

            } else {
                // El pedido no existe, es la primera vez que lo vemos.
                // Lo creamos y marcamos para incrementar el contador de totalOrders.
                isNewOrder = true;
                transaction.set(orderRef, {
                    orderId: orderId,
                    orderNumber: orderNumber,
                    date: formattedDate,
                    confirmed: false,
                    createdAt: new Date(orderData.created_at),
                    createdBy: 'shopify_webhook'
                });
            }

            // Solo si es un pedido genuinamente nuevo, actualizamos las métricas.
            if (isNewOrder) {
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
                console.log(`Nuevo pedido de Shopify ${orderId} procesado. totalOrders incrementado.`);
            }
        });

    } catch (error) {
        console.error(`Error en la transacción para el pedido de Shopify ${orderId}:`, error);
    }
}


/**
 * Actualiza los pedidos a 'confirmado'. Es el ÚNICO responsable de incrementar confirmedOrders.
 */
export async function updateConfirmedOrders(confirmedOrderData: { orderNumber: string, date: string | null }[]) {
    if (confirmedOrderData.length === 0) return;

    const dailyMetricsToUpdate: Record<string, number> = {};

    const ordersRef = collection(db, 'orders');
    const CHUNK_SIZE = 30; // Firestore 'in' query limit
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
                    if (!dailyMetricsToUpdate[date]) dailyMetricsToUpdate[date] = 0;
                    dailyMetricsToUpdate[date]++; // Solo incrementa contador de confirmados
                }
            }
        });

        // Caso 2: Pedidos no encontrados. Crearlos como confirmados pero NO afectar métricas.
        const ordersToCreate = chunk.filter(d => !foundOrderNumbers.has(d.orderNumber));
        ordersToCreate.forEach(data => {
            const date = data.date ? formatDate(data.date) : format(new Date(), 'dd-MM-yyyy');
            if (!date) return;
            
            const newOrderRef = doc(collection(db, 'orders'));
            batch.set(newOrderRef, {
                orderId: newOrderRef.id,
                orderNumber: data.orderNumber,
                date: date,
                confirmed: true,
                createdAt: new Date(),
                createdBy: 'sheets_webhook'
            });
            
            // NO incrementamos totalOrders aquí. Esperamos al webhook de Shopify.
            // Sí incrementamos confirmedOrders.
            if (!dailyMetricsToUpdate[date]) dailyMetricsToUpdate[date] = 0;
            dailyMetricsToUpdate[date]++;
        });
        
        await batch.commit();
    }

    // Actualizar las métricas diarias en transacciones separadas
    for (const [date, increment] of Object.entries(dailyMetricsToUpdate)) {
        if (increment === 0) continue;

        const dailyMetricRef = doc(db, 'daily_metrics', date);
        try {
            await runTransaction(db, async (transaction) => {
                const dailyDoc = await transaction.get(dailyMetricRef);
                if (dailyDoc.exists()) {
                    const currentConfirmed = dailyDoc.data().confirmedOrders || 0;
                    transaction.update(dailyMetricRef, {
                        confirmedOrders: currentConfirmed + increment
                    });
                } else {
                    // Si no existe, lo crea con 0 pedidos totales,
                    // esperando que el webhook de Shopify los sume.
                    transaction.set(dailyMetricRef, {
                        date: date,
                        totalOrders: 0,
                        confirmedOrders: increment
                    });
                }
            });
            console.log(`Métricas de confirmados para el día ${date} actualizadas.`);
        } catch(e) {
            console.error(`Error actualizando métricas para el día ${date}:`, e);
        }
    }
}
