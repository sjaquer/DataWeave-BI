import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * VERCEL CRON: Backfill Diario de Zadarma
 * 
 * Este endpoint se ejecuta automáticamente cada noche (configurado en vercel.json)
 * para sincronizar las últimas 24 horas de llamadas.
 * 
 * Propósito: Rectificar cualquier llamada perdida (ej. por webhook fallido)
 */

export async function GET(req: NextRequest) {
  // Verificar que la petición viene del Cron de Vercel (seguridad básica)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[CRON] Iniciando backfill diario de Zadarma...');
    
    // Ejecutar script de backfill para las últimas 24 horas
    const { stdout, stderr } = await execAsync(
      'npx tsx scripts/zadarma-backfill.ts --days=1 --timezone="America/Lima"',
      {
        cwd: process.cwd(),
        env: { ...process.env },
      }
    );

    console.log('[CRON] Backfill completado');
    if (stdout) console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);

    return NextResponse.json({
      status: 'success',
      message: 'Backfill diario completado',
      timestamp: new Date().toISOString(),
      stdout: stdout.substring(0, 500), // Limitar output
    });

  } catch (error: any) {
    console.error('[CRON] Error en backfill:', error);
    
    return NextResponse.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
