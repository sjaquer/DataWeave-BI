"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle, Calendar as CalendarIcon, ArrowDown, ArrowUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";


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
  totalMinutes: number;
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
};


export default function AdvisorPerformancePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<AdvisorPerformance[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'totalCalls', direction: 'descending' });
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  const { toast } = useToast();

  const fetchAndProcessData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (date?.from) {
        params.append('startDate', date.from.toISOString());
        params.append('endDate', (date.to || date.from).toISOString());
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
          totalMinutes: 0,
          lastCallTime: null
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
          // Ordenar por disposición ('answered' primero) y luego por duración para encontrar el mejor registro
          group.sort((a, b) => {
              if (a.disposition === 'answered' && b.disposition !== 'answered') return -1;
              if (a.disposition !== 'answered' && b.disposition === 'answered') return 1;
              return b.seconds - a.seconds;
          });
          // El primer elemento es el "mejor" registro consolidado.
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

        // Asegurarse de que son llamadas salientes a números externos
        if (destinationStr.length > 3) {
            agentData.totalCalls += 1;
            agentData.totalMinutes += Math.ceil(call.seconds / 60);

            if (call.disposition === 'answered') {
                agentData.effectiveCalls += 1;
            }
            
            if (call.callstart) {
                try {
                    const callDate = new Date(call.callstart);
                    const lastCallDate = agentData.lastCallTime ? new Date(agentData.lastCallTime) : null;
                    
                    // Almacenamos la fecha completa para comparar, luego formateamos solo para mostrar
                    if (!lastCallDate || callDate > lastCallDate) {
                        agentData.lastCallTime = callDate.toISOString(); 
                    }
                } catch (e) {
                    console.error("Error parseando fecha para última llamada:", call.callstart);
                }
            }
        }
      });
      
      const finalPerformanceData = Object.values(performanceByAgent).map(agent => {
        agent.effectivenessRate = agent.totalCalls > 0 ? (agent.effectiveCalls / agent.totalCalls) * 100 : 0;
         // Formatear la hora de la última llamada solo para la visualización
        if (agent.lastCallTime) {
            try {
                agent.lastCallTime = format(new Date(agent.lastCallTime), 'HH:mm:ss');
            } catch {
                agent.lastCallTime = "Inválido";
            }
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
    fetchAndProcessData();
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


  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Informe de Rendimiento de Asesores</h2>
          <p className="text-muted-foreground">Métricas clave de la actividad de llamadas.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
      
      <DashboardNav active="performance" />

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Calculando rendimiento...</p>
        </div>
      ) : (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Rendimiento por Asesor</CardTitle>
                <CardDescription>Resumen de actividad de llamadas salientes.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[70vh] p-2">
                <Table>
                <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>
                             <Button variant="ghost" onClick={() => handleSort('name')}>Asesor {renderSortArrow('name')}</Button>
                        </TableHead>
                        <TableHead className="text-center">
                            <Button variant="ghost" onClick={() => handleSort('totalCalls')}>Llamadas Salientes {renderSortArrow('totalCalls')}</Button>
                        </TableHead>
                        <TableHead className="text-center">
                            <Button variant="ghost" onClick={() => handleSort('effectiveCalls')}>Llamadas Efectivas {renderSortArrow('effectiveCalls')}</Button>
                        </TableHead>
                        <TableHead className="text-center">
                            <Button variant="ghost" onClick={() => handleSort('effectivenessRate')}>Tasa de Efectividad {renderSortArrow('effectivenessRate')}</Button>
                        </TableHead>
                        <TableHead className="text-center">
                            <Button variant="ghost" onClick={() => handleSort('totalMinutes')}>Total Minutos {renderSortArrow('totalMinutes')}</Button>
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
                                    {agent.totalMinutes} min
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-mono">{agent.lastCallTime || "N/A"}</TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No se encontraron datos de rendimiento para el período seleccionado.
                        </TableCell>
                    </TableRow>
                    )}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
