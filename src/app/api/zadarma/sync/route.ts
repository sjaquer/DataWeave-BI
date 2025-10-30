import { NextRequest, NextResponse } from 'next/server';

/**
 * ENDPOINT DEPRECADO - NO USAR
 * 
 * Este endpoint ha sido REEMPLAZADO por la arquitectura Webhook + Backfill.
 * 
 * REEMPLAZO:
 * - Webhook: /api/zadarma/webhook (tiempo real)
 * - Backfill: npm run zadarma:backfill (histórico/rectificación)
 * - Cron: Automático 2 AM UTC diario
 * 
 * Deprecado: 30 de Octubre, 2025
 */

export async function POST(req: NextRequest) {
  return NextResponse.json({
    status: 'error',
    message: 'Este endpoint ha sido deprecado. Usa la arquitectura Webhook + Backfill.',
    migration: {
      webhook: {
        url: '/api/zadarma/webhook',
        description: 'Configurar en panel de Zadarma para datos en tiempo real',
        events: ['NOTIFY_END', 'NOTIFY_MISSED']
      },
      backfill: {
        manual: 'npm run zadarma:backfill -- --from="YYYY-MM-DD" --to="YYYY-MM-DD"',
        automatic: 'Vercel Cron ejecuta diariamente a las 2 AM UTC',
        docs: '/docs/ZADARMA-QUICKSTART.md'
      }
    },
    deprecated: true,
    deprecationDate: '2025-10-30'
  }, { status: 410 });
}
