/**
 * Funciones helper para Zadarma
 */

import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { format, parse } from 'date-fns';
import type { ZadarmaCall, ZadarmaCallDocument } from '@/types/zadarma';

const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen",
  "104": "Alanis",
  "105": "Marisol",
  "107": "Lisset",
  "108": "Wendy",
  "110": "Avril",
  "111": "Luz",
  "113": "Fiorela",
};

/**
 * Guarda llamadas de Zadarma en Firestore
 */
export async function saveZadarmaCalls(calls: ZadarmaCall[]): Promise<number> {
  const batch = db.batch();
  let savedCount = 0;
  const now = Timestamp.now();

  for (const call of calls) {
    try {
      const callDate = format(new Date(call.callstart), 'yyyy-MM-dd');
      // Incluir la fecha en el ID del documento para evitar sobrescrituras
      // cuando el mismo pbx_call_id + sip ocurre en días distintos
      const docId = `${call.pbx_call_id}_${call.sip}_${callDate}`;
      
      const docRef = db.collection('zadarma_calls').doc(docId);
      
      const callDoc: Partial<ZadarmaCallDocument> = {
        ...call,
        id: docId,
        callDate,
        agentId: call.sip,
        agentName: AGENT_MAP[call.sip] || 'Desconocido',
        isConsolidated: false, // Se marca después en consolidación
        syncedAt: now.toDate().toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      // Usamos set con merge: true pero ahora el docId es único por día
      batch.set(docRef, callDoc, { merge: true });
      savedCount++;

      // Firestore batch limit is 500
      if (savedCount % 450 === 0) {
        await batch.commit();
      }
    } catch (error) {
      console.error(`Error procesando llamada ${call.pbx_call_id}:`, error);
    }
  }

  if (savedCount % 450 !== 0) {
    await batch.commit();
  }

  return savedCount;
}

/**
 * Obtiene llamadas de Firestore para un rango de fechas
 */
export async function getZadarmaCallsFromFirestore(
  startDate: Date,
  endDate: Date
): Promise<ZadarmaCall[]> {
  const formattedStart = format(startDate, 'yyyy-MM-dd');
  const formattedEnd = format(endDate, 'yyyy-MM-dd');

  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', formattedStart)
    .where('callDate', '<=', formattedEnd)
    .get();

  return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data();
    return {
      pbx_call_id: data.pbx_call_id,
      callstart: data.callstart,
      sip: data.sip,
      clid: data.clid,
      destination: data.destination,
      disposition: data.disposition,
      seconds: data.seconds,
    } as ZadarmaCall;
  });
}

/**
 * Verifica si ya existen datos para un rango de fechas
 */
export async function hasDataForDateRange(
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const formattedStart = format(startDate, 'yyyy-MM-dd');
  const formattedEnd = format(endDate, 'yyyy-MM-dd');

  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', formattedStart)
    .where('callDate', '<=', formattedEnd)
    .limit(1)
    .get();

  return !snapshot.empty;
}

/**
 * Guarda metadata de sincronización
 */
export async function saveSyncMetadata(
  startDate: Date,
  endDate: Date,
  totalCalls: number,
  status: 'success' | 'error' | 'partial',
  errorMessage?: string
): Promise<void> {
  const syncId = `sync_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`;
  const now = Timestamp.now();

  await db.collection('zadarma_sync_metadata').doc(syncId).set({
    lastSyncDate: format(new Date(), 'yyyy-MM-dd'),
    lastSyncTimestamp: now,
    totalCallsSynced: totalCalls,
    dateRange: {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    },
    status,
    errorMessage: errorMessage || null,
    createdAt: now,
  }, { merge: true });
}

/**
 * Obtiene metadata de sincronización para un rango de fechas
 */
export async function getSyncMetadata(
  startDate: Date,
  endDate: Date
): Promise<any | null> {
  const syncId = `sync_${format(startDate, 'yyyy-MM-dd')}_${format(endDate, 'yyyy-MM-dd')}`;
  
  const doc = await db.collection('zadarma_sync_metadata').doc(syncId).get();
  
  if (!doc.exists) {
    return null;
  }

  return doc.data();
}

/**
 * Consolida llamadas duplicadas por pbx_call_id
 * Prioriza la llamada "answered", sino la de mayor duración
 */
export function consolidateCalls(calls: ZadarmaCall[]): ZadarmaCall[] {
  const callsByKey: { [key: string]: ZadarmaCall[] } = {};

  // Agrupar por pbx_call_id + fecha (día) para contar llamadas de cada día por separado
  calls.forEach(call => {
    // Extraer solo la fecha (YYYY-MM-DD) del timestamp
    const callDate = call.callstart ? new Date(call.callstart).toISOString().slice(0, 10) : 'unknown';
    const key = `${call.pbx_call_id}_${callDate}`;
    
    if (!callsByKey[key]) {
      callsByKey[key] = [];
    }
    callsByKey[key].push(call);
  });

  // Consolidar cada grupo (mismo pbx_call_id en el mismo día)
  return Object.values(callsByKey).map(group => {
    group.sort((a, b) => {
      if (a.disposition === 'answered' && b.disposition !== 'answered') return -1;
      if (a.disposition !== 'answered' && b.disposition === 'answered') return 1;
      return b.seconds - a.seconds;
    });
    return group[0];
  });
}

/**
 * Valida credenciales de Zadarma
 */
export function validateZadarmaCredentials(): { valid: boolean; message?: string } {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    return {
      valid: false,
      message: 'Las credenciales de la API de Zadarma no están configuradas en .env.',
    };
  }

  return { valid: true };
}
