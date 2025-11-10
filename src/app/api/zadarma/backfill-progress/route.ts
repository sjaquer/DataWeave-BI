import { NextResponse } from "next/server";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import * as dotenv from "dotenv";
import CryptoJS from "crypto-js";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { saveSyncMetadata } from "@/lib/zadarma-helpers";

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mapeo de agentes para enriquecer datos
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

// Store global para el progreso (en producción usar Redis o similar)
const progressStore = new Map<string, any>();

// 🔒 CONTROL DE CONCURRENCIA GLOBAL
let currentBackfillSessionId: string | null = null;
let isBackfillInProgress = false;

/**
 * Guarda el progreso del backfill para un sessionId
 */
function updateProgress(sessionId: string, progress: any) {
  progressStore.set(sessionId, {
    ...progress,
    updatedAt: Date.now()
  });
  console.log(`[PROGRESS] ${sessionId}:`, progress.message || progress.status);
  // Persistir de forma no bloqueante
  void persistProgressToFirestore(sessionId, progress);
}

// Persistir progreso en Firestore para que el frontend pueda leerlo aun cuando
// el proceso que inició el backfill haya sido reciclado (entornos serverless).
async function persistProgressToFirestore(sessionId: string, progress: any) {
  try {
    const doc = {
      ...progress,
      sessionId,
      updatedAtMillis: Date.now(),
      last_updated_by: 'backfill-progress-api'
    };
    await db.collection('zadarma_backfill_sessions').doc(sessionId).set(doc, { merge: true });
  } catch (err) {
    console.error('[PERSIST-PROGRESS] Error guardando progreso en Firestore:', err);
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKFILL PROGRESS API - SEGUIMIENTO DE PROGRESO EN TIEMPO REAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * - Endpoint para consultar el progreso de un backfill en curso
 * - Permite al frontend mostrar barra de progreso en tiempo real
 * - Reporta días procesados, llamadas guardadas, tiempo estimado
 * 
 * USO:
 * ====
 * GET /api/zadarma/backfill-progress?sessionId=abc123
 * 
 * RESPUESTA:
 * ==========
 * {
 *   "status": "in_progress",
 *   "currentDay": "2025-11-03",
 *   "processedDays": 2,
 *   "totalDays": 7,
 *   "progress": 28.6,
 *   "callsSaved": 1847,
 *   "estimatedTimeRemaining": 420,
 *   "message": "Procesando 2025-11-03..."
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { status: "error", message: "sessionId es requerido" },
        { status: 400 }
      );
    }

    let progress = progressStore.get(sessionId);

    if (!progress) {
      // Intentar leer desde Firestore en caso de que el proceso que inició el
      // backfill se haya reciclado (entorno serverless). Esto evita 404 para
      // sesiones recién iniciadas en otra instancia.
      try {
        const doc = await db.collection('zadarma_backfill_sessions').doc(sessionId).get();
        if (doc.exists) {
          const data = doc.data() || {};
          // Compatibilidad con la estructura en memoria
          data.updatedAt = data.updatedAtMillis || Date.now();
          // Guardar en cache de memoria para cargas subsecuentes
          progressStore.set(sessionId, data);
          progress = data;
        }
      } catch (err) {
        console.error('[BACKFILL-PROGRESS] Error leyendo progreso desde Firestore:', err);
      }
    }

    if (!progress) {
      return NextResponse.json(
        { status: "not_found", message: "Sesión no encontrada" },
        { status: 404 }
      );
    }

    // Limpiar progreso completado después de 5 minutos
    if (progress.status === 'completed' && Date.now() - progress.updatedAt > 300000) {
      progressStore.delete(sessionId);
    }

    return NextResponse.json(progress, { status: 200 });

  } catch (error: any) {
    console.error("[BACKFILL-PROGRESS] Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    return NextResponse.json(
      { status: "error", message: "Faltan credenciales de API." },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { startDate, endDate } = body;
    
    // 🔒 VERIFICAR SI YA HAY UN BACKFILL EN PROGRESO
    // También verificar sesión activa en Firestore para entornos serverless
    try {
      const recentWindowMs = 1000 * 60 * 15; // 15 minutos
      const cutoff = Date.now() - recentWindowMs;
      const recentQuery = await db.collection('zadarma_backfill_sessions')
        .where('status', 'in', ['starting', 'in_progress'])
        .get();

      if (!recentQuery.empty) {
        for (const d of recentQuery.docs) {
          const doc = d.data();
          const updatedAtMillis = doc?.updatedAtMillis || 0;
          if (updatedAtMillis && updatedAtMillis > cutoff) {
            const existingSessionId = d.id;
            console.log(`[BACKFILL-LOCK] ⚠️ Backfill detectado en Firestore (sesión: ${existingSessionId})`);
            return NextResponse.json(
              {
                status: 'already_in_progress',
                message: 'Ya hay un backfill en progreso (firestore). Espera a que termine.',
                currentSessionId: existingSessionId
              },
              { status: 409 }
            );
          }
        }
      }
    } catch (err) {
      console.warn('[BACKFILL-LOCK] Error verificando sesiones en Firestore:', err);
    }

    if (isBackfillInProgress && currentBackfillSessionId) {
      console.log(`[BACKFILL-LOCK] ⚠️  Backfill ya en progreso (sesión: ${currentBackfillSessionId})`);
      return NextResponse.json(
        { 
          status: "already_in_progress", 
          message: "Ya hay un backfill en progreso. Espera a que termine.",
          currentSessionId: currentBackfillSessionId
        },
        { status: 409 } // Conflict
      );
    }
    
    const sessionId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { status: "error", message: "startDate y endDate son requeridos." },
        { status: 400 }
      );
    }

    // Verificar que db esté inicializado
    if (!db || typeof db.collection !== 'function') {
      return NextResponse.json(
        { status: "error", message: "Firebase Admin SDK no está inicializado." },
        { status: 500 }
      );
    }

    // Generar lista de días a procesar
    const dateRange = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const totalDays = dateRange.length;
    const estimatedTimePerDay = 180; // 🎯 3 minutos por día (180 segundos)
    const totalEstimatedTime = totalDays * estimatedTimePerDay;

    // Inicializar progreso
    updateProgress(sessionId, {
      status: 'starting',
      sessionId,
      totalDays,
      processedDays: 0,
      progress: 0,
      callsSaved: 0,
      totalCalls: 0,
      estimatedTimeRemaining: totalEstimatedTime,
      startTime: Date.now(),
      message: 'Iniciando backfill...'
    });

    // 🔒 ESTABLECER LOCK GLOBAL
    isBackfillInProgress = true;
    currentBackfillSessionId = sessionId;
    console.log(`[BACKFILL-LOCK] 🔒 Lock establecido para sesión: ${sessionId}`);

    // Ejecutar backfill en background (no bloquear respuesta)
    setImmediate(async () => {
      await executeBackfillWithProgress(sessionId, dateRange, ZADARMA_API_KEY, ZADARMA_API_SECRET);
    });

    // Retornar sessionId inmediatamente
    return NextResponse.json({
      status: "started",
      sessionId,
      totalDays,
      estimatedTime: totalEstimatedTime,
      message: "Backfill iniciado. Use el sessionId para consultar progreso."
    }, { status: 200 });

  } catch (error: any) {
    console.error("[BACKFILL-PROGRESS] Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Ejecuta el backfill reportando progreso en tiempo real
 */
async function executeBackfillWithProgress(sessionId: string, dateRange: Date[], apiKey: string, apiSecret: string) {
  let processedDays = 0;
  let totalCalls = 0;
  let savedCalls = 0;
  let failedCalls = 0;
  let globalRequestCount = 0;
  const startTime = Date.now();

  updateProgress(sessionId, {
    status: 'in_progress',
    processedDays: 0,
    totalDays: dateRange.length,
    progress: 0,
    callsSaved: 0,
    totalCalls: 0,
    estimatedTimeRemaining: calculateEstimatedTime(dateRange.length, 0),
    message: 'Iniciando procesamiento...'
  });

  try {
    for (let i = 0; i < dateRange.length; i++) {
      const date = dateRange[i];
      const dateStr = format(date, 'yyyy-MM-dd');

      updateProgress(sessionId, {
        status: 'in_progress',
        currentDay: dateStr,
        processedDays: i,
        totalDays: dateRange.length,
        progress: (i / dateRange.length) * 100,
        callsSaved: savedCalls,
        totalCalls,
        estimatedTimeRemaining: calculateEstimatedTime(dateRange.length, i),
        message: `Procesando ${dateStr}...`
      });

      try {
        // Obtener llamadas del día con rate limiting
        const calls = await fetchCallsForDayWithProgress(sessionId, dateStr, apiKey, apiSecret, globalRequestCount);
        totalCalls += calls.length;

        // Guardar llamadas
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

        // Marcar día como sincronizado
        await saveSyncMetadata(date, calls.length, 'success');
        processedDays++;

        updateProgress(sessionId, {
          status: 'in_progress',
          currentDay: dateStr,
          processedDays: processedDays,
          totalDays: dateRange.length,
          progress: (processedDays / dateRange.length) * 100,
          callsSaved: savedCalls,
          totalCalls,
          estimatedTimeRemaining: calculateEstimatedTime(dateRange.length, processedDays),
          message: `✅ ${dateStr} completado: ${calls.length} llamadas (${daySaved} guardadas)`
        });

      } catch (error) {
        console.error(`[BACKFILL-PROGRESS] Error procesando ${dateStr}:`, error);
        updateProgress(sessionId, {
          status: 'in_progress',
          currentDay: dateStr,
          processedDays: processedDays,
          totalDays: dateRange.length,
          progress: (processedDays / dateRange.length) * 100,
          callsSaved: savedCalls,
          totalCalls,
          estimatedTimeRemaining: calculateEstimatedTime(dateRange.length, processedDays),
          message: `❌ Error en ${dateStr}: ${error}`
        });
      }
    }

    // Backfill completado
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    updateProgress(sessionId, {
      status: 'completed',
      processedDays: processedDays,
      totalDays: dateRange.length,
      progress: 100,
      callsSaved: savedCalls,
      totalCalls,
      failed: failedCalls,
      totalTime,
      estimatedTimeRemaining: 0,
      message: `🎉 Backfill completado: ${savedCalls}/${totalCalls} llamadas guardadas en ${totalTime}s`
    });

    // 🔓 LIBERAR LOCK GLOBAL
    isBackfillInProgress = false;
    currentBackfillSessionId = null;
    console.log(`[BACKFILL-LOCK] 🔓 Lock liberado - sesión ${sessionId} completada`);

  } catch (error: any) {
    console.error(`[BACKFILL-PROGRESS] Error fatal:`, error);
    updateProgress(sessionId, {
      status: 'error',
      processedDays: processedDays,
      totalDays: dateRange.length,
      progress: (processedDays / dateRange.length) * 100,
      callsSaved: savedCalls,
      totalCalls,
      error: error?.message || String(error),
      message: `💥 Error fatal: ${error?.message || String(error)}`
    });
    
    // 🔓 LIBERAR LOCK GLOBAL EN CASO DE ERROR
    isBackfillInProgress = false;
    currentBackfillSessionId = null;
    console.log(`[BACKFILL-LOCK] 🔓 Lock liberado - sesión ${sessionId} con error`);
  }
}

function calculateEstimatedTime(totalDays: number, processedDays: number): number {
  const remainingDays = totalDays - processedDays;
  const secondsPerDay = 180; // 🎯 3 minutos por día (180 segundos)
  return remainingDays * secondsPerDay;
}

async function fetchCallsForDayWithProgress(sessionId: string, date: string, apiKey: string, apiSecret: string, globalRequestCount: number): Promise<any[]> {
  const limit = 1000;
  let skip = 0;
  const allCalls: any[] = [];
  const formattedStartDate = `${date} 00:00:00`;
  const formattedEndDate = `${date} 23:59:59`;
  let continuePaging = true;

  while (continuePaging) {
    // Rate limiting
    if (globalRequestCount >= 2) {
      updateProgress(sessionId, {
        message: `⏳ Rate limit alcanzado, esperando 120s...`
      });
      await sleep(120000);
      globalRequestCount = 0;
    }

    const params = {
      start: formattedStartDate,
      end: formattedEndDate,
      format: "json",
      version: "2",
      skip,
    };

    const data = await makeZadarmaRequest(params, apiKey, apiSecret);
    globalRequestCount++;

    const calls = data.stats || [];
    allCalls.push(...calls);

    continuePaging = calls.length === limit;
    skip += limit;

    if (continuePaging) {
      updateProgress(sessionId, {
        message: `📄 ${date}: página ${Math.floor(skip/limit)}, ${allCalls.length} llamadas...`
      });
    }
  }

  return allCalls;
}

async function makeZadarmaRequest(params: any, apiKey: string, apiSecret: string): Promise<any> {
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

  const response = await fetch(apiUrl, {
    method: "GET",
    headers: { Authorization: authHeader },
  });

  const data = await response.json();
  if (data.status === "error") {
    if (data.message?.toLowerCase()?.includes("limit exceeded") || response.status === 429) {
      await sleep(60000);
      return makeZadarmaRequest(params, apiKey, apiSecret);
    }
    throw new Error(`Error Zadarma: ${data.message}`);
  }

  return data;
}

async function saveCallToFirestore(call: any): Promise<boolean> {
  try {
    const callId = call.pbx_call_id || call.call_id_with_rec || `call_${Date.now()}_${Math.random()}`;
    const startTimeUTC = new Date(call.callstart + (call.callstart.includes('Z') ? '' : 'Z'));
    const callDate = call.callstart.substring(0, 10);
    
    const firestoreDoc: any = {
      call_id: callId,
      pbx_call_id: call.pbx_call_id || callId,
      call_id_with_rec: call.call_id_with_rec || callId,
      callstart: call.callstart,
      start_time_utc: Timestamp.fromDate(startTimeUTC),
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
      last_updated_by: 'backfill-progress-api',
      syncedAt: new Date().toISOString(),
      updatedAt: Timestamp.now(),
    };

    if (call.status_code !== undefined) firestoreDoc.status_code = call.status_code;
    if (call.is_recorded !== undefined) firestoreDoc.is_recorded = call.is_recorded;
    if (call.internal !== undefined) firestoreDoc.internal = call.internal;
    if (call.redirection !== undefined) firestoreDoc.redirection = call.redirection;

    await db.collection('zadarma_calls').doc(callId).set(firestoreDoc, { merge: true });
    return true;
  } catch (error: any) {
    console.error('[SAVE-FIRESTORE] Error:', error);
    return false;
  }
}