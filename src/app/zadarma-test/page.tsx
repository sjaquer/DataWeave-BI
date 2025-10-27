"use client";
import React, { useEffect, useState } from 'react';

type AnyObj = { [k: string]: any };

export default function ZadarmaTestPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AnyObj[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Construir fecha de hoy en formato YYYY-MM-DD (Lima local date)
        const today = new Date();
        // Obtener la fecha local de Lima: como simplificación usamos la fecha local del sistema
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const isoDay = `${yyyy}-${mm}-${dd}`;

        const url = `/api/zadarma/stats?startDate=${isoDay}&endDate=${isoDay}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Error HTTP: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (data.status === 'error') throw new Error(data.message || 'Error desde la API');
        setRows(data.stats || []);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Cuadro Test Zadarma — Hoy</h1>
      <p>Esto consulta <code>/api/zadarma/stats?startDate=YYYY-MM-DD&amp;endDate=YYYY-MM-DD</code> y muestra todos los campos recibidos.</p>

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
                  <th style={thStyle}>callstart (UTC)</th>
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
