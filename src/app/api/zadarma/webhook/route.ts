import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// ============================================================================
// SCHEMAS DE VALIDACIÓN (NOTIFY_END y NOTIFY_MISSED)
// ============================================================================

const notifyEndSchema = z.object({
  event: z.literal('NOTIFY_END'),
  caller_id: z.string(),
  called_did: z.string(),
  call_start: z.string(), // "YYYY-MM-DD HH:MM:SS" (UTC)
  duration: z.string().or(z.number()),
  disposition: z.string(), // "answered", "busy", "no answer", "cancel", "failed"
  status_code: z.string().or(z.number()).optional(),
  is_recorded: z.string().or(z.number()).optional(),
  call_id_with_rec: z.string(), // ID único de la llamada
  pbx_call_id: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sip: z.string().optional(), // SIP del agente
  // Campos adicionales que Zadarma puede enviar
  internal: z.string().optional(),
  redirection: z.string().optional(),
  amd: z.string().optional(),
});

const notifyMissedSchema = z.object({
  event: z.literal('NOTIFY_MISSED'),
  caller_id: z.string(),
  called_did: z.string(),
  call_start: z.string(), // "YYYY-MM-DD HH:MM:SS" (UTC)
  call_id_with_rec: z.string(),
  pbx_call_id: z.string().optional(),
});

// ============================================================================
// MAPEO DE AGENTES (mismo que helpers)
// ============================================================================

const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen", "104": "Alanis", "105": "Marisol", "107": "Lisset",
  "108": "Wendy", "110": "Avril", "111": "Luz", "113": "Fiorela",
  "114": "Eduardo", "115": "Daiana", "116": "Noemi",
};

// ============================================================================
// HANDLER DEL WEBHOOK - GET Y POST
// ============================================================================

/**
 * GET - Verificación de webhook por Zadarma
 * Zadarma envía ?zd_echo=XXXXX para validar que el endpoint es tuyo
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zdEcho = searchParams.get('zd_echo');
  
  if (zdEcho) {
    console.log('[WEBHOOK VERIFICATION] Zadarma validation request, zd_echo:', zdEcho);
    // Zadarma espera que devolvamos el valor de zd_echo tal cual
    return new NextResponse(zdEcho, { 
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  // Si no hay zd_echo, devolver error
  return NextResponse.json({ 
    error: 'Missing zd_echo parameter for verification' 
  }, { status: 400 });
}

/**
 * POST - Recepción de eventos de webhook
 * Zadarma envía NOTIFY_END, NOTIFY_MISSED, etc.
 */
export async function POST(req: NextRequest) {
  // ══════════════════════════════════════════════════════════════════════════
  // RESPUESTA INMEDIATA A ZADARMA
  // ══════════════════════════════════════════════════════════════════════════
  // CRÍTICO: Responder inmediatamente con 200 OK para evitar timeouts
  const response = NextResponse.json({ status: 'ok' }, { status: 200 });

  // ══════════════════════════════════════════════════════════════════════════
  // PROCESAMIENTO EN SEGUNDO PLANO
  // ══════════════════════════════════════════════════════════════════════════
  // Procesar después de enviar la respuesta
  processWebhookInBackground(req).catch((error) => {
    console.error('[WEBHOOK ERROR] Error procesando webhook de Zadarma:', error);
  });

  return response;
}

async function processWebhookInBackground(req: NextRequest) {
  try {
    const payload = await req.json();
    
    console.log('[WEBHOOK] Evento recibido:', payload.event, 'Call ID:', payload.call_id_with_rec);

    if (payload.event === 'NOTIFY_END') {
      await handleNotifyEnd(payload);
    } else if (payload.event === 'NOTIFY_MISSED') {
      await handleNotifyMissed(payload);
    } else {
      console.log('[WEBHOOK] Evento no manejado:', payload.event);
    }
  } catch (error) {
    console.error('[WEBHOOK] Error en processWebhookInBackground:', error);
    throw error; // Re-throw para logging
  }
}

async function handleNotifyEnd(payload: any) {
  try {
    // Validar payload
    const callData = notifyEndSchema.parse(payload);
    
    // Usar call_id_with_rec o pbx_call_id como ID del documento
    const callId = callData.call_id_with_rec || callData.pbx_call_id || `unknown_${Date.now()}`;
    
    // Convertir call_start (UTC string) a Date y luego a Timestamp de Firestore
    // Formato esperado: "2025-10-29 14:30:00" (sin Z, asumimos UTC)
    const startTimeUTC = new Date(callData.call_start + 'Z');
    const callDate = callData.call_start.substring(0, 10); // "2025-10-29"
    
    // Preparar documento para Firestore
    const firestoreDoc = {
      // Identificadores
      call_id: callId,
      pbx_call_id: callData.pbx_call_id || callId,
      call_id_with_rec: callData.call_id_with_rec,
      
      // Timestamps
      callstart: callData.call_start, // String original "YYYY-MM-DD HH:MM:SS"
      start_time_utc: Timestamp.fromDate(startTimeUTC),
      callDate, // "YYYY-MM-DD" para queries
      
      // Datos de la llamada
      duration: typeof callData.duration === 'string' ? parseInt(callData.duration, 10) : callData.duration,
      seconds: typeof callData.duration === 'string' ? parseInt(callData.duration, 10) : callData.duration,
      disposition: callData.disposition,
      status_code: callData.status_code,
      
      // Números y routing
      caller_id: callData.caller_id,
      called_did: callData.called_did,
      from: callData.from || callData.caller_id,
      to: callData.to || callData.called_did,
      destination: callData.to || callData.called_did,
      
      // Agente (SIP)
      sip: callData.sip || 'unknown',
      agentId: callData.sip || 'unknown',
      agentName: AGENT_MAP[callData.sip || ''] || 'Desconocido',
      
      // Metadata
      is_recorded: callData.is_recorded,
      internal: callData.internal,
      redirection: callData.redirection,
      amd: callData.amd,
      
      // Origen y timestamp de actualización
      last_updated_by: 'webhook',
      webhook_received_at: Timestamp.now(),
      syncedAt: new Date().toISOString(),
      createdAt: Timestamp.now(),
    };

    // CRÍTICO: Usar set con merge: true para permitir convivencia con backfill
    // Si el documento ya existe (ej. creado por backfill), esta operación solo actualiza campos
    await db.collection('zadarma_calls')
      .doc(callId)
      .set(firestoreDoc, { merge: true });

    console.log('[WEBHOOK] NOTIFY_END guardado:', callId, '- Duración:', firestoreDoc.duration, 's');
  } catch (error) {
    console.error('[WEBHOOK] Error en handleNotifyEnd:', error);
    throw error;
  }
}

async function handleNotifyMissed(payload: any) {
  try {
    // Validar payload
    const callData = notifyMissedSchema.parse(payload);
    
    const callId = callData.call_id_with_rec || callData.pbx_call_id || `missed_${Date.now()}`;
    const startTimeUTC = new Date(callData.call_start + 'Z');
    const callDate = callData.call_start.substring(0, 10);
    
    const firestoreDoc = {
      call_id: callId,
      pbx_call_id: callData.pbx_call_id || callId,
      call_id_with_rec: callData.call_id_with_rec,
      
      callstart: callData.call_start,
      start_time_utc: Timestamp.fromDate(startTimeUTC),
      callDate,
      
      duration: 0,
      seconds: 0,
      disposition: 'no answer', // Llamada perdida
      
      caller_id: callData.caller_id,
      called_did: callData.called_did,
      from: callData.caller_id,
      to: callData.called_did,
      destination: callData.called_did,
      
      sip: 'unknown',
      agentId: 'unknown',
      agentName: 'Desconocido',
      
      last_updated_by: 'webhook',
      webhook_received_at: Timestamp.now(),
      syncedAt: new Date().toISOString(),
      createdAt: Timestamp.now(),
    };

    await db.collection('zadarma_calls')
      .doc(callId)
      .set(firestoreDoc, { merge: true });

    console.log('[WEBHOOK] NOTIFY_MISSED guardado:', callId);
  } catch (error) {
    console.error('[WEBHOOK] Error en handleNotifyMissed:', error);
    throw error;
  }
}
