import { NextResponse } from "next/server";

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

    console.log(`[CHECK-MISSING] 🔍 Verificando datos contra API ZADARMA: ${startDate} → ${endDate}`);

    // NUEVA ESTRATEGIA: Verificar SIEMPRE contra API de Zadarma real (no solo metadata)
    // Llamar al endpoint verify-completeness que compara Firestore vs API directa
    console.log(`[CHECK-MISSING] 🌐 Consultando verify-completeness para verificación real...`);
    
    const verifyResponse = await fetch(`${req.url.replace('/check-missing', '/verify-completeness')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate })
    });

    if (!verifyResponse.ok) {
      throw new Error(`Error en verify-completeness: ${verifyResponse.status}`);
    }

    const verifyData = await verifyResponse.json();
    
    if (verifyData.status !== 'success') {
      throw new Error(`Fallo en verify-completeness: ${verifyData.message}`);
    }

    // Extraer días que están incompletos según la verificación real
    const missingDays = verifyData.incompleteDays.map((item: any) => item.date);
    
    console.log(`[CHECK-MISSING] 📊 Verificación real completada:`, verifyData.incompleteDays);    console.log(`[CHECK-MISSING] 📊 Resultado: ${missingDays.length} días faltantes de ${verifyData.totalDays} totales`);

    return NextResponse.json({
      status: "success",
      missingDays,
      totalDays: verifyData.totalDays,
      missingCount: missingDays.length,
      verificationDetails: verifyData.incompleteDays, // Incluir detalles de la verificación
    }, { status: 200 });

  } catch (error: any) {
    console.error("[CHECK-MISSING] 💥 Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}