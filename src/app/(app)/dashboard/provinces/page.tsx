"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { cn, findBestProvinceMatch } from "@/lib/utils";
import { provinceList } from "@/lib/provinces";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { ProvinceMetric, GetMetricsOutput, GetMetricsInput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_provinces';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;

export default function ProvincesDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [provinceMetrics, setProvinceMetrics] = useState<ProvinceMetric[]>([]);
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
    const provinceCorrectionsCache: Record<string, string> = {};
    if (data.provinceMetrics) {
      const uniqueProvinces = [...new Set(data.provinceMetrics.map(p => p.name).filter(p => p !== 'Desconocida'))];
      uniqueProvinces.forEach(provinceName => {
        if (!provinceCorrectionsCache[provinceName]) {
          const bestMatch = findBestProvinceMatch(provinceName, provinceList);
          provinceCorrectionsCache[provinceName] = bestMatch || provinceName;
        }
      });
      const correctedProvinceMetrics = data.provinceMetrics.map(metric => ({
        ...metric,
        name: provinceCorrectionsCache[metric.name] || metric.name,
      }));
      const aggregatedProvinceMetrics: ProvinceMetric[] = Object.values(
        correctedProvinceMetrics.reduce((acc: Record<string, ProvinceMetric>, metric) => {
          if (!acc[metric.name]) {
            acc[metric.name] = { ...metric, totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
          }
          acc[metric.name].totalOrders += metric.totalOrders;
          acc[metric.name].confirmedOrders += metric.confirmedOrders;
          acc[metric.name].totalSpent += metric.totalSpent;
          acc[metric.name].confirmationRate = acc[metric.name].totalOrders > 0 ? (acc[metric.name].confirmedOrders / acc[metric.name].totalOrders) * 100 : 0;
          return acc;
        }, {})
      ).sort((a, b) => b.totalOrders - a.totalOrders);
      setProvinceMetrics(aggregatedProvinceMetrics);
    }
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
        
        input = {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        };
      }
      
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
    fetchMetrics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis Detallado por Provincia</h2>
          <p className="text-muted-foreground">Desglose completo de pedidos, gasto y tasas de confirmación por provincia.</p>
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
      
      <DashboardNav active="provinces" />
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5" />Métricas por Provincia</CardTitle>
          <CardDescription>Desglose completo de pedidos y gasto por cada provincia.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[70vh] p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
                <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Provincia</TableHead>
                  <TableHead className="text-center">Pedidos Totales</TableHead>
                  <TableHead className="text-center">Pedidos Confirmados</TableHead>
                  <TableHead className="text-right">Gasto Total (S/)</TableHead>
                  <TableHead className="w-[220px] text-right">Tasa de Confirmación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {provinceMetrics.filter(p => p.totalOrders > 0).map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-center">{p.totalOrders}</TableCell>
                    <TableCell className="text-center text-green-500 font-semibold">{p.confirmedOrders}</TableCell>
                    <TableCell className="text-right font-medium">{p.totalSpent.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="font-medium text-sm w-16">{p.confirmationRate.toFixed(2)}%</span>
                        <Progress value={p.confirmationRate} className="h-2 w-[100px]" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
