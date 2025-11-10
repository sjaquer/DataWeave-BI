import { NextResponse } from "next/server";
import { startOfDay, format } from 'date-fns';
import { fetchZadarmaAdaptive, updateZadarmaCallsInFirestore, saveSyncMetadata, validateZadarmaCredentials } from '@/lib/zadarma-helpers';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Endpoint seguro para forzar la sincronización del día ACTUAL.
 * Protección: requiere la cabecera 'x-refresh-secret' con el valor de la
 * variable de entorno REFRESH_TODAY_SECRET.
 *
 * POST /api/zadarma/refresh-today
 * Headers: { 'x-refresh-secret': '<secret>' }
 * Body: optional
 */
export async function POST(req: Request) {
  try {
    const secretHeader = req.headers.get('x-refresh-secret') || '';
    const expected = process.env.REFRESH_TODAY_SECRET;

    if (!expected) {
      return NextResponse.json({ status: 'error', message: 'REFRESH_TODAY_SECRET no configurado en el servidor.' }, { status: 500 });
    }

    if (!secretHeader || secretHeader !== expected) {
      return NextResponse.json({ status: 'unauthorized', message: 'Credencial inválida para refresh-today.' }, { status: 401 });
    }

    // Validar credenciales Zadarma
    const credsValid = validateZadarmaCredentials();
    if (!credsValid.valid) {
      return NextResponse.json({ status: 'error', message: credsValid.message || 'Faltan credenciales Zadarma.' }, { status: 500 });
    }

    const apiKey = process.env.ZADARMA_API_KEY as string;
    const apiSecret = process.env.ZADARMA_API_SECRET as string;

    const todayStart = startOfDay(new Date());
    const now = new Date();

    // Rango: hoy 00:00:00 → ahora
    const calls = await fetchZadarmaAdaptive(todayStart, now, apiKey, apiSecret);

    // Guardar/actualizar en Firestore (borrar anteriores de hoy y escribir los nuevos)
    const saved = await updateZadarmaCallsInFirestore(calls, todayStart);

    // Guardar metadata de sync
    await saveSyncMetadata(todayStart, calls.length, 'success');

    return NextResponse.json({ status: 'success', message: 'Refresh de HOY completado', fetched: calls.length, saved }, { status: 200 });

  } catch (error: any) {
    console.error('[REFRESH-TODAY] Error:', error);
    try {
      await saveSyncMetadata(new Date(), 0, 'error', String(error?.message || error));
    } catch (e) {/* ignore */}
    return NextResponse.json({ status: 'error', message: error?.message || String(error) }, { status: 500 });
  }
}
