
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, startOfDay, addDays } from 'date-fns';
import type { ZadarmaCall, ZadarmaCallDocument } from '@/types/zadarma';

// --- Mapeo de Agentes ---
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana",
};

// --- Funciones de Sincronización y Caché ---

/**
 * Guarda un lote de llamadas en Firestore.
 */
export async function saveZadarmaCalls(calls: ZadarmaCall[]): Promise<number> {
  if (calls.length === 0) return 0;
  const batch = db.batch();
  const now = Timestamp.now();
  
  calls.forEach(call => {
    const callDate = format(new Date(call.callstart), 'yyyy-MM-dd');
    const docId = `${call.pbx_call_id}_${call.callstart}`;
    const docRef = db.collection('zadarma_calls').doc(docId);
    
    const callDoc: Partial<ZadarmaCallDocument> = {
      ...call, id: docId, callDate, agentId: call.sip,
      agentName: AGENT_MAP[call.sip] || 'Desconocido',
      syncedAt: now.toDate().toISOString(), createdAt: now,
    };
    batch.set(docRef, callDoc, { merge: true });
  });

  await batch.commit();
  return calls.length;
}

/**
 * Borra todas las llamadas de un día específico y las reemplaza con un nuevo conjunto de llamadas.
 * Esto es útil para corregir cachés incompletos.
 */
export async function updateZadarmaCallsInFirestore(calls: ZadarmaCall[], date: Date): Promise<number> {
  const callDate = format(date, 'yyyy-MM-dd');

  const querySnapshot = await db.collection('zadarma_calls')
    .where('callDate', '==', callDate)
    .get();

  const batch = db.batch();
  const now = Timestamp.now();

  querySnapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });

  calls.forEach(call => {
    const docId = `${call.pbx_call_id}_${call.callstart}`;
    const docRef = db.collection('zadarma_calls').doc(docId);
    
    const callDoc: Partial<ZadarmaCallDocument> = {
      ...call,
      id: docId,
      callDate: format(new Date(call.callstart), 'yyyy-MM-dd'),
      agentId: call.sip,
      agentName: AGENT_MAP[call.sip] || 'Desconocido',
      syncedAt: now.toDate().toISOString(),
      createdAt: now,
    };
    batch.set(docRef, callDoc, { merge: true });
  });

  await batch.commit();
  console.log(`[Firestore]: Replaced ${querySnapshot.size} old calls with ${calls.length} new calls for date ${callDate}.`);
  return calls.length;
}

/**
 * Obtiene llamadas de Firestore para un rango de fechas.
 */
export async function getZadarmaCallsFromFirestore(startDate: Date, endDate: Date): Promise<ZadarmaCall[]> {
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', format(startDate, 'yyyy-MM-dd'))
    .where('callDate', '<=', format(endDate, 'yyyy-MM-dd'))
    .get();

  return snapshot.docs.map(doc => doc.data() as ZadarmaCall);
}

/**
 * Verifica si existen datos en Firestore para un rango de fechas.
 */
export async function hasDataForDateRange(startDate: Date, endDate: Date): Promise<boolean> {
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', format(startDate, 'yyyy-MM-dd'))
    .where('callDate', '<=', format(endDate, 'yyyy-MM-dd'))
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Guarda metadatos de una operación de sincronización para UN SOLO DÍA.
 */
export async function saveSyncMetadata(date: Date, totalCalls: number, status: 'success' | 'error', errorMessage?: string): Promise<void> {
  const syncId = `sync_${format(date, 'yyyy-MM-dd')}`;
  const now = Timestamp.now();
  await db.collection('zadarma_sync_metadata').doc(syncId).set({
    lastSyncTimestamp: now, totalCallsSynced: totalCalls, date: format(date, 'yyyy-MM-dd'),
    status, errorMessage: errorMessage || null,
  }, { merge: true });
}

/**
 * Devuelve una lista de días que NO tienen metadatos de sincronización exitosa.
 */
export async function getMissingDaysFromFirestore(startDate: Date, endDate: Date): Promise<Date[]> {
    const daysInRange: Date[] = [];
    let currentDate = startOfDay(startDate);
    const finalDate = startOfDay(endDate);
    
    while(currentDate <= finalDate) {
        daysInRange.push(new Date(currentDate));
        currentDate = addDays(currentDate, 1);
    }
    
    if (daysInRange.length === 0) return [];
    
    const syncIds = daysInRange.map(d => `sync_${format(d, 'yyyy-MM-dd')}`);
    const foundDates = new Set<string>();

    for (let i = 0; i < syncIds.length; i += 30) {
        const chunk = syncIds.slice(i, i + 30);
        const foundDocs = await db.collection('zadarma_sync_metadata')
            .where('__name__', 'in', chunk)
            .where('status', '==', 'success')
            .get();
        foundDocs.docs.forEach(doc => foundDates.add(doc.data().date));
    }
    
    return daysInRange.filter(d => !foundDates.has(format(d, 'yyyy-MM-dd')));
}

// --- Funciones de Bloqueo (Locking) ---

const getLockRef = (date: Date) => db.collection('zadarma_sync_locks').doc(format(date, 'yyyy-MM-dd'));

export async function setSyncLock(date: Date): Promise<void> {
  await getLockRef(date).set({ timestamp: Timestamp.now() });
}

export async function removeSyncLock(date: Date): Promise<void> {
  await getLockRef(date).delete();
}

export async function isSyncLocked(date: Date, ttlMinutes: number): Promise<boolean> {
  const doc = await getLockRef(date).get();
  if (!doc.exists) return false;
  
  const lockTime = (doc.data()?.timestamp as Timestamp).toDate();
  const expirationTime = new Date(lockTime.getTime() + ttlMinutes * 60000);

  if (new Date() > expirationTime) {
    await removeSyncLock(date);
    return false;
  }
  return true;
}

// --- Funciones de Utilidad ---

/**
 * Consolida múltiples registros de llamadas de Zadarma para el mismo evento de llamada (mismo pbx_call_id)
 * en un único registro definitivo.
 * La lógica de selección prioriza los estados finales ('answered') y la mayor duración.
 */
export function consolidateCalls(calls: ZadarmaCall[]): ZadarmaCall[] {
  // 1. Agrupar todos los registros de llamada por 'pbx_call_id'.
  const callsMap = new Map<string, ZadarmaCall[]>();
  calls.forEach(call => {
    // Ignorar llamadas sin pbx_call_id, ya que no se pueden consolidar de forma fiable.
    if (!call.pbx_call_id) {
      return;
    }
    const group = callsMap.get(call.pbx_call_id) || [];
    group.push(call);
    callsMap.set(call.pbx_call_id, group);
  });

  // 2. Para cada grupo, seleccionar el mejor registro.
  const finalCalls: ZadarmaCall[] = [];
  for (const callGroup of callsMap.values()) {
    if (callGroup.length === 1) {
      finalCalls.push(callGroup[0]);
      continue;
    }

    // Reducir el grupo a un solo registro "mejor".
    const bestCall = callGroup.reduce((best, current) => {
      // Prioridad 1: El estado 'answered' siempre es preferible.
      if (current.disposition === 'answered' && best.disposition !== 'answered') {
        return current;
      }
      if (best.disposition === 'answered' && current.disposition !== 'answered') {
        return best;
      }

      // Prioridad 2: Si ambos (o ninguno) son 'answered', el de mayor duración es preferible.
      // Esto ayuda a resolver empates y a elegir el registro más completo.
      if (current.seconds > best.seconds) {
        return current;
      }

      return best;
    });
    
    finalCalls.push(bestCall);
  }

  return finalCalls;
}


/**
 * Valida que las credenciales de la API de Zadarma estén configuradas.
 */
export function validateZadarmaCredentials(): { valid: boolean; message?: string } {
  if (!process.env.ZADARMA_API_KEY || !process.env.ZADARMA_API_SECRET) {
    return { valid: false, message: 'Las credenciales de la API de Zadarma no están configuradas.' };
  }
  return { valid: true };
}
