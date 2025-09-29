
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, ArrowDown, ArrowUp, LineChart as LineChartIcon, CheckCircle, XCircle, Percent } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components//ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { DailyMetric, GetMetricsOutput, GetMetricsInput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_daily';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];

type SortConfig = {
    key: keyof DailyMetric | 'totalOrders';
    direction: 'ascending' | 'descending';
};

const capitalize = (s: string) => {
  if (typeof s !== 'string' || !s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function DailyDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });
  const { toast } = useToast();

  const handleDatePreset = (preset: string) => {
    const to = new Date();
    let from: Date | undefined;

    switch (preset) {
      case 'today':
        from = new Date();
        break;
      case '7days':
        from = new Date();
        from.setDate(from.getDate() - 6);
        break;
      case '30days':
        from = new Date();
        from.setDate(from.getDate() - 29);
        break;
      case '6months':
        from = new Date();
        from.setMonth(from.getMonth() - 6);
        break;
      case 'all':
        from = undefined; // o una fecha muy antigua
        break;
    }
    setDate({ from, to });
  };


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

  const handleSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedMetrics = useMemo(() => {
    let sortableItems = [...dailyMetrics];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = sortConfig.key === 'date' ? new Date(a.date.split('-').reverse().join('-')).getTime() : a[sortConfig.key as keyof DailyMetric] as number;
        const bValue = sortConfig.key === 'date' ? new Date(b.date.split('-').reverse().join('-')).getTime() : b[sortConfig.key as keyof DailyMetric] as number;

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [dailyMetrics, sortConfig]);
  
  const chartData = useMemo(() => {
    return [...sortedMetrics].reverse();
  }, [sortedMetrics]);


  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    if (sortConfig.direction === 'ascending') return <ArrowUp className="ml-2 h-4 w-4" />;
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

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
      : sortedMetrics;

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead className="w-[120px]">
              <Button variant="ghost" onClick={() => handleSort('date')}>
                Fecha {renderSortArrow('date')}
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button variant="ghost" onClick={() => handleSort('totalOrders')}>
                Pedidos Totales {renderSortArrow('totalOrders')}
              </Button>
            </TableHead>
            <TableHead className="text-center">
               <Button variant="ghost" onClick={() => handleSort('confirmed')}>
                Confirmados {renderSortArrow('confirmed')}
              </Button>
            </TableHead>
            <TableHead className="text-center">
              <Button variant="ghost" onClick={() => handleSort('unconfirmed')}>
                No Confirmados {renderSortArrow('unconfirmed')}
              </Button>
            </TableHead>
            <TableHead className="w-[220px] text-right">
              <Button variant="ghost" onClick={() => handleSort('confirmationRate')}>
                Tasa de Confirmación {renderSortArrow('confirmationRate')}
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataToRender.length > 0 ? (
            dataToRender.map((metric) => (
              <TableRow key={metric.date}>
                <TableCell className="font-medium">{metric.date}</TableCell>
                <TableCell className="text-center">{metric.totalOrders}</TableCell>
                <TableCell className="text-center text-green-500 font-semibold">{metric.confirmed}</TableCell>
                <TableCell className="text-center text-red-500 font-semibold">{metric.unconfirmed}</TableCell>
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

      <DashboardNav active="daily" />

      {isLoading ? (
            <div className="flex items-center justify-center h-96">
                <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
        <>
            <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5" />Tendencia de Pedidos Totales</CardTitle>
                        <CardDescription>Evolución del total de pedidos (confirmados y no confirmados) en el período.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                         <ChartContainer config={{ totalOrders: { label: "Pedidos Totales", color: "hsl(var(--primary))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="totalOrders" name="Pedidos Totales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-500" /> <XCircle className="mr-2 h-5 w-5 text-red-500" />Composición de Pedidos</CardTitle>
                        <CardDescription>Desglose de pedidos confirmados vs. no confirmados por día.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ChartContainer config={{ 
                            confirmed: { label: "Confirmados", color: "hsl(var(--chart-1))" },
                            unconfirmed: { label: "No Confirmados", color: "hsl(var(--chart-3))" }
                        }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="confirmed" name="Confirmados" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="unconfirmed" name="No Confirmados" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5" />Tendencia de Tasa de Confirmación</CardTitle>
                        <CardDescription>Evolución del porcentaje de pedidos confirmados sobre el total.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                        <ChartContainer config={{ confirmationRate: { label: "Tasa de Confirmación", color: "hsl(var(--chart-2))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                    <Tooltip content={<ChartTooltipContent formatter={(value) => `${(value as number).toFixed(2)}%`} />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="confirmationRate" name="Tasa de Confirmación" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>


            <Card>
                <CardHeader>
                    <CardTitle>Desglose Diario por Tienda</CardTitle>
                    <CardDescription>Usa las pestañas para filtrar los datos por una tienda específica o ver el total.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[70vh] p-2">
                    <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 sticky top-0 bg-card z-10 p-1 h-auto">
                            <TabsTrigger value="all">General</TabsTrigger>
                            {MAIN_STORES.map(store => (
                                <TabsTrigger key={store} value={store} className="capitalize">{capitalize(store)}</TabsTrigger>
                            ))}
                            <TabsTrigger value="others">Otras</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="mt-4">
                            {renderDailyMetricsTable(sortedMetrics)}
                        </TabsContent>
                        {MAIN_STORES.map(store => (
                            <TabsContent key={store} value={store} className="mt-4">
                                {renderDailyMetricsTable(sortedMetrics, store)}
                            </TabsContent>
                        ))}
                        <TabsContent value="others" className="mt-4">
                            {renderDailyMetricsTable(sortedMetrics.map(m => {
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
                </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
