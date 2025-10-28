
"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle, Calendar as CalendarIcon, ArrowDown, ArrowUp, Timer, PlayCircle, StopCircle, PhoneForwarded, PhoneOutgoing, BarChartHorizontal, Database, Cloud, Percent, ChevronDown, Download, Cog, Target, BarChart2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, differenceInCalendarDays, eachDayOfInterval, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toPng } from 'html-to-image';
import download from 'downloadjs';

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import agentMap from '@/lib/agents.json';
import { ScheduleManager } from "@/components/dashboard/ScheduleManager";
import { PerformanceCalendar } from "@/components/dashboard/PerformanceCalendar";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { SidebarTrigger } from "@/components/ui/sidebar";


const CALLS_PER_HOUR_TARGET = 12;

// --- Types ---
interface DaySchedule { active: boolean; start: string; end: string; }
interface Schedule { [day: string]: DaySchedule; }
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
interface AdvisorPerformance extends PerformanceMetrics, ActivityMetrics { id: string; name: string; callTarget?: number; compliance?: number; }
interface DailyPerformanceData { [agentId: string]: { [date: string]: PerformanceMetrics & ActivityMetrics & { callTarget?: number; compliance?: number; } }; }
type SortConfig = { key: keyof AdvisorPerformance; direction: 'ascending' | 'descending'; };

const dayMapping = [ "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday" ];

const calculateHoursForDay = (schedule: Schedule, date: Date): number => {
    const dayName = dayMapping[getDay(date)];
    const daySchedule = schedule[dayName];
    if (!daySchedule || !daySchedule.active) return 0;
    const [startH, startM] = daySchedule.start.split(':').map(Number);
    const [endH, endM] = daySchedule.end.split(':').map(Number);
    return (endH + endM / 60) - (startH + startM / 60);
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
  const [dataSource, setDataSource] = useState<boolean | 'mixed'> (false);
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const showDailyBreakdown = useMemo(() => (date?.from && date.to) ? differenceInCalendarDays(date.to, date.from) >= 0 : false, [date]);

  const fetchAndProcessData = useCallback(async () => {
    if (!date?.from) return;
    setIsLoading(true);
    setOpenAdvisorId(null);
    try {
      // rate-limit guard: evitar llamadas repetidas seguidas
      const lastKey = `zadarma_stats_last_${format(date.from, 'yyyy-MM-dd')}_${format(date.to || date.from, 'yyyy-MM-dd')}`;
      const lastTs = sessionStorage.getItem(lastKey);
      if (lastTs && Date.now() - Number(lastTs) < 6000) {
        // si la última petición fue hace menos de 6s, esperar un poco para no golpear la API
        await new Promise(r => setTimeout(r, 6000));
      }
      const params = new URLSearchParams({ startDate: format(date.from, 'yyyy-MM-dd'), endDate: format(date.to || date.from, 'yyyy-MM-dd') });

      // Helper: retries with backoff and respect Retry-After
      const attemptFetch = async (url: string, retries = 3) => {
        let attempt = 0;
        while (true) {
          try {
            const res = await fetch(url);
            if (res.status === 429) {
              const ra = res.headers.get('Retry-After');
              const wait = ra ? Number(ra) * 1000 : Math.min(60000, Math.pow(2, attempt) * 1000);
              await new Promise(r => setTimeout(r, wait));
              attempt++;
              if (attempt > retries) throw new Error('Rate limit excedido');
              continue;
            }
            if (!res.ok) throw new Error((await res.json()).message || `HTTP ${res.status}`);
            return await res.json();
          } catch (err) {
            attempt++;
            if (attempt > retries) throw err;
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
          }
        }
      };

      // Stats: usar cache por sesión para reducir llamadas repetidas
      const statsCacheKey = `zadarma_stats_${format(date.from, 'yyyy-MM-dd')}_${format(date.to || date.from, 'yyyy-MM-dd')}`;
      const statsCachedRaw = sessionStorage.getItem(statsCacheKey);
      let statsData: any = null;
      if (statsCachedRaw) {
        try { statsData = JSON.parse(statsCachedRaw); } catch(e) { statsData = null; }
      }
      if (!statsData) {
        statsData = await attemptFetch(`/api/zadarma/stats?${params.toString()}`);
        try { sessionStorage.setItem(statsCacheKey, JSON.stringify(statsData)); } catch(e){}
      }
      setDataSource(statsData.fromCache);
      try { sessionStorage.setItem(lastKey, String(Date.now())); } catch(e) {}

      // Schedules: fetch con concurrencia limitada y cache por agente
      const agentIds = Object.keys(agentMap);
      const schedules: { [id: string]: Schedule } = {};
      const concurrency = 4;
      let idx = 0;
      const fetchScheduleFor = async (agentId: string) => {
        const sk = `schedule_${agentId}`;
        const cached = sessionStorage.getItem(sk);
        if (cached) {
          try { schedules[agentId] = JSON.parse(cached); return; } catch(e) {}
        }
        try {
          const json = await attemptFetch(`/api/schedules/${agentId}`);
          schedules[agentId] = json;
          try { sessionStorage.setItem(sk, JSON.stringify(json)); } catch(e) {}
        } catch (e) {
          schedules[agentId] = {};
        }
      };
      const workers: Promise<void>[] = [];
      while (idx < agentIds.length) {
        const batch = agentIds.slice(idx, idx + concurrency).map(id => fetchScheduleFor(id));
        workers.push(...batch);
        await Promise.all(batch);
        idx += concurrency;
      }

      const performanceByAgent: { [k: string]: AdvisorPerformance } = {};
      const dailyPerformance: DailyPerformanceData = {};
      Object.keys(agentMap).forEach(id => {
        performanceByAgent[id] = { id, name: (agentMap as any)[id], totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0, firstCallTime: null, lastCallTime: null };
        dailyPerformance[id] = {};
      });
      
      (statsData.stats || []).forEach((call: ZadarmaCall) => {
        if (!performanceByAgent[call.sip]) return;
        
        // Usar metadatos pre-calculados cuando estén disponibles, sino calcular como antes
        const dayKey = (call as any).callDate || (call.callstart || '').substring(0, 10);
        
        if (!dailyPerformance[call.sip][dayKey]) {
          dailyPerformance[call.sip][dayKey] = { totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0, firstCallTime: null, lastCallTime: null };
        }
        
        const agentTotal = performanceByAgent[call.sip];
        const agentDaily = dailyPerformance[call.sip][dayKey];

        // 1. Cálculo de Actividad (para horas): usa TODAS las llamadas.
        if (!agentTotal.firstCallTime || call.callstart < agentTotal.firstCallTime) agentTotal.firstCallTime = call.callstart;
        if (!agentTotal.lastCallTime || call.callstart > agentTotal.lastCallTime) agentTotal.lastCallTime = call.callstart;
        if (!agentDaily.firstCallTime || call.callstart < agentDaily.firstCallTime) agentDaily.firstCallTime = call.callstart;
        if (!agentDaily.lastCallTime || call.callstart > agentDaily.lastCallTime) agentDaily.lastCallTime = call.callstart;
        
        // 2. Cálculo de Rendimiento: usar metadatos pre-calculados cuando estén disponibles
        const isOutboundCall = (call as any).isOutbound !== undefined ? (call as any).isOutbound : String(call.destination || '').length >= 5;
        const isAnsweredCall = (call as any).isAnswered !== undefined ? (call as any).isAnswered : call.disposition === 'answered';
        
        if (isOutboundCall) {
            agentTotal.totalCalls++; agentDaily.totalCalls++;
            agentTotal.totalSeconds += call.seconds; agentDaily.totalSeconds += call.seconds;
            if (isAnsweredCall) {
                agentTotal.effectiveCalls++; agentDaily.effectiveCalls++;
            }
        }
      });
      
      const formatMetrics = (p: PerformanceMetrics & ActivityMetrics) => {
        p.effectivenessRate = p.totalCalls > 0 ? (p.effectiveCalls / p.totalCalls) * 100 : 0;
        p.averageCallDuration = p.effectiveCalls > 0 ? p.totalSeconds / p.effectiveCalls : 0;
        
        // Formatear horas: extraer la porción HH:mm:ss directamente del timestamp raw
        if (p.firstCallTime && String(p.firstCallTime).length >= 19) {
          p.firstCallTime = String(p.firstCallTime).substring(11, 19);
        }
        if (p.lastCallTime && String(p.lastCallTime).length >= 19) {
          p.lastCallTime = String(p.lastCallTime).substring(11, 19);
        }
        
        return p;
      };

      const daysInInterval = eachDayOfInterval({ start: date.from, end: date.to || date.from });
      Object.keys(performanceByAgent).forEach(agentId => {
        const agentSchedule = schedules[agentId];
        let totalHours = 0;
        if (agentSchedule) {
          daysInInterval.forEach(day => {
            const hours = calculateHoursForDay(agentSchedule, day);
            totalHours += hours;
            const dayKey = format(day, 'yyyy-MM-dd');
            if (dailyPerformance[agentId][dayKey]) {
              const dailyStats = dailyPerformance[agentId][dayKey];
              dailyStats.callTarget = hours * CALLS_PER_HOUR_TARGET;
              dailyStats.compliance = dailyStats.callTarget! > 0 ? (dailyStats.totalCalls / dailyStats.callTarget!) * 100 : 100;
            }
          });
        }
        const agentPerformance = performanceByAgent[agentId];
        agentPerformance.callTarget = totalHours * CALLS_PER_HOUR_TARGET;
        agentPerformance.compliance = agentPerformance.callTarget! > 0 ? (agentPerformance.totalCalls / agentPerformance.callTarget!) * 100 : 100;
      });

      setPerformanceData(Object.values(performanceByAgent).map(p => formatMetrics(p) as AdvisorPerformance));
      Object.values(dailyPerformance).forEach(agentDays => Object.values(agentDays).forEach(formatMetrics));
      setDailyPerformanceData(dailyPerformance);
      
  // Mostrar solo mensaje genérico para evitar avisos de corrección horaria en la UI
  toast({ title: "Datos Cargados" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Conexión", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);
  
  useEffect(() => { fetchAndProcessData(); }, [fetchAndProcessData]);

  const sortedPerformanceData = useMemo(() => [...performanceData].sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key];
      if (aVal === null) return 1; if (bVal === null) return -1;
      const order = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortConfig.direction === 'ascending' ? order : -order;
  }), [performanceData, sortConfig]);

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
  const calendarData = useMemo(() => {
    const data: { [date: string]: { value: number; tooltip: string[] } } = {};
    Object.values(dailyPerformanceData).forEach(agentDays => {
      Object.entries(agentDays).forEach(([dayKey, stats]) => {
        if (!data[dayKey]) data[dayKey] = { value: 0, tooltip: [] };
        if (stats.compliance !== undefined) {
          data[dayKey].value += stats.compliance;
          data[dayKey].tooltip.push(`${(agentMap as any)[Object.keys(agentDays)[0]]}: ${stats.compliance.toFixed(0)}%`);
        }
      });
    });
    return Object.entries(data).map(([date, { value, tooltip }]) => {
      const numAgents = tooltip.length;
      const avgCompliance = numAgents > 0 ? value / numAgents : 0;
      let count = 0;
      if (avgCompliance < 75) count = 1;
      else if (avgCompliance < 95) count = 2;
      else if (avgCompliance >= 95) count = 3;
      return {
        date,
        count,
        tooltip: `${format(parseISO(date), "dd LLL", { locale: es })}: ${avgCompliance.toFixed(0)}% promedio. ${tooltip.join(', ')}`
      };
    });
  }, [dailyPerformanceData]);
  
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
                  <h2 className="text-3xl font-bold tracking-tight">Rendimiento de Asesores</h2>
                  <p className="text-muted-foreground">Métricas de llamadas y cumplimiento de objetivos.</p>
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
              <Button variant="outline" size="sm" onClick={() => setIsScheduleManagerOpen(true)}><Cog className="h-4 w-4 mr-2"/>Gestionar Horarios</Button>
              <Button variant="outline" size="sm" onClick={() => fetchAndProcessData()} disabled={isLoading}><RefreshCw className="h-4 w-4 mr-2"/>Actualizar</Button>
          </div>
        </div>
        {!isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground">{dataSource === 'mixed' ? <><Database className="h-4 w-4 text-green-500" /><Cloud className="h-4 w-4 text-blue-500" /></> : dataSource ? <Database className="h-4 w-4 text-green-500" /> : <Cloud className="h-4 w-4 text-blue-500" />}<p>{dataSource === 'mixed' ? "Datos combinados (caché histórico + API hoy)" : dataSource ? "Datos desde Firestore (caché histórico)" : "Datos desde API de Zadarma (usando caché de sesión)"}</p></div>}
      
        {isLoading ? ( <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Calculando rendimiento...</p></div> ) :
        (<div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total de Intentos</CardTitle><PhoneForwarded className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalCalls}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Llamadas Efectivas</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalEffectiveCalls}</div></CardContent></Card>
              <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Efectividad Promedio</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={cn("text-2xl font-bold", averageEffectiveness < 30 ? "text-red-500" : averageEffectiveness < 50 ? "text-yellow-500" : "text-green-500")}>{averageEffectiveness.toFixed(1)}%</div></CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="flex items-center"><CalendarIcon className="mr-2 h-5 w-5" />Resumen de Cumplimiento Mensual</CardTitle></CardHeader><CardContent><PerformanceCalendar data={calendarData} /></CardContent></Card>
            
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

    