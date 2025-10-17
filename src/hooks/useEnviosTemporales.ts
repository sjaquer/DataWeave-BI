/**
 * Hook para consumir datos de envíos temporales
 * Obtiene estadísticas en tiempo real del webhook GET /api/webhooks/envios-temporales
 */

import { useState, useEffect } from 'react';

// Tipos basados en la respuesta del webhook
export interface EnviosTemporalesStats {
  status: string;
  totalActivos: number;
  porTipoOrigen: {
    PROVINCIA: number;
    LIMA: number;
  };
  porEstado: Record<string, number>;
  estadosPorOrigen?: {
    PROVINCIA: Record<string, number>;
    LIMA: Record<string, number>;
  };
  porTienda: Record<string, number>;
  porProvincia: Record<string, number>;
  porCourier: Record<string, number>;
  timestamp: string;
}

interface UseEnviosTemporalesResult {
  data: EnviosTemporalesStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useEnviosTemporales(autoRefresh = false, refreshInterval = 30000): UseEnviosTemporalesResult {
  const [data, setData] = useState<EnviosTemporalesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/webhooks/envios-temporales');
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Error desconocido');
      }

      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos';
      setError(errorMessage);
      console.error('[useEnviosTemporales] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh si está habilitado
    if (autoRefresh) {
      const intervalId = setInterval(fetchData, refreshInterval);
      return () => clearInterval(intervalId);
    }
  }, [autoRefresh, refreshInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
