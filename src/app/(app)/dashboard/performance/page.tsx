
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle, Calendar as CalendarIcon, ArrowDown, ArrowUp, Timer, PlayCircle, StopCircle, PhoneForwarded, PhoneOutgoing, BarChartHorizontal, Database, Percent, ChevronDown, Download, Cog, Target, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, endOfDay, differenceInCalendarDays, eachDayOfInterval, getDay } from "date-fns";
import { es } from "date-fns/locale";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toPng } from 'html-to-image';
import download from 'downloadjs';

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import agentMap from '@/lib/agents.json';
import { ScheduleManager } from "@/components/dashboard/ScheduleManager";
import { BackfillProgress } from "@/components/dashboard/BackfillProgress";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { SidebarTrigger } from "@/components/ui/sidebar";


const CALLS_PER_HOUR_TARGET = 12;

// --- Types ---
interface DaySchedule { active: boolean; start: string; end: string; }
interface Schedule { [day: string]: DaySchedule | undefined; }
interface ZadarmaCall { 
  pbx_call_id: string; 
  callstart: string; 
  sip: string; 
  destination: string | number; 
  disposition: string; 
  seconds: number; 
  // Nuevos metadatos opcionales (añadidos por consolidateCalls)
  callDate?: string;
  callTime?: string; 
  callHour?: number;
  isOutbound?: boolean;
  isAnswered?: boolean;
  durationCategory?: 'no-answer' | 'short' | 'medium' | 'long';
  agentName?: string;
  originalIndex?: number;
}
interface PerformanceMetrics { totalCalls: number; effectiveCalls: number; effectivenessRate: number; totalSeconds: number; averageCallDuration: number; }
interface ActivityMetrics { firstCallTime: string | null; lastCallTime: string | null; }
interface AdvisorPerformance extends PerformanceMetrics, ActivityMetrics { id: string; name: string; callTarget?: number; compliance?: number; scheduledHours?: number; actualHours?: number; }
interface DailyPerformanceData { [agentId: string]: { [date: string]: PerformanceMetrics & ActivityMetrics & { callTarget?: number; compliance?: number; scheduledHours?: number; actualHours?: number; }; }; }
type SortConfig = { key: keyof AdvisorPerformance; direction: 'ascending' | 'descending'; };

const dayMapping = [ "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday" ];

const defaultSchedule: Schedule = {
  monday: { active: true, start: '09:00', end: '18:00' },
  tuesday: { active: true, start: '09:00', end: '18:00' },
  wednesday: { active: true, start: '09:00', end: '18:00' },
  thursday: { active: true, start: '09:00', end: '18:00' },
  friday: { active: true, start: '09:00', end: '18:00' },
  saturday: { active: false, start: '09:00', end: '13:00' },
  sunday: { active: false, start: '09:00', end: '13:00' },
};

const parseTimeToMinutes = (time: string): number | null => {
  if (!time) return null;
  const parts = time.split(':').map(Number);
  if (parts.length < 2 || parts.some(isNaN)) return null;
  const [hours, minutes, seconds = 0] = parts;
  return hours * 60 + minutes + Math.floor(seconds / 60);
};

const calculateActualHoursFromTimes = (firstTime: string | null, lastTime: string | null): number => {
  if (!firstTime || !lastTime) return 0;
  const startMinutes = parseTimeToMinutes(firstTime);
  const endMinutes = parseTimeToMinutes(lastTime);
  if (startMinutes === null || endMinutes === null) return 0;
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60; // Manejar turnos que cruzan medianoche
  return Math.max(0, diff / 60);
};

const computeCompliancePercentage = (actualHours: number, scheduledHours: number): number | undefined => {
  if (!scheduledHours || scheduledHours <= 0) return undefined;
  const ratio = actualHours / scheduledHours;
  return Math.max(0, Math.min(100, Number((ratio * 100).toFixed(1))));
};

const calculateHoursForDay = (schedule: Schedule, date: Date): number => {
  const dayName = dayMapping[getDay(date)];
  const daySchedule = schedule[dayName];
  if (!daySchedule || !daySchedule.active) return 0;

  const startMinutes = parseTimeToMinutes(daySchedule.start);
  const endMinutes = parseTimeToMinutes(daySchedule.end);
  if (startMinutes === null || endMinutes === null) return 0;

  let diff = endMinutes - startMinutes;
  if (diff <= 0) diff += 24 * 60; // Manejar horarios que cruzan medianoche

  return diff / 60;
};

export default function AdvisorPerformancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<AdvisorPerformance[]>([]);
  const [dailyPerformanceData, setDailyPerformanceData] = useState<DailyPerformanceData>({});
  const [openAdvisorId, setOpenAdvisorId] = useState<string | null>(null);
  const [isScheduleManagerOpen, setIsScheduleManagerOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'totalCalls', direction: 'descending' });
  const [date, setDate] = useState<DateRange | undefined>({ from: new Date(), to: new Date() });
  const [tempDate, setTempDate] = useState<DateRange | undefined>(date);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const agentIds = useMemo(() => Object.keys(agentMap), []);
  
  // Estado para backfill automático con progreso
  const [showBackfillProgress, setShowBackfillProgress] = useState(false);
  const [backfillDates, setBackfillDates] = useState<{ start: string; end: string } | null>(null);
  const [isBackfillInProgress, setIsBackfillInProgress] = useState(false);
  
  // Estados para auto-refresh
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const showDailyBreakdown = useMemo(() => (date?.from && date.to) ? differenceInCalendarDays(date.to, date.from) >= 0 : false, [date]);

  const loadSchedules = useCallback(async () => {
    try {
      const scheduleEntries = await Promise.all(agentIds.map(async (id) => {
        try {
          const response = await fetch(`/api/schedules/${id}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          return [id, { ...defaultSchedule, ...data }] as [string, Schedule];
        } catch (error) {
          console.warn(`[SCHEDULE] No se pudo cargar horario para ${id}, usando por defecto.`, error);
          return [id, defaultSchedule] as [string, Schedule];
        }
      }));

      const scheduleMap: Record<string, Schedule> = {};
      scheduleEntries.forEach(([id, schedule]) => {
        scheduleMap[id] = schedule;
      });
      setSchedules(scheduleMap);
    } catch (error) {
      console.error('[SCHEDULE] Error cargando horarios:', error);
    }
  }, [agentIds]);

  useEffect(() => {
    if (!isScheduleManagerOpen) {
      loadSchedules();
    }
  }, [isScheduleManagerOpen, loadSchedules]);

  const getScheduleForAgent = useCallback((agentId: string): Schedule => {
    return schedules[agentId] ?? defaultSchedule;
  }, [schedules]);

  const calculateScheduledHoursForRange = useCallback((agentId: string, from: Date, to: Date) => {
    const schedule = getScheduleForAgent(agentId);
    const normalizedStart = startOfDay(from);
    const normalizedEnd = startOfDay(to);
    const intervalDays = eachDayOfInterval({ start: normalizedStart, end: normalizedEnd });
    return intervalDays.reduce((total, day) => total + calculateHoursForDay(schedule, day), 0);
  }, [getScheduleForAgent]);

  // Función para verificar y rellenar datos faltantes EN BACKGROUND (no bloquea UI)
  const checkAndBackfillMissingDataInBackground = useCallback(async (startDate: Date, endDate: Date): Promise<void> => {
    try {
      // ⚠️ PREVENIR MÚLTIPLES EJECUCIONES
      if (isBackfillInProgress) {
        console.log('[PERFORMANCE] 🔄 Backfill ya está en progreso, saltando nueva verificación');
        return;
      }
      
      // Comprobar siempre si faltan días, incluyendo HOY. El comportamiento anterior
      // omitía HOY para evitar solaparse con el auto-refresh, pero ahora queremos
      // verificar siempre y dejar que la lógica de backfill/locks maneje concurrencia.
      const today = format(new Date(), 'yyyy-MM-dd');
      const startDateStr = format(startDate, 'yyyy-MM-dd');
      const endDateStr = format(endDate, 'yyyy-MM-dd');
      
      // Verificar qué días faltan en Firestore (solo para días anteriores)
      const response = await fetch('/api/zadarma/check-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startDate: startDateStr, 
          endDate: endDateStr
        })
      });
      
      const checkData = await response.json();
      const missingDays = checkData.missingDays || [];
      
      if (missingDays.length === 0) {
        console.log('[PERFORMANCE] ✅ Todos los datos están completos');
        return;
      }
      
      console.log('[PERFORMANCE] 🔧 Datos faltantes detectados en background:', missingDays);
      
      // Marcar que backfill está en progreso
      setIsBackfillInProgress(true);
      
      // Mostrar componente de progreso con backfill automático solo para días faltantes
      setBackfillDates({
        start: missingDays[0], // Primer día faltante
        end: missingDays[missingDays.length - 1] // Último día faltante
      });
      setShowBackfillProgress(true);
      
    } catch (error) {
      console.error('[PERFORMANCE] ❌ Error verificando datos faltantes en background:', error);
      // No mostrar error al usuario, esto es verificación en background
    }
  }, [isBackfillInProgress]);

  // Función para procesar datos de llamadas
  const processCallsData = useCallback((calls: any[]) => {
    // Procesar llamadas y agrupar por agente
    const performanceByAgent: { [k: string]: AdvisorPerformance } = {};
    const dailyPerformance: DailyPerformanceData = {};

    const ensureAgent = (id: string, displayName?: string) => {
      const fallbackName = displayName || (agentMap as any)[id] || (id && id !== 'unknown' ? `Ext ${id}` : 'Sin asignar');
      if (!performanceByAgent[id]) {
        performanceByAgent[id] = {
          id,
          name: fallbackName,
          totalCalls: 0,
          effectiveCalls: 0,
          effectivenessRate: 0,
          totalSeconds: 0,
          averageCallDuration: 0,
          firstCallTime: null,
          lastCallTime: null,
          compliance: undefined,
          callTarget: undefined
        };
      } else if (displayName && performanceByAgent[id].name === `Ext ${id}`) {
        performanceByAgent[id].name = displayName;
      }

      if (!dailyPerformance[id]) {
        dailyPerformance[id] = {};
      }
    };

    Object.keys(agentMap).forEach(id => ensureAgent(id, (agentMap as any)[id]));

    // Procesar cada llamada
    calls.forEach((call: any) => {
      const agentId = call.sip || call.agentId || 'unknown';
      const agentDisplayName = call.agentName || (agentMap as any)[agentId] || (agentId === 'unknown' ? 'Sin asignar' : `Ext ${agentId}`);

      ensureAgent(agentId, agentDisplayName);
      performanceByAgent[agentId].name = agentDisplayName;

      const isEffective = call.disposition === 'answered' && (call.seconds || 0) > 0;
      const callDate = call.callDate || call.callstart?.substring(0, 10) || format(new Date(), 'yyyy-MM-dd');
      const callTime = call.callstart?.substring(11, 19) || '';

      // Actualizar totales del agente
      performanceByAgent[agentId].totalCalls++;
      if (isEffective) performanceByAgent[agentId].effectiveCalls++;
      performanceByAgent[agentId].totalSeconds += (call.seconds || 0);

      // Actualizar horarios de primera y última llamada
      if (!performanceByAgent[agentId].firstCallTime || callTime < performanceByAgent[agentId].firstCallTime!) {
        performanceByAgent[agentId].firstCallTime = callTime;
      }
      if (!performanceByAgent[agentId].lastCallTime || callTime > performanceByAgent[agentId].lastCallTime!) {
        performanceByAgent[agentId].lastCallTime = callTime;
      }

      // Actualizar datos diarios
      if (!dailyPerformance[agentId][callDate]) {
        dailyPerformance[agentId][callDate] = {
          totalCalls: 0,
          effectiveCalls: 0,
          effectivenessRate: 0,
          totalSeconds: 0,
          averageCallDuration: 0,
          firstCallTime: null,
          lastCallTime: null
        };
      }

      const dayData = dailyPerformance[agentId][callDate];
      dayData.totalCalls++;
      if (isEffective) dayData.effectiveCalls++;
      dayData.totalSeconds += (call.seconds || 0);

      if (!dayData.firstCallTime || callTime < dayData.firstCallTime) {
        dayData.firstCallTime = callTime;
      }
      if (!dayData.lastCallTime || callTime > dayData.lastCallTime) {
        dayData.lastCallTime = callTime;
      }
    });

    // Calcular métricas finales y cumplimiento con base en horarios
    const rangeStart = date?.from ?? new Date();
    const rangeEnd = date?.to ?? rangeStart;

    Object.values(performanceByAgent).forEach(agent => {
      agent.effectivenessRate = agent.totalCalls > 0 ? (agent.effectiveCalls / agent.totalCalls) * 100 : 0;
      agent.averageCallDuration = agent.effectiveCalls > 0 ? agent.totalSeconds / agent.effectiveCalls : 0;
    });

    Object.keys(dailyPerformance).forEach(agentId => {
      const agentSchedule = getScheduleForAgent(agentId);
      let accumulatedActualHours = 0;

      Object.entries(dailyPerformance[agentId]).forEach(([dayKey, stats]) => {
        stats.effectivenessRate = stats.totalCalls > 0 ? (stats.effectiveCalls / stats.totalCalls) * 100 : 0;
        stats.averageCallDuration = stats.effectiveCalls > 0 ? stats.totalSeconds / stats.effectiveCalls : 0;

        const scheduleDate = new Date(`${dayKey}T00:00:00`);
        const scheduledHours = calculateHoursForDay(agentSchedule, scheduleDate);
        const actualHours = calculateActualHoursFromTimes(stats.firstCallTime, stats.lastCallTime);

        stats.scheduledHours = scheduledHours;
        stats.actualHours = actualHours;
        stats.callTarget = scheduledHours * CALLS_PER_HOUR_TARGET;
        stats.compliance = computeCompliancePercentage(actualHours, scheduledHours);

        accumulatedActualHours += actualHours;
      });

      const agentStats = performanceByAgent[agentId];
      if (!agentStats) return;

      const scheduledHoursInRange = calculateScheduledHoursForRange(agentId, rangeStart, rangeEnd);
      agentStats.scheduledHours = scheduledHoursInRange;
      agentStats.actualHours = accumulatedActualHours;
      agentStats.callTarget = scheduledHoursInRange * CALLS_PER_HOUR_TARGET;
      agentStats.compliance = computeCompliancePercentage(accumulatedActualHours, scheduledHoursInRange);
    });

    return { performance: Object.values(performanceByAgent), daily: dailyPerformance };
  }, [date, calculateScheduledHoursForRange, getScheduleForAgent]);

  // Función para verificar y rellenar datos faltantes automáticamente
  const checkAndBackfillMissingData = useCallback(async (startDate: Date, endDate: Date): Promise<boolean> => {
    try {
      // Verificar qué días faltan en Firestore
      const response = await fetch('/api/zadarma/check-missing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          startDate: format(startDate, 'yyyy-MM-dd'), 
          endDate: format(endDate, 'yyyy-MM-dd') 
        })
      });
      
      const checkData = await response.json();
      const missingDays = checkData.missingDays || [];
      
      if (missingDays.length === 0) {
        console.log('[PERFORMANCE] ✅ Todos los datos están disponibles');
        return true;
      }
      
      console.log('[PERFORMANCE] 🔧 Datos faltantes detectados:', missingDays);
      
      // Mostrar componente de progreso con backfill automático
      setBackfillDates({
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd')
      });
      setShowBackfillProgress(true);
      
      return false; // Indicar que se está ejecutando backfill
      
    } catch (error) {
      console.error('[PERFORMANCE] ❌ Error verificando datos faltantes:', error);
      toast({
        title: "Error verificando datos",
        description: `No se pudo verificar datos históricos: ${error}`,
        variant: "destructive",
      });
      return true; // Continuar con datos existentes
    }
  }, [toast]);

  // Callback cuando el backfill se completa exitosamente
  const handleBackfillComplete = useCallback(() => {
    setShowBackfillProgress(false);
    setBackfillDates(null);
    setIsBackfillInProgress(false); // 🔓 Liberar bloqueo de backfill
    
    console.log('[PERFORMANCE] ✅ Backfill completado - liberando bloqueo');
    
    toast({
      title: "Datos históricos cargados",
      description: "Los datos están ahora disponibles y se han actualizado automáticamente.",
      variant: "default",
    });
    
    // La recarga se activará automáticamente cuando isBackfillInProgress se resetee
    // debido a que el useEffect de fetchAndProcessData lo detectará
  }, [toast]);

  // Callback cuando hay error en el backfill
  const handleBackfillError = useCallback((error: string) => {
    setShowBackfillProgress(false);
    setBackfillDates(null);
    setIsBackfillInProgress(false); // 🔓 Liberar bloqueo de backfill en caso de error
    
    console.log('[PERFORMANCE] ❌ Error en backfill - liberando bloqueo');
    
    toast({
      title: "Error cargando datos históricos",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  const fetchAndProcessData = useCallback(async (silent = false, isAutoRefresh = false) => {
    if (!date?.from) return;
    if (!silent) setIsLoading(true);
    setOpenAdvisorId(null);
    try {
      // 🔥 NUEVA LÓGICA: Solo usar Firestore, pero actualizar en auto-refresh si es hoy
      const today = format(new Date(), 'yyyy-MM-dd');
      const isViewingToday = format(date.from, 'yyyy-MM-dd') === today && 
                            (!date.to || format(date.to, 'yyyy-MM-dd') === today);
      
      let endpoint = '/api/zadarma/calls'; // Siempre leer desde Firestore
      let params: URLSearchParams;
      
      let calls: any[] = [];
      
      // 🔥 CRÍTICO: Si estamos viendo HOY, mostrar Firestore INMEDIATAMENTE y actualizar en background
      if (isViewingToday) {
        console.log('[PERFORMANCE] 🔥 DÍA DE HOY - mostrando Firestore y actualizando en background...');
        
        // 1️⃣ PRIMERO: Cargar datos existentes de Firestore INMEDIATAMENTE
        const firestoreParams = new URLSearchParams({ 
          startDate: format(date.from, 'yyyy-MM-dd'), 
          endDate: format(date.to || date.from, 'yyyy-MM-dd')
        });
        
        console.log(`[PERFORMANCE] ⚡ Cargando Firestore para mostrar inmediatamente...`);
        const firestoreResponse = await fetch(`/api/zadarma/calls?${firestoreParams.toString()}`);
        const firestoreData = await firestoreResponse.json();
        calls = firestoreData.calls || [];
        console.log(`[PERFORMANCE] ✅ Firestore cargado: ${calls.length} llamadas (mostrando AHORA)`);
        
        // 2️⃣ SEGUNDO: Solo si es auto-refresh, actualizar desde API en BACKGROUND
        if (isAutoRefresh) {
          setTimeout(async () => {
            console.log('[PERFORMANCE] 🔄 Actualizando desde API Zadarma (auto-refresh)...');
            
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const now = new Date();
            
            const refreshParams = new URLSearchParams({ 
              startDate: format(todayStart, 'yyyy-MM-dd HH:mm:ss'),
              endDate: format(now, 'yyyy-MM-dd HH:mm:ss')
            });
            
            try {
              const statsResponse = await fetch(`/api/zadarma/stats?${refreshParams.toString()}`);
              const statsData = await statsResponse.json();

              if (statsData.status === 'success' || statsData.status === 'partial') {
                const freshCalls = statsData.stats || [];
                const saved = typeof statsData.savedTotal === 'number'
                  ? statsData.savedTotal
                  : (statsData.count ?? freshCalls.length);
                console.log(`[PERFORMANCE] ✅ Background API completada - ${freshCalls.length} llamadas, guardadas: ${saved}`);

                if (Array.isArray(statsData.lockedDays) && statsData.lockedDays.length > 0) {
                  console.log('[PERFORMANCE] ⏳ Sync bloqueada para:', statsData.lockedDays.join(', '));
                }
                if (Array.isArray(statsData.errors) && statsData.errors.length > 0) {
                  console.warn('[PERFORMANCE] ⚠️ Problemas en background:', statsData.errors);
                }

                // 🔄 Actualizar UI con datos frescos
                const processedData = processCallsData(freshCalls);
                setPerformanceData(processedData.performance);
                setDailyPerformanceData(processedData.daily);
                console.log('[PERFORMANCE] 🎯 UI actualizada con datos frescos de API');
              } else {
                console.warn('[PERFORMANCE] ⚠️ Background API respondió con estado:', statsData.status, statsData.message);
              }
            } catch (error) {
              console.warn('[PERFORMANCE] ⚠️ Error en background update:', error);
            }
          }, 100);
        } else {
          console.log('[PERFORMANCE] 🚫 NO es auto-refresh - omitiendo actualización API background');
        }
      } else {
        // Para días anteriores, consultar desde Firestore
        params = new URLSearchParams({ 
          startDate: format(date.from, 'yyyy-MM-dd'), 
          endDate: format(date.to || date.from, 'yyyy-MM-dd')
        });
        
        console.log(`[PERFORMANCE] 📊 Consultando Firestore: ${format(date.from, 'yyyy-MM-dd')} → ${format(date.to || date.from, 'yyyy-MM-dd')}`);
        
        const response = await fetch(`${endpoint}?${params.toString()}`);
        const data = await response.json();

        if (data.status === 'error') {
          throw new Error(data.message || 'Error al obtener datos');
        }

        calls = data.calls || [];
        console.log('[PERFORMANCE] Datos recibidos desde Firestore:', calls.length, 'llamadas');
      }

      // 🔄 PROCESAR DATOS EXISTENTES INMEDIATAMENTE
      const processedData = processCallsData(calls);
      setPerformanceData(processedData.performance);
      setDailyPerformanceData(processedData.daily);
      
      if (!silent) setIsLoading(false);

      // VERIFICACIÓN EN PARALELO: Si no es auto-refresh y no es consulta silenciosa, verificar datos faltantes
      // Ejecutar esta verificación SOLO cuando NO estamos viendo HOY. Esto garantiza que al
      // visualizar días anteriores (ej. ayer) no se lancen auto-refreshes o backfills que
      // modifiquen Firestore cada 60s y cambien la vista del usuario inesperadamente.
      if (!isAutoRefresh && !silent && date.from && !isViewingToday) {
        // Ejecutar en paralelo sin bloquear la UI
        setTimeout(async () => {
          if (date.from) {
            await checkAndBackfillMissingDataInBackground(date.from, date.to || date.from);
          }
        }, 500);
      }

      // Mostrar solo mensaje genérico (silent = sin toast si es auto-refresh)
      if (!silent) {
        toast({ title: "Datos Cargados" });
      }
    } catch (error: any) {
      if (!silent) {
        toast({ variant: "destructive", title: "Error de Conexión", description: error.message });
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [date, checkAndBackfillMissingDataInBackground, processCallsData, toast]);
  
  
  // Auto-refresh cada 60 segundos SOLO para el día actual Y cuando no hay backfill en progreso
  useEffect(() => {
    const isToday = date?.from && date.to && 
      format(date.from, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') &&
      format(date.to, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    
    // 🛑 PAUSAR AUTO-REFRESH cuando:
    // 1. No es el día actual
    // 2. Auto-refresh deshabilitado manualmente
    // 3. Hay backfill en progreso (para evitar competencia de requests)
    if (!isToday || !autoRefreshEnabled || isBackfillInProgress) {
      setCountdown(60);
      if (isBackfillInProgress) {
        console.log('[AUTO-REFRESH] ⏸️  Pausado - backfill en progreso');
      } else if (!isToday) {
        console.log('[AUTO-REFRESH] ⏸️  Pausado - no es día actual');
      }
      return;
    }
    
    console.log('[AUTO-REFRESH] ✅ Activado para el día actual (60s)');
    
    // Interval para actualizar datos cada 60s
    const refreshInterval = setInterval(() => {
      // Verificar nuevamente antes de hacer refresh (por si cambió isBackfillInProgress)
      if (!isBackfillInProgress) {
        console.log('[AUTO-REFRESH] 🔄 Actualizando datos...');
        fetchAndProcessData(false, true); // Con toast visible Y marcado como auto-refresh
        setCountdown(60); // Reiniciar countdown
      } else {
        console.log('[AUTO-REFRESH] ⏸️  Saltando refresh - backfill en progreso');
      }
    }, 60000);
    
    // Interval para countdown cada segundo
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      console.log('[AUTO-REFRESH] Desactivado');
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [date, autoRefreshEnabled, isBackfillInProgress, fetchAndProcessData]);
  
  useEffect(() => { fetchAndProcessData(); }, [fetchAndProcessData]);

  // Forzar sincronización manual del rango visualizado usando la API directa de Zadarma
  const handleForceSyncSelection = useCallback(async () => {
    if (!date?.from) {
      toast({
        variant: 'destructive',
        title: 'Selecciona un rango',
        description: 'Elige al menos un día para sincronizar manualmente.'
      });
      return;
    }

    const rangeStart = date.from;
    const rangeEnd = date.to || date.from;
    const rangeLabel = differenceInCalendarDays(rangeEnd, rangeStart) === 0
      ? format(rangeStart, 'dd LLL, y', { locale: es })
      : `${format(rangeStart, 'dd LLL, y', { locale: es })} → ${format(rangeEnd, 'dd LLL, y', { locale: es })}`;

    try {
      setIsLoading(true);
      toast({
        title: 'Sincronizando Zadarma',
        description: `Forzando ${rangeLabel}...`
      });

      const response = await fetch('/api/zadarma/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: format(startOfDay(rangeStart), 'yyyy-MM-dd HH:mm:ss'),
          endDate: format(endOfDay(rangeEnd), 'yyyy-MM-dd HH:mm:ss'),
          force: true,
          save: true
        })
      });

      const data = await response.json();

      if (!response.ok || data.status === 'error') {
        throw new Error(data.message || 'No se pudo sincronizar Zadarma.');
      }

      const statsArray = Array.isArray(data.stats) ? data.stats : [];
      if (statsArray.length > 0) {
        const processed = processCallsData(statsArray);
        setPerformanceData(processed.performance);
        setDailyPerformanceData(processed.daily);
      }

      const totalGuardadas = typeof data.savedTotal === 'number'
        ? data.savedTotal
        : Object.values(data.savedPerDay || {}).reduce((acc: number, value: any) => {
            const numeric = Number(value);
            return Number.isFinite(numeric) ? acc + numeric : acc;
          }, 0);

      const hadLocks = Array.isArray(data.lockedDays) && data.lockedDays.length > 0;
      const hadErrors = Array.isArray(data.errors) && data.errors.length > 0;
      const errorSummary = hadErrors
        ? data.errors.map((entry: any) => `${entry.date}: ${entry.message}`).join(' | ')
        : '';

      const descriptionParts: string[] = [];
      descriptionParts.push(`Rango: ${rangeLabel}`);
      if (totalGuardadas > 0) descriptionParts.push(`Actualizadas ${totalGuardadas} llamadas`);
      if (hadLocks) descriptionParts.push(`Bloqueado: ${data.lockedDays.join(', ')}`);
      if (errorSummary) descriptionParts.push(`Errores: ${errorSummary}`);

      toast({
        variant: hadErrors || hadLocks ? 'destructive' : 'default',
        title: hadErrors ? 'Sincronización parcial' : hadLocks ? 'Sincronización en espera' : 'Sincronización completada',
        description: descriptionParts.join(' | ')
      });

      await fetchAndProcessData(true);
    } catch (error: any) {
      console.error('[FORCE-SYNC] Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error forzando sincronización',
        description: String(error?.message || error)
      });
    } finally {
      setIsLoading(false);
    }
  }, [date, fetchAndProcessData, processCallsData, toast]);

  const sortedPerformanceData = useMemo(() => [...performanceData].sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key];
      if (aVal === null) return 1; if (bVal === null) return -1;
      const order = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortConfig.direction === 'ascending' ? order : -order;
  }), [performanceData, sortConfig]);

  const forceButtonLabel = useMemo(() => {
    if (!date?.from) return 'Forzar Hoy';
    const startKey = format(date.from, 'yyyy-MM-dd');
    const endKey = format(date.to || date.from, 'yyyy-MM-dd');
    if (startKey === endKey) {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      return startKey === todayKey ? 'Forzar Hoy' : `Forzar ${format(date.from, 'dd LLL', { locale: es })}`;
    }
    return 'Forzar Rango';
  }, [date]);

  const handleSort = (key: SortConfig['key']) => setSortConfig(sc => ({ key, direction: (sc?.key === key && sc.direction === 'ascending') ? 'descending' : 'ascending' }));
  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };
  const getComplianceColor = (c?: number) => c === undefined ? "" : c < 75 ? "bg-red-500/20 text-red-500" : c < 95 ? "bg-yellow-500/20 text-yellow-500" : "bg-green-500/20 text-green-500";
  const totalCalls = useMemo(() => performanceData.reduce((s, a) => s + a.totalCalls, 0), [performanceData]);
  const totalEffectiveCalls = useMemo(() => performanceData.reduce((s, a) => s + a.effectiveCalls, 0), [performanceData]);
  const averageEffectiveness = totalCalls > 0 ? (totalEffectiveCalls / totalCalls) * 100 : 0;
  const chartData = useMemo(() => performanceData.filter(d => d.totalCalls > 0).sort((a,b) => a.name.localeCompare(b.name)), [performanceData]);
  
  const handleDownloadReport = useCallback(() => {
    if (tableRef.current === null) return;
    toPng(tableRef.current, { cacheBust: true, backgroundColor: 'white' })
      .then((dataUrl) => download(dataUrl, 'reporte-rendimiento.png'))
      .catch(() => toast({ variant: "destructive", title: "Error", description: "No se pudo generar la imagen del reporte." }));
  }, []);
  
  const handleDatePreset = (preset: string) => {
    const to = new Date();
    let from: Date | undefined;
    switch (preset) {
      case 'today': from = new Date(); break;
      case 'yesterday': 
        from = subDays(to, 1); 
        setDate({ from, to: from }); 
        return;
      case '7days': from = subDays(to, 6); break;
      case '30days': from = subDays(to, 29); break;
      default: from = undefined;
    }
    setDate(from ? { from, to } : undefined);
  };
  
  return (
    <div className="space-y-6">
        <ScheduleManager open={isScheduleManagerOpen} onOpenChange={setIsScheduleManagerOpen} />
        {/* Header and Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden"/>
              <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl font-bold tracking-tight">Rendimiento de Asesores</h2>
                  </div>
                  <p className="text-muted-foreground">Métricas de llamadas con datos en tiempo real desde Firestore</p>
              </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
              <Select onValueChange={handleDatePreset}>
                  <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtro Rápido" /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="yesterday">Ayer</SelectItem>
                      <SelectItem value="7days">Últimos 7 días</SelectItem>
                      <SelectItem value="30days">Últimos 30 días</SelectItem>
                  </SelectContent>
              </Select>

              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2} locale={es} />
                   <div className="flex justify-end gap-2 p-4">
                      <Button variant="ghost" onClick={() => setIsDatePickerOpen(false)}>Cancelar</Button>
                      <Button onClick={() => { setDate(tempDate); setIsDatePickerOpen(false); }}>Aplicar</Button>
                   </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" onClick={() => fetchAndProcessData()}><RefreshCw className="h-4 w-4 mr-2"/>Refrescar Ahora</Button>
              <Button variant="outline" size="sm" onClick={handleForceSyncSelection} disabled={isLoading}>
                <PlayCircle className="h-4 w-4 mr-2" />
                {forceButtonLabel}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsScheduleManagerOpen(true)}><Cog className="h-4 w-4 mr-2"/>Gestionar Horarios</Button>
          </div>
        </div>

        {/* Control de Auto-Refresh y Fuente de Datos */}
        {format(date?.from || new Date(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="auto-refresh" 
                      checked={autoRefreshEnabled}
                      onCheckedChange={setAutoRefreshEnabled}
                    />
                    <label htmlFor="auto-refresh" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Auto-actualización cada 60s
                    </label>
                  </div>
                  {autoRefreshEnabled && !isBackfillInProgress && (
                    <Badge variant="outline" className="flex items-center gap-2">
                      <Timer className="h-3 w-3 animate-pulse" />
                      Próxima actualización en {countdown}s
                    </Badge>
                  )}
                  {autoRefreshEnabled && isBackfillInProgress && (
                    <Badge variant="secondary" className="flex items-center gap-2">
                      <Timer className="h-3 w-3" />
                      Pausado (backfill en progreso)
                    </Badge>
                  )}
                </div>
                {autoRefreshEnabled && !isBackfillInProgress && (
                  <div className="text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Datos en tiempo real activados
                  </div>
                )}
                {autoRefreshEnabled && isBackfillInProgress && (
                  <div className="text-sm text-amber-600">
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Pausado durante sincronización
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Barra de Progreso del Backfill */}
        {showBackfillProgress && backfillDates && (
          <BackfillProgress
            startDate={backfillDates.start}
            endDate={backfillDates.end}
            onComplete={handleBackfillComplete}
            onError={handleBackfillError}
          />
        )}
      
        {isLoading ? ( <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Consultando Firestore...</p></div> ) :
        (<div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total de Intentos</CardTitle><PhoneForwarded className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalCalls}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Llamadas Efectivas</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalEffectiveCalls}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Efectividad Promedio</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={cn("text-2xl font-bold", averageEffectiveness < 30 ? "text-red-500" : averageEffectiveness < 50 ? "text-yellow-500" : "text-green-500")}>{averageEffectiveness.toFixed(1)}%</div></CardContent></Card>
            </div>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Detalle por Asesor</CardTitle><CardDescription>{showDailyBreakdown ? "Haz clic en una fila para ver el desglose por día." : "Selecciona un rango de más de un día para ver desglose."}</CardDescription></div><Button variant="outline" size="icon" onClick={handleDownloadReport}><Download className="h-4 w-4" /></Button></CardHeader>
                <CardContent className="overflow-x-auto"><div ref={tableRef} className="min-w-[1000px]">
                    <Table>
                        <TableHeader><TableRow>
                            {showDailyBreakdown && <TableHead className="w-8 p-0"></TableHead>}
                            <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Asesor {renderSortArrow('name')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalCalls')}>Intentos {renderSortArrow('totalCalls')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('compliance')}>Cumplimiento {renderSortArrow('compliance')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectiveCalls')}>Efectivas {renderSortArrow('effectiveCalls')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectivenessRate')}>Efectividad {renderSortArrow('effectivenessRate')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalSeconds')}>Minutos Totales {renderSortArrow('totalSeconds')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('firstCallTime')}>Primera Llamada {renderSortArrow('firstCallTime')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('lastCallTime')}>Última Llamada {renderSortArrow('lastCallTime')}</Button></TableHead>
                        </TableRow></TableHeader>
                        {sortedPerformanceData.map((agent) => (
                        <Collapsible asChild key={agent.id} open={openAdvisorId === agent.id} onOpenChange={() => showDailyBreakdown && setOpenAdvisorId(p => p === agent.id ? null : agent.id)}>
                            <TableBody>
                                <CollapsibleTrigger asChild><TableRow className={cn(showDailyBreakdown && "cursor-pointer hover:bg-muted/50")}>
                                    {showDailyBreakdown && <TableCell className="p-2"><ChevronDown className={cn("h-4 w-4 transition-transform", openAdvisorId === agent.id && "rotate-180")}/></TableCell>}
                                    <TableCell className="font-bold">{agent.name} ({agent.id})</TableCell>
                                    <TableCell className="text-center font-semibold">{agent.totalCalls}</TableCell>
                                    <TableCell className="text-center"><Badge variant="outline" className={cn("text-base font-bold", getComplianceColor(agent.compliance))}>{agent.compliance?.toFixed(0) ?? 'N/A'}%</Badge></TableCell>
                                    <TableCell className="text-center font-semibold text-green-600">{agent.effectiveCalls}</TableCell>
                                    <TableCell className="text-center font-mono">{agent.effectivenessRate.toFixed(1)}%</TableCell>
                                    <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{Math.ceil(agent.totalSeconds / 60)} min</div></TableCell>
                                    <TableCell className="text-center font-mono text-green-600">{agent.firstCallTime || "N/A"}</TableCell>
                                    <TableCell className="text-right font-mono text-red-500">{agent.lastCallTime || "N/A"}</TableCell>
                                </TableRow></CollapsibleTrigger>
                                {showDailyBreakdown && <CollapsibleContent asChild><TableRow><TableCell colSpan={showDailyBreakdown ? 9 : 8} className="p-0"><div className="p-4 bg-muted/50">
                                    <h4 className="font-bold mb-2">Desglose Diario para {agent.name}</h4>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[800px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-center">Intentos</TableHead>
                          <TableHead className="text-center">Cumplimiento</TableHead>
                          <TableHead className="text-center">Efectivas</TableHead>
                          <TableHead className="text-center">Efectividad</TableHead>
                          <TableHead className="text-center">Minutos Totales</TableHead>
                          <TableHead className="text-center">Primera Llamada</TableHead>
                          <TableHead className="text-right">Última Llamada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(dailyPerformanceData[agent.id] || {}).sort(([a], [b]) => b.localeCompare(a)).map(([d, stats]) => (
                        <TableRow key={d}>
                          <TableCell className="font-medium">{format(new Date(d + 'T00:00:00'), "dd LLL, y", { locale: es })}</TableCell>
                          <TableCell className="text-center font-semibold">{stats.totalCalls}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={cn("text-sm font-bold", getComplianceColor(stats.compliance))}>
                              {stats.compliance?.toFixed(0) ?? 'N/A'}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-green-600">{stats.effectiveCalls || 0}</TableCell>
                          <TableCell className="text-center font-mono">{stats.effectivenessRate?.toFixed(1) || '0.0'}%</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              {Math.ceil((stats.totalSeconds || 0) / 60)} min
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono text-green-600">{stats.firstCallTime || "N/A"}</TableCell>
                          <TableCell className="text-right font-mono text-red-500">{stats.lastCallTime || "N/A"}</TableCell>
                        </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                                </div></TableCell></TableRow></CollapsibleContent>}
                            </TableBody>
                        </Collapsible>
                        ))}
                    </Table>
                </div></CardContent>
            </Card>
        </div>)}
    </div>
  );
}

    