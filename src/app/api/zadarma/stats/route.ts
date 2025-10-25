
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';
// CORRECCIÓN: Se importan los nombres de función correctos para la versión actual de date-fns-tz
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';
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
  apiSecret: string
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
  return (data.stats || []).map((call: any) => ({
    ...call,
    // CORRECCIÓN: Se usa fromZonedTime para interpretar la fecha de Zadarma como hora de Madrid y convertirla a un objeto Date (UTC)
    callstart: fromZonedTime(call.callstart, MADRID_TIME_ZONE).toISOString(),
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
    const startLima = startOfDay(parseISO(startDateQuery));
    const endLima = endOfDay(parseISO(endDateQuery));

    // 2. Traducir el rango de Lima a los equivalentes en hora de Madrid para la API.
    // CORRECCIÓN: Se usa toZonedTime para obtener el objeto Date cuya representación local sea la hora de Madrid
    const startMadrid = toZonedTime(startLima, MADRID_TIME_ZONE);
    const endMadrid = toZonedTime(endLima, MADRID_TIME_ZONE);
    
    // 3. Pedir los datos correctos a Zadarma.
    const callsInUTC = await fetchZadarmaAPI(startMadrid, endMadrid, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);

    // 4. Procesar y guardar los datos (que ya están en UTC).
    const finalStats = consolidateCalls(callsInUTC);
    
    if (finalStats.length > 0) {
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
