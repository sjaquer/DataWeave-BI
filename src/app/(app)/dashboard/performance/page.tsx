
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
// formatInTimeZone import removed - using Zadarma data directly without timezone conversions
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

// LIMA_TIME_ZONE constant removed - using Zadarma data directly
const CALLS_PER_HOUR_TARGET = 15;

// --- Types ---
interface DaySchedule { active: boolean; start: string; end: string; }
interface Schedule { [day: string]: DaySchedule; }
interface ZadarmaCall { pbx_call_id: string; callstart: string; sip: string; destination: string | number; disposition: string; seconds: number; }
interface PerformanceMetrics { totalCalls: number; effectiveCalls: number; effectivenessRate: number; totalSeconds: number; averageCallDuration: number; }
interface AdvisorPerformance extends PerformanceMetrics { id: string; name: string; callTarget?: number; compliance?: number; }
interface DailyPerformanceData { [agentId: string]: { [date: string]: PerformanceMetrics & { callTarget?: number; compliance?: number; } }; }
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
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [tempDate, setTempDate] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | 'mixed' | boolean>('api');
  const { toast } = useToast();
  const tableRef = useRef<HTMLDivElement>(null);

  const showDailyBreakdown = useMemo(() => (date?.from && date.to) ? differenceInCalendarDays(date.to, date.from) > 0 : false, [date]);
  
  // Detectar si estamos viendo datos de HOY para auto-refresh
  const isViewingToday = useMemo(() => {
    if (!date?.from) return false;
    const today = format(new Date(), 'yyyy-MM-dd');
    const fromDate = format(date.from, 'yyyy-MM-dd');
    const toDate = format(date.to || date.from, 'yyyy-MM-dd');
    return fromDate === today || toDate === today;
  }, [date]);
  
  useEffect(() => { setDate({ from: new Date(), to: new Date() }); }, []);

  const fetchAndProcessData = useCallback(async () => {
    if (!date?.from) return;
    setIsLoading(true);
    setOpenAdvisorId(null);
    try {
      const params = new URLSearchParams({ startDate: startOfDay(date.from).toISOString(), endDate: startOfDay(date.to || date.from).toISOString() });
      const [statsRes, ...schedulesRes] = await Promise.all([
        fetch(`/api/zadarma/stats?${params.toString()}`),
        ...Object.keys(agentMap).map(id => fetch(`/api/schedules/${id}`))
      ]);

      if (!statsRes.ok) throw new Error((await statsRes.json()).message || 'Error al cargar estadísticas');
      const statsData = await statsRes.json();
      setDataSource(statsData.fromCache);

      // CORRECCIÓN: 'schedules' se define aquí, antes de ser usada.
      const schedules: { [id: string]: Schedule } = {};
      for (let i = 0; i < schedulesRes.length; i++) {
        const agentId = Object.keys(agentMap)[i];
        if (schedulesRes[i].ok) {
          schedules[agentId] = await schedulesRes[i].json();
        }
      }

      const performanceByAgent: { [k: string]: AdvisorPerformance } = {};
      const dailyPerformance: DailyPerformanceData = {};
      Object.keys(agentMap).forEach(id => {
        performanceByAgent[id] = { id, name: (agentMap as any)[id], totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0 };
        dailyPerformance[id] = {};
      });
      
      (statsData.stats || []).forEach((call: ZadarmaCall) => {
        if (!performanceByAgent[call.sip] || String(call.destination).length < 5) return;
        
        const callTimeUTC = parseISO(call.callstart);
        const dayKey = format(callTimeUTC, 'yyyy-MM-dd'); // Using local date without timezone conversion

        if (!dailyPerformance[call.sip][dayKey]) {
          dailyPerformance[call.sip][dayKey] = { totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0 };
        }
        
        const agentTotal = performanceByAgent[call.sip];
        const agentDaily = dailyPerformance[call.sip][dayKey];

        [agentTotal, agentDaily].forEach(p => {
          p.totalCalls++; p.totalSeconds += call.seconds;
          if (call.disposition === 'answered') p.effectiveCalls++;
        });
      });
      
      const formatMetrics = (p: PerformanceMetrics) => {
        p.effectivenessRate = p.totalCalls > 0 ? (p.effectiveCalls / p.totalCalls) * 100 : 0;
        p.averageCallDuration = p.effectiveCalls > 0 ? p.totalSeconds / p.effectiveCalls : 0;
        return p;
      };

      const daysInInterval = eachDayOfInterval({ start: date.from, end: date.to || date.from });
      Object.keys(performanceByAgent).forEach(agentId => {
        // CORRECCIÓN: Se usa la variable 'schedules' que ya fue definida.
        const agentSchedule = schedules[agentId];
        let totalHours = 0;
        if (agentSchedule) {
          daysInInterval.forEach(day => {
            const hours = calculateHoursForDay(agentSchedule, day);
            totalHours += hours;
            const dayKey = format(day, 'yyyy-MM-dd');
            if (dailyPerformance[agentId][dayKey]) {
              dailyPerformance[agentId][dayKey].callTarget = hours * CALLS_PER_HOUR_TARGET;
              dailyPerformance[agentId][dayKey].compliance = dailyPerformance[agentId][dayKey].callTarget! > 0 ? (dailyPerformance[agentId][dayKey].totalCalls / dailyPerformance[agentId][dayKey].callTarget!) * 100 : 100;
            }
          });
        }
        performanceByAgent[agentId].callTarget = totalHours * CALLS_PER_HOUR_TARGET;
        performanceByAgent[agentId].compliance = performanceByAgent[agentId].callTarget! > 0 ? (performanceByAgent[agentId].totalCalls / performanceByAgent[agentId].callTarget!) * 100 : 100;
      });

      setPerformanceData(Object.values(performanceByAgent).map(p => formatMetrics(p as AdvisorPerformance) as AdvisorPerformance));
      Object.values(dailyPerformance).forEach(agentDays => Object.values(agentDays).forEach(formatMetrics));
      setDailyPerformanceData(dailyPerformance);
      
      toast({ title: "Datos Cargados", description: statsData.message });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Conexión", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);

  useEffect(() => { fetchAndProcessData(); }, [date, fetchAndProcessData]);
  
  // Auto-refresh para datos de HOY cada 2 minutos
  useEffect(() => {
    if (!isViewingToday || isLoading) return;
    
    const interval = setInterval(() => {
      console.log('[AUTO-REFRESH] Actualizando datos de HOY...');
      fetchAndProcessData();
    }, 2 * 60 * 1000); // 2 minutos
    
    return () => clearInterval(interval);
  }, [isViewingToday, isLoading, fetchAndProcessData]);
  
  // ... (El resto del JSX y funciones auxiliares no necesitan cambios)
  const sortedPerformanceData = useMemo(() => {
    return [...performanceData].sort((a, b) => {
      if (!sortConfig) return 0;
      const aVal = a[sortConfig.key]; const bVal = b[sortConfig.key];
      if (aVal === null) return 1; if (bVal === null) return -1;
      const order = typeof aVal === 'string' ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
      return sortConfig.direction === 'ascending' ? order : -order;
    });
  }, [performanceData, sortConfig]);

  const handleSort = (key: SortConfig['key']) => {
    const direction = (sortConfig?.key === key && sortConfig.direction === 'ascending') ? 'descending' : 'ascending';
    setSortConfig({ key, direction });
  };

  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const getComplianceColor = (compliance: number | undefined): string => {
    if (compliance === undefined) return "";
    if (compliance < 75) return "bg-red-500/20 text-red-500 border-red-500/50";
    if (compliance < 95) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
    return "bg-green-500/20 text-green-500 border-green-500/50";
  };
  
  const totalCalls = useMemo(() => performanceData.reduce((sum, a) => sum + a.totalCalls, 0), [performanceData]);
  const totalEffectiveCalls = useMemo(() => performanceData.reduce((sum, a) => sum + a.effectiveCalls, 0), [performanceData]);
  const averageEffectiveness = totalCalls > 0 ? (totalEffectiveCalls / totalCalls) * 100 : 0;
  
  const chartData = useMemo(() => performanceData.filter(d => d.totalCalls > 0).sort((a,b) => a.name.localeCompare(b.name)), [performanceData]);

  const calendarData = useMemo(() => {
    const data: { [date: string]: { total: number; count: number; compliance: number } } = {};
    Object.values(dailyPerformanceData).forEach(agentDays => {
        Object.entries(agentDays).forEach(([date, stats]) => {
            if (!data[date]) data[date] = { total: 0, count: 0, compliance: 0 };
            data[date].total += stats.totalCalls;
            data[date].count++;
            data[date].compliance += stats.compliance ?? 0;
        });
    });
    return Object.entries(data).map(([date, { total, count, compliance }]) => {
        const avgCompliance = count > 0 ? compliance / count : 0;
        let colorLevel = 0;
        if (avgCompliance >= 95) colorLevel = 3;
        else if (avgCompliance >= 75) colorLevel = 2;
        else if (avgCompliance > 0) colorLevel = 1;
        return { date, count: colorLevel, tooltip: `${format(new Date(date), 'dd LLL')}: ${total} llamadas, Cumplimiento: ${avgCompliance.toFixed(0)}%` };
    });
  }, [dailyPerformanceData]);

  const handleDatePreset = (preset: string) => {
      const to = new Date(); let from: Date;
      switch (preset) {
        case 'today': from = to; setDate({ from, to }); break;
        case 'yesterday': from = subDays(to, 1); setDate({ from, to: from }); break;
        case '7days': from = subDays(to, 6); setDate({ from, to }); break;
        case '30days': from = subDays(to, 29); setDate({ from, to }); break;
      }
  };

  const handleDownloadReport = useCallback(() => {
    if (!tableRef.current) return;
    const filter = (node: HTMLElement) => (node.tagName !== 'LINK') || !node.hasAttribute('href') || !(node.getAttribute('href') || '').includes('googleapis');
    toPng(tableRef.current, { cacheBust: true, backgroundColor: '#ffffff', filter })
      .then((dataUrl) => {
        download(dataUrl, 'reporte-rendimiento.png');
        toast({ title: "¡Éxito!", description: "El reporte se está descargando." });
      })
      .catch((err) => toast({ variant: "destructive", title: "Error", description: "No se pudo generar la imagen del reporte." }));
  }, [toast]);
  
  return (
    <div className="space-y-6">
        <ScheduleManager open={isScheduleManagerOpen} onOpenChange={setIsScheduleManagerOpen} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Rendimiento de Asesores</h1>
                <p className="text-muted-foreground">Métricas clave de la actividad de llamadas.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setIsScheduleManagerOpen(true)}><Cog className="mr-2 h-4 w-4" />Horarios</Button>
                <Select onValueChange={handleDatePreset}><SelectTrigger className="w-full sm:w-auto"><SelectValue placeholder="Filtro Rápido" /></SelectTrigger><SelectContent><SelectItem value="today">Hoy</SelectItem><SelectItem value="yesterday">Ayer</SelectItem><SelectItem value="7days">Últimos 7 días</SelectItem><SelectItem value="30days">Últimos 30 días</SelectItem></SelectContent></Select>
                <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-full sm:w-auto justify-start text-left font-normal", !date && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{date?.from ? (date.to && date.to > date.from ? `${format(date.from, "LLL dd, y", { locale: es })} - ${format(date.to, "LLL dd, y", { locale: es })}` : format(date.from, "LLL dd, y", { locale: es })) : <span>Selecciona un rango</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="end"><Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2} locale={es} /><div className="flex items-center justify-end gap-2 p-3 border-t"><Button variant="outline" size="sm" onClick={() => setIsDatePickerOpen(false)}>Cancelar</Button><Button size="sm" onClick={() => { setDate(tempDate); setIsDatePickerOpen(false); }}>Aplicar</Button></div></PopoverContent></Popover>
                <Button variant="outline" size="icon" onClick={fetchAndProcessData} disabled={isLoading}>{isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            </div>
        </div>

        {!isLoading && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {dataSource === true || dataSource === 'cache' ? (
                <>
                  <Database className="h-4 w-4 text-green-500" />
                  <span className="text-green-700">Datos Históricos desde Caché</span>
                  <span className="text-xs text-muted-foreground">(Optimizado para velocidad)</span>
                </>
              ) : dataSource === 'mixed' ? (
                <>
                  <Database className="h-4 w-4 text-yellow-500" />
                  <Cloud className="h-4 w-4 text-blue-500 -ml-1" />
                  <span className="text-yellow-700">Datos Combinados</span>
                </>
              ) : (
                <>
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <span className="text-blue-700">Datos en Tiempo Real</span>
                  {isViewingToday && <span className="text-xs text-muted-foreground">(Auto-refresh cada 2min)</span>}
                </>
              )}
            </div>
            {!dataSource && isViewingToday && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <Timer className="h-3 w-3" />
                <span>Actualizando automáticamente...</span>
              </div>
            )}
          </div>
        )}
      
        {isLoading ? ( <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Calculando rendimiento...</p></div> ) :
        (<div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Intentos</CardTitle><PhoneOutgoing className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalCalls}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Llamadas Efectivas</CardTitle><PhoneForwarded className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalEffectiveCalls}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tasa de Efectividad</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{averageEffectiveness.toFixed(1)}%</div></CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="flex items-center"><CalendarIcon className="mr-2 h-5 w-5" />Resumen de Cumplimiento Mensual</CardTitle><CardDescription>Mapa de calor del cumplimiento promedio del equipo en los últimos meses.</CardDescription></CardHeader><CardContent><PerformanceCalendar data={calendarData} /></CardContent></Card>
            
            <Card>
                <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Detalle por Asesor</CardTitle><CardDescription>{showDailyBreakdown ? "Haz clic en una fila para ver el desglose por día." : "Selecciona un rango de más de un día para ver desglose."}</CardDescription></div><Button variant="outline" size="icon" onClick={handleDownloadReport}><Download className="h-4 w-4" /></Button></CardHeader>
                <CardContent className="overflow-x-auto"><div ref={tableRef} className="min-w-[900px]">
                    <Table>
                        <TableHeader><TableRow>
                            {showDailyBreakdown && <TableHead className="w-8 p-0"></TableHead>}
                            <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Asesor {renderSortArrow('name')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalCalls')}>Intentos {renderSortArrow('totalCalls')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('compliance')}>Cumplimiento {renderSortArrow('compliance')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectiveCalls')}>Efectivas {renderSortArrow('effectiveCalls')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectivenessRate')}>Efectividad {renderSortArrow('effectivenessRate')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('averageCallDuration')}>Tiempo Prom. {renderSortArrow('averageCallDuration')}</Button></TableHead>
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
                                    <TableCell className="text-center font-mono">{agent.averageCallDuration > 0 ? `${Math.round(agent.averageCallDuration)}s` : 'N/A'}</TableCell>
                                </TableRow></CollapsibleTrigger>
                                {showDailyBreakdown && <CollapsibleContent asChild><TableRow><TableCell colSpan={7} className="p-0"><div className="p-4 bg-muted/50">
                                    <h4 className="font-bold mb-2">Desglose Diario para {agent.name}</h4>
                                    <div className="overflow-x-auto">
                                        <Table className="min-w-[600px]"><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-center">Intentos</TableHead><TableHead className="text-center">Efectivas</TableHead><TableHead className="text-center">Efectividad</TableHead><TableHead className="text-center">Tiempo Prom.</TableHead></TableRow></TableHeader><TableBody>
                                            {Object.entries(dailyPerformanceData[agent.id] || {}).sort(([a], [b]) => b.localeCompare(a)).map(([d, stats]) => (
                                            <TableRow key={d}><TableCell>{format(new Date(d), "dd LLL, y", { locale: es })}</TableCell><TableCell className="text-center">{stats.totalCalls}</TableCell><TableCell className="text-center font-semibold text-green-600">{stats.effectiveCalls}</TableCell><TableCell className="text-center">{stats.effectivenessRate.toFixed(1)}%</TableCell><TableCell className="text-center">{stats.averageCallDuration > 0 ? `${Math.round(stats.averageCallDuration)}s` : 'N/A'}</TableCell></TableRow>
                                            ))}
                                        </TableBody></Table>
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
