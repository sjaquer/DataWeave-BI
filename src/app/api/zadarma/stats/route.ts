import { NextResponse } from "next/server";
import { format } from "date-fns";
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
    console.log('[SAVE] 🔍 Intentando guardar llamada:', call.pbx_call_id || call.callstart);
    
    // Verificar si db está disponible ANTES de procesar
    if (!db || typeof db.collection !== 'function') {
      console.error('[SAVE] ❌ Firebase Admin NO está inicializado (db es null)');
      console.error('[SAVE] 💡 Verifica que SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS estén configurados');
      return false;
    }
    
    console.log('[SAVE] ✅ Firebase Admin está inicializado correctamente');
    
    const callId = call.pbx_call_id || call.call_id_with_rec || `call_${Date.now()}_${Math.random()}`;
    console.log('[SAVE] 📝 Call ID generado:', callId);
    
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
      
      last_updated_by: 'api-route',
      syncedAt: new Date().toISOString(),
      updatedAt: Timestamp.now(),
    };

    // Agregar campos opcionales solo si no son undefined
    if (call.status_code !== undefined) firestoreDoc.status_code = call.status_code;
    if (call.is_recorded !== undefined) firestoreDoc.is_recorded = call.is_recorded;
    if (call.internal !== undefined) firestoreDoc.internal = call.internal;
    if (call.redirection !== undefined) firestoreDoc.redirection = call.redirection;

    console.log('[SAVE] 💾 Guardando en Firestore colección zadarma_calls, doc:', callId);
    
    await db.collection('zadarma_calls')
      .doc(callId)
      .set(firestoreDoc, { merge: true });
    
    console.log('[SAVE] ✅ Guardado exitoso:', callId);
    return true;
    
  } catch (error: any) {
    console.error('[SAVE] ❌ Error al guardar en Firestore:', error);
    console.error('[SAVE] 🔍 Error completo:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return false;
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZADARMA STATS API - CONSULTA DIRECTA A ZADARMA + GUARDADO EN FIRESTORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA:
 * =============
 * - Consulta directa a la API de Zadarma
 * - Paginación automática (1000 registros por página)
 * - Reintentos con backoff exponencial (máx 3 intentos)
 * - Manejo de rate limits (espera 60s en caso de 429)
 * - GUARDA automáticamente en Firestore (colección zadarma_calls)
 * - Usa merge: true para mantener integridad de datos
 * 
 * USO:
 * ----
 * GET /api/zadarma/stats?startDate=2025-11-01&endDate=2025-11-06
 * 
 * Query Params opcionales:
 * - save=false : Desactiva guardado en Firestore (solo retorna datos)
 * 
 * RESPUESTA:
 * ----------
 * {
 *   "status": "success",
 *   "stats": [...],  // Array de llamadas
 *   "saved": 150     // Número de llamadas guardadas en Firestore
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET(req: Request) {
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
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get("startDate");
    const endDateQuery = searchParams.get("endDate");
    const shouldSave = searchParams.get("save") !== "false"; // Por defecto: true

    if (!startDateQuery || !endDateQuery) {
      return NextResponse.json(
        {
          status: "error",
          message: "Los parámetros startDate y endDate son requeridos.",
        },
        { status: 400 }
      );
    }

    // Si la fecha no incluye hora, buscar TODO el día
    const start = startDateQuery ? new Date(startDateQuery) : new Date();
    const end = endDateQuery ? new Date(endDateQuery) : new Date();

    // Si la fecha es solo YYYY-MM-DD (sin hora), buscar desde 00:00:00 hasta 23:59:59
    let formattedStartDate: string;
    let formattedEndDate: string;
    
    if (startDateQuery && startDateQuery.length === 10 && endDateQuery && endDateQuery.length === 10) {
      // Solo fecha (YYYY-MM-DD) → buscar desde startDate 00:00:00 hasta endDate 23:59:59
      formattedStartDate = `${startDateQuery} 00:00:00`;
      formattedEndDate = `${endDateQuery} 23:59:59`;
      console.log('[ZADARMA API] 📅 Modo: Días completos desde', startDateQuery, 'hasta', endDateQuery);
    } else {
      // Fecha con hora → usar tal cual
      formattedStartDate = format(start, "yyyy-MM-dd HH:mm:ss");
      formattedEndDate = format(end, "yyyy-MM-dd HH:mm:ss");
      console.log('[ZADARMA API] 📅 Modo: Rango específico con hora');
    }

    const method = "/v1/statistics/pbx/";
    const limit = 1000;
    let skip = 0;
    const accumulatedStats: any[] = [];

    let continuePaging = true;

    console.log('[ZADARMA API] 🚀 Iniciando consulta');
    console.log('[ZADARMA API] 📅 Rango:', formattedStartDate, '→', formattedEndDate);

    while (continuePaging) {
      let attempt = 0;
      let success = false;
      let data: any;

      while (!success && attempt < 3) {
        // máximo 3 reintentos por página
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

          const hmac = CryptoJS.HmacSHA1(dataToSign, ZADARMA_API_SECRET);
          const hmacHex = hmac.toString(CryptoJS.enc.Hex);

          const signature = CryptoJS.enc.Base64.stringify(
            CryptoJS.enc.Utf8.parse(hmacHex)
          );
          const authHeader = `${ZADARMA_API_KEY}:${signature}`;

          const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

          console.log(`[ZADARMA API] 📤 Petición → skip=${skip}, intento #${attempt}`);

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
              console.warn("[ZADARMA API] ⏳ Límite excedido. Esperando 60 segundos...");
              await sleep(60000); // Espera 1 minuto
              continue;
            }

            return NextResponse.json(
              { status: "error", message: `Error Zadarma: ${data.message}` },
              { status: response.status }
            );
          }

          success = true;
        } catch (err) {
          console.warn(
            "[ZADARMA API] ❌ Error en solicitud, reintentando en 60 segundos...",
            err
          );
          await sleep(60000); // espera un minuto y reintenta
        }
      }

      if (!success) {
        return NextResponse.json(
          { 
            status: "error", 
            message: `No se pudo obtener datos después de 3 intentos para skip=${skip}` 
          },
          { status: 500 }
        );
      }

      accumulatedStats.push(...(data.stats || []));
      console.log(`[ZADARMA API] ✅ Página cargada: ${data.stats?.length || 0} registros. Total: ${accumulatedStats.length}`);

      continuePaging = data.stats?.length === limit;
      skip += limit;
    }

    console.log(`[ZADARMA API] 🎉 Consulta finalizada: ${accumulatedStats.length} llamadas`);

    // Guardar en Firestore si está habilitado
    let savedCount = 0;
    let failedCount = 0;
    
    if (shouldSave && accumulatedStats.length > 0) {
      console.log('[ZADARMA API] 💾 Iniciando guardado en Firestore...');
      console.log('[ZADARMA API] 📊 Total de llamadas a guardar:', accumulatedStats.length);
      
      // Verificar db ANTES del loop
      if (!db || typeof db.collection !== 'function') {
        console.error('[ZADARMA API] ❌ Firebase Admin NO inicializado. No se guardará nada.');
        console.error('[ZADARMA API] 💡 Verifica SERVICE_ACCOUNT en variables de entorno');
        console.error('[ZADARMA API] 🔍 Estado de db:', db === null ? 'null' : typeof db);
      } else {
        console.log('[ZADARMA API] ✅ Firebase Admin inicializado correctamente, procediendo a guardar...');
        
        for (const call of accumulatedStats) {
          const success = await saveCallToFirestore(call);
          if (success) {
            savedCount++;
          } else {
            failedCount++;
          }
          
          // Log cada 50 llamadas para no saturar consola
          if ((savedCount + failedCount) % 50 === 0) {
            console.log(`[ZADARMA API] � Progreso: ${savedCount} guardadas, ${failedCount} fallidas de ${accumulatedStats.length} totales`);
          }
        }
        
        console.log(`[ZADARMA API] 🎉 Guardado completado: ${savedCount} exitosas, ${failedCount} fallidas de ${accumulatedStats.length} totales`);
      }
    } else if (!shouldSave) {
      console.log('[ZADARMA API] ⏭️  Guardado desactivado (save=false en query params)');
    } else {
      console.log('[ZADARMA API] ⏭️  No hay llamadas para guardar (0 resultados)');
    }

    return NextResponse.json(
      { 
        status: "success", 
        stats: accumulatedStats,
        saved: savedCount,
        failed: failedCount
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[ZADARMA API] 💥 Error fatal:", error);
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
