"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Phone, Hourglass, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell } from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";


// Tipado para los datos de las llamadas que esperamos de nuestra API
interface ZadarmaCall {
  pbx_call_id: string;
  call_id: string; // ID único del evento de llamada
  call_start: string;
  sip: string;
  clid: string;
  destination: string;
  disposition: "answered" | "busy" | "cancel" | "no answer" | "failed" | "congestion";
  seconds: number;
  is_recorded: boolean;
}

const dispositionMap: { [key: string]: { text: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
  answered: { text: "Contestada", variant: "default" },
  busy: { text: "Ocupado", variant: "secondary" },
  cancel: { text: "Cancelada", variant: "secondary" },
  "no answer": { text: "No contestada", variant: "destructive" },
  failed: { text: "Fallida", variant: "destructive" },
  congestion: { text: "Congestión", variant: "destructive" },
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];


export default function CallCenterPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [callStats, setCallStats] = useState<ZadarmaCall[]>([]);
  const { toast } = useToast();

  const fetchCallStats = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/zadarma/stats');
      const data = await response.json();

      if (response.ok && data.status === 'success') {
        const uniqueCalls = Object.values(
          (data.stats || []).reduce((acc: { [key: string]: ZadarmaCall }, call: ZadarmaCall) => {
            if (!acc[call.pbx_call_id] || call.call_id > acc[call.pbx_call_id].call_id) {
              acc[call.pbx_call_id] = call;
            }
            return acc;
          }, {})
        );
        
        setCallStats(uniqueCalls);
        
        if (forceRefresh) {
            toast({
                title: "Estadísticas de llamadas actualizadas",
                description: `Se encontraron ${uniqueCalls.length} llamadas únicas para hoy.`,
            });
        }
      } else {
        throw new Error(data.message || "Error al obtener los datos de Zadarma.");
      }
    } catch (error: any) {
      console.error("Error al obtener las estadísticas de llamadas:", error);
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
    fetchCallStats();
  }, [fetchCallStats]);

  const { kpis, dispositionData, hourlyData, agentData } = useMemo(() => {
    if (!callStats || callStats.length === 0) {
      return { kpis: { totalCalls: 0, answeredCalls: 0, avgDuration: 0 }, dispositionData: [], hourlyData: [], agentData: [] };
    }

    const answeredCalls = callStats.filter(c => c.disposition === 'answered');
    const totalDuration = answeredCalls.reduce((sum, call) => sum + call.seconds, 0);
    const avgDuration = answeredCalls.length > 0 ? totalDuration / answeredCalls.length : 0;

    const dispositionCounts = callStats.reduce((acc, call) => {
        const status = dispositionMap[call.disposition]?.text || call.disposition;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });

    const dispositionData = Object.entries(dispositionCounts).map(([name, value]) => ({ name, value }));

    const hourlyCounts = callStats.reduce((acc, call) => {
        try {
            const hour = parse(call.call_start, "yyyy-MM-dd HH:mm:ss", new Date()).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
        } catch (e) {
            // Ignorar si la fecha es inválida
        }
        return acc;
    }, {} as { [key: number]: number });
    
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: `${String(i).padStart(2, '0')}:00`, llamadas: hourlyCounts[i] || 0 }));
    
    const agentCounts = callStats.reduce((acc, call) => {
        const agent = call.sip || 'Desconocido';
        acc[agent] = (acc[agent] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });

    const agentData = Object.entries(agentCounts).map(([agent, llamadas]) => ({ agent, llamadas })).sort((a,b) => b.llamadas - a.llamadas);

    return {
      kpis: {
        totalCalls: callStats.length,
        answeredCalls: answeredCalls.length,
        avgDuration: avgDuration,
      },
      dispositionData,
      hourlyData,
      agentData
    };
  }, [callStats]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCallDate = (dateString: string | undefined) => {
    if (!dateString) {
      return "Fecha no disponible";
    }
    try {
      const date = parse(dateString, "yyyy-MM-dd HH:mm:ss", new Date());
      return format(date, "d MMM yyyy, HH:mm:ss", { locale: es });
    } catch (error) {
      console.error("Error al formatear la fecha:", dateString, error);
      return "Fecha inválida";
    }
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Call Center</h2>
          <p className="text-muted-foreground">Análisis de rendimiento de llamadas con datos de Zadarma.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCallStats(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      <DashboardNav active="call-center" />

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Llamadas (Hoy)</CardTitle>
                        <Phone className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.totalCalls}</div>
                        <p className="text-xs text-muted-foreground">Llamadas entrantes y salientes.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Duración Media (AHT)</CardTitle>
                        <Hourglass className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatDuration(kpis.avgDuration)}</div>
                        <p className="text-xs text-muted-foreground">Promedio de llamadas contestadas.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Llamadas Contestadas</CardTitle>
                        <Phone className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.answeredCalls}</div>
                        <p className="text-xs text-muted-foreground">
                            {kpis.totalCalls > 0 ? `${((kpis.answeredCalls / kpis.totalCalls) * 100).toFixed(1)}% de efectividad` : 'Sin llamadas'}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5" />Distribución de Resultados</CardTitle>
                        <CardDescription>Desglose del estado final de todas las llamadas.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                         <ChartContainer config={{}}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                                    <Legend />
                                    <Pie data={dispositionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {dispositionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" />Volumen de Llamadas por Hora</CardTitle>
                        <CardDescription>Actividad de llamadas a lo largo del día para detectar horas pico.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ChartContainer config={{ llamadas: { label: "Llamadas", color: "hsl(var(--primary))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}/>
                                    <Legend />
                                    <Bar dataKey="llamadas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" />Tráfico por Agente</CardTitle>
                    <CardDescription>Total de llamadas gestionadas por cada extensión SIP.</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                    <ChartContainer config={{ llamadas: { label: "Llamadas", color: "hsl(var(--chart-2))" } }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={agentData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="agent" tick={{ fontSize: 12 }} />
                                <YAxis />
                                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--chart-2) / 0.1)' }}/>
                                <Legend />
                                <Bar dataKey="llamadas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Phone className="mr-2 h-5 w-5" />Llamadas del Día</CardTitle>
                    <CardDescription>Registro de las llamadas más recientes procesadas por Zadarma.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[70vh] p-2">
                    <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                        <TableHead>Fecha y Hora</TableHead>
                        <TableHead>Agente (SIP)</TableHead>
                        <TableHead>Origen</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-center">Duración</TableHead>
                        <TableHead className="text-right">Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {callStats.length > 0 ? (
                        callStats.map((call) => (
                            <TableRow key={`${call.pbx_call_id}-${call.call_id}`}>
                            <TableCell className="font-medium">
                                {formatCallDate(call.call_start)}
                            </TableCell>
                            <TableCell>{call.sip}</TableCell>
                            <TableCell>{call.clid}</TableCell>
                            <TableCell>{call.destination}</TableCell>
                            <TableCell className="text-center">{formatDuration(call.seconds)}</TableCell>
                            <TableCell className="text-right">
                                <Badge variant={dispositionMap[call.disposition]?.variant || "secondary"}>
                                {dispositionMap[call.disposition]?.text || call.disposition}
                                </Badge>
                            </TableCell>
                            </TableRow>
                        ))
                        ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                            No se encontraron registros de llamadas para el día de hoy.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
