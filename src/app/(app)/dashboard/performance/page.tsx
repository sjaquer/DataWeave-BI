
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle, Calendar as CalendarIcon, ArrowDown, ArrowUp, Timer, PlayCircle, StopCircle, PhoneForwarded, PhoneOutgoing, BarChartHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";


// --- Tipos de Datos ---
interface ZadarmaCall {
  pbx_call_id: string;
  callstart: string;
  sip: string;
  clid: string;
  destination: string | number;
  disposition: "answered" | "busy" | "cancel" | "no answer" | "failed" | "congestion";
  seconds: number;
}

interface AdvisorPerformance {
  id: string;
  name: string;
  totalCalls: number;
  effectiveCalls: number;
  effectivenessRate: number;
  totalSeconds: number;
  averageCallDuration: number;
  firstCallTime: string | null;
  lastCallTime: string | null;
}

type SortConfig = {
    key: keyof AdvisorPerformance;
    direction: 'ascending' | 'descending';
};

// --- Mapeo de Agentes ---
const agentMap: { [key: string]: string } = {
  "101": "Aylen",
  "104": "Alanis",
  "105": "Marisol",
  "107": "Lisset",
  "108": "Wendy",
  "111": "Luz",
  "113": "Fiorela",
};


export default function AdvisorPerformancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<AdvisorPerformance[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'totalCalls', direction: 'descending' });
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  const { toast } = useToast();
  
  useEffect(() => {
    // Set initial date range to today on client side to avoid hydration errors
    const today = new Date();
    setDate({ from: today, to: today });
  }, []);

    const handleDatePreset = (preset: string) => {
        const to = new Date();
        let from: Date | undefined;

        switch (preset) {
        case 'today':
            from = new Date();
            break;
        case 'yesterday':
            from = subDays(new Date(), 1);
            setDate({ from, to: from });
            return;
        case '7days':
            from = new Date();
            from.setDate(from.getDate() - 6);
            break;
        case '30days':
            from = new Date();
            from.setDate(from.getDate() - 29);
            break;
        }
        setDate({ from, to });
    };

  const fetchAndProcessData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (date?.from) {
        const startDate = new Date(date.from);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date.to || date.from);
        endDate.setHours(23, 59, 59, 999);
        
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }
      
      const response = await fetch(`/api/zadarma/stats?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || "Error al obtener los datos de Zadarma.");
      }

      // --- Lógica de Agregación de Datos ---
      const performanceByAgent: { [key: string]: AdvisorPerformance } = {};

      Object.keys(agentMap).forEach(agentId => {
        performanceByAgent[agentId] = {
          id: agentId,
          name: agentMap[agentId],
          totalCalls: 0,
          effectiveCalls: 0,
          effectivenessRate: 0,
          totalSeconds: 0,
          averageCallDuration: 0,
          firstCallTime: null,
          lastCallTime: null,
        };
      });
      
      const rawCalls: ZadarmaCall[] = data.stats || [];
      const callsByPbxId: { [pbxId: string]: ZadarmaCall[] } = {};

      // 1. Agrupar todas las llamadas por pbx_call_id
      rawCalls.forEach(call => {
          if (!callsByPbxId[call.pbx_call_id]) {
              callsByPbxId[call.pbx_call_id] = [];
          }
          callsByPbxId[call.pbx_call_id].push(call);
      });

      // 2. Procesar cada grupo para crear una llamada consolidada
      const consolidatedCalls: ZadarmaCall[] = Object.values(callsByPbxId).map(group => {
          // Prioriza la llamada que fue 'answered', sino, la de mayor duración.
          group.sort((a, b) => {
              if (a.disposition === 'answered' && b.disposition !== 'answered') return -1;
              if (a.disposition !== 'answered' && b.disposition === 'answered') return 1;
              return b.seconds - a.seconds;
          });
          return group[0];
      });

      // 3. Calcular métricas basadas en las llamadas consolidadas
      consolidatedCalls.forEach(call => {
        const agentId = call.sip;

        if (!performanceByAgent[agentId]) {
          return;
        }

        const agentData = performanceByAgent[agentId];
        const destinationStr = String(call.destination);

        if (destinationStr.length > 3) { // Asegurarse de que son llamadas salientes a números externos
            agentData.totalCalls += 1;
            agentData.totalSeconds += call.seconds;

            if (call.disposition === 'answered') {
                agentData.effectiveCalls += 1;
            }
            
            if (call.callstart) {
                try {
                    const callDate = new Date(call.callstart);
                    const firstCallDate = agentData.firstCallTime ? new Date(agentData.firstCallTime) : null;
                    const lastCallDate = agentData.lastCallTime ? new Date(agentData.lastCallTime) : null;
                    
                    if (!firstCallDate || callDate < firstCallDate) {
                        agentData.firstCallTime = callDate.toISOString(); 
                    }
                    if (!lastCallDate || callDate > lastCallDate) {
                        agentData.lastCallTime = callDate.toISOString(); 
                    }
                } catch (e) {
                    console.error("Error parseando fecha:", call.callstart);
                }
            }
        }
      });
      
      const finalPerformanceData = Object.values(performanceByAgent).map(agent => {
        agent.effectivenessRate = agent.totalCalls > 0 ? (agent.effectiveCalls / agent.totalCalls) * 100 : 0;
        // CORRECCIÓN: Calcular el promedio solo sobre las llamadas efectivas.
        agent.averageCallDuration = agent.effectiveCalls > 0 ? agent.totalSeconds / agent.effectiveCalls : 0;

        if (agent.firstCallTime) {
            try { agent.firstCallTime = format(new Date(agent.firstCallTime), 'HH:mm:ss'); } catch { agent.firstCallTime = "Inválido"; }
        }
        if (agent.lastCallTime) {
            try { agent.lastCallTime = format(new Date(agent.lastCallTime), 'HH:mm:ss'); } catch { agent.lastCallTime = "Inválido"; }
        }
        return agent;
      });

      setPerformanceData(finalPerformanceData);

      if (forceRefresh) {
        toast({
          title: "Informe de Rendimiento Actualizado",
          description: `Se procesaron ${rawCalls.length} registros de llamadas.`,
        });
      }
    } catch (error: any) {
      console.error("Error al procesar el rendimiento de asesores:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    if (date) {
      fetchAndProcessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const sortedPerformanceData = useMemo(() => {
    let sortableItems = [...performanceData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null) return 1;
        if (bValue === null) return -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if ((aValue as number) < (bValue as number)) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if ((aValue as number) > (bValue as number)) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [performanceData, sortConfig]);

  const handleSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const getCallCountColor = (count: number): string => {
    if (count < 60) return "bg-red-500/20 text-red-500 border-red-500/50";
    if (count >= 60 && count <= 100) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/50";
    return "bg-green-500/20 text-green-500 border-green-500/50";
  };
  
  const totalCalls = useMemo(() => performanceData.reduce((acc, agent) => acc + agent.totalCalls, 0), [performanceData]);
  const totalEffectiveCalls = useMemo(() => performanceData.reduce((acc, agent) => acc + agent.effectiveCalls, 0), [performanceData]);
  const averageEffectiveness = totalCalls > 0 ? (totalEffectiveCalls / totalCalls) * 100 : 0;
  
  const chartData = useMemo(() => {
    return [...performanceData]
        .filter(d => d.totalCalls > 0)
        .sort((a,b) => a.totalCalls - b.totalCalls)
        .map(d => ({...d, totalMinutes: Math.ceil(d.totalSeconds / 60)}));
  }, [performanceData]);


  return (
    <div className="space-y-8">
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
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtro Rápido" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="7days">Últimos 7 días</SelectItem>
                    <SelectItem value="30days">Últimos 30 días</SelectItem>
                </SelectContent>
            </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={es} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => fetchAndProcessData(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Calculando rendimiento...</p>
        </div>
      ) : (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Intentos</CardTitle>
                        <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCalls}</div>
                        <p className="text-xs text-muted-foreground">Llamadas salientes realizadas por el equipo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Llamadas Efectivas</CardTitle>
                        <PhoneForwarded className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalEffectiveCalls}</div>
                        <p className="text-xs text-muted-foreground">Llamadas que fueron contestadas</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Efectividad Promedio</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{averageEffectiveness.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">Efectividad promedio del equipo</p>
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5" />Comparativa de Intentos de Llamada</CardTitle>
                        <CardDescription>Total de llamadas salientes realizadas por cada asesor.</CardDescription>
                    </CardHeader>
                    <CardContent className="aspect-video">
                         <ChartContainer config={{ totalCalls: { label: "Intentos", color: "hsl(var(--chart-2))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30}}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{fill: "hsl(var(--muted))"}}/>
                                    <Bar dataKey="totalCalls" name="Intentos" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><CheckCircle className="mr-2 h-5 w-5" />Comparativa de Llamadas Efectivas</CardTitle>
                        <CardDescription>Total de llamadas contestadas por cada asesor.</CardDescription>
                    </CardHeader>
                    <CardContent className="aspect-video">
                        <ChartContainer config={{ effectiveCalls: { label: "Efectivas", color: "hsl(var(--chart-1))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30}}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{fill: "hsl(var(--muted))"}} />
                                    <Bar dataKey="effectiveCalls" name="Efectivas" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Clock className="mr-2 h-5 w-5" />Comparativa de Minutos en Llamada</CardTitle>
                    <CardDescription>Total de minutos que cada asesor ha pasado en llamadas.</CardDescription>
                </CardHeader>
                <CardContent className="aspect-video">
                    <ChartContainer config={{ totalMinutes: { label: "Minutos", color: "hsl(var(--chart-4))" } }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30}}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12 }} />
                                <Tooltip content={<ChartTooltipContent />} cursor={{fill: "hsl(var(--muted))"}}/>
                                <Bar dataKey="totalMinutes" name="Minutos Totales" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Detalle de Rendimiento por Asesor</CardTitle>
                    <CardDescription>Resumen detallado de la actividad de llamadas salientes.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[70vh] p-2">
                    <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                            <TableHead>
                                <Button variant="ghost" onClick={() => handleSort('name')}>Asesor {renderSortArrow('name')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('totalCalls')}>Intentos {renderSortArrow('totalCalls')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('effectiveCalls')}>Efectivas {renderSortArrow('effectiveCalls')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('effectivenessRate')}>Efectividad {renderSortArrow('effectivenessRate')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('totalSeconds')}>Minutos Totales {renderSortArrow('totalSeconds')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('averageCallDuration')}>Duración Prom. (Efectivas) {renderSortArrow('averageCallDuration')}</Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('firstCallTime')}>Primera Llamada {renderSortArrow('firstCallTime')}</Button>
                            </TableHead>
                            <TableHead className="text-right">
                                <Button variant="ghost" onClick={() => handleSort('lastCallTime')}>Última Llamada {renderSortArrow('lastCallTime')}</Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPerformanceData.length > 0 ? (
                        sortedPerformanceData.map((agent) => (
                            <TableRow key={agent.id}>
                                <TableCell className="font-bold">{agent.name} ({agent.id})</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={cn("text-base font-bold", getCallCountColor(agent.totalCalls))}>
                                        {agent.totalCalls}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center font-semibold text-green-500">
                                    <div className="flex items-center justify-center gap-2">
                                        <CheckCircle className="h-4 w-4" />
                                        {agent.effectiveCalls}
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-mono font-semibold">
                                {agent.effectivenessRate.toFixed(1)}%
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                        {Math.ceil(agent.totalSeconds / 60)} min
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Timer className="h-4 w-4 text-muted-foreground" />
                                        {agent.averageCallDuration.toFixed(0)} s
                                    </div>
                                </TableCell>
                                <TableCell className="text-center font-mono">
                                <div className="flex items-center justify-center gap-2 text-green-500">
                                    <PlayCircle className="h-4 w-4" />
                                    {agent.firstCallTime || "N/A"}
                                </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                <div className="flex items-center justify-end gap-2 text-red-500">
                                    <StopCircle className="h-4 w-4" />
                                    {agent.lastCallTime || "N/A"}
                                </div>
                                </TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={8} className="h-24 text-center">
                                No se encontraron datos de rendimiento para el período seleccionado.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}

    