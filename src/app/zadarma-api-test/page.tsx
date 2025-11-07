"use client";
import React, { useState } from 'react';

type CallStat = { [k: string]: any };

export default function ZadarmaAPITestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<CallStat[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [message, setMessage] = useState<string>('');
  
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [source, setSource] = useState<'firestore' | 'api'>('firestore');

  async function fetchData() {
    setLoading(true);
    setError(null);
    setStats([]);
    setMetadata(null);
    setMessage('');

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        source
      });

      console.log(`🚀 Consultando: /api/zadarma/stats?${params.toString()}`);
      
      const response = await fetch(`/api/zadarma/stats?${params.toString()}`);
      const data = await response.json();

      if (data.status === 'error') {
        throw new Error(data.message || 'Error desconocido');
      }

      setStats(data.stats || []);
      setMetadata(data.metadata || null);
      setMessage(data.message || '');
      
      console.log('✅ Datos recibidos:', {
        total: data.stats?.length || 0,
        source: data.metadata?.dataSource,
        fromCache: data.fromCache
      });

    } catch (err: any) {
      console.error('❌ Error:', err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <h1>🧪 Test de API Zadarma - Firestore vs API Directa</h1>
      
      <div style={{ 
        background: '#f0f9ff', 
        border: '2px solid #3b82f6', 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 24 
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#1e40af' }}>ℹ️ Información</h3>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li><strong>Firestore</strong>: Lectura rápida desde caché (200-500ms). Datos poblados por webhook + backfill.</li>
          <li><strong>API Directa</strong>: Consulta directa a Zadarma con paginación automática y reintentos. Más lento pero datos frescos.</li>
        </ul>
      </div>

      <div style={{ 
        background: '#fff', 
        border: '1px solid #ddd', 
        borderRadius: 8, 
        padding: 20, 
        marginBottom: 24 
      }}>
        <h3 style={{ marginTop: 0 }}>Configuración</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
              Fecha inicio:
            </label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ 
                width: '100%', 
                padding: 8, 
                border: '1px solid #ccc', 
                borderRadius: 4 
              }}
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>
              Fecha fin:
            </label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ 
                width: '100%', 
                padding: 8, 
                border: '1px solid #ccc', 
                borderRadius: 4 
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
            Fuente de datos:
          </label>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ cursor: 'pointer' }}>
              <input 
                type="radio" 
                value="firestore"
                checked={source === 'firestore'}
                onChange={(e) => setSource(e.target.value as 'firestore')}
              />
              {' '}🔥 Firestore (rápido)
            </label>
            <label style={{ cursor: 'pointer' }}>
              <input 
                type="radio" 
                value="api"
                checked={source === 'api'}
                onChange={(e) => setSource(e.target.value as 'api')}
              />
              {' '}🌐 API Zadarma (directo)
            </label>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          style={{ 
            padding: '12px 24px',
            background: loading ? '#ccc' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.background = '#2563eb';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.background = '#3b82f6';
          }}
        >
          {loading ? '⏳ Cargando...' : '🚀 Obtener Datos'}
        </button>
      </div>

      {error && (
        <div style={{ 
          background: '#fee2e2', 
          border: '2px solid #ef4444', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 24 
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#991b1b' }}>❌ Error</h3>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#7f1d1d' }}>{error}</pre>
        </div>
      )}

      {message && !error && (
        <div style={{ 
          background: '#d1fae5', 
          border: '2px solid #10b981', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 24 
        }}>
          <p style={{ margin: 0, color: '#065f46', fontWeight: 600 }}>✅ {message}</p>
        </div>
      )}

      {metadata && (
        <div style={{ 
          background: '#fff', 
          border: '1px solid #ddd', 
          borderRadius: 8, 
          padding: 20, 
          marginBottom: 24 
        }}>
          <h3 style={{ marginTop: 0 }}>📊 Metadatos</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Total de llamadas</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{metadata.totalCalls}</div>
            </div>

            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Llamadas salientes</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{metadata.callTypes?.outbound || 0}</div>
            </div>

            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Llamadas contestadas</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>{metadata.callTypes?.answered || 0}</div>
            </div>

            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Efectividad</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>{metadata.callTypes?.effectiveness || '0%'}</div>
            </div>

            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Agentes</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#111827' }}>{metadata.agents || 0}</div>
            </div>

            <div style={{ padding: 12, background: '#f9fafb', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Fuente de datos</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#6366f1', marginTop: 8 }}>
                {metadata.dataSource === 'firestore-cache' ? '🔥 Firestore' : '🌐 API Zadarma'}
              </div>
            </div>
          </div>

          {metadata.timeRange && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Rango temporal:</div>
              <div style={{ fontSize: 14 }}>
                <strong>Primera:</strong> {metadata.timeRange.first} <br />
                <strong>Última:</strong> {metadata.timeRange.last}
              </div>
            </div>
          )}
        </div>
      )}

      {stats.length > 0 && (
        <div style={{ 
          background: '#fff', 
          border: '1px solid #ddd', 
          borderRadius: 8, 
          padding: 20 
        }}>
          <h3 style={{ marginTop: 0 }}>📞 Llamadas ({stats.length})</h3>
          
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table style={{ 
              borderCollapse: 'collapse', 
              width: '100%', 
              fontSize: 14 
            }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f9fafb' }}>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Fecha/Hora</th>
                  <th style={thStyle}>Agente</th>
                  <th style={thStyle}>De</th>
                  <th style={thStyle}>Para</th>
                  <th style={thStyle}>Duración</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Call ID</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((call, i) => (
                  <tr key={i} style={i % 2 ? { background: '#fafafa' } : {}}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{call.callstart}</td>
                    <td style={tdStyle}>{call.agentName || call.sip || 'N/A'}</td>
                    <td style={tdStyle}>{call.caller_id || call.from || 'N/A'}</td>
                    <td style={tdStyle}>{call.destination || call.to || 'N/A'}</td>
                    <td style={tdStyle}>{call.seconds || call.duration || 0}s</td>
                    <td style={tdStyle}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: 4, 
                        fontSize: 12,
                        background: call.disposition === 'answered' ? '#d1fae5' : '#fee2e2',
                        color: call.disposition === 'answered' ? '#065f46' : '#991b1b'
                      }}>
                        {call.disposition || 'unknown'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#3b82f6' }}>
                          {call.call_id?.substring(0, 8)}...
                        </summary>
                        <pre style={{ 
                          fontSize: 11, 
                          margin: '8px 0 0 0', 
                          padding: 8, 
                          background: '#f9fafb',
                          borderRadius: 4,
                          maxWidth: 300,
                          overflow: 'auto'
                        }}>
                          {JSON.stringify(call, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && stats.length === 0 && metadata && (
        <div style={{ 
          background: '#fef3c7', 
          border: '2px solid #f59e0b', 
          borderRadius: 8, 
          padding: 16, 
          textAlign: 'center' 
        }}>
          <p style={{ margin: 0, color: '#92400e', fontWeight: 600 }}>
            ⚠️ No se encontraron llamadas para el rango de fechas especificado
          </p>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  background: '#f3f4f6',
  padding: '12px 8px',
  textAlign: 'left',
  borderBottom: '2px solid #d1d5db',
  fontWeight: 600,
  fontSize: 13,
  color: '#374151'
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 13
};
