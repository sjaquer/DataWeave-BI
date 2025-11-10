import { NextResponse } from "next/server";
import { parseISO } from "date-fns";
import { getMissingDaysFromFirestore } from "@/lib/zadarma-helpers";

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHECK MISSING DAYS API - DETECTA FECHAS FALTANTES EN FIRESTORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * - Verificar qué días del rango seleccionado NO tienen datos en Firestore
 * - Retorna lista de fechas que necesitan backfill
 * - Utiliza la metadata de sincronización para determinar días completos
 * 
 * USO:
 * ====
 * POST /api/zadarma/check-missing
 * Body: { "startDate": "2025-11-01", "endDate": "2025-11-07" }
 * 
 * RESPUESTA:
 * ==========
 * {
 *   "status": "success",
 *   "missingDays": ["2025-11-01", "2025-11-03", "2025-11-05"],
 *   "totalDays": 7,
 *   "missingCount": 3
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { startDate, endDate } = body;

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          status: "error",
          message: "Los parámetros startDate y endDate son requeridos.",
        },
        { status: 400 }
      );
    }

    console.log(`[CHECK-MISSING] 🔍 Verificando datos: ${startDate} → ${endDate}`);

    // Usar la función existente para detectar días faltantes
  // body puede incluir includeToday: true para forzar que el backfill incluya HOY
  // Si no se envía includeToday asumimos que queremos verificar siempre (includeToday = true)
  const includeToday = body.includeToday === undefined ? true : Boolean(body.includeToday === true);
    const missingDates = await getMissingDaysFromFirestore(
      parseISO(startDate),
      parseISO(endDate),
      includeToday
    );

    const missingDays = missingDates.map(date => date.toISOString().substring(0, 10));

    console.log(`[CHECK-MISSING] 📊 Resultado: ${missingDays.length} días faltantes de ${endDate ? Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1} totales`);

    return NextResponse.json({
      status: "success",
      missingDays,
      totalDays: endDate ? Math.ceil((parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 1,
      missingCount: missingDays.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CHECK-MISSING] 💥 Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}