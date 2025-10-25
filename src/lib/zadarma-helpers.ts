
import { db } from '@/lib/firebase-admin';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import { format, startOfDay, addDays } from 'date-fns';
import type { ZadarmaCall, ZadarmaCallDocument } from '@/types/zadarma';

const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana",
};

export async function saveZadarmaCalls(calls: ZadarmaCall[]): Promise<number> {
  if (calls.length === 0) return 0;
  const batch = db.batch();
  const now = Timestamp.now();
  
  calls.forEach(call => {
    const callDate = call.callstart.substring(0, 10);
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
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', format(startDate, 'yyyy-MM-dd'))
    .where('callDate', '<=', format(endDate, 'yyyy-MM-dd'))
    .get();

  return snapshot.docs.map((doc: DocumentData) => doc.data() as ZadarmaCall);
}

export async function hasDataForDateRange(startDate: Date, endDate: Date): Promise<boolean> {
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', format(startDate, 'yyyy-MM-dd'))
    .where('callDate', '<=', format(endDate, 'yyyy-MM-dd'))
    .limit(1)
    .get();
  return !snapshot.empty;
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
  // Se elimina la lógica de consolidación.
  // Ahora, esta función devuelve todas las llamadas sin filtrar.
  return calls;
}

export function validateZadarmaCredentials(): { valid: boolean; message?: string } {
  if (!process.env.ZADARMA_API_KEY || !process.env.ZADARMA_API_SECRET) {
    return { valid: false, message: 'Las credenciales de la API de Zadarma no están configuradas.' };
  }
  return { valid: true };
}
