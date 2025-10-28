import { NextResponse, NextRequest } from 'next/server';
import * as dotenv from 'dotenv';
import CryptoJS from 'crypto-js';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

dotenv.config();

async function fetchZadarmaDirect(startStr: string, endStr: string, apiKey: string, apiSecret: string) {
  // startStr/endStr expected in 'yyyy-MM-dd HH:mm:ss' already in Europe/Madrid timezone
  const method = '/v1/statistics/pbx/';
  const params: any = { start: startStr, end: endStr, format: 'json', version: '2' };
  const sortedKeys = Object.keys(params).sort();
  const sortedParams = new URLSearchParams();
  sortedKeys.forEach(key => sortedParams.append(key, params[key]));
  const queryString = sortedParams.toString();

  const md5Hash = CryptoJS.MD5(queryString).toString(CryptoJS.enc.Hex);
  const dataToSign = method + queryString + md5Hash;
  const hmac = CryptoJS.HmacSHA1(dataToSign, apiSecret);
  const signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(hmac.toString(CryptoJS.enc.Hex)));
  const authHeader = `${apiKey}:${signature}`;
  const apiUrl = `https://api.zadarma.com${method}?${queryString}`;

  // Implement simple retries and respect 429 Retry-After header
  let attempt = 0;
  const maxAttempts = 4;
  while (true) {
    attempt++;
    const response = await fetch(apiUrl, { method: 'GET', headers: { 'Authorization': authHeader } });
    if (response.status === 429) {
      const ra = response.headers.get('Retry-After');
      const waitMs = ra ? Number(ra) * 1000 : Math.min(60000, Math.pow(2, attempt) * 1000);
      if (attempt >= maxAttempts) throw new Error(`Rate limited by Zadarma after ${attempt} attempts`);
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    if (!response.ok) throw new Error(`Error de red de Zadarma: ${response.status} ${response.statusText}`);
    const data = await response.json();
    if (data.status === 'error') throw new Error(`Error de API de Zadarma: ${data.message}`);
    return data.stats || [];
  }
}

export async function GET(req: NextRequest) {
  const { ZADARMA_API_KEY, ZADARMA_API_SECRET } = process.env;
  if (!ZADARMA_API_KEY || !ZADARMA_API_SECRET) {
    return NextResponse.json({ status: 'error', message: 'Credenciales Zadarma no configuradas' }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDateQuery = searchParams.get('startDate');
    const endDateQuery = searchParams.get('endDate');
    const tz = 'Europe/Madrid';

    // Default to today in Madrid if missing
    const now = new Date();
    const madridNow = formatInTimeZone(now, tz, 'yyyy-MM-dd');
    const startDay = startDateQuery || madridNow;
    const endDay = endDateQuery || startDay;

  // Build Madrid-local start/end strings; we'll send them as Madrid-local timestamps
  const startForApi = `${startDay} 00:00:00`;
  const endForApi = `${endDay} 23:59:59`;

    // Adaptive fetch: try full range, if response hits a presumed limit (e.g. 1000),
    // split the interval recursively (binary split) until chunks are below the limit
    // or a minimum window is reached. This reduces number of requests compared to
    // fixed small windows while ensuring we don't miss records hidden by a per-request cap.
    const LIMIT = 1000;
    const minWindowMinutes = 5; // don't split below 5 minutes

    const startDt = new Date(`${startDay}T00:00:00`);
    const endDt = new Date(`${endDay}T23:59:59`);

    const allStatsMap = new Map<string, any>();
    const windows: Array<{ start: string; end: string; count: number; note?: string }> = [];

    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;

    async function fetchRangeRecursive(a: Date, b: Date) {
      const s = fmt(a);
      const e = fmt(b);
      try {
  const chunk = await fetchZadarmaDirect(s, e, ZADARMA_API_KEY!, ZADARMA_API_SECRET!);
        windows.push({ start: s, end: e, count: chunk.length });
        // If chunk size looks below limit, accept it
        if (chunk.length < LIMIT) {
          for (const c of chunk) {
            const key = `${c.pbx_call_id}__${c.callstart}`;
            if (!allStatsMap.has(key)) allStatsMap.set(key, c);
          }
          return;
        }
        // If chunk hits or exceeds limit, try to split unless window is too small
        const spanMs = b.getTime() - a.getTime();
        const spanMinutes = spanMs / 60000;
        if (spanMinutes <= minWindowMinutes) {
          // window too small to split further; include what we have to avoid infinite recursion
          for (const c of chunk) {
            const key = `${c.pbx_call_id}__${c.callstart}`;
            if (!allStatsMap.has(key)) allStatsMap.set(key, c);
          }
          windows[windows.length - 1].note = 'limit_reached_small_window';
          return;
        }
  const mid = new Date(a.getTime() + Math.floor(spanMs / 2));
  // split into [a, mid] and [mid+1s, b]
  await fetchRangeRecursive(a, mid);
  await fetchRangeRecursive(new Date(mid.getTime() + 1000), b);
      } catch (err) {
        windows.push({ start: s, end: e, count: -1, note: String((err as any)?.message || err) });
      }
    }

    await fetchRangeRecursive(startDt, endDt);

    await fetchRangeRecursive(startDt, endDt);

    const stats = Array.from(allStatsMap.values()).sort((a: any, b: any) => String(a.callstart || '').localeCompare(String(b.callstart || '')));
    return NextResponse.json({ status: 'success', stats, fromCache: false, message: `Debug Spain adaptive fetched`, windows });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message || String(err) }, { status: 500 });
  }
}
