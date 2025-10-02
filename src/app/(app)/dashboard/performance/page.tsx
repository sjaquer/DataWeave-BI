"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Users, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
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
  const { toast } = useToast();

  const fetchAndProcessData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/zadarma/stats`);
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
      
      const calls: ZadarmaCall[] = data.stats || [];

      calls.forEach(call => {
        const agentId = call.sip;

        if (!performanceByAgent[agentId]) {
          return;
        }

        const agentData = performanceByAgent[agentId];
        
        const destinationStr = String(call.destination);
        if (destinationStr.length > 3) {
            agentData.totalCalls += 1;
            agentData.totalMinutes += Math.ceil(call.seconds / 60);

            if (call.disposition === 'answered') {
                agentData.effectiveCalls += 1;
            }
            
            if (call.callstart) {
                try {
                    const callDate = parse(call.callstart, 'yyyy-MM-dd HH:mm:ss', new Date());
                    const lastCallDateString = agentData.lastCallTime;
                    
                    let lastCallDate: Date | null = null;
                    if(lastCallDateString) {
                       // Asumimos que el año, mes y día son los de callDate para la comparación
                       const tempDate = new Date(callDate);
                       const timeParts = lastCallDateString.split(':');
                       tempDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]));
                       lastCallDate = tempDate;
                    }

                    if (!lastCallDate || callDate > lastCallDate) {
                        agentData.lastCallTime = format(callDate, 'HH:mm:ss');
                    }
                } catch (e) {
                    console.error("Error parseando fecha para última llamada:", call.callstart);
                }
            }
        }
      });
      
      const finalPerformanceData = Object.values(performanceByAgent).map(agent => {
        agent.effectivenessRate = agent.totalCalls > 0 ? (agent.effectiveCalls / agent.totalCalls) * 100 : 0;
        return agent;
      }).sort((a, b) => b.totalCalls - a.totalCalls);

      setPerformanceData(finalPerformanceData);

      if (forceRefresh) {
        toast({
          title: "Informe de Rendimiento Actualizado",
          description: `Se procesaron ${calls.length} registros de llamadas.`,
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
  }, [toast]);

  useEffect(() => {
    fetchAndProcessData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAndProcessData]);

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
          <p className="text-muted-foreground">Métricas clave de la actividad de llamadas para el día de hoy.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
                <CardDescription>Resumen de actividad de llamadas salientes para hoy.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[70vh] p-2">
                <Table>
                <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                        <TableHead>Asesor</TableHead>
                        <TableHead className="text-center">Llamadas Salientes (Intentos)</TableHead>
                        <TableHead className="text-center">Llamadas Efectivas</TableHead>
                        <TableHead className="text-center">Tasa de Efectividad</TableHead>
                        <TableHead className="text-center">Total Minutos</TableHead>
                        <TableHead className="text-right">Última Llamada</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {performanceData.length > 0 ? (
                    performanceData.map((agent) => (
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
                            No se encontraron datos de rendimiento para el día de hoy.
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
