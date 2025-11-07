import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZADARMA CALLS API - CONSULTA DESDE FIRESTORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ----------
 * Endpoint para leer llamadas guardadas en Firestore (colección zadarma_calls).
 * Datos ya poblados por el route /api/zadarma/stats o script de backfill.
 * 
 * USO:
 * ----
 * GET /api/zadarma/calls?startDate=2025-11-01&endDate=2025-11-06
 * 
 * VENTAJAS:
 * ---------
 * ✅ Consulta rápida (no llama a API externa de Zadarma)
 * ✅ Datos consistentes (guardados con estructura completa)
 * ✅ No consume rate limits de Zadarma
 * ✅ Soporta datos históricos poblados por backfill
 * 
 * RESPUESTA:
 * ----------
 * {
 *   "status": "success",
 *   "calls": [...],     // Array de llamadas desde Firestore
 *   "source": "firestore",
 *   "count": 150
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get("startDate");
    const endDateQuery = searchParams.get("endDate");

    if (!startDateQuery || !endDateQuery) {
      return NextResponse.json(
        {
          status: "error",
          message: "Los parámetros startDate y endDate son requeridos.",
        },
        { status: 400 }
      );
    }

    // Verificar que Firestore esté disponible
    if (!db || typeof db.collection !== 'function') {
      return NextResponse.json(
        {
          status: "error",
          message: "Firebase Admin no está inicializado. Configura SERVICE_ACCOUNT.",
        },
        { status: 500 }
      );
    }

    console.log('[FIRESTORE] 📚 Consultando zadarma_calls');
    console.log('[FIRESTORE] 📅 Rango:', startDateQuery, '→', endDateQuery);

    // Consulta a Firestore filtrando por callDate
    const snapshot = await db.collection('zadarma_calls')
      .where('callDate', '>=', startDateQuery)
      .where('callDate', '<=', endDateQuery)
      .get();

    const calls: any[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      // Convertir Timestamp a string para serialización JSON
      if (data.start_time_utc && typeof data.start_time_utc.toDate === 'function') {
        data.start_time_utc = data.start_time_utc.toDate().toISOString();
      }
      if (data.updatedAt && typeof data.updatedAt.toDate === 'function') {
        data.updatedAt = data.updatedAt.toDate().toISOString();
      }
      calls.push({ id: doc.id, ...data });
    });

    console.log(`[FIRESTORE] ✅ Encontradas ${calls.length} llamadas`);

    return NextResponse.json(
      {
        status: "success",
        calls,
        source: "firestore",
        count: calls.length
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error("[FIRESTORE] 💥 Error al consultar:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
