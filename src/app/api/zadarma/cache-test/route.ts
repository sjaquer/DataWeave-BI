import { NextResponse } from 'next/server';
import { format, startOfDay, subDays } from 'date-fns';
import { hasDataForDateRange, getZadarmaCallsFromFirestore } from '@/lib/zadarma-helpers';

export async function GET() {
  try {
    const today = startOfDay(new Date());
    const yesterday = subDays(today, 1);
    const sevenDaysAgo = subDays(today, 7);

    // Test caché para diferentes rangos
    const todayHasData = await hasDataForDateRange(today, today);
    const yesterdayHasData = await hasDataForDateRange(yesterday, yesterday);
    const weekHasData = await hasDataForDateRange(sevenDaysAgo, today);

    let sampleData = null;
    if (yesterdayHasData) {
      const sample = await getZadarmaCallsFromFirestore(yesterday, yesterday);
      sampleData = {
        count: sample.length,
        firstCall: sample[0]?.callstart || null,
        lastCall: sample[sample.length - 1]?.callstart || null
      };
    }

    return NextResponse.json({
      status: 'success',
      cacheStatus: {
        today: todayHasData,
        yesterday: yesterdayHasData,
        lastWeek: weekHasData,
        dates: {
          today: format(today, 'yyyy-MM-dd'),
          yesterday: format(yesterday, 'yyyy-MM-dd'),
          sevenDaysAgo: format(sevenDaysAgo, 'yyyy-MM-dd')
        }
      },
      sampleData,
      message: 'Diagnóstico del sistema de caché completado'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: `Error en diagnóstico: ${error.message}`
    }, { status: 500 });
  }
}