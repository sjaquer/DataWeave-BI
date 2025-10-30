/**
 * API Endpoint para ejecutar Backfill de Zadarma
 * 
 * GET /api/zadarma/backfill?days=7
 * 
 * Propósito:
 * - Permitir ejecutar backfill desde el navegador
 * - No requiere credenciales locales
 * - Usa las credenciales de Vercel
 */

import { NextRequest, NextResponse } from 'next/server';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { fetchZadarmaAdaptive, saveZadarmaCalls } from '@/lib/zadarma-helpers';

const ZADARMA_API_KEY = process.env.ZADARMA_API_KEY!;
const ZADARMA_API_SECRET = process.env.ZADARMA_API_SECRET!;

/**
 * Endpoint GET
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days') || '7';
    const days = parseInt(daysParam, 10);

    if (isNaN(days) || days < 1 || days > 90) {
      return NextResponse.json(
        { error: 'El parámetro days debe ser un número entre 1 y 90' },
        { status: 400 }
      );
    }

    console.log(`[BACKFILL] Iniciando backfill de ${days} días...`);

    // Calcular rango de fechas
    const now = new Date();
    const endDate = endOfDay(now);
    const startDate = startOfDay(subDays(now, days));

    console.log(`[BACKFILL] Rango: ${format(startDate, 'yyyy-MM-dd HH:mm:ss')} → ${format(endDate, 'yyyy-MM-dd HH:mm:ss')}`);

    // Obtener llamadas de Zadarma usando la función existente
    const calls = await fetchZadarmaAdaptive(startDate, endDate, ZADARMA_API_KEY, ZADARMA_API_SECRET);
    console.log(`[BACKFILL] Llamadas obtenidas de API: ${calls.length}`);

    if (calls.length === 0) {
      return NextResponse.json({
        status: 'success',
        message: 'No hay llamadas en el rango especificado',
        data: {
          days,
          range: {
            start: format(startDate, 'yyyy-MM-dd'),
            end: format(endDate, 'yyyy-MM-dd'),
          },
          callsProcessed: 0,
          callsSaved: 0,
        },
      });
    }

    // Guardar en Firestore usando la función existente
    const savedCount = await saveZadarmaCalls(calls);
    console.log(`[BACKFILL] Guardadas en Firestore: ${savedCount}/${calls.length}`);

    return NextResponse.json({
      status: 'success',
      message: `Backfill completado: ${savedCount} llamadas guardadas`,
      data: {
        days,
        range: {
          start: format(startDate, 'yyyy-MM-dd'),
          end: format(endDate, 'yyyy-MM-dd'),
        },
        callsProcessed: calls.length,
        callsSaved: savedCount,
      },
    });
  } catch (error) {
    console.error('[BACKFILL] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido',
        error: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
