import { NextResponse } from "next/server";
import { parseISO, format } from "date-fns";
import { fetchZadarmaAdaptive, validateZadarmaCredentials } from "@/lib/zadarma-helpers";
import { db } from '@/lib/firebase-admin';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VERIFY COMPLETENESS API - VERIFICA CONTRA API ZADARMA DIRECTA
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * - Para cada día del rango, consulta directamente la API de Zadarma
 * - Compara el número de llamadas con lo que está guardado en Firestore
 * - Retorna días donde hay discrepancias (datos incompletos)
 * - NO confía solo en metadata, sino que hace verificación real
 * 
 * USO:
 * ====
 * POST /api/zadarma/verify-completeness
 * Body: { 
 *   "startDate": "2025-11-08", 
 *   "endDate": "2025-11-08"
 * }
 * 
 * RESPUESTA:
 * ==========
 * {
 *   "status": "success",
 *   "incompleteDays": [
 *     {
 *       "date": "2025-11-08",
 *       "zadarmaCount": 1250,
 *       "firestoreCount": 1007,
 *       "missing": 243
 *     }
 *   ]
 * }
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

    // Validar credenciales de Zadarma
    const validation = validateZadarmaCredentials();
    if (!validation.valid) {
      return NextResponse.json(
        { status: "error", message: validation.message },
        { status: 500 }
      );
    }

    const apiKey = process.env.ZADARMA_API_KEY!;
    const apiSecret = process.env.ZADARMA_API_SECRET!;

    console.log(`[VERIFY-COMPLETENESS] 🔍 Verificando contra API Zadarma: ${startDate} → ${endDate}`);

    const startDateObj = parseISO(startDate);
    const endDateObj = parseISO(endDate);
    
    // Para cada día en el rango, verificar contra API de Zadarma
    const incompleteDays: Array<{
      date: string;
      zadarmaCount: number;
      firestoreCount: number;
      missing: number;
    }> = [];

    let currentDate = new Date(startDateObj);
    while (currentDate <= endDateObj) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      console.log(`[VERIFY-COMPLETENESS] 📅 Verificando ${dateStr}...`);

      try {
        // 1. Consultar API de Zadarma para este día específico
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        console.log(`[VERIFY-COMPLETENESS] 🌐 Consultando API Zadarma para ${dateStr}...`);
        const zadarmaData = await fetchZadarmaAdaptive(dayStart, dayEnd, apiKey, apiSecret);
        const zadarmaCount = zadarmaData.length;

        // 2. Contar documentos en Firestore para este día
        console.log(`[VERIFY-COMPLETENESS] 🗄️ Contando Firestore para ${dateStr}...`);
        const snapshot = await db.collection('zadarma_calls')
          .where('callDate', '==', dateStr)
          .get();
        const firestoreCount = snapshot.size;

        console.log(`[VERIFY-COMPLETENESS] 📊 ${dateStr}: Zadarma=${zadarmaCount}, Firestore=${firestoreCount}`);

        // 3. Si hay discrepancia, marcar como incompleto
        if (zadarmaCount !== firestoreCount) {
          const missing = zadarmaCount - firestoreCount;
          console.log(`[VERIFY-COMPLETENESS] ❌ ${dateStr}: INCOMPLETO (falta ${missing})`);
          incompleteDays.push({
            date: dateStr,
            zadarmaCount,
            firestoreCount,
            missing
          });
        } else {
          console.log(`[VERIFY-COMPLETENESS] ✅ ${dateStr}: COMPLETO`);
        }

      } catch (error: any) {
        console.error(`[VERIFY-COMPLETENESS] 💥 Error verificando ${dateStr}:`, error);
        // Si hay error al verificar un día, asumir que está incompleto
        incompleteDays.push({
          date: dateStr,
          zadarmaCount: -1,
          firestoreCount: -1,
          missing: -1
        });
      }

      // Avanzar al siguiente día
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[VERIFY-COMPLETENESS] 📊 Resultado: ${incompleteDays.length} días incompletos de ${Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1} verificados`);

    return NextResponse.json({
      status: "success",
      incompleteDays,
      totalDays: Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      incompleteCount: incompleteDays.length,
    }, { status: 200 });

  } catch (error: any) {
    console.error("[VERIFY-COMPLETENESS] 💥 Error:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}