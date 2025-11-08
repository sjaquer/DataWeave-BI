
import { db } from '@/lib/firebase-admin';
import { Timestamp, DocumentData } from 'firebase-admin/firestore';
import { format, startOfDay, addDays } from 'date-fns';
import type { ZadarmaCall, ZadarmaCallDocument } from '@/types/zadarma';
import CryptoJS from 'crypto-js';

const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

export async function saveZadarmaCalls(calls: ZadarmaCall[]): Promise<number> {
  if (calls.length === 0) return 0;
  const batch = db.batch();
  const now = Timestamp.now();
  
  calls.forEach(call => {
    // Extraer fecha del callstart raw (formato: 2025-10-27 14:30:00)
    const callDate = call.callstart.substring(0, 10);
    const docId = `${call.pbx_call_id}_${call.callstart.replace(/[: -]/g, '')}`;
    const docRef = db.collection('zadarma_calls').doc(docId);
    
    const callDoc: Partial<ZadarmaCallDocument> = {
      ...call, 
      id: docId, 
      callDate, 
      agentId: call.sip,
      agentName: AGENT_MAP[call.sip] || 'Desconocido',
      syncedAt: now.toDate().toISOString(), 
      createdAt: now,
    };
    batch.set(docRef, callDoc, { merge: true });
  });

  await batch.commit();
  console.log(`[ZADARMA CACHE] Guardadas ${calls.length} llamadas en caché`);
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
  // Nota: evitamos pedir un orderBy a Firestore que implique un índice compuesto
  // porque consultas con filtros de rango sobre un campo y ordenamiento sobre
  // otro requieren un índice compuesto en Firestore. Para evitar el error
  // FAILED_PRECONDITION en entornos donde el índice no exista, hacemos la
  // ordenación en memoria después de recuperar los documentos.
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '>=', format(startDate, 'yyyy-MM-dd'))
    .where('callDate', '<=', format(endDate, 'yyyy-MM-dd'))
    .get();

  const results = snapshot.docs.map((doc: DocumentData) => doc.data() as ZadarmaCall);
  // Ordenar localmente por callstart (cadena ISO-like yyyy-MM-dd HH:mm:ss funciona con lexicographical)
  return results.sort((a: ZadarmaCall, b: ZadarmaCall) => (a.callstart || '').localeCompare(b.callstart || ''));
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

  // Considerar días parcialmente sincronizados como 'faltantes' para los días recientes
  // (ej. hoy y ayer) si la última hora sincronizada no cubre todo el día.
  const recentWindowDays = 1; // revisar hoy y ayer
  const missing: Date[] = [];
  const todayStart = startOfDay(new Date());

  for (const d of daysInRange) {
    const key = format(d, 'yyyy-MM-dd');

    // Si no hay metadata de éxito, el día está faltante
    if (!foundDates.has(key)) {
      missing.push(d);
      continue;
    }

    // Si la metadata existe, pero la fecha es reciente (hoy/ayer), verificar la última hora sincronizada
    const diffDays = Math.floor((todayStart.getTime() - startOfDay(d).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= recentWindowDays) {
      try {
        const lastHour = await getLastSyncedHour(d);
        // Si no hay llamadas registradas o la última hora es menor a 23, consideramos faltante
        if (!lastHour) {
          missing.push(d);
          continue;
        }
        if (lastHour.getFullYear() === d.getFullYear() && lastHour.getMonth() === d.getMonth() && lastHour.getDate() === d.getDate()) {
          if (lastHour.getHours() < 23) {
            missing.push(d);
            continue;
          }
        } else {
          // Si la última hora no corresponde al mismo día (por error), marcar como faltante
          missing.push(d);
          continue;
        }
      } catch (err) {
        // En caso de error al determinar la última hora, marcar como faltante para ser seguro
        missing.push(d);
        continue;
      }
    }
    // Si metadata existe y no es reciente o ya cubre hasta las 23h, lo consideramos sincronizado
  }

  return missing;
}

export async function getLastSyncedHour(date: Date): Promise<Date | null> {
  // Buscar la última llamada guardada para este día para determinar hasta qué hora tenemos datos
  const dayStr = format(date, 'yyyy-MM-dd');
  const snapshot = await db.collection('zadarma_calls')
    .where('callDate', '==', dayStr)
    .get();
  
  if (snapshot.empty) return null;
  
  // Ordenar en memoria y tomar el último
  const calls = snapshot.docs.map((doc: DocumentData) => doc.data()).filter((call: any) => call.callstart);
  if (calls.length === 0) return null;
  
  calls.sort((a: any, b: any) => String(b.callstart || '').localeCompare(String(a.callstart || '')));
  const lastCall = calls[0];
  if (!lastCall.callstart) return null;
  
  // Parsear el timestamp y devolver la fecha/hora
  try {
    // callstart formato: "yyyy-MM-dd HH:mm:ss"
    const [datePart, timePart] = lastCall.callstart.split(' ');
    if (!timePart) return null;
    
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour] = timePart.split(':').map(Number);
    
    return new Date(year, month - 1, day, hour, 0, 0, 0);
  } catch (error) {
    console.error('[PARSE LAST SYNC ERROR]:', error);
    return null;
  }
}

async function fetchZadarmaDirectAdaptive(startStr: string, endStr: string, apiKey: string, apiSecret: string) {
  // Función interna para hacer petición directa con retry y 429 handling
  const method = '/v1/statistics/pbx/';
  const params: any = { start: startStr, end: endStr, format: 'json', version: '2' };
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, params[key]));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmac.toString(CryptoJS.enc.Hex)));
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

  let attempt = 0;
  const maxAttempts = 4;
  while (true) {
    attempt++;
    const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });
    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const waitMs = ra ? Number(ra) * 1000 : Math.min(60000, Math.pow(2, attempt) * 1000);
      if (attempt >= maxAttempts) throw new Error(`Rate limited by Zadarma after ${attempt} attempts`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data.status === 'error') throw new Error(`Error de API de Zadarma: ${data.message}`);
    return data.stats || [];
  }
}

export async function fetchZadarmaAdaptive(startDate: Date, endDate: Date, apiKey: string, apiSecret: string): Promise<any[]> {
  // Fetch adaptativo con división recursiva para evitar truncamiento por límite por petición
  console.log('[FETCH ADAPTIVE] Starting adaptive fetch:', { startDate, endDate });
  
  try {
    const LIMIT = 1000;
    const minWindowMinutes = 5;

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

    const allStatsMap = new Map<string, any>();

  async function fetchRangeRecursive(a: Date, b: Date) {
    const s = fmt(a);
    const e = fmt(b);
    try {
      const chunk = await fetchZadarmaDirectAdaptive(s, e, apiKey, apiSecret);
      
      // Si chunk está por debajo del límite, aceptarlo
      if (chunk.length < LIMIT) {
        for (const c of chunk) {
          const key = `${c.pbx_call_id}__${c.callstart}`;
          if (!allStatsMap.has(key)) allStatsMap.set(key, c);
        }
        return;
      }
      
      // Si chunk alcanza/supera límite, intentar dividir a menos que la ventana sea muy pequeña
      const spanMs = b.getTime() - a.getTime();
      const spanMinutes = spanMs / 60000;
      if (spanMinutes <= minWindowMinutes) {
        // Ventana muy pequeña, incluir lo que tenemos
        for (const c of chunk) {
          const key = `${c.pbx_call_id}__${c.callstart}`;
          if (!allStatsMap.has(key)) allStatsMap.set(key, c);
        }
        return;
      }
      
      const mid = new Date(a.getTime() + Math.floor(spanMs / 2));
      await fetchRangeRecursive(a, mid);
      await fetchRangeRecursive(new Date(mid.getTime() + 1000), b);
    } catch (err) {
      console.error(`[ADAPTIVE FETCH ERROR] ${s} to ${e}:`, err);
      // En caso de error, no hacer nada más para este rango
    }
  }

    await fetchRangeRecursive(startDate, endDate);
    console.log('[FETCH ADAPTIVE] Completed adaptive fetch:', allStatsMap.size, 'unique calls');
    return Array.from(allStatsMap.values()).sort((a: any, b: any) => String(a.callstart || '').localeCompare(String(b.callstart || '')));
  } catch (error: any) {
    console.error('[FETCH ADAPTIVE FATAL ERROR]:', error);
    // En caso de error crítico, devolver array vacío para no romper la cadena
    return [];
  }
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
  if (!calls || calls.length === 0) return [];
  
  // Filtrar y limpiar datos básicos
  const cleanedCalls = calls.filter(call => 
    call && 
    call.pbx_call_id && 
    call.callstart && 
    call.sip
  ).map((call, index) => ({
    ...call,
    // Asegurar que los números sean números
    seconds: Number(call.seconds) || 0,
    // Normalizar el estado de disposición
    disposition: call.disposition || 'unknown',
    // METADATOS ADICIONALES:
    // Extraer componentes de tiempo para facilitar análisis
    callDate: call.callstart ? call.callstart.substring(0, 10) : '',
    callTime: call.callstart ? call.callstart.substring(11, 19) : '',
    callHour: call.callstart ? parseInt(call.callstart.substring(11, 13)) : 0,
    // Clasificar tipo de llamada
    isOutbound: String(call.destination || '').length >= 5,
    isAnswered: call.disposition === 'answered',
    // Duración categorizada
    durationCategory: (() => {
      const secs = Number(call.seconds) || 0;
      if (secs === 0) return 'no-answer';
      if (secs < 30) return 'short';
      if (secs < 180) return 'medium';
      return 'long';
    })(),
    // Nombre del agente desde el mapa
    agentName: AGENT_MAP[call.sip] || 'Desconocido',
    // Índice de orden original (para debugging)
    originalIndex: index
  }));

  // ORDENAR POR TIMESTAMP CRONOLÓGICAMENTE (más antigua primero)
  return cleanedCalls.sort((a, b) => {
    const timeA = a.callstart || '';
    const timeB = b.callstart || '';
    return timeA.localeCompare(timeB);
  });
}

export function validateZadarmaCredentials(): { valid: boolean; message?: string } {
  if (!process.env.ZADARMA_API_KEY || !process.env.ZADARMA_API_SECRET) {
    return { valid: false, message: 'Las credenciales de la API de Zadarma no están configuradas.' };
  }
  return { valid: true };
}
