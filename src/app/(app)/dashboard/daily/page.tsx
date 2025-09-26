"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { DailyMetric, GetMetricsOutput, GetMetricsInput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_daily';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];

const capitalize = (s: string) => {
  if (typeof s !== 'string' || !s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function DailyDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    return { from: startDate, to: endDate };
  });
  const { toast } = useToast();

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    if (!data) {
      setIsLoading(false);
      return;
    }
    setDailyMetrics(data.dailyMetrics || []);
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
      const input: GetMetricsInput = date?.from && date?.to ? {
        startDate: date.from.toISOString(),
        endDate: date.to.toISOString()
      } : {};
      const metricsData = await getMetrics(input);

      try {
        const cachePayload = { data: metricsData, timestamp: Date.now() };
        localStorage.setItem(cacheKeyWithDate, JSON.stringify(cachePayload));
      } catch (e) {
        console.error("Error al guardar en la caché:", e);
      }

      processAndSetMetrics(metricsData);
    } catch (error) {
      console.error("Error al obtener las métricas:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas.",
      });
      setIsLoading(false);
    }
  }, [date, processAndSetMetrics, toast]);

  useEffect(() => {
    if (date?.from && date?.to) {
      fetchMetrics(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const renderDailyMetricsTable = (metrics: DailyMetric[], storeId?: string) => {
    const dataToRender = storeId
      ? metrics.map(m => {
          const storeData = m.byStore?.[storeId] || { confirmed: 0, unconfirmed: 0 };
          const total = storeData.confirmed + storeData.unconfirmed;
          return {
            date: m.date,
            confirmed: storeData.confirmed,
            unconfirmed: storeData.unconfirmed,
            totalOrders: total,
            confirmationRate: total > 0 ? (storeData.confirmed / total) * 100 : 0,
          };
        }).filter(m => m.totalOrders > 0)
      : metrics;

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead className="w-[120px]">Fecha</TableHead>
            <TableHead className="text-center">Confirmados</TableHead>
            <TableHead className="text-center">No Confirmados</TableHead>
            <TableHead className="text-center">Pedidos Totales</TableHead>
            <TableHead className="w-[220px] text-right">Tasa de Confirmación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataToRender.length > 0 ? (
            dataToRender.map((metric) => (
              <TableRow key={metric.date}>
                <TableCell className="font-medium">{metric.date}</TableCell>
                <TableCell className="text-center text-green-500 font-semibold">{metric.confirmed}</TableCell>
                <TableCell className="text-center text-red-500 font-semibold">{metric.unconfirmed}</TableCell>
                <TableCell className="text-center">{metric.totalOrders}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className="font-medium text-sm w-16">{metric.confirmationRate.toFixed(2)}%</span>
                    <Progress value={metric.confirmationRate} className="h-2 w-[100px]" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">No se encontraron datos de pedidos para esta selección.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis Detallado por Día</h2>
          <p className="text-muted-foreground">Desglose diario de pedidos por tienda y tasa de éxito.</p>
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
          <Button className="flex-1 sm:flex-initial" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      <DashboardNav active="daily" />

      <Card>
        <CardHeader>
            <CardTitle>Desglose Diario por Tienda</CardTitle>
            <CardDescription>Usa las pestañas para filtrar los datos por una tienda específica o ver el total.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[70vh] p-2">
            {isLoading ? (
                 <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                 </div>
            ) : (
                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 sticky top-0 bg-card z-10 p-1 h-auto">
                        <TabsTrigger value="all">General</TabsTrigger>
                        {MAIN_STORES.map(store => (
                            <TabsTrigger key={store} value={store} className="capitalize">{capitalize(store)}</TabsTrigger>
                        ))}
                        <TabsTrigger value="others">Otras</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all" className="mt-4">
                        {renderDailyMetricsTable(dailyMetrics)}
                    </TabsContent>
                    {MAIN_STORES.map(store => (
                        <TabsContent key={store} value={store} className="mt-4">
                            {renderDailyMetricsTable(dailyMetrics, store)}
                        </TabsContent>
                    ))}
                    <TabsContent value="others" className="mt-4">
                        {renderDailyMetricsTable(dailyMetrics.map(m => {
                            const otherStoresData = Object.keys(m.byStore || {}).filter(s => !MAIN_STORES.includes(s.toLowerCase())).reduce((acc, key) => {
                                acc.confirmed += m.byStore![key].confirmed;
                                acc.unconfirmed += m.byStore![key].unconfirmed;
                                return acc;
                            }, { confirmed: 0, unconfirmed: 0 });
                            const total = otherStoresData.confirmed + otherStoresData.unconfirmed;
                            return {
                                ...m,
                                confirmed: otherStoresData.confirmed,
                                unconfirmed: otherStoresData.unconfirmed,
                                totalOrders: total,
                                confirmationRate: total > 0 ? (otherStoresData.confirmed / total) * 100 : 0
                            };
                        }).filter(m => m.totalOrders > 0))}
                    </TabsContent>
                </Tabs>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
