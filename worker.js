/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZADARMA BACKFILL WORKER - RENDER BACKGROUND SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * Worker durable que procesa jobs de backfill desde la cola zadarma_jobs.
 * Diseñado para correr como servicio always-on en Render (Background Worker).
 * 
 * FLUJO:
 * ======
 * 1. Poll zadarma_jobs buscando jobs con status 'queued'
 * 2. Claim job (transacción: set status='in_progress', owner=worker_id)
 * 3. Ejecutar backfill día por día con paginación completa
 * 4. Actualizar zadarma_backfill_sessions con progreso
 * 5. Al completar: job.status='completed'
 * 6. En error: incrementar attempts, si >MAX_ATTEMPTS -> 'failed'
 * 
 * RECOVERY:
 * =========
 * - Jobs con status 'in_progress' y updatedAt > TTL se requeue automáticamente
 * - Permite recovery ante crashes del worker
 * 
 * DEPLOYMENT:
 * ===========
 * En Render crear Background Worker service:
 * - Build command: npm install
 * - Start command: node worker.js
 * - Env vars: FIREBASE_SERVICE_ACCOUNT, ZADARMA_API_KEY, ZADARMA_API_SECRET
 * ═══════════════════════════════════════════════════════════════════════════
 */

const admin = require('firebase-admin');
const { format, eachDayOfInterval, parseISO } = require('date-fns');
const CryptoJS = require('crypto-js');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const POLL_INTERVAL_MS = 5000; // Poll cada 5 segundos
const JOB_CLAIM_TTL_MS = 15 * 60 * 1000; // 15 minutos para recovery
const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 400;
const WORKER_ID = `worker_${process.pid}_${Date.now()}`;

// Mapeo de agentes
const AGENT_MAP = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

// ═══════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN FIREBASE
// ═══════════════════════════════════════════════════════════════════════════

let db;

// Inicializa Firebase con reintentos y múltiples fallbacks de env vars.
async function initFirebase() {
  const retryDelayMs = 30000; // 30s
  while (true) {
    try {
      // Prefer FIREBASE_SERVICE_ACCOUNT, luego SERVICE_ACCOUNT, luego GOOGLE_APPLICATION_CREDENTIALS file
      const envJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.SERVICE_ACCOUNT;

      let serviceAccount;

      if (envJson) {
        try {
          serviceAccount = JSON.parse(envJson);
        } catch (parseErr) {
          throw new Error(`Error parseando JSON de service account desde env: ${parseErr.message}`);
        }
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Intentar leer el archivo de credenciales (si existe en el filesystem del contenedor)
        const fs = require('fs');
        const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        if (!fs.existsSync(path)) {
          throw new Error(`GOOGLE_APPLICATION_CREDENTIALS definido pero el archivo no existe: ${path}`);
        }
        const content = fs.readFileSync(path, 'utf8');
        try {
          serviceAccount = JSON.parse(content);
        } catch (parseErr) {
          throw new Error(`Error parseando JSON desde GOOGLE_APPLICATION_CREDENTIALS: ${parseErr.message}`);
        }
      } else {
        throw new Error('No se encontró FIREBASE_SERVICE_ACCOUNT ni SERVICE_ACCOUNT ni GOOGLE_APPLICATION_CREDENTIALS');
      }

      // Inicializar Admin SDK si no está inicializado
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      }

      db = admin.firestore();
      console.log('[WORKER] ✅ Firebase Admin inicializado correctamente');
      return; // éxito

    } catch (error) {
      console.error('[WORKER] ❌ Error inicializando Firebase (reintentando):', error.message || error);
      console.log(`[WORKER] ⏳ Reintentando en ${retryDelayMs / 1000}s...`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function updateProgress(sessionId, progress) {
  const doc = {
    ...progress,
    sessionId,
    updatedAtMillis: Date.now(),
    last_updated_by: WORKER_ID
  };
  
  return db.collection('zadarma_backfill_sessions')
    .doc(sessionId)
    .set(doc, { merge: true });
}

async function makeZadarmaRequest(params, apiKey, apiSecret) {
  const method = "/v1/statistics/pbx/";
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach((key) => sortedParams.append(key, String(params[key])));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const hmacHex = hmac.toString(CryptoJS.enc.Hex);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmacHex));
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

  let attempt = 0;
  while (attempt < 3) {
    attempt++;
    try {
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: { Authorization: authHeader },
      });

      const data = await response.json();

      if (data.status === "error") {
        if (data.message?.toLowerCase()?.includes("limit exceeded") || response.status === 429) {
          console.log(`[WORKER] ⏳ Rate limit, esperando 60s...`);
          await sleep(60000);
          continue;
        }
        throw new Error(`Error Zadarma: ${data.message}`);
      }

      return data;
    } catch (err) {
      if (attempt === 3) throw err;
      await sleep(30000);
    }
  }
}

async function fetchCallsForDay(date, apiKey, apiSecret) {
  const limit = 1000;
  let skip = 0;
  const allCalls = [];
  const formattedStartDate = `${date} 00:00:00`;
  const formattedEndDate = `${date} 23:59:59`;
  let continuePaging = true;

  while (continuePaging) {
    const params = {
      start: formattedStartDate,
      end: formattedEndDate,
      format: "json",
      version: "2",
      skip,
    };

    const data = await makeZadarmaRequest(params, apiKey, apiSecret);
    const calls = data.stats || [];
    allCalls.push(...calls);

    continuePaging = calls.length === limit;
    skip += limit;
  }

  return allCalls;
}

async function saveCallToFirestore(call) {
  try {
    const callId = call.pbx_call_id || call.call_id_with_rec || `call_${Date.now()}_${Math.random()}`;
    const startTimeUTC = new Date(call.callstart + (call.callstart.includes('Z') ? '' : 'Z'));
    const callDate = call.callstart.substring(0, 10);
    
    const firestoreDoc = {
      call_id: callId,
      pbx_call_id: call.pbx_call_id || callId,
      call_id_with_rec: call.call_id_with_rec || callId,
      callstart: call.callstart,
      start_time_utc: admin.firestore.Timestamp.fromDate(startTimeUTC),
      callDate,
      duration: typeof call.duration === 'string' ? parseInt(call.duration, 10) : (call.duration || 0),
      seconds: typeof call.seconds === 'string' ? parseInt(call.seconds, 10) : (call.seconds || 0),
      disposition: call.disposition || 'unknown',
      caller_id: call.caller_id || '',
      called_did: call.called_did || '',
      from: call.from || call.caller_id || '',
      to: call.to || call.called_did || '',
      destination: call.destination || call.to || call.called_did || '',
      sip: call.sip || 'unknown',
      agentId: call.sip || 'unknown',
      agentName: AGENT_MAP[call.sip || ''] || 'Desconocido',
      last_updated_by: WORKER_ID,
      syncedAt: new Date().toISOString(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (call.status_code !== undefined) firestoreDoc.status_code = call.status_code;
    if (call.is_recorded !== undefined) firestoreDoc.is_recorded = call.is_recorded;
    if (call.internal !== undefined) firestoreDoc.internal = call.internal;
    if (call.redirection !== undefined) firestoreDoc.redirection = call.redirection;

    await db.collection('zadarma_calls').doc(callId).set(firestoreDoc, { merge: true });
    return true;
  } catch (error) {
    console.error('[WORKER] Error guardando llamada:', error);
    return false;
  }
}

async function saveSyncMetadata(date, totalCalls, status, errorMessage) {
  const syncId = `sync_${format(date, 'yyyy-MM-dd')}`;
  const now = admin.firestore.Timestamp.now();
  await db.collection('zadarma_sync_metadata').doc(syncId).set({
    lastSyncTimestamp: now,
    totalCallsSynced: totalCalls,
    date: format(date, 'yyyy-MM-dd'),
    status,
    errorMessage: errorMessage || null,
  }, { merge: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESAMIENTO DE JOBS
// ═══════════════════════════════════════════════════════════════════════════

async function claimJob(jobRef) {
  try {
    await db.runTransaction(async (transaction) => {
      const jobDoc = await transaction.get(jobRef);
      
      if (!jobDoc.exists) {
        throw new Error('Job no existe');
      }

      const jobData = jobDoc.data();
      
      if (jobData.status !== 'queued') {
        throw new Error(`Job ya procesado: ${jobData.status}`);
      }

      transaction.update(jobRef, {
        status: 'in_progress',
        owner: WORKER_ID,
        updatedAt: admin.firestore.Timestamp.now()
      });
    });
    
    console.log(`[WORKER] ✅ Job claimed: ${jobRef.id}`);
    return true;
  } catch (error) {
    console.log(`[WORKER] ⚠️ No se pudo claim job: ${error.message}`);
    return false;
  }
}

async function processJob(jobDoc) {
  const jobData = jobDoc.data();
  const { sessionId, startDate, endDate, attempts = 0 } = jobData;
  const apiKey = process.env.ZADARMA_API_KEY;
  const apiSecret = process.env.ZADARMA_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Credenciales Zadarma no configuradas');
  }

  console.log(`[WORKER] 🚀 Procesando job ${sessionId}: ${startDate} → ${endDate}`);

  const dateRange = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  let processedDays = 0;
  let totalCalls = 0;
  let savedCalls = 0;
  let failedCalls = 0;
  const startTime = Date.now();

  await updateProgress(sessionId, {
    status: 'in_progress',
    processedDays: 0,
    totalDays: dateRange.length,
    progress: 0,
    callsSaved: 0,
    totalCalls: 0,
    message: 'Iniciando procesamiento...'
  });

  for (let i = 0; i < dateRange.length; i++) {
    const date = dateRange[i];
    const dateStr = format(date, 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');

    // No procesar día actual
    if (dateStr === today) {
      console.log(`[WORKER] ⏭️ Saltando ${dateStr} (día actual)`);
      processedDays++;
      continue;
    }

    await updateProgress(sessionId, {
      status: 'in_progress',
      currentDay: dateStr,
      processedDays: i,
      totalDays: dateRange.length,
      progress: (i / dateRange.length) * 100,
      callsSaved: savedCalls,
      totalCalls,
      message: `Procesando ${dateStr}...`
    });

    try {
      console.log(`[WORKER] 📅 Procesando ${dateStr}...`);
      const calls = await fetchCallsForDay(dateStr, apiKey, apiSecret);
      totalCalls += calls.length;
      console.log(`[WORKER] 📊 ${dateStr}: ${calls.length} llamadas obtenidas`);

      let daySaved = 0;
      for (const call of calls) {
        const success = await saveCallToFirestore(call);
        if (success) {
          savedCalls++;
          daySaved++;
        } else {
          failedCalls++;
        }
      }

      await saveSyncMetadata(date, calls.length, 'success');
      processedDays++;

      console.log(`[WORKER] ✅ ${dateStr} completado: ${daySaved}/${calls.length} guardadas`);

      await updateProgress(sessionId, {
        status: 'in_progress',
        currentDay: dateStr,
        processedDays: processedDays,
        totalDays: dateRange.length,
        progress: (processedDays / dateRange.length) * 100,
        callsSaved: savedCalls,
        totalCalls,
        message: `✅ ${dateStr} completado: ${calls.length} llamadas`
      });

    } catch (error) {
      console.error(`[WORKER] ❌ Error en ${dateStr}:`, error);
      await updateProgress(sessionId, {
        status: 'in_progress',
        currentDay: dateStr,
        processedDays: processedDays,
        totalDays: dateRange.length,
        progress: (processedDays / dateRange.length) * 100,
        callsSaved: savedCalls,
        totalCalls,
        message: `❌ Error en ${dateStr}: ${error.message}`
      });
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  await updateProgress(sessionId, {
    status: 'completed',
    processedDays: processedDays,
    totalDays: dateRange.length,
    progress: 100,
    callsSaved: savedCalls,
    totalCalls,
    failed: failedCalls,
    totalTime,
    message: `🎉 Completado: ${savedCalls}/${totalCalls} guardadas en ${totalTime}s`
  });

  console.log(`[WORKER] 🎉 Job ${sessionId} completado: ${savedCalls}/${totalCalls} en ${totalTime}s`);
}

async function requeueStalledJobs() {
  try {
    const staleThreshold = Date.now() - JOB_CLAIM_TTL_MS;
    const stalledJobs = await db.collection('zadarma_jobs')
      .where('status', '==', 'in_progress')
      .get();

    for (const doc of stalledJobs.docs) {
      const data = doc.data();
      const updatedAt = data.updatedAt?.toMillis() || 0;
      
      if (updatedAt < staleThreshold) {
        console.log(`[WORKER] 🔄 Requeuing stalled job: ${doc.id}`);
        await doc.ref.update({
          status: 'queued',
          owner: null,
          updatedAt: admin.firestore.Timestamp.now(),
          requeueCount: (data.requeueCount || 0) + 1
        });
      }
    }
  } catch (error) {
    console.error('[WORKER] Error requeuing stalled jobs:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════════════════════════════════════

async function mainLoop() {
  console.log(`[WORKER] 🚀 Worker iniciado: ${WORKER_ID}`);
  console.log(`[WORKER] 📊 Configuración:`);
  console.log(`[WORKER]    - Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`[WORKER]    - Job TTL: ${JOB_CLAIM_TTL_MS}ms`);
  console.log(`[WORKER]    - Max attempts: ${MAX_ATTEMPTS}`);

  let loopCount = 0;

  while (true) {
    try {
      loopCount++;

      // Cada 12 loops (~1 minuto) requeue stalled jobs
      if (loopCount % 12 === 0) {
        await requeueStalledJobs();
      }

      // Buscar próximo job pendiente
      const querySnapshot = await db.collection('zadarma_jobs')
        .where('status', '==', 'queued')
        .orderBy('createdAt')
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        // No hay jobs, esperar
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const jobDoc = querySnapshot.docs[0];
      const jobRef = jobDoc.ref;
      const jobData = jobDoc.data();

      // Intentar claim
      const claimed = await claimJob(jobRef);
      if (!claimed) {
        await sleep(1000);
        continue;
      }

      // Procesar job
      try {
        await processJob(jobDoc);
        
        // Marcar como completado
        await jobRef.update({
          status: 'completed',
          completedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now()
        });

        console.log(`[WORKER] ✅ Job ${jobDoc.id} marcado como completado`);

      } catch (error) {
        console.error(`[WORKER] ❌ Error procesando job ${jobDoc.id}:`, error);

        const attempts = (jobData.attempts || 0) + 1;
        
        if (attempts >= MAX_ATTEMPTS) {
          // Marcar como failed
          await jobRef.update({
            status: 'failed',
            attempts,
            lastError: error.message,
            failedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now()
          });
          console.log(`[WORKER] 💀 Job ${jobDoc.id} marcado como failed (${attempts} intentos)`);
        } else {
          // Requeue para reintentar
          await jobRef.update({
            status: 'queued',
            attempts,
            lastError: error.message,
            owner: null,
            updatedAt: admin.firestore.Timestamp.now()
          });
          console.log(`[WORKER] 🔄 Job ${jobDoc.id} requeued (intento ${attempts}/${MAX_ATTEMPTS})`);
        }
      }

    } catch (error) {
      console.error('[WORKER] ❌ Error en main loop:', error);
      await sleep(5000);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

initFirebase();
mainLoop().catch(error => {
  console.error('[WORKER] 💥 Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WORKER] 🛑 SIGTERM recibido, cerrando...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[WORKER] 🛑 SIGINT recibido, cerrando...');
  process.exit(0);
});
