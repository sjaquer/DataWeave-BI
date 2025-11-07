import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader, Clock, CheckCircle, AlertCircle, Database } from 'lucide-react';
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

export function BackfillProgress({ startDate, endDate, onComplete, onError }: BackfillProgressProps) {
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Formatear tiempo en formato MM:SS
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Iniciar backfill
  const startBackfill = async () => {
    try {
      const response = await fetch('/api/zadarma/backfill-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate })
      });

      const data = await response.json();
      
      if (data.status === 'started') {
        setSessionId(data.sessionId);
        setIsPolling(true);
      } else {
        throw new Error(data.message || 'Error iniciando backfill');
      }
    } catch (error: any) {
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

        if (data.status === 'completed') {
          setIsPolling(false);
          setTimeout(() => onComplete(), 2000);
        } else if (data.status === 'error') {
          setIsPolling(false);
          onError(data.error || 'Error durante el backfill');
        }
      } else {
        console.warn('[BACKFILL-PROGRESS] Sesión no encontrada o error');
      }
    } catch (error: any) {
      console.error('[BACKFILL-PROGRESS] Error en polling:', error);
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
          <div className="flex items-center gap-3">
            <Loader className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <p className="font-medium text-blue-800">Iniciando carga de datos históricos</p>
              <p className="text-sm text-blue-600">Preparando backfill...</p>
            </div>
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
              <p className={`text-sm ${getTextColor()} opacity-80`}>
                {progressData.message}
              </p>
            </div>
          </div>

          {/* Barra de progreso */}
          {progressData.status !== 'error' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className={`${getTextColor()} opacity-80`}>
                  {progressData.processedDays} de {progressData.totalDays} días procesados
                </span>
                <span className={`${getTextColor()} opacity-80`}>
                  {Math.round(progressData.progress)}%
                </span>
              </div>
              <Progress 
                value={progressData.progress} 
                className="h-3"
              />
            </div>
          )}

          {/* Estadísticas y tiempo restante */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">{progressData.callsSaved.toLocaleString()}</p>
                <p className="text-xs opacity-70">Llamadas guardadas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium">{progressData.totalCalls.toLocaleString()}</p>
                <p className="text-xs opacity-70">Total obtenidas</p>
              </div>
            </div>

            {progressData.currentDay && (
              <div>
                <p className="font-medium">{progressData.currentDay}</p>
                <p className="text-xs opacity-70">Día actual</p>
              </div>
            )}

            {progressData.status === 'in_progress' && progressData.estimatedTimeRemaining > 0 && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="font-medium">{formatTime(progressData.estimatedTimeRemaining)}</p>
                  <p className="text-xs opacity-70">Tiempo estimado</p>
                </div>
              </div>
            )}

            {progressData.status === 'completed' && progressData.totalTime && (
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="font-medium">{formatTime(progressData.totalTime)}</p>
                  <p className="text-xs opacity-70">Tiempo total</p>
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