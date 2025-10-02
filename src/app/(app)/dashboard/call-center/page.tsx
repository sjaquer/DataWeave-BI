"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Phone, Hourglass, BarChart3, PieChart as PieChartIcon, PhoneMissed, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from "recharts";
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
             if (!call.pbx_call_id) return acc;
            // Se usa pbx_call_id para agrupar, pero se compara con call_id para obtener el evento más reciente
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

  const parseZadarmaDate = (dateString: string | undefined): Date | null => {
      if (!dateString) return null;
      try {
        // El formato de Zadarma es 'yyyy-MM-dd HH:mm:ss'
        return parse(dateString, "yyyy-MM-dd HH:mm:ss", new Date());
      } catch (e) {
        console.error("Error al parsear fecha de Zadarma:", dateString, e);
        return null;
      }
  };

  const { kpis, dispositionData, hourlyData, agentAHTData, hourlyAHTData } = useMemo(() => {
    if (!callStats || callStats.length === 0) {
      return { kpis: { totalCalls: 0, answeredCalls: 0, abandonedCalls: 0, avgDuration: 0, abandonRate: 0 }, dispositionData: [], hourlyData: [], agentAHTData: [], hourlyAHTData: [] };
    }

    const answeredCalls = callStats.filter(c => c.disposition === 'answered');
    const abandonedCalls = callStats.filter(c => c.disposition === 'no answer' || c.disposition === 'failed');
    
    const totalDuration = answeredCalls.reduce((sum, call) => sum + call.seconds, 0);
    const avgDuration = answeredCalls.length > 0 ? totalDuration / answeredCalls.length : 0;
    const abandonRate = callStats.length > 0 ? (abandonedCalls.length / callStats.length) * 100 : 0;


    const dispositionCounts = callStats.reduce((acc, call) => {
        const status = dispositionMap[call.disposition]?.text || call.disposition;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as { [key: string]: number });

    const dispositionData = Object.entries(dispositionCounts).map(([name, value]) => ({ name, value }));
    
    const hourlyCounts = callStats.reduce((acc, call) => {
        const callDate = parseZadarmaDate(call.call_start);
        if (!callDate) return acc;
        
        const hour = callDate.getHours();
        if (!acc[hour]) acc[hour] = { atendidas: 0, perdidas: 0, totalDuration: 0, callCount: 0 };

        if (call.disposition === 'answered') {
            acc[hour].atendidas++;
            acc[hour].totalDuration += call.seconds;
            acc[hour].callCount++;
        } else if (call.disposition === 'no answer' || call.disposition === 'failed') {
            acc[hour].perdidas++;
        }
        
        return acc;
    }, {} as { [key: number]: { atendidas: number, perdidas: number, totalDuration: number, callCount: number } });
    
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ 
        hour: `${String(i).padStart(2, '0')}:00`, 
        atendidas: hourlyCounts[i]?.atendidas || 0,
        perdidas: hourlyCounts[i]?.perdidas || 0
    }));

    const hourlyAHTData = Array.from({ length: 24 }, (_, i) => ({
        hour: `${String(i).padStart(2, '0')}:00`,
        aht: (hourlyCounts[i]?.callCount > 0) ? (hourlyCounts[i].totalDuration / hourlyCounts[i].callCount) : 0,
    }));
    
    const agentStats = callStats.reduce((acc, call) => {
        const agent = call.sip || 'Desconocido';
        if (!acc[agent]) acc[agent] = { totalDuration: 0, answeredCount: 0 };
        if (call.disposition === 'answered') {
            acc[agent].totalDuration += call.seconds;
            acc[agent].answeredCount++;
        }
        return acc;
    }, {} as { [key: string]: { totalDuration: number, answeredCount: number } });

    const agentAHTData = Object.entries(agentStats)
        .map(([agent, data]) => ({
            agent,
            aht: data.answeredCount > 0 ? Math.round(data.totalDuration / data.answeredCount) : 0,
        }))
        .filter(d => d.aht > 0)
        .sort((a, b) => b.aht - a.aht);

    return {
      kpis: {
        totalCalls: callStats.length,
        answeredCalls: answeredCalls.length,
        abandonedCalls: abandonedCalls.length,
        avgDuration,
        abandonRate,
      },
      dispositionData,
      hourlyData,
      agentAHTData,
      hourlyAHTData,
    };
  }, [callStats]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCallDate = (dateString: string | undefined) => {
    const date = parseZadarmaDate(dateString);
    if (!date) {
      return "Fecha no disponible";
    }
    try {
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Abandono</CardTitle>
                        <PhoneMissed className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.abandonRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">{kpis.abandonedCalls} llamadas perdidas.</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
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
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5" />Llamadas Atendidas vs. Perdidas por Hora</CardTitle>
                        <CardDescription>Actividad de llamadas para detectar horas pico y fallos.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ChartContainer config={{ 
                            atendidas: { label: "Atendidas", color: "hsl(var(--chart-1))" },
                            perdidas: { label: "Perdidas", color: "hsl(var(--destructive))" }
                        }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyData} stackOffset="none">
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--muted))' }}/>
                                    <Legend />
                                    <Bar dataKey="atendidas" fill="hsl(var(--chart-1))" stackId="a" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="perdidas" fill="hsl(var(--destructive))" stackId="a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
             <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Hourglass className="mr-2 h-5 w-5" />Duración Media (AHT) por Agente</CardTitle>
                        <CardDescription>Tiempo promedio en segundos que cada agente dedica por llamada.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                        <ChartContainer config={{ aht: { label: "Segundos", color: "hsl(var(--chart-2))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agentAHTData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="agent" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--chart-2) / 0.1)' }}/>
                                    <Legend />
                                    <Bar dataKey="aht" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" />Tendencia de AHT por Hora</CardTitle>
                        <CardDescription>Evolución de la duración media de la llamada a lo largo del día.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-80">
                         <ChartContainer config={{ aht: { label: "Segundos", color: "hsl(var(--primary))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={hourlyAHTData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--primary) / 0.1)' }}/>
                                    <Legend />
                                    <Line type="monotone" dataKey="aht" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>


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
