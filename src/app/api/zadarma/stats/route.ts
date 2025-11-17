import { NextRequest, NextResponse } from 'next/server';
import { format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import {
  fetchZadarmaAdaptive,
  // usar las versiones optimizadas para reducir latencia de escritura/transformación
  consolidateCallsFast,
  updateZadarmaCallsInFirestoreFast,
  saveSyncMetadata,
  setSyncLock,
  removeSyncLock,
  isSyncLocked,
  validateZadarmaCredentials,
} from '@/lib/zadarma-helpers';

type StatsHandlerInput = {
  startDate?: string;
  endDate?: string;
  save?: boolean;
  force?: boolean;
};

type ErrorEntry = {
  date: string;
  message: string;
};

const LOCK_TTL_MINUTES = 20;

const normalizeDateInput = (value: string, boundary: 'start' | 'end'): Date => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Se recibió una fecha vacía.');
  }
  const hasTime = trimmed.includes(' ');
  const isoCandidate = hasTime
    ? trimmed.replace(' ', 'T')
    : `${trimmed}T${boundary === 'start' ? '00:00:00' : '23:59:59'}`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return parsed;
};

async function processZadarmaRange({ startDate, endDate, save = true, force = false }: StatsHandlerInput) {
  if (!startDate) {
    throw new Error('startDate es requerido.');
  }

  const start = normalizeDateInput(startDate, 'start');
  const end = normalizeDateInput(endDate ?? startDate, 'end');

  if (end.getTime() < start.getTime()) {
    throw new Error('endDate no puede ser anterior a startDate.');
  }

  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    throw new Error(credentialsCheck.message || 'Credenciales de Zadarma no configuradas.');
  }

  const apiKey = process.env.ZADARMA_API_KEY as string;
  const apiSecret = process.env.ZADARMA_API_SECRET as string;

  const dayRange = eachDayOfInterval({
    start: startOfDay(start),
    end: startOfDay(end),
  });

  const statsAccumulator: any[] = [];
  const fetchedPerDay: Record<string, number> = {};
  const savedPerDay: Record<string, number> = {};
  const lockedDays: string[] = [];
  const errors: ErrorEntry[] = [];

  for (const day of dayRange) {
    const dayKey = format(day, 'yyyy-MM-dd');
    const isFirstDay = day.getTime() === startOfDay(start).getTime();
    const isLastDay = day.getTime() === startOfDay(end).getTime();
    const dayStart = isFirstDay ? start : startOfDay(day);
    const dayEnd = isLastDay ? end : endOfDay(day);

    let lockAcquired = false;

    try {
      if (save) {
        const locked = await isSyncLocked(day, LOCK_TTL_MINUTES);
        if (locked && !force) {
          lockedDays.push(dayKey);
          continue;
        }
        await setSyncLock(day);
        lockAcquired = true;
      }

      const rawStats = await fetchZadarmaAdaptive(dayStart, dayEnd, apiKey, apiSecret);
      fetchedPerDay[dayKey] = rawStats.length;

      // Usar consolidación optimizada (más rápida en CPU)
      const consolidated = consolidateCallsFast(rawStats);
      statsAccumulator.push(...consolidated);

      if (save) {
        if (consolidated.length > 0) {
          const savedCount = await updateZadarmaCallsInFirestoreFast(consolidated, day);
          savedPerDay[dayKey] = savedCount;
          await saveSyncMetadata(day, consolidated.length, 'success');
        } else {
          savedPerDay[dayKey] = savedPerDay[dayKey] ?? 0;
          await saveSyncMetadata(day, 0, 'success');
        }
      }

    } catch (error: any) {
      const message = error?.message || String(error);
      errors.push({ date: dayKey, message });
      if (save) {
        await saveSyncMetadata(day, 0, 'error', message).catch(() => {});
      }
    } finally {
      if (save && lockAcquired) {
        await removeSyncLock(day).catch(() => {});
      }
    }
  }

  const savedTotal = Object.values(savedPerDay).reduce((acc, value) => acc + Number(value || 0), 0);
  const fetchedTotal = Object.values(fetchedPerDay).reduce((acc, value) => acc + Number(value || 0), 0);

  const hadLocks = lockedDays.length > 0;
  const status = errors.length === 0 && !hadLocks ? 'success' : statsAccumulator.length > 0 ? 'partial' : 'error';

  return {
    status,
    stats: statsAccumulator,
    count: statsAccumulator.length,
    fetchedPerDay,
    fetchedTotal,
    savedPerDay,
    savedTotal,
    lockedDays,
    errors,
    force,
    save,
    range: {
      start: format(start, 'yyyy-MM-dd HH:mm:ss'),
      end: format(end, 'yyyy-MM-dd HH:mm:ss'),
    },
    fromCache: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const save = searchParams.get('save') !== 'false';
    const force = searchParams.get('force') === 'true';

    const result = await processZadarmaRange({ startDate, endDate, save, force });
    const statusCode = result.status === 'error' ? 500 : 200;
    return NextResponse.json(result, { status: statusCode });
  } catch (error: any) {
    console.error('[ZADARMA STATS][GET] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate, endDate, save = true, force = false } = body || {};
    const result = await processZadarmaRange({ startDate, endDate, save, force });
    const statusCode = result.status === 'error' ? 500 : 200;
    return NextResponse.json(result, { status: statusCode });
  } catch (error: any) {
    console.error('[ZADARMA STATS][POST] Error:', error);
    return NextResponse.json(
      { status: 'error', message: error?.message || String(error) },
      { status: 500 }
    );
  }
}
