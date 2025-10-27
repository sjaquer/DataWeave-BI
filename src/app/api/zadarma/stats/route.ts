
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  consolidateCalls,
  validateZadarmaCredentials,
  saveZadarmaCalls,
} from '@/lib/zadarma-helpers';

dotenv.config();

const LIMA_TIME_ZONE = 'America/Lima';
const MADRID_TIME_ZONE = 'Europe/Madrid';

async function fetchZadarmaAPI(
  start: Date, // Se espera una fecha que representa la hora de Madrid
  end: Date,   // Se espera una fecha que representa la hora de Madrid
  apiKey: string,
  apiSecret: string,
  // skipConversion: si true, devuelve los tiempos tal cual llegan desde la API (sin convertir a UTC)
  skipConversion = false
): Promise<any[]> {
  // La función format usará la representación local de la fecha, que ya está ajustada a Madrid
  const formattedStartDate = format(start, 'yyyy-MM-dd HH:mm:ss');
  const formattedEndDate = format(end, 'yyyy-MM-dd HH:mm:ss');
  
  const method = '/v1/statistics/pbx/';
  const params = { start: formattedStartDate, end: formattedEndDate, format: 'json', version: '2' };
  
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, (params as any)[key]));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmac.toString(CryptoJS.enc.Hex)));
  
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;
  
  const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });

  if (!response.ok) throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
  const data = await response.json();
  if (data.status === 'error') throw new Error(`Error de API de Zadarma: ${data.message}`);
  
  // --- CONVERSIÓN DE MADRID A UTC ---
  // Devolver callstart tal cual viene de la API — sin ninguna conversión de zona horaria.
  return (data.stats || []).map((call: any) => ({
    ...call,
    callstart: call.callstart,
  }));
}

export async function GET(req: NextRequest) {
  const credentialsCheck = validateZadarmaCredentials();
  if (!credentialsCheck.valid) {
    return NextResponse.json({ status: 'error', message: credentialsCheck.message }, { status: 500 });
  }

  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;

  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');

    if (!startDateQuery || !endDateQuery) {
        return NextResponse.json({ status: 'error', message: 'Los parámetros startDate y endDate son requeridos.' }, { status: 400 });
    }

  // 1. Entender la petición del usuario como un día en Lima.
  // NOTE: ya no se realiza ninguna traducción horaria; enviamos las fechas tal cual para obtener los datos en crudo.
  const startLima = startOfDay(parseISO(startDateQuery));
  const endLima = endOfDay(parseISO(endDateQuery));

  // 2. Pedir los datos directamente (sin zonificar) — la API devolverá callstart tal cual.
  const rawFlag = true; // por defecto ahora trabajamos en modo crudo
  const skipSave = searchParams.get('skipSave') === 'true' || searchParams.get('skip_save') === 'true' || searchParams.get('noSave') === 'true';
  const callsInUTC = await fetchZadarmaAPI(startLima, endLima, ZADARMA_API_KEY!, ZADARMA_API_SECRET!, true);

    // 4. Procesar y guardar los datos (que ya están en UTC).
    const finalStats = consolidateCalls(callsInUTC);
    
    if (finalStats.length > 0 && !skipSave) {
      // Guardado condicional: si la petición indicó skipSave, omitimos la persistencia.
      saveZadarmaCalls(finalStats).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
    }

    return NextResponse.json({
      status: 'success',
      stats: finalStats,
      fromCache: false, // En esta arquitectura siempre se obtienen datos frescos.
      message: 'Datos obtenidos y estandarizados a UTC.',
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS FATAL ERROR]:', error);
    return NextResponse.json({ status: 'error', message: `Error fatal del servidor: ${error.message}` }, { status: 500 });
  }
}
