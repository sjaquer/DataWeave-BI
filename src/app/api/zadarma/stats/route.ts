
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';
import {
  validateZadarmaCredentials,
  getZadarmaCallsFromFirestore,
} from '@/lib/zadarma-helpers';

dotenv.config();

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ZADARMA STATS API - SOLO LECTURA DESDE FIRESTORE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA WEBHOOK + BACKFILL:
 * ================================
 * Este endpoint ha sido simplificado para SOLO lectura desde Firestore.
 * 
 * POBLACIÓN DE DATOS:
 * -------------------
 * 1. Webhook (/api/zadarma/webhook): Datos en tiempo real (< 1 segundo)
 *    - Recibe NOTIFY_END y NOTIFY_MISSED desde Zadarma
 *    - Guarda automáticamente en Firestore con merge: true
 * 
 * 2. Backfill (scripts/zadarma-backfill.ts): Datos históricos y rectificación
 *    - Ejecutable manual: npm run zadarma:backfill -- --from="YYYY-MM-DD" --to="YYYY-MM-DD"
 *    - Cron diario: 2 AM UTC (últimas 24h automáticamente)
 *    - Rate limit seguro: 21 segundos entre llamadas API
 * 
 * BENEFICIOS:
 * -----------
 * ✅ Latencia ultra-baja: 200-500ms (solo lectura Firestore)
 * ✅ CERO consumo de rate limit de Zadarma API
 * ✅ Datos siempre frescos (webhook en tiempo real)
 * ✅ Rectificación automática (cron diario)
 * ✅ Sin duplicados (upsert con call_id como docId)
 * 
 * DEPLOYMENT:
 * -----------
 * 1. Limpiar colecciones Firestore (zadarma_calls, zadarma_sync_metadata, zadarma_sync_locks)
 * 2. Desplegar a Vercel con variables de entorno configuradas
 * 3. Activar webhook en panel de Zadarma
 * 4. Ejecutar backfill histórico: npm run zadarma:backfill -- --from="2024-01-01"
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET(req: NextRequest) {
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({ status: 'error', message: credentialsCheck.message }, { status: 500 });
  }

  try {
    console.log('[ZADARMA STATS READ-ONLY] Request received');
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    if (!startDateQuery || !endDateQuery) {
        return NextResponse.json({ 
          status: 'error', 
          message: 'Los parámetros startDate y endDate son requeridos.' 
        }, { status: 400 });
    }

    console.log('[ZADARMA STATS READ-ONLY] Parsing dates:', { startDateQuery, endDateQuery });
    const startDate = startOfDay(parseISO(startDateQuery));
    const endDate = endOfDay(parseISO(endDateQuery));

    // ═══════════════════════════════════════════════════════════════════════
    // SOLO LECTURA DESDE FIRESTORE
    // ═══════════════════════════════════════════════════════════════════════
    // Los datos son poblados por:
    // - Webhook: llamadas en tiempo real
    // - Backfill: datos históricos y rectificación diaria
    console.log('[ZADARMA STATS READ-ONLY] Reading from Firestore cache');
    const finalStats = await getZadarmaCallsFromFirestore(startDate, endDate);

    // METADATOS ADICIONALES para mejorar la información
    const metadata = {
      totalCalls: finalStats.length,
      dateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      },
      agents: [...new Set(finalStats.map(call => call.sip))].filter(Boolean).length,
      callTypes: {
        outbound: finalStats.filter(call => String(call.destination || '').length >= 5).length,
        answered: finalStats.filter(call => call.disposition === 'answered').length,
        effectiveness: finalStats.length > 0 ? 
          (finalStats.filter(call => call.disposition === 'answered').length / 
           Math.max(1, finalStats.filter(call => String(call.destination || '').length >= 5).length) * 100).toFixed(1) + '%' : '0%'
      },
      timeRange: finalStats.length > 0 ? {
        first: finalStats[0]?.callstart || null,
        last: finalStats[finalStats.length - 1]?.callstart || null
      } : null,
      processed: new Date().toISOString(),
      dataSource: 'firestore-cache' // Siempre desde Firestore ahora
    };

    console.log('[ZADARMA STATS READ-ONLY] Retrieved', metadata.totalCalls, 'calls from Firestore');

    return NextResponse.json({
      status: 'success',
      stats: finalStats,
      fromCache: true, // Siempre true con arquitectura webhook
      metadata,
      message: `Datos recuperados desde Firestore. ${metadata.totalCalls} llamadas. Poblados por webhook + backfill.`,
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS READ-ONLY FATAL ERROR]:', error);
    console.error('[ZADARMA STATS READ-ONLY STACK]:', error.stack);
    return NextResponse.json({ 
      status: 'error', 
      message: `Error al leer datos desde Firestore: ${error.message}`,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
