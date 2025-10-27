"use client";
import React, { useEffect, useState, useRef } from 'react';

type AnyObj = { [k: string]: any };

export default function ZadarmaTestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyObj[]>([]);
  const [skipSave, setSkipSave] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [lastRequestAt, setLastRequestAt] = useState<number>(0);
  const [queued, setQueued] = useState<boolean>(false);
  const [nextAllowedSeconds, setNextAllowedSeconds] = useState<number>(0);
  const cooldownSeconds = 6; // 10 requests per minute => 1 request cada 6s
  const cacheTtlSeconds = 60; // cache en sessionStorage por 60s
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Helper: sleep
  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  // Attempt fetch with retries and backoff; respects 429 Retry-After when present
  async function attemptFetch(url: string, maxRetries = 3) {
    let attempt = 0;
    let lastErr: any = null;
    while (attempt <= maxRetries) {
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          // Respect Retry-After if provided
          const ra = res.headers.get('Retry-After');
          const waitMs = ra ? Number(ra) * 1000 : Math.pow(2, attempt) * 1000;
          await sleep(waitMs);
          attempt++;
          continue;
        }
        if (!res.ok) throw new Error(`Error HTTP: ${res.status} ${res.statusText}`);
        const data = await res.json();
        return data;
      } catch (err: any) {
        lastErr = err;
        // Exponential backoff before retry
        const backoff = Math.pow(2, attempt) * 1000;
        await sleep(backoff);
        attempt++;
      }
    }
    throw lastErr;
  }

  async function load() {
    if (!isMounted.current) return;
    // cooldown / rate-limit guard
    const now = Date.now();
    const earliest = lastRequestAt + cooldownSeconds * 1000;
    if (now < earliest) {
      setQueued(true);
      setNextAllowedSeconds(Math.ceil((earliest - now) / 1000));
      // schedule actual run when allowed
      const delay = earliest - now + 50;
      setTimeout(() => {
        setQueued(false);
        setNextAllowedSeconds(0);
        // increment reloadKey to trigger effect or call load directly
        setReloadKey(k => k + 1);
      }, delay);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Construir fecha de hoy en formato YYYY-MM-DD (Lima local date)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const isoDay = `${yyyy}-${mm}-${dd}`;

      // Caching key simplificado
      const cacheKey = `zadarma_${isoDay}_${skipSave ? 'nosave' : 'save'}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.ts && (Date.now() - parsed.ts) / 1000 < cacheTtlSeconds) {
            setRows(parsed.data || []);
            setLastRequestAt(Date.now());
            console.log(`[CACHE] Datos cargados desde caché de sesión: ${parsed.data?.length || 0} registros`);
            return;
          }
        } catch (e) { /* ignore cache parse errors */ }
      }

      // Construir URL (raw mode ahora es por defecto en el backend)
      const params = new URLSearchParams({ startDate: isoDay, endDate: isoDay });
      if (skipSave) params.set('skipSave', 'true');
      const url = `/api/zadarma/stats?${params.toString()}`;

      const data = await attemptFetch(url, 3);
      if (data.status === 'error') throw new Error(data.message || 'Error desde la API');

      setRows(data.stats || []);
      // Guardar en caché con información del origen
      try { 
        sessionStorage.setItem(cacheKey, JSON.stringify({ 
          ts: Date.now(), 
          data: data.stats || [],
          fromCache: data.fromCache,
          message: data.message
        })); 
        console.log(`[CACHE] ${data.message || 'Datos obtenidos'} - ${data.stats?.length || 0} registros`);
      } catch(e) {}
      setLastRequestAt(Date.now());
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }

  // run load on mount and when reloadKey changes
  useEffect(() => { load(); }, [reloadKey]);
  // run when toggles change, but guard by triggering reloadKey (so cooldown logic centralizes)
  useEffect(() => { setReloadKey(k => k + 1); }, [skipSave]);

  return (
    <div style={{ padding: 24 }}>
      <h1>Cuadro Test Zadarma — Hoy</h1>
      <p>Esto consulta <code>/api/zadarma/stats?startDate=YYYY-MM-DD&amp;endDate=YYYY-MM-DD</code> y muestra todos los campos recibidos.</p>

      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 12 }}>
          <input type="checkbox" checked={skipSave} onChange={e => setSkipSave(e.target.checked)} />{' '}
          Evitar guardar en BD (skipSave)
        </label>
        <button onClick={() => setReloadKey(k => k + 1)} style={{ marginLeft: 8 }}>Recargar</button>

        <div style={{ display: 'inline-block', marginLeft: 16, verticalAlign: 'middle', color: '#444' }}>
          <div style={{ fontSize: 12 }}>Cooldown: {cooldownSeconds}s entre peticiones (máx 10/min)</div>
          {lastRequestAt ? <div style={{ fontSize: 12 }}>Última petición: {new Date(lastRequestAt).toLocaleTimeString()}</div> : null}
          {queued ? <div style={{ fontSize: 12, color: '#b35' }}>En cola. Próxima en {nextAllowedSeconds}s</div> : null}
        </div>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <pre style={{ color: 'crimson' }}>{error}</pre>}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, minWidth: 160 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Total llamadas</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{rows.length}</div>
            </div>

            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, minWidth: 220 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Llamadas respondidas</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{rows.filter(r => r.disposition === 'answered').length}</div>
            </div>

            <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 6, minWidth: 220 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Duración total (segundos)</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{rows.reduce((s, r) => s + (Number(r.seconds) || 0), 0)}</div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>callstart (raw)</th>
                  <th style={thStyle}>all fields (JSON)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={i % 2 ? { background: '#fafafa' } : undefined}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{r.callstart}</td>
                    <td style={tdStyle}>
                      <details>
                        <summary>Ver objeto (expandir)</summary>
                        <pre style={{ maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(r, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Campos únicos encontrados</h2>
          <PreUniqueFields rows={rows} />
        </>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  background: '#f0f0f0'
};
const tdStyle: React.CSSProperties = {
  border: '1px solid #eee',
  padding: '8px',
  verticalAlign: 'top',
};

function PreUniqueFields({ rows }: { rows: AnyObj[] }) {
  const allKeys = new Set<string>();
  rows.forEach(r => Object.keys(r || {}).forEach(k => allKeys.add(k)));
  const keys = Array.from(allKeys).sort();
  return (
    <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Campo</th>
            <th style={thStyle}>Ejemplo (primer valor no nulo)</th>
          </tr>
        </thead>
        <tbody>
          {keys.map(k => (
            <tr key={k}>
              <td style={tdStyle}>{k}</td>
              <td style={tdStyle}>{String(findFirstNonNull(rows, k) ?? '')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function findFirstNonNull(rows: AnyObj[], key: string) {
  for (const r of rows) {
    if (r && Object.prototype.hasOwnProperty.call(r, key) && r[key] != null) return r[key];
  }
  return null;
}
