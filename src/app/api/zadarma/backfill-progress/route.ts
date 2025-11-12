import { NextResponse } from "next/server";
import { eachDayOfInterval, parseISO } from "date-fns";
import * as dotenv from "dotenv";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

dotenv.config();

// Store global para el progreso (legacy - leer desde Firestore si no está en memoria)
const progressStore = new Map<string, any>();

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
    
    if (!startDate || !endDate) {
      return NextResponse.json(
        { status: "error", message: "startDate y endDate son requeridos." },
        { status: 400 }
      );
    }

    // 🔒 VERIFICAR SI YA HAY UN JOB PENDIENTE O EN PROGRESO
    try {
      const pendingJobs = await db.collection('zadarma_jobs')
        .where('status', 'in', ['queued', 'in_progress'])
        .limit(1)
        .get();

      if (!pendingJobs.empty) {
        const existingJob = pendingJobs.docs[0];
        const existingData = existingJob.data();
        console.log(`[BACKFILL-LOCK] ⚠️ Job ya en cola/progreso: ${existingJob.id}`);
        return NextResponse.json(
          {
            status: 'already_in_progress',
            message: 'Ya hay un backfill pendiente o en progreso. Espera a que termine.',
            existingSessionId: existingData.sessionId,
            existingJobId: existingJob.id
          },
          { status: 409 }
        );
      }
    } catch (err) {
      console.warn('[BACKFILL-LOCK] Error verificando jobs:', err);
    }

    // Verificar que db esté inicializado
    if (!db || typeof db.collection !== 'function') {
      return NextResponse.json(
        { status: "error", message: "Firebase Admin SDK no está inicializado." },
        { status: 500 }
      );
    }

    // Generar sessionId
    const sessionId = `backfill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calcular días totales
    const dateRange = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const totalDays = dateRange.length;
    const estimatedTimePerDay = 180; // 🎯 3 minutos por día (180 segundos)
    const totalEstimatedTime = totalDays * estimatedTimePerDay;

    // 📝 ENQUEUE JOB EN FIRESTORE (en lugar de setImmediate)
    const jobRef = db.collection('zadarma_jobs').doc();
    await jobRef.set({
      sessionId,
      startDate,
      endDate,
      status: 'queued',
      attempts: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      totalDays,
      estimatedTime: totalEstimatedTime
    });

    console.log(`[BACKFILL-QUEUE] ✅ Job enqueued: ${jobRef.id} (session: ${sessionId})`);

    // Inicializar sesión de progreso
    await db.collection('zadarma_backfill_sessions').doc(sessionId).set({
      status: 'queued',
      sessionId,
      totalDays,
      processedDays: 0,
      progress: 0,
      callsSaved: 0,
      totalCalls: 0,
      estimatedTimeRemaining: totalEstimatedTime,
      startTime: Date.now(),
      updatedAtMillis: Date.now(),
      message: 'En cola, esperando worker...',
      jobId: jobRef.id
    });

    // Retornar sessionId inmediatamente
    return NextResponse.json({
      status: "queued",
      sessionId,
      jobId: jobRef.id,
      totalDays,
      estimatedTime: totalEstimatedTime,
      message: "Backfill encolado. El worker lo procesará pronto. Use el sessionId para consultar progreso."
    }, { status: 200 });

  } catch (error: any) {
    console.error("[BACKFILL-PROGRESS] Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTA: La ejecución del backfill ahora se maneja por el worker.js
// Este endpoint solo encola jobs en zadarma_jobs
// ═══════════════════════════════════════════════════════════════════════════