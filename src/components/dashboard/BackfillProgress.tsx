import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader, CheckCircle, AlertCircle, Database, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BackfillProgressProps {
  startDate: string;
  endDate: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

interface ProgressData {
  status: string;
  sessionId?: string;
  currentDay?: string;
  processedDays: number;
  totalDays: number;
  progress: number;
  callsSaved: number;
  totalCalls: number;
  estimatedTimeRemaining: number;
  message: string;
  error?: string;
  totalTime?: number;
}

type LogStatus = 'info' | 'success' | 'warning' | 'error';

interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  status: LogStatus;
}

export function BackfillProgress({ startDate, endDate, onComplete, onError }: BackfillProgressProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const lastMessageRef = useRef<string>('');
  const lastDayRef = useRef<string>('');
  const lastStatusRef = useRef<string>('');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const appendLog = useCallback((message: string, status: LogStatus = 'info') => {
    setLogEntries(prev => {
      const id = `${Date.now()}-${prev.length}`;
      const timestamp = new Date().toLocaleTimeString('es-PE', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      return [...prev, { id, timestamp, message, status }];
    });
  }, []);

  // Reset logs when range changes
  useEffect(() => {
    setLogEntries([]);
    lastMessageRef.current = '';
    lastDayRef.current = '';
    lastStatusRef.current = '';
  }, [startDate, endDate]);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({ top: logContainerRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [logEntries]);

  // Iniciar backfill
  const startBackfill = async () => {
    try {
      appendLog(`Solicitando backfill Zadarma para ${startDate} → ${endDate}`);

      const response = await fetch('/api/zadarma/backfill-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      const data = await response.json();
      
      if (data.status === 'started') {
        appendLog('Backfill encolado, esperando confirmación del worker...');
        setSessionId(data.sessionId);
        setIsPolling(true);
      } else if (data.status === 'already_in_progress') {
        // 🔄 Ya hay un backfill en progreso, usar esa sesión
        console.log('[BACKFILL] Ya hay proceso en progreso, usando sesión existente:', data.currentSessionId);
        appendLog('Ya existe una sesión activa, adjuntando al progreso actual.', 'warning');
        setSessionId(data.currentSessionId);
        setIsPolling(true);
      } else {
        throw new Error(data.message || 'Error iniciando backfill');
      }
    } catch (error: any) {
      appendLog(`Error al iniciar backfill: ${error.message}`, 'error');
      onError(error.message);
    }
  };

  // Polling del progreso
  const pollProgress = async (id: string) => {
    try {
      const response = await fetch(`/api/zadarma/backfill-progress?sessionId=${id}`);
      const data = await response.json();

      if (response.ok && data.status !== 'not_found') {
        setProgressData(data);

        if (data.message && data.message !== lastMessageRef.current) {
          appendLog(data.message, data.status === 'error' ? 'error' : 'info');
          lastMessageRef.current = data.message;
        }

        if (data.currentDay && data.currentDay !== lastDayRef.current) {
          appendLog(`Procesando ${data.currentDay}...`);
          lastDayRef.current = data.currentDay;
        }

        if (data.status !== lastStatusRef.current) {
          if (data.status === 'completed') {
            appendLog('Backfill finalizado correctamente.', 'success');
          } else if (data.status === 'error') {
            appendLog('Backfill reporta error, revisa detalles.', 'error');
          } else if (data.status === 'in_progress' && lastStatusRef.current !== 'in_progress') {
            appendLog('Worker confirmó inicio del procesamiento.');
          }
          lastStatusRef.current = data.status;
        }

        if (data.status === 'completed') {
          setIsPolling(false);
          setTimeout(() => onComplete(), 1500);
        } else if (data.status === 'error') {
          setIsPolling(false);
          onError(data.error || 'Error durante el backfill');
        }
      } else {
        console.warn('[BACKFILL-PROGRESS] Sesión no encontrada o error');
        appendLog('No se pudo recuperar el estado de la sesión de backfill.', 'warning');
      }
    } catch (error: any) {
      console.error('[BACKFILL-PROGRESS] Error en polling:', error);
      appendLog(`Error consultando progreso: ${error.message}`, 'warning');
    }
  };

  // Effect para iniciar backfill
  useEffect(() => {
    startBackfill();
  }, [startDate, endDate]);

  // Effect para polling
  useEffect(() => {
    if (sessionId && isPolling) {
      const interval = setInterval(() => {
        pollProgress(sessionId);
      }, 2000); // Polling cada 2 segundos

      return () => clearInterval(interval);
    }
  }, [sessionId, isPolling]);
  if (!progressData) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">Sincronización en curso</p>
              <p className="text-sm text-blue-600">Esperando la primera actualización del worker...</p>
            </div>
          </div>
          <div
            ref={logContainerRef}
            className="max-h-48 overflow-y-auto rounded-md border border-blue-200 bg-white/80 p-3 font-mono text-xs text-blue-900"
          >
            {logEntries.length === 0 ? (
              <p className="text-blue-600/80">Aún no hay mensajes...</p>
            ) : (
              logEntries.map((entry) => (
                <div key={entry.id} className="mb-1">
                  <span className="mr-2 text-blue-500">[{entry.timestamp}]</span>
                  <span>{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (progressData.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Loader className="h-5 w-5 animate-spin text-blue-600" />;
    }
  };

  const getStatusColor = () => {
    switch (progressData.status) {
      case 'completed':
        return 'border-green-200 bg-green-50';
      case 'error':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  const getTextColor = () => {
    switch (progressData.status) {
      case 'completed':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      default:
        return 'text-blue-800';
    }
  };

  return (
    <Card className={getStatusColor()}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header con icono y título */}
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div className="flex-1">
              <p className={`font-medium ${getTextColor()}`}>
                {progressData.status === 'completed' ? 'Datos históricos cargados' : 
                 progressData.status === 'error' ? 'Error cargando datos' :
                 'Cargando datos históricos'}
              </p>
            </div>
          </div>

          {/* Stream de logs */}
          <div
            ref={logContainerRef}
            className="max-h-56 overflow-y-auto rounded-md border border-blue-200/70 bg-white/90 p-3 font-mono text-xs shadow-inner"
          >
            {logEntries.length === 0 ? (
              <p className="text-blue-600/80">Esperando mensajes del worker...</p>
            ) : (
              logEntries.map((entry) => {
                const color = entry.status === 'error'
                  ? 'text-red-600'
                  : entry.status === 'success'
                    ? 'text-green-600'
                    : entry.status === 'warning'
                      ? 'text-amber-600'
                      : 'text-blue-700';
                return (
                  <div key={entry.id} className={`mb-1 ${color}`}>
                    <span className="mr-2 text-blue-500">[{entry.timestamp}]</span>
                    <span>{entry.message}</span>
                  </div>
                );
              })
            )}
          </div>

          {/* Estadísticas y tiempo restante */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">{(progressData.callsSaved || 0).toLocaleString()}</p>
                <p className="text-xs opacity-70">Llamadas guardadas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium">{(progressData.totalCalls || 0).toLocaleString()}</p>
                <p className="text-xs opacity-70">Total obtenidas</p>
              </div>
            </div>

            {progressData.currentDay && (
              <div>
                <p className="font-medium">{progressData.currentDay}</p>
                <p className="text-xs opacity-70">Día actual</p>
              </div>
            )}

            {progressData.status === 'completed' && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">{progressData.totalDays} día(s) procesados</p>
                  <p className="text-xs opacity-70">Sesión finalizada</p>
                </div>
              </div>
            )}
          </div>

          {/* Badge de estado */}
          <div className="flex justify-center">
            <Badge 
              variant={progressData.status === 'completed' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {progressData.status === 'completed' && '✅ Completado'}
              {progressData.status === 'in_progress' && '🔄 En progreso'}
              {progressData.status === 'error' && '❌ Error'}
              {progressData.status === 'starting' && '⚡ Iniciando'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}