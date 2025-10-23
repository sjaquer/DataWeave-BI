
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle, Calendar as CalendarIcon, ArrowDown, ArrowUp, Timer, PlayCircle, StopCircle, PhoneForwarded, PhoneOutgoing, BarChartHorizontal, Database, Cloud, Percent, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, subDays, startOfDay, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from 'date-fns-tz';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import agentMap from '@/lib/agents.json';

const LIMA_TIME_ZONE = 'America/Lima';

// --- Tipos de Datos ---
interface ZadarmaCall {
  pbx_call_id: string; callstart: string; sip: string;
  destination: string | number; disposition: string; seconds: number;
}
interface PerformanceMetrics {
  totalCalls: number; effectiveCalls: number; effectivenessRate: number;
  totalSeconds: number; averageCallDuration: number;
  firstCallTime: string | null; lastCallTime: string | null;
}
interface AdvisorPerformance extends PerformanceMetrics {
  id: string; name: string;
}
interface DailyPerformanceData {
  [agentId: string]: { [date: string]: PerformanceMetrics };
}
type SortConfig = { key: keyof AdvisorPerformance; direction: 'ascending' | 'descending'; };

export default function AdvisorPerformancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<AdvisorPerformance[]>([]);
  const [dailyPerformanceData, setDailyPerformanceData] = useState<DailyPerformanceData>({});
  const [openAdvisorId, setOpenAdvisorId] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'totalCalls', direction: 'descending' });
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [tempDate, setTempDate] = useState<DateRange | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dataSource, setDataSource] = useState<'cache' | 'api' | 'mixed'>('cache');
  const { toast } = useToast();

  const showDailyBreakdown = useMemo(() => {
    if (!date?.from || !date?.to) return false;
    return differenceInCalendarDays(date.to, date.from) > 0;
  }, [date]);
  
  useEffect(() => {
    const today = new Date();
    setDate({ from: today, to: today });
  }, []);

  const handleDatePreset = (preset: string) => {
      const to = new Date(); let from: Date;
      switch (preset) {
        case 'today': from = to; setDate({ from, to }); break;
        case 'yesterday': from = subDays(to, 1); setDate({ from, to: from }); break;
        case '7days': from = subDays(to, 6); setDate({ from, to }); break;
        case '30days': from = subDays(to, 29); setDate({ from, to }); break;
      }
  };

  const fetchAndProcessData = useCallback(async () => {
    if (!date?.from) return;
    setIsLoading(true);
    setOpenAdvisorId(null);
    try {
      const params = new URLSearchParams({
        startDate: startOfDay(date.from).toISOString(),
        endDate: startOfDay(date.to || date.from).toISOString(),
      });
      
      const response = await fetch(`/api/zadarma/stats?${params.toString()}`);

      if (!response.ok) {
        let msg = `Error: ${response.status}`;
        try { msg = (await response.json()).message; } catch (e) {}
        throw new Error(msg);
      }
      
      const data = await response.json();
      setDataSource(data.fromCache || 'api');

      const performanceByAgent: { [k: string]: AdvisorPerformance } = {};
      const dailyPerformance: DailyPerformanceData = {};
      Object.keys(agentMap).forEach(id => {
        performanceByAgent[id] = { id, name: (agentMap as any)[id], totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0, firstCallTime: null, lastCallTime: null };
        dailyPerformance[id] = {};
      });
      
      (data.stats || []).forEach((call: ZadarmaCall) => {
        if (!performanceByAgent[call.sip] || String(call.destination).length < 5) return;
        
        const callDate = new Date(call.callstart);
        const dayKey = format(callDate, 'yyyy-MM-dd');
        if (!dailyPerformance[call.sip][dayKey]) {
          dailyPerformance[call.sip][dayKey] = { totalCalls: 0, effectiveCalls: 0, effectivenessRate: 0, totalSeconds: 0, averageCallDuration: 0, firstCallTime: null, lastCallTime: null };
        }
        
        const agentTotal = performanceByAgent[call.sip];
        const agentDaily = dailyPerformance[call.sip][dayKey];
        const callIso = callDate.toISOString();

        [agentTotal, agentDaily].forEach(p => {
          p.totalCalls++;
          p.totalSeconds += call.seconds;
          if (call.disposition === 'answered') p.effectiveCalls++;
          if (!p.firstCallTime || callIso < p.firstCallTime) p.firstCallTime = callIso;
          if (!p.lastCallTime || callIso > p.lastCallTime) p.lastCallTime = callIso;
        });
      });
      
      const formatMetrics = (p: PerformanceMetrics) => {
        p.effectivenessRate = p.totalCalls > 0 ? (p.effectiveCalls / p.totalCalls) * 100 : 0;
        p.averageCallDuration = p.effectiveCalls > 0 ? p.totalSeconds / p.effectiveCalls : 0;
        if (p.firstCallTime) p.firstCallTime = formatInTimeZone(new Date(p.firstCallTime), LIMA_TIME_ZONE, 'HH:mm:ss');
        if (p.lastCallTime) p.lastCallTime = formatInTimeZone(new Date(p.lastCallTime), LIMA_TIME_ZONE, 'HH:mm:ss');
        return p;
      };

      setPerformanceData(Object.values(performanceByAgent).map(p => formatMetrics(p as AdvisorPerformance) as AdvisorPerformance));
      Object.values(dailyPerformance).forEach(agentDays => Object.values(agentDays).forEach(formatMetrics));
      setDailyPerformanceData(dailyPerformance);
      
      toast({ title: data.fromCache ? "Datos desde Caché" : "Datos en Tiempo Real", description: data.message });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Conexión", description: error.message });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);

  useEffect(() => { fetchAndProcessData(); }, [date, fetchAndProcessData]);

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

  const getCallCountColor = (count: number) => {
    if (count < 60) return "bg-red-500/20 text-red-500 border-red-500/50";
    if (count >= 60 && count <= 100) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
    return "bg-green-500/20 text-green-500 border-green-500/50";
  };
  
  const totalCalls = useMemo(() => performanceData.reduce((sum, a) => sum + a.totalCalls, 0), [performanceData]);
  const totalEffectiveCalls = useMemo(() => performanceData.reduce((sum, a) => sum + a.effectiveCalls, 0), [performanceData]);
  const averageEffectiveness = totalCalls > 0 ? (totalEffectiveCalls / totalCalls) * 100 : 0;
  
  const chartData = useMemo(() => performanceData.filter(d => d.totalCalls > 0).sort((a,b) => a.name.localeCompare(b.name)), [performanceData]);

  return (
    <div className="space-y-8">
        {/* Encabezado y Filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
                <SidebarTrigger className="md:hidden"/>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Rendimiento de Asesores</h2>
                    <p className="text-muted-foreground">Métricas clave de la actividad de llamadas.</p>
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
                        {date?.from ? (date.to && date.to > date.from ? `${format(date.from, "LLL dd, y", { locale: es })} - ${format(date.to, "LLL dd, y", { locale: es })}` : format(date.from, "LLL dd, y", { locale: es })) : <span>Selecciona un rango</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2} locale={es} />
                    <div className="flex items-center justify-end gap-2 p-3 border-t">
                        <Button variant="outline" size="sm" onClick={() => setIsDatePickerOpen(false)}>Cancelar</Button>
                        <Button size="sm" onClick={() => { setDate(tempDate); setIsDatePickerOpen(false); }}>Aplicar</Button>
                    </div>
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="sm" onClick={fetchAndProcessData} disabled={isLoading}>
                    {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refrescar
                </Button>
            </div>
        </div>

        {/* Indicador de Fuente de Datos */}
        {!isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {dataSource === 'cache' || dataSource === true ? <><Database className="h-4 w-4 text-green-500" /><span>Datos desde Caché</span></>
            : dataSource === 'mixed' ? <><Database className="h-4 w-4 text-yellow-500" /><Cloud className="h-4 w-4 text-blue-500 -ml-1" /><span>Datos Combinados</span></>
            : <><Cloud className="h-4 w-4 text-blue-500" /><span>Datos en Tiempo Real</span></>}
            </div>
        )}
      
        {isLoading ? ( <div className="flex items-center justify-center min-h-[400px]"><Loader className="h-8 w-8 animate-spin text-primary" /><p className="ml-4 text-muted-foreground">Calculando rendimiento...</p></div> ) :
        (<div className="space-y-8">
            {/* Tarjetas de Resumen */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Intentos</CardTitle><PhoneOutgoing className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalCalls}</div><p className="text-xs text-muted-foreground">Llamadas salientes realizadas</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Llamadas Efectivas</CardTitle><PhoneForwarded className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalEffectiveCalls}</div><p className="text-xs text-muted-foreground">Llamadas que fueron contestadas</p></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Tasa de Efectividad</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{averageEffectiveness.toFixed(1)}%</div><p className="text-xs text-muted-foreground">Efectividad promedio del equipo</p></CardContent></Card>
            </div>
            
            {/* Gráficos */}
            <Card>
                <CardHeader><CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5" />Rendimiento de Llamadas</CardTitle><CardDescription>Comparativa de intentos vs. llamadas efectivas por asesor.</CardDescription></CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                <Tooltip content={<ChartTooltipContent />} cursor={{fill: "hsl(var(--muted))"}}/><Legend />
                                <Bar dataKey="totalCalls" name="Intentos" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                <Bar dataKey="effectiveCalls" name="Efectivas" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5" />Tasa de Efectividad por Asesor</CardTitle><CardDescription>Porcentaje de llamadas contestadas sobre el total de intentos.</CardDescription></CardHeader>
                <CardContent>
                    <ChartContainer config={{}} className="min-h-[300px] w-full">
                        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
                            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" domain={[0, 100]} unit="%" /><YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                <Tooltip content={<ChartTooltipContent formatter={(v) => `${(v as number).toFixed(1)}%`} />} cursor={{fill: "hsl(var(--muted))"}}/>
                                <ReferenceLine x={averageEffectiveness} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ value: `Promedio: ${averageEffectiveness.toFixed(1)}%`, position: 'insideTopLeft' }} />
                                <Bar dataKey="effectivenessRate" name="Efectividad" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Tabla de Detalles */}
            <Card>
                <CardHeader><CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Detalle de Rendimiento por Asesor</CardTitle><CardDescription>{showDailyBreakdown ? "Haz clic en una fila para ver el desglose por día." : "Selecciona un rango de más de un día para ver el desglose diario."}</CardDescription></CardHeader>
                <CardContent className="p-0 sm:p-2">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {showDailyBreakdown && <TableHead className="w-8 p-0"></TableHead>}
                                <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Asesor {renderSortArrow('name')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalCalls')}>Intentos {renderSortArrow('totalCalls')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectiveCalls')}>Efectivas {renderSortArrow('effectiveCalls')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('effectivenessRate')}>Efectividad {renderSortArrow('effectivenessRate')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('totalSeconds')}>Minutos Totales {renderSortArrow('totalSeconds')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('averageCallDuration')}>Duración Prom. {renderSortArrow('averageCallDuration')}</Button></TableHead>
                                <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('firstCallTime')}>Primera Llamada {renderSortArrow('firstCallTime')}</Button></TableHead>
                                <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('lastCallTime')}>Última Llamada {renderSortArrow('lastCallTime')}</Button></TableHead>
                            </TableRow>
                        </TableHeader>
                        {sortedPerformanceData.map((agent) => (
                        <Collapsible asChild key={agent.id} open={openAdvisorId === agent.id} onOpenChange={() => showDailyBreakdown && setOpenAdvisorId(p => p === agent.id ? null : agent.id)}>
                            <TableBody>
                                <CollapsibleTrigger asChild>
                                    <TableRow className={cn(showDailyBreakdown && "cursor-pointer hover:bg-muted/50")}>
                                        {showDailyBreakdown && <TableCell className="p-2"><ChevronDown className={cn("h-4 w-4 transition-transform", openAdvisorId === agent.id && "rotate-180")}/></TableCell>}
                                        <TableCell className="font-bold">{agent.name} ({agent.id})</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className={cn("text-base font-bold", getCallCountColor(agent.totalCalls))}>{agent.totalCalls}</Badge></TableCell>
                                        <TableCell className="text-center font-semibold"><div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle className="h-4 w-4" />{agent.effectiveCalls}</div></TableCell>
                                        <TableCell className="text-center font-mono">{agent.effectivenessRate.toFixed(1)}%</TableCell>
                                        <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{Math.ceil(agent.totalSeconds / 60)} min</div></TableCell>
                                        <TableCell className="text-center"><div className="flex items-center justify-center gap-2"><Timer className="h-4 w-4 text-muted-foreground" />{agent.averageCallDuration.toFixed(0)} s</div></TableCell>
                                        <TableCell className="text-center font-mono"><div className="flex items-center justify-center gap-2 text-green-600"><PlayCircle className="h-4 w-4" />{agent.firstCallTime || "N/A"}</div></TableCell>
                                        <TableCell className="text-right font-mono"><div className="flex items-center justify-end gap-2 text-red-500"><StopCircle className="h-4 w-4" />{agent.lastCallTime || "N/A"}</div></TableCell>
                                    </TableRow>
                                </CollapsibleTrigger>
                                {showDailyBreakdown && <CollapsibleContent asChild>
                                    <TableRow>
                                        <TableCell colSpan={9} className="p-0">
                                            <div className="p-4 bg-muted/50">
                                                <h4 className="font-bold mb-2">Desglose Diario para {agent.name}</h4>
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-center">Intentos</TableHead><TableHead className="text-center">Efectivas</TableHead><TableHead className="text-center">Efectividad</TableHead><TableHead className="text-center">Minutos</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {Object.entries(dailyPerformanceData[agent.id] || {}).sort(([a], [b]) => a.localeCompare(b)).map(([d, stats]) => (
                                                        <TableRow key={d}><TableCell>{format(new Date(d), "dd LLL, y", { locale: es })}</TableCell><TableCell className="text-center"><Badge variant="secondary">{stats.totalCalls}</Badge></TableCell><TableCell className="text-center font-semibold text-green-600">{stats.effectiveCalls}</TableCell><TableCell className="text-center font-mono">{stats.effectivenessRate.toFixed(1)}%</TableCell><TableCell className="text-center">{Math.ceil(stats.totalSeconds / 60)}</TableCell></TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </CollapsibleContent>}
                            </TableBody>
                        </Collapsible>
                        ))}
                      </Table>
                </CardContent>
            </Card>
        </div>)}
    </div>
  );
}
