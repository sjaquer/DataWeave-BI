
import { NextResponse, NextRequest } from 'next/server';
import { format, startOfDay, addDays, getHours, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import {
  getZadarmaCallsFromFirestore,
  consolidateCalls,
  validateZadarmaCredentials,
  updateZadarmaCallsInFirestore,
} from '@/lib/zadarma-helpers';

const LIMA_TIME_ZONE = 'America/Lima';
const RESYNC_THRESHOLD_HOUR = 23; // 11 PM Lima time, a safe threshold for end-of-day.

dotenv.config();

async function fetchZadarmaAPI(
  utcStart: Date,
  utcEnd: Date,
  apiKey: string,
  apiSecret: string
): Promise<any[]> {
  const formattedStartDate = format(utcStart, 'yyyy-MM-dd HH:mm:ss');
  const formattedEndDate = format(utcEnd, 'yyyy-MM-dd HH:mm:ss');
  
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

  if (!response.ok) {
      throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(`Error de API de Zadarma: ${data.message}`);
  }
  return data.stats || [];
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

    // --- CORE TIMEZONE FIX ---
    // The dates from the query ("2025-10-23") represent days in Lima.
    const startLimaDate = parseISO(startDateQuery);
    const endLimaDate = parseISO(endDateQuery);
    
    const todayInLima = startOfDay(toZonedTime(new Date(), LIMA_TIME_ZONE));
    
    let allCalls: any[] = [];
    let fromCache: boolean | 'mixed' = false;
    let message = '';

    let currentDate = startLimaDate;
    while (currentDate <= endLimaDate) {
      const dayToFetch = currentDate; // This is a date object representing the Lima day, e.g., 2025-10-23T00:00:00.000Z

      if (dayToFetch < todayInLima) {
        // --- PAST DAY: Use Cache + Auto-Healing ---
        if (!fromCache) fromCache = true;
        
        let callsForDay = await getZadarmaCallsFromFirestore(dayToFetch, dayToFetch);
        
        const lastCall = callsForDay.length > 0 ? callsForDay.reduce((max, call) => new Date(call.callstart) > new Date(max.callstart) ? call : max) : null;
        const lastCallHourInLima = lastCall ? getHours(toZonedTime(new Date(lastCall.callstart), LIMA_TIME_ZONE)) : -1;

        if (lastCallHourInLima < RESYNC_THRESHOLD_HOUR) {
          message += `Caché para ${format(dayToFetch, 'dd/MM')} incompleto. Resincronizando... `;
          
          const startOfLimaDay = toZonedTime(`${format(dayToFetch, 'yyyy-MM-dd')}T00:00:00`, LIMA_TIME_ZONE);
          const endOfLimaDay = toZonedTime(`${format(dayToFetch, 'yyyy-MM-dd')}T23:59:59`, LIMA_TIME_ZONE);
          
          const freshCalls = await fetchZadarmaAPI(startOfLimaDay, endOfLimaDay, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
          await updateZadarmaCallsInFirestore(freshCalls, dayToFetch);
          callsForDay = freshCalls;
        }
        allCalls.push(...callsForDay);

      } else {
        // --- TODAY: Fetch directly from API ---
        if (fromCache) fromCache = 'mixed'; else fromCache = false;
        
        const startOfTodayLima = toZonedTime(`${format(dayToFetch, 'yyyy-MM-dd')}T00:00:00`, LIMA_TIME_ZONE);
        const nowInLima = toZonedTime(new Date(), LIMA_TIME_ZONE);
        
        const todayCalls = await fetchZadarmaAPI(startOfTodayLima, nowInLima, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        allCalls.push(...todayCalls);
        message = 'Datos de hoy obtenidos de la API en tiempo real. ';
      }
      
      currentDate = addDays(currentDate, 1);
    }
    
    const finalStats = consolidateCalls(allCalls);

    return NextResponse.json({
      status: 'success',
      stats: finalStats,
      fromCache,
      message,
    });

  } catch (error: any) {
    console.error('[ZADARMA STATS FATAL ERROR]:', error);
    return NextResponse.json({ status: 'error', message: `Error fatal del servidor: ${error.message}` }, { status: 500 });
  }
}
