
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
  // Fragmentar en batches de tamaño permitido por Firestore (<= 500)
  if (calls.length === 0) return 0;
  const BATCH_LIMIT = 400; // margen por seguridad
  const now = Timestamp.now();
  let saved = 0;

  function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  const chunks = chunkArray(calls, BATCH_LIMIT);
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const call of chunk) {
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
    }
    await batch.commit();
    saved += chunk.length;
  }

  console.log(`[ZADARMA CACHE] Guardadas ${saved} llamadas en caché (fragmentadas en ${chunks.length} batches)`);
  return saved;
}

export async function updateZadarmaCallsInFirestore(calls: ZadarmaCall[], date: Date): Promise<number> {
  const dateString = format(date, 'yyyy-MM-dd');
  // Estrategia safer-swap:
  // 1) Escribir nuevas llamadas en colección temporal `zadarma_calls_tmp_<date>_<ts>` en batches
  // 2) Borrar documentos existentes en `zadarma_calls` para esa fecha en batches
  // 3) Copiar desde la colección temporal a `zadarma_calls` en batches
  // 4) Borrar la colección temporal
  const tmpColName = `zadarma_calls_tmp_${dateString.replace(/-/g, '')}_${Date.now()}`;

  console.log(`[ZADARMA SWAP] Creando colección temporal: ${tmpColName}`);

  // Helper chunk
  function chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  }

  const BATCH_LIMIT = 400;

  try {
    // 1) Escribir en colección temporal
    const tmpSaved = await (async (): Promise<number> => {
      if (!calls || calls.length === 0) return 0;
      let written = 0;
      const chunks = chunkArray(calls, BATCH_LIMIT);
      for (const chunk of chunks) {
        const batch = db.batch();
        for (const call of chunk) {
          const callDate = call.callstart.substring(0, 10);
          const docId = `${call.pbx_call_id}_${call.callstart.replace(/[: -]/g, '')}`;
          const docRef = db.collection(tmpColName).doc(docId);
          const callDoc: any = {
            ...call,
            id: docId,
            callDate,
            agentId: call.sip,
            agentName: AGENT_MAP[call.sip] || 'Desconocido',
            syncedAt: Timestamp.now().toDate().toISOString(),
            createdAt: Timestamp.now(),
          };
          batch.set(docRef, callDoc, { merge: true });
        }
        await batch.commit();
        written += chunk.length;
      }
      console.log(`[ZADARMA SWAP] Escritos ${written} docs en temporal ${tmpColName}`);
      return written;
    })();

    // 2) Borrar docs existentes en la colección principal para la fecha
    console.log(`[ZADARMA SWAP] Borrando docs existentes en 'zadarma_calls' para ${dateString}`);
    const existingSnapshot = await db.collection('zadarma_calls').where('callDate', '==', dateString).get();
    if (!existingSnapshot.empty) {
      const existingDocs = existingSnapshot.docs.map((d: any) => d.ref);
      const deleteChunks = chunkArray(existingDocs, BATCH_LIMIT);
      for (const dchunk of deleteChunks) {
        const batch = db.batch();
        dchunk.forEach((r: any) => batch.delete(r));
        await batch.commit();
      }
      console.log(`[ZADARMA SWAP] Borrados ${existingDocs.length} docs antiguos de 'zadarma_calls' para ${dateString}`);
    } else {
      console.log(`[ZADARMA SWAP] No se encontraron docs anteriores para ${dateString}`);
    }

    // 3) Copiar desde temporal a la colección principal
    console.log(`[ZADARMA SWAP] Copiando desde temporal ${tmpColName} a 'zadarma_calls'`);
    const tmpSnapshot = await db.collection(tmpColName).get();
    const tmpDocs = tmpSnapshot.docs.map((d: any) => ({ id: d.id, data: d.data() }));
    if (tmpDocs.length > 0) {
      const copyChunks = chunkArray(tmpDocs, BATCH_LIMIT);
      let copied = 0;
      for (const cchunk of copyChunks) {
        const batch = db.batch();
        for (const doc of cchunk as { id: string; data: any }[]) {
          const docRef = db.collection('zadarma_calls').doc(doc.id);
          batch.set(docRef, doc.data, { merge: true });
        }
        await batch.commit();
        copied += cchunk.length;
      }
      console.log(`[ZADARMA SWAP] Copiados ${copied} docs desde temporal a 'zadarma_calls'`);
    } else {
      console.log(`[ZADARMA SWAP] Temporal ${tmpColName} está vacío, nada que copiar`);
    }

    // 4) Borrar colección temporal (borrar documentos en batches)
    console.log(`[ZADARMA SWAP] Limpiando colección temporal ${tmpColName}`);
    const tmpSnapshot2 = await db.collection(tmpColName).get();
    if (!tmpSnapshot2.empty) {
      const tmpRefs = tmpSnapshot2.docs.map((d: any) => d.ref);
      const tmpDeleteChunks = chunkArray(tmpRefs, BATCH_LIMIT);
      for (const tchunk of tmpDeleteChunks) {
        const batch = db.batch();
        tchunk.forEach((r: any) => batch.delete(r));
        await batch.commit();
      }
      console.log(`[ZADARMA SWAP] Temporal ${tmpColName} borrada (${tmpRefs.length} docs)`);
    }

    // Retornar cantidad copiada (guardada en main)
    const finalCount = (await db.collection('zadarma_calls').where('callDate', '==', dateString).get()).size;
    return finalCount;

  } catch (error: any) {
    console.error('[ZADARMA SWAP] Error realizando swap seguro:', error);
    // Intentar limpieza del temporal si existe
    try {
      const tmpSnapshotErr = await db.collection(tmpColName).get();
      if (!tmpSnapshotErr.empty) {
        const refs = tmpSnapshotErr.docs.map((d: any) => d.ref);
        const chunks = [] as any[];
        for (let i = 0; i < refs.length; i += BATCH_LIMIT) chunks.push(refs.slice(i, i + BATCH_LIMIT));
        for (const ch of chunks) {
          const batch = db.batch();
          ch.forEach((r: any) => batch.delete(r));
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn('[ZADARMA SWAP] Error limpiando temporal tras fallo:', e);
    }

    throw error;
  }
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

export async function getMissingDaysFromFirestore(startDate: Date, endDate: Date, includeToday = true): Promise<Date[]> {
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

  // Por defecto excluimos el día actual (evita solaparse con auto-refresh de 60s).
  // Si includeToday === true entonces NO lo excluimos y el backfill puede procesar HOY.
  const missing: Date[] = [];
  const todayStart = startOfDay(new Date());
  
  console.log(`[MISSING-DAYS] 🔍 Analizando ${daysInRange.length} días. HOY (${format(todayStart, 'yyyy-MM-dd')}) será ${includeToday ? 'INCLUIDO' : 'EXCLUIDO'} en la evaluación.`);

  for (const d of daysInRange) {
    const key = format(d, 'yyyy-MM-dd');

    // Si se solicita explícitamente incluir HOY, no lo excluimos
    const isToday = startOfDay(d).getTime() === todayStart.getTime();
    if (isToday && !includeToday) {
      console.log(`[MISSING-DAYS] ⚠️ ${key}: EXCLUIDO - día actual manejado por auto-refresh (usar includeToday=true para forzar)`);
      continue;
    }

    // Si no hay metadata de éxito, el día está faltante
    if (!foundDates.has(key)) {
      console.log(`[MISSING-DAYS] 📝 ${key}: SIN METADATA - agregado a backfill`);
      missing.push(d);
      continue;
    }

    // Para días anteriores (no HOY), verificar si están parcialmente sincronizados
    const diffDays = Math.floor((todayStart.getTime() - startOfDay(d).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) { // Solo ayer - verificar última hora sincronizada
      try {
        const lastHour = await getLastSyncedHour(d);
        // Si no hay llamadas registradas o la última hora es menor a 23, consideramos faltante
        if (!lastHour) {
          console.log(`[MISSING-DAYS] 📝 ${key}: SIN LLAMADAS - agregado a backfill`);
          missing.push(d);
          continue;
        }
        if (lastHour.getFullYear() === d.getFullYear() && lastHour.getMonth() === d.getMonth() && lastHour.getDate() === d.getDate()) {
          if (lastHour.getHours() < 23) {
            console.log(`[MISSING-DAYS] 📝 ${key}: PARCIAL hasta ${lastHour.getHours()}h - agregado a backfill`);
            missing.push(d);
            continue;
          }
        } else {
          // Si la última hora no corresponde al mismo día (por error), marcar como faltante
          console.log(`[MISSING-DAYS] 📝 ${key}: HORA INCONSISTENTE - agregado a backfill`);
          missing.push(d);
          continue;
        }
        console.log(`[MISSING-DAYS] ✅ ${key}: COMPLETO hasta ${lastHour.getHours()}h`);
      } catch (err) {
        // En caso de error al determinar la última hora, marcar como faltante para ser seguro
        console.log(`[MISSING-DAYS] 📝 ${key}: ERROR verificación - agregado a backfill`);
        missing.push(d);
        continue;
      }
    } else {
      console.log(`[MISSING-DAYS] ✅ ${key}: TIENE METADATA y no es reciente`);
    }
    // Si metadata existe y no es reciente o ya cubre hasta las 23h, lo consideramos sincronizado
  }

  console.log(`[MISSING-DAYS] 📊 Resultado: ${missing.length} días para backfill de ${daysInRange.length} total`);
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
