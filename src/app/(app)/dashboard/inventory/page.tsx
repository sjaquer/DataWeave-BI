
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, Truck, Users, LineChart as LineChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { GetMetricsOutput, GetMetricsInput, InventoryFlowTrend, MostMovedProducts, InventoryPersonnelMetric } from "@/ai/schemas/getMetricsSchema";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_inventory';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;

export default function InventoryDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryFlowTrend, setInventoryFlowTrend] = useState<InventoryFlowTrend[]>([]);
  const [mostMovedProducts, setMostMovedProducts] = useState<MostMovedProducts[]>([]);
  const [inventoryPersonnelMetrics, setInventoryPersonnelMetrics] = useState<InventoryPersonnelMetric[]>([]);
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const { toast } = useToast();

  const handleDatePreset = (preset: string) => {
    const to = new Date();
    let from: Date | undefined;

    switch (preset) {
      case 'today': from = new Date(); break;
      case '7days': from = new Date(); from.setDate(from.getDate() - 6); break;
      case '30days': from = new Date(); from.setDate(from.getDate() - 29); break;
      case '6months': from = new Date(); from.setMonth(from.getMonth() - 6); break;
      case 'all': from = undefined; break;
    }
    setDate({ from, to });
  };

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    if (!data) {
      setIsLoading(false);
      return;
    }
    setInventoryFlowTrend(data.inventoryFlowTrend || []);
    setMostMovedProducts(data.mostMovedProducts || []);
    setInventoryPersonnelMetrics(data.inventoryPersonnelMetrics || []);
    setIsLoading(false);
  }, []);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    const cacheKeyWithDate = `${CACHE_KEY}_${date?.from?.toISOString()}_${date?.to?.toISOString()}`;

    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(cacheKeyWithDate);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            processAndSetMetrics(data);
            return;
          }
        }
      } catch (e) {
        console.error("Error al leer la caché:", e);
        localStorage.removeItem(cacheKeyWithDate);
      }
    }

    try {
      let input: GetMetricsInput = {};
      if (date?.from) {
        const startDate = new Date(date.from);
        startDate.setHours(0, 0, 0, 0);
        const endDate = date.to ? new Date(date.to) : new Date(date.from);
        endDate.setHours(23, 59, 59, 999);
        input = { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      }
      
      const metricsData = await getMetrics(input);

      try {
        const cachePayload = { data: metricsData, timestamp: Date.now() };
        localStorage.setItem(cacheKeyWithDate, JSON.stringify(cachePayload));
      } catch (e) { console.error("Error al guardar en la caché:", e); }

      processAndSetMetrics(metricsData);
    } catch (error) {
      console.error("Error al obtener las métricas de inventario:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudieron cargar las métricas de inventario." });
      setIsLoading(false);
    }
  }, [date, processAndSetMetrics, toast]);

  useEffect(() => {
    fetchMetrics(false);
  }, [date, fetchMetrics]);

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis de Inventario</h2>
          <p className="text-muted-foreground">Flujo, rotación y actividad del personal de inventario.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleDatePreset}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtro Rápido" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="7days">Últimos 7 días</SelectItem>
                  <SelectItem value="30days">Últimos 30 días</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
                  <SelectItem value="all">Ver todo</SelectItem>
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
          <Button className="flex-1 sm:flex-initial" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      <DashboardNav active="inventory" />
      
      {isLoading ? (
        <div className="flex items-center justify-center h-96">
            <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5" />Tendencia de Flujo de Inventario (Entradas vs. Salidas)</CardTitle>
                    <CardDescription>Unidades que entran y salen del inventario por día.</CardDescription>
                </CardHeader>
                <CardContent className="w-full aspect-video">
                  <ChartContainer config={{
                      Entradas: { label: "Entradas", color: "hsl(var(--chart-1))" },
                      Salidas: { label: "Salidas", color: "hsl(var(--chart-2))" },
                    }}>
                     <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={inventoryFlowTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis dataKey="date" />
                         <YAxis />
                         <Tooltip content={<ChartTooltipContent />} />
                         <Legend />
                         <Line type="monotone" dataKey="Entradas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                         <Line type="monotone" dataKey="Salidas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                      </LineChart>
                     </ResponsiveContainer>
                   </ChartContainer>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Truck className="mr-2 h-5 w-5" />Top 10 Productos por Rotación (Salidas)</CardTitle>
                        <CardDescription>Productos con mayor cantidad de movimientos de salida.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] overflow-auto">
                        <ChartContainer config={{ movements: { label: "Movimientos", color: "hsl(var(--chart-2))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={mostMovedProducts.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} interval={0} allowDataOverflow={false} />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Bar dataKey="movements" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Actividad del Equipo de Inventario</CardTitle>
                        <CardDescription>Movimientos de entrada y salida procesados por cada miembro del equipo.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[400px] overflow-auto">
                       <ChartContainer config={{
                            entries: { label: "Entradas", color: "hsl(var(--chart-1))" },
                            exits: { label: "Salidas", color: "hsl(var(--chart-2))" },
                         }}>
                         <ResponsiveContainer width="100%" height="100%">
                           <BarChart data={inventoryPersonnelMetrics} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" stacked />
                              <YAxis dataKey="name" type="category" width={80} />
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              <Bar dataKey="entries" name="Entradas" fill="hsl(var(--chart-1))" stackId="a" />
                              <Bar dataKey="exits" name="Salidas" fill="hsl(var(--chart-2))" stackId="a" />
                           </BarChart>
                         </ResponsiveContainer>
                       </ChartContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}
    </div>
  );
}
