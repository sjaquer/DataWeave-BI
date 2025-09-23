import { db } from './firebase';
import { collection, doc, getDoc, setDoc, runTransaction, DocumentReference, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';

/**
 * Formatea una fecha de varios formatos posibles y la devuelve como DD-MM-YYYY.
 */
function formatDate(dateString: string): string | null {
    if (!dateString) return null;
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
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
    const formattedDate = formatDate(orderData.created_at);

    if (!formattedDate) {
        console.error(`Fecha inválida para pedido ${orderId}`);
        return;
    }

    const orderRef = doc(db, 'orders', orderId);
    const dailyMetricRef = doc(db, 'daily_metrics', formattedDate);

    try {
        await runTransaction(db, async (transaction) => {
            const orderDoc = await transaction.get(orderRef);

            // Solo procesar si el pedido no existe para evitar duplicados por reintentos del webhook
            if (orderDoc.exists()) {
                console.log(`El pedido ${orderId} ya fue procesado. Omitiendo.`);
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

            // 2. Actualizar las métricas diarias
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
        console.log(`Pedido ${orderId} (${orderNumber}) del ${formattedDate} procesado exitosamente.`);

    } catch (error) {
        console.error(`Error en la transacción para el pedido ${orderId}:`, error);
    }
}


/**
 * Actualiza los pedidos a 'confirmado' basado en una lista de números de pedido
 * y recalcula las métricas diarias correspondientes.
 */
export async function updateConfirmedOrders(confirmedOrderNumbers: string[]) {
    if (confirmedOrderNumbers.length === 0) return;

    const ordersRef = collection(db, 'orders');
    // Firestore limita las cláusulas 'in' a 30 valores por consulta
    const CHUNK_SIZE = 30; 
    const orderNumberChunks = [];
    for (let i = 0; i < confirmedOrderNumbers.length; i += CHUNK_SIZE) {
        orderNumberChunks.push(confirmedOrderNumbers.slice(i, i + CHUNK_SIZE));
    }
    
    const dailyMetricsToUpdate: Record<string, number> = {};

    for (const chunk of orderNumberChunks) {
        const q = query(ordersRef, where('orderNumber', 'in', chunk), where('confirmed', '==', false));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) continue;
        
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.update(doc.ref, { confirmed: true });
            const date = doc.data().date;
            if (date) {
                dailyMetricsToUpdate[date] = (dailyMetricsToUpdate[date] || 0) + 1;
            }
        });
        await batch.commit();
    }

    // Actualizar las métricas diarias en una transacción por cada día afectado
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
                    // Esto no debería pasar si la lógica de creación de pedido funciona, pero es un buen seguro
                    transaction.set(dailyMetricRef, {
                        date: date,
                        totalOrders: increment,
                        confirmedOrders: increment
                    });
                }
            });
        } catch(e) {
            console.error(`Error actualizando métricas para el día ${date}:`, e);
        }
    }
}

    