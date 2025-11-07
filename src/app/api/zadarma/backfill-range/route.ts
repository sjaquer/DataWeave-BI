import { NextResponse } from "next/server";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import * as dotenv from "dotenv";
import CryptoJS from "crypto-js";
import { db } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

dotenv.config();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mapeo de agentes para enriquecer datos
const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

/**
 * Guarda una llamada en Firestore
 */
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
      
      last_updated_by: 'backfill-range-api',
      syncedAt: new Date().toISOString(),
      updatedAt: Timestamp.now(),
    };

    // Agregar campos opcionales solo si no son undefined
    if (call.status_code !== undefined) firestoreDoc.status_code = call.status_code;
    if (call.is_recorded !== undefined) firestoreDoc.is_recorded = call.is_recorded;
    if (call.internal !== undefined) firestoreDoc.internal = call.internal;
    if (call.redirection !== undefined) firestoreDoc.redirection = call.redirection;

    await db.collection('zadarma_calls')
      .doc(callId)
      .set(firestoreDoc, { merge: true });
    
    return true;
    
  } catch (error: any) {
    console.error('[BACKFILL-RANGE] Error al guardar:', error);
    return false;
  }
}

/**
 * Obtiene llamadas de un día específico desde Zadarma API
 */
async function fetchCallsForDay(date: string, apiKey: string, apiSecret: string): Promise<any[]> {
  const method = "/v1/statistics/pbx/";
  const limit = 1000;
  let skip = 0;
  const allCalls: any[] = [];

  const formattedStartDate = `${date} 00:00:00`;
  const formattedEndDate = `${date} 23:59:59`;

  let continuePaging = true;

  while (continuePaging) {
    let attempt = 0;
    let success = false;
    let data: any;

    while (!success && attempt < 3) {
      attempt++;
      try {
        const params: { [key: string]: string | number } = {
          start: formattedStartDate,
          end: formattedEndDate,
          format: "json",
          version: "2",
          skip,
        };

        const sortedKeys = Object.keys(params).sort();
        const sortedParams = new URLSearchParams();
        sortedKeys.forEach((key) =>
          sortedParams.append(key, String(params[key]))
        );
        const queryString = sortedParams.toString();

        const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
        const dataToSign = method + queryString + md5Hash;

        const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
        const hmacHex = hmac.toString(CryptoJS.enc.Hex);

        const signature = CryptoJS.enc.Base64.stringify(
          CryptoJS.enc.Utf8.parse(hmacHex)
        );
        const authHeader = `${apiKey}:${signature}`;

        const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: { Authorization: authHeader },
        });

        data = await response.json();

        if (data.status === "error") {
          if (
            data.message?.toLowerCase()?.includes("limit exceeded") ||
            response.status === 429
          ) {
            console.log(`[BACKFILL-RANGE] ⏳ Rate limit excedido, esperando 60s...`);
            await sleep(60000);
            continue;
          }
          throw new Error(`Error Zadarma: ${data.message}`);
        }

        success = true;
      } catch (err) {
        console.warn(`[BACKFILL-RANGE] ❌ Error en intento ${attempt}/3:`, err);
        if (attempt === 3) throw err;
        await sleep(30000);
      }
    }

    allCalls.push(...(data.stats || []));
    continuePaging = data.stats?.length === limit;
    skip += limit;
  }

  return allCalls;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BACKFILL RANGE API - BACKFILL ON-DEMAND PARA RANGOS ESPECÍFICOS
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * - Permite rellenar datos faltantes cuando usuario selecciona fechas históricas
 * - Respeta rate limits de Zadarma (2 requests/min, con wait automático)
 * - Procesamiento día por día con reporte de progreso
 * - Evita duplicados usando merge: true
 * 
 * USO:
 * ====
 * POST /api/zadarma/backfill-range
 * Body: { "startDate": "2025-11-01", "endDate": "2025-11-07" }
 * 
 * RESPUESTA:
 * ==========
 * {
 *   "status": "success",
 *   "processed": ["2025-11-01", "2025-11-02", ...],
 *   "totalDays": 7,
 *   "totalCalls": 350,
 *   "saved": 348,
 *   "failed": 2
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function POST(req: Request) {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    return NextResponse.json(
      {
        status: "error",
        message: "Faltan credenciales de API.",
      },
      { status: 500 }
    );
  }

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

    // Verificar que db esté inicializado
    if (!db || typeof db.collection !== 'function') {
      return NextResponse.json(
        {
          status: "error",
          message: "Firebase Admin SDK no está inicializado.",
        },
        { status: 500 }
      );
    }

    console.log(`[BACKFILL-RANGE] 🚀 Iniciando backfill: ${startDate} → ${endDate}`);

    // Generar lista de días a procesar
    const dateRange = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const processedDays: string[] = [];
    let totalCalls = 0;
    let savedCalls = 0;
    let failedCalls = 0;
    let requestCount = 0;

    for (const date of dateRange) {
      const dateStr = format(date, 'yyyy-MM-dd');
      console.log(`[BACKFILL-RANGE] 📅 Procesando ${dateStr}...`);

      try {
        // Rate limiting: Máximo 2 requests, luego wait 120s
        if (requestCount >= 2) {
          console.log(`[BACKFILL-RANGE] ⏳ Esperando 120s por rate limit...`);
          await sleep(120000);
          requestCount = 0;
        }

        // Obtener llamadas del día
        const calls = await fetchCallsForDay(dateStr, ZADARMA_API_KEY, ZADARMA_API_SECRET);
        requestCount++;

        console.log(`[BACKFILL-RANGE] 📊 ${dateStr}: ${calls.length} llamadas obtenidas`);
        totalCalls += calls.length;

        // Guardar cada llamada
        for (const call of calls) {
          const success = await saveCallToFirestore(call);
          if (success) {
            savedCalls++;
          } else {
            failedCalls++;
          }
        }

        processedDays.push(dateStr);
        console.log(`[BACKFILL-RANGE] ✅ ${dateStr}: ${calls.length} llamadas procesadas`);

      } catch (error) {
        console.error(`[BACKFILL-RANGE] ❌ Error procesando ${dateStr}:`, error);
        // Continuar con siguiente día
      }
    }

    console.log(`[BACKFILL-RANGE] 🎉 Backfill completado: ${savedCalls}/${totalCalls} llamadas guardadas`);

    return NextResponse.json({
      status: "success",
      processed: processedDays,
      totalDays: dateRange.length,
      totalCalls,
      saved: savedCalls,
      failed: failedCalls,
    }, { status: 200 });

  } catch (error: any) {
    console.error("[BACKFILL-RANGE] 💥 Error fatal:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}