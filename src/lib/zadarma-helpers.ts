
import { db } from '@/lib/firebase-admin';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import { format, startOfDay, addDays, parseISO } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { ZadarmaCall, ZadarmaCallDocument } from '@/types/zadarma';

const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana",
};

const MADRID_TIME_ZONE = 'Europe/Madrid';

/**
 * Convierte una llamada de Zadarma de zona horaria Madrid a UTC
 * La API de Zadarma retorna fechas en hora de Madrid (Europe/Madrid)
 * Esta función convierte el callstart a UTC estándar (ISO 8601)
 */
export function convertZadarmaCallToUTC(call: any): ZadarmaCall {
  return {
    ...call,
    callstart: fromZonedTime(call.callstart, MADRID_TIME_ZONE).toISOString(),
  };
}

export async function saveZadarmaCalls(calls: ZadarmaCall[]): Promise<number> {
  if (calls.length === 0) return 0;
  const batch = db.batch();
  const now = Timestamp.now();
  
  calls.forEach(call => {
    // CORRECCIÓN: Generar callDate en timezone de Lima, no UTC
    // Esto asegura que las llamadas se filtren correctamente por fecha local
    const callTimeUTC = parseISO(call.callstart);
    const callDate = formatInTimeZone(callTimeUTC, 'America/Lima', 'yyyy-MM-dd');
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

export async function updateZadarmaCallsInFirestore(calls: ZadarmaCall[], date: Date): Promise<number> {
  const dateString = format(date, 'yyyy-MM-dd');
  const querySnapshot = await db.collection('zadarma_calls').where('callDate', '==', dateString).get();

  const batch = db.batch();
  querySnapshot.docs.forEach((doc: DocumentData) => batch.delete(doc.ref));
  await batch.commit();

  return saveZadarmaCalls(calls);
}

export async function getZadarmaCallsFromFirestore(startDate: Date, endDate: Date): Promise<ZadarmaCall[]> {
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  
  console.log('[FIRESTORE DEBUG] Buscando llamadas:');
  console.log('  Fecha inicio:', startDateStr);
  console.log('  Fecha fin:', endDateStr);
  
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', startDateStr)
    .where('callDate', '<=', endDateStr)
    .get();

  const calls = snapshot.docs.map((doc: DocumentData) => doc.data() as ZadarmaCall);
  
  console.log('[FIRESTORE DEBUG] Encontradas', calls.length, 'llamadas en caché');
  if (calls.length > 0) {
    // Mostrar distribución por callDate
    const dateDistribution: { [date: string]: number } = {};
    calls.forEach((call: ZadarmaCall) => {
      const callTimeUTC = parseISO(call.callstart);
      const callDate = formatInTimeZone(callTimeUTC, 'America/Lima', 'yyyy-MM-dd');
      dateDistribution[callDate] = (dateDistribution[callDate] || 0) + 1;
    });
    console.log('[FIRESTORE DEBUG] Distribución por fecha Lima:', dateDistribution);
  }
  
  return calls;
}

export async function hasDataForDateRange(startDate: Date, endDate: Date): Promise<boolean> {
  const startDateStr = format(startDate, 'yyyy-MM-dd');
  const endDateStr = format(endDate, 'yyyy-MM-dd');
  const today = format(new Date(), 'yyyy-MM-dd');
  
  // NUNCA usar caché para el día de hoy - siempre consultar API en tiempo real
  if (startDateStr === today || endDateStr === today) {
    console.log('[CACHE CHECK] Rechazando caché - rango incluye fecha de HOY');
    return false;
  }
  
  // Para un solo día histórico
  if (startDateStr === endDateStr) {
    const syncDoc = await db.collection('zadarma_sync_metadata')
      .doc(`sync_${startDateStr}`)
      .get();
    
    if (!syncDoc.exists) return false;
    const data = syncDoc.data();
    const hasValidSync = data?.status === 'success';
    console.log(`[CACHE CHECK] Día ${startDateStr}: ${hasValidSync ? 'CACHE VÁLIDO' : 'NO HAY CACHE'}`);
    return hasValidSync;
  }
  
  // Para rango de fechas históricas, verificar que tenemos datos
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', startDateStr)
    .where('callDate', '<=', endDateStr)
    .limit(1)
    .get();
  
  const hasData = !snapshot.empty;
  console.log(`[CACHE CHECK] Rango ${startDateStr} a ${endDateStr}: ${hasData ? 'DATOS DISPONIBLES' : 'NO HAY DATOS'}`);
  return hasData;
}

export async function saveSyncMetadata(date: Date, totalCalls: number, status: 'success' | 'error', errorMessage?: string): Promise<void> {
  const syncId = `sync_${format(date, 'yyyy-MM-dd')}`;
  const now = Timestamp.now();
  await db.collection('zadarma_sync_metadata').doc(syncId).set({
    lastSyncTimestamp: now, totalCallsSynced: totalCalls, date: format(date, 'yyyy-MM-dd'),
    status, errorMessage: errorMessage || null,
  }, { merge: true });
}

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
        foundDocs.docs.forEach((doc: DocumentData) => foundDates.add(doc.data().date));
    }
    
    return daysInRange.filter(d => !foundDates.has(format(d, 'yyyy-MM-dd')));
}

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

export function consolidateCalls(calls: ZadarmaCall[]): ZadarmaCall[] {
  // PASO 1: Agrupar por pbx_call_id (llamadas idénticas reportadas múltiples veces)
  const callsByPbxId = new Map<string, ZadarmaCall[]>();
  
  calls.forEach(call => {
    if (!call.pbx_call_id) return;
    const group = callsByPbxId.get(call.pbx_call_id) || [];
    group.push(call);
    callsByPbxId.set(call.pbx_call_id, group);
  });

  // PASO 2: Para cada grupo con mismo pbx_call_id, elegir la mejor llamada
  const consolidatedByPbxId: ZadarmaCall[] = [];
  
  for (const group of callsByPbxId.values()) {
    if (group.length === 1) {
      consolidatedByPbxId.push(group[0]);
      continue;
    }

    // Priorizar: answered > mayor duración > más reciente
    const bestCall = group.reduce((best, current) => {
      if (current.disposition === 'answered' && best.disposition !== 'answered') 
        return current;
      if (best.disposition === 'answered' && current.disposition !== 'answered') 
        return best;
      if (current.seconds > best.seconds) 
        return current;
      if (current.seconds === best.seconds && current.callstart > best.callstart)
        return current;
      return best;
    });
    
    consolidatedByPbxId.push(bestCall);
  }

  // PASO 3: Detectar y consolidar re-intentos cercanos al mismo destino
  // (Llamadas diferentes al mismo número en ventana de 2 minutos por el mismo agente)
  return consolidateRetries(consolidatedByPbxId);
}

/**
 * Consolida re-intentos: llamadas al mismo destino en ventana de 2 minutos
 * Esto elimina duplicados reales donde el agente intenta llamar varias veces seguidas
 */
function consolidateRetries(calls: ZadarmaCall[]): ZadarmaCall[] {
  // Agrupar por agente + destino
  const groups = new Map<string, ZadarmaCall[]>();
  
  calls.forEach(call => {
    const key = `${call.sip}_${call.destination}`;
    const group = groups.get(key) || [];
    group.push(call);
    groups.set(key, group);
  });

  const result: ZadarmaCall[] = [];
  
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Ordenar por tiempo
    group.sort((a, b) => a.callstart.localeCompare(b.callstart));

    let currentBatch: ZadarmaCall[] = [group[0]];
    
    for (let i = 1; i < group.length; i++) {
      const current = group[i];
      const previous = group[i - 1];
      
      // Calcular diferencia en minutos
      const diffMs = new Date(current.callstart).getTime() - 
                     new Date(previous.callstart).getTime();
      const diffMin = diffMs / 60000;
      
      if (diffMin <= 2) {
        // Es un re-intento, agregar al batch
        currentBatch.push(current);
      } else {
        // Es una llamada nueva, procesar batch anterior
        result.push(selectBestFromBatch(currentBatch));
        currentBatch = [current];
      }
    }
    
    // Procesar último batch
    if (currentBatch.length > 0) {
      result.push(selectBestFromBatch(currentBatch));
    }
  }

  return result;
}

/**
 * Selecciona la mejor llamada de un batch de re-intentos
 * Prioriza: answered > mayor duración
 */
function selectBestFromBatch(batch: ZadarmaCall[]): ZadarmaCall {
  return batch.reduce((best, current) => {
    if (current.disposition === 'answered' && best.disposition !== 'answered') 
      return current;
    if (best.disposition === 'answered' && current.disposition !== 'answered') 
      return best;
    return current.seconds > best.seconds ? current : best;
  });
}

export function validateZadarmaCredentials(): { valid: boolean; message?: string } {
  if (!process.env.ZADARMA_API_KEY || !process.env.ZADARMA_API_SECRET) {
    return { valid: false, message: 'Las credenciales de la API de Zadarma no están configuradas.' };
  }
  return { valid: true };
}
