import { NextRequest, NextResponse } from 'next/server';
import { getMissingDaysFromFirestore } from '@/lib/zadarma-helpers';
import { format } from 'date-fns';

/**
 * API endpoint para verificar qué días tienen datos faltantes de Zadarma en Firestore
 * 
 * POST /api/zadarma/check-missing
 * Body: { startDate: string, endDate: string, includeToday?: boolean }
 * 
 * Retorna: { missingDays: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const { startDate, endDate, includeToday = false } = await request.json();

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos' },
        { status: 400 }
      );
    }

    console.log(`[CHECK-MISSING] Verificando rango: ${startDate} → ${endDate}, includeToday: ${includeToday}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Obtener días faltantes usando la función helper
    const missingDatesArray = await getMissingDaysFromFirestore(start, end, includeToday);
    
    // Convertir a strings en formato yyyy-MM-dd
    const missingDays = missingDatesArray.map(date => format(date, 'yyyy-MM-dd'));

    console.log(`[CHECK-MISSING] ✅ Encontrados ${missingDays.length} días faltantes:`, missingDays);

    return NextResponse.json({
      missingDays,
      totalMissing: missingDays.length,
      range: { startDate, endDate },
      includeToday
    });

  } catch (error) {
    console.error('[CHECK-MISSING] Error:', error);
    return NextResponse.json(
      { error: 'Error verificando días faltantes' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/zadarma/check-missing?startDate=2024-01-01&endDate=2024-01-31&includeToday=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeToday = searchParams.get('includeToday') === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate y endDate son requeridos como query params' },
        { status: 400 }
      );
    }

    console.log(`[CHECK-MISSING] GET verificando rango: ${startDate} → ${endDate}, includeToday: ${includeToday}`);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Obtener días faltantes usando la función helper
    const missingDatesArray = await getMissingDaysFromFirestore(start, end, includeToday);
    
    // Convertir a strings en formato yyyy-MM-dd
    const missingDays = missingDatesArray.map(date => format(date, 'yyyy-MM-dd'));

    console.log(`[CHECK-MISSING] GET ✅ Encontrados ${missingDays.length} días faltantes:`, missingDays);

    return NextResponse.json({
      missingDays,
      totalMissing: missingDays.length,
      range: { startDate, endDate },
      includeToday
    });

  } catch (error) {
    console.error('[CHECK-MISSING] GET Error:', error);
    return NextResponse.json(
      { error: 'Error verificando días faltantes' },
      { status: 500 }
    );
  }
}