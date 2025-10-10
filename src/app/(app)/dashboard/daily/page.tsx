
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, ArrowDown, ArrowUp, LineChart as LineChartIcon, CheckCircle, XCircle, Percent, DollarSign, Store, MapPin } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, BarChart, Bar } from "recharts";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { SidebarTrigger } from "@/components/ui/sidebar";

const CACHE_KEY = 'dashboardMetricsCache_daily';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];
const ITEMS_PER_PAGE = 15;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c', '#d0ed57'];


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
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'date', direction: 'descending' });
  const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const { toast } = useToast();

  useEffect(() => {
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
    if (!date) return; // No hacer fetch si la fecha no está lista
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
     if(date) {
        fetchMetrics(false);
     }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handleSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
    setVisibleItemsCount(ITEMS_PER_PAGE);
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

  // Calcular métricas de ventas diarias
  const salesMetrics = useMemo(() => {
    const salesData = sortedMetrics.map(m => ({
      date: m.date,
      ventas: m.revenue || 0,
      pedidos: m.confirmed,
      total_pedidos: m.totalOrders
    }));

    const totalRev = salesData.reduce((sum, d) => sum + d.ventas, 0);
    const avgRev = salesData.length > 0 ? totalRev / salesData.length : 0;
    const totalConf = salesData.reduce((sum, d) => sum + d.pedidos, 0);
    const avgDailyOrders = salesData.length > 0 ? totalConf / salesData.length : 0;

    // Extraer todas las tiendas
    const storesSet = new Set<string>();
    sortedMetrics.forEach(m => {
      if (m.byStore) {
        Object.keys(m.byStore).forEach(store => storesSet.add(store));
      }
    });
    const allStores = Array.from(storesSet);

    // Extraer todas las provincias
    const provincesSet = new Set<string>();
    sortedMetrics.forEach(m => {
      if (m.byProvince) {
        Object.keys(m.byProvince).forEach(province => provincesSet.add(province));
      }
    });
    const allProvinces = Array.from(provincesSet);

    // Datos por tienda
    const byStoreData = sortedMetrics.map(m => {
      const result: any = { date: m.date };
      if (m.byStore) {
        Object.entries(m.byStore).forEach(([store, data]) => {
          result[`${store}_ventas`] = data.revenue || 0;
          result[`${store}_pedidos`] = data.confirmed;
        });
      }
      return result;
    }).reverse(); // Reverse para orden cronológico

    // Datos por provincia (top 10)
    const provinceRevenues: { [key: string]: number } = {};
    sortedMetrics.forEach(m => {
      if (m.byProvince) {
        Object.entries(m.byProvince).forEach(([province, data]) => {
          provinceRevenues[province] = (provinceRevenues[province] || 0) + data.revenue;
        });
      }
    });

    const topProvinces = Object.entries(provinceRevenues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name]) => name);

    const byProvinceData = sortedMetrics.map(m => {
      const result: any = { date: m.date };
      if (m.byProvince) {
        topProvinces.forEach(province => {
          const data = m.byProvince?.[province];
          result[`${province}_ventas`] = data?.revenue || 0;
          result[`${province}_pedidos`] = data?.confirmed || 0;
        });
      }
      return result;
    }).reverse();

    return {
      dailySalesData: [...salesData].reverse(),
      totalRevenue: totalRev,
      avgDailyRevenue: avgRev,
      totalConfirmed: totalConf,
      avgDailyOrders: avgDailyOrders,
      allStores,
      allProvinces: topProvinces,
      byStoreData,
      byProvinceData
    };
  }, [sortedMetrics]);


  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    if (sortConfig.direction === 'ascending') return <ArrowUp className="ml-2 h-4 w-4" />;
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const DailyMetricsTable = ({ metrics, storeId }: { metrics: DailyMetric[], storeId?: string }) => {
    const dataToRender = useMemo(() => {
      let data = storeId
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
      
       if (sortConfig !== null) {
            data.sort((a, b) => {
                const key = sortConfig.key as keyof typeof a;
                const aValue = key === 'date' ? new Date(a.date.split('-').reverse().join('-')).getTime() : a[key] as number;
                const bValue = key === 'date' ? new Date(b.date.split('-').reverse().join('-')).getTime() : b[key] as number;

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
      return data;
    }, [metrics, storeId, sortConfig]);

    const visibleData = useMemo(() => {
      return dataToRender.slice(0, visibleItemsCount);
    }, [dataToRender, visibleItemsCount]);

    return (
      <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
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
                    {visibleData.length > 0 ? (
                    visibleData.map((metric) => (
                        <TableRow key={metric.date}>
                        <TableCell className="font-medium whitespace-nowrap">
                            {metric.date}
                        </TableCell>
                        <TableCell className="text-center">
                            {metric.totalOrders}
                        </TableCell>
                        <TableCell className="text-center text-green-500 font-semibold">
                            {metric.confirmed}
                        </TableCell>
                        <TableCell className="text-center text-red-500 font-semibold">
                            {metric.unconfirmed}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-3 whitespace-nowrap">
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
            </div>
          </CardContent>
           {dataToRender.length > visibleItemsCount && (
                <CardFooter className="flex items-center justify-center pt-4">
                    <Button onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}>
                        Cargar más
                    </Button>
                </CardFooter>
            )}
      </Card>
    );
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden"/>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Análisis Detallado por Día</h2>
              <p className="text-muted-foreground">Desglose diario de pedidos por tienda y tasa de éxito.</p>
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

      {isLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
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
                    <CardContent className="h-[250px] overflow-x-auto">
                      <div className="min-w-[600px] h-full">
                        <ChartContainer config={{ totalOrders: { label: "Pedidos Totales", color: "hsl(var(--primary))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="totalOrders" name="Pedidos Totales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="flex items-center"><CheckCircle className="mr-2 h-5 w-5 text-green-500" /> <XCircle className="mr-2 h-5 w-5 text-red-500" />Composición de Pedidos</CardTitle>
                        <CardDescription>Desglose de pedidos confirmados vs. no confirmados por día.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] overflow-x-auto">
                      <div className="min-w-[600px] h-full">
                        <ChartContainer config={{ 
                            confirmed: { label: "Confirmados", color: "hsl(var(--chart-1))" },
                            unconfirmed: { label: "No Confirmados", color: "hsl(var(--chart-3))" }
                        }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                                    <YAxis />
                                    <Tooltip content={<ChartTooltipContent />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="confirmed" name="Confirmados" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                                    <Line type="monotone" dataKey="unconfirmed" name="No Confirmados" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5" />Tendencia de Tasa de Confirmación</CardTitle>
                        <CardDescription>Evolución del porcentaje de pedidos confirmados sobre el total.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[250px] overflow-x-auto">
                      <div className="min-w-[600px] h-full">
                        <ChartContainer config={{ confirmationRate: { label: "Tasa de Confirmación", color: "hsl(var(--chart-2))" } }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
                                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                                    <Tooltip content={<ChartTooltipContent formatter={(value) => `${(value as number).toFixed(2)}%`} />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="confirmationRate" name="Tasa de Confirmación" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                      </div>
                    </CardContent>
                </Card>
            </div>

            {/* NUEVA SECCIÓN: VENTAS DIARIAS */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center">
                            <DollarSign className="mr-2 h-5 w-5" />
                            Ventas Diarias (Ingresos)
                        </CardTitle>
                        <CardDescription>
                            Evolución de ingresos por día - Total acumulado: S/ {salesMetrics.totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 })} 
                            {' '}| Promedio diario: S/ {salesMetrics.avgDailyRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px] overflow-x-auto">
                        <div className="min-w-[800px] h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesMetrics.dailySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fontSize: 12 }} 
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis 
                                        yAxisId="left"
                                        tickFormatter={(value) => `S/ ${value.toFixed(0)}`}
                                    />
                                    <YAxis 
                                        yAxisId="right"
                                        orientation="right"
                                    />
                                    <Tooltip 
                                        formatter={(value: number, name: string) => {
                                            if (name === 'ventas') return [`S/ ${value.toFixed(2)}`, 'Ventas'];
                                            if (name === 'pedidos') return [value, 'Pedidos Confirmados'];
                                            return [value, name];
                                        }}
                                    />
                                    <Legend />
                                    <Line 
                                        yAxisId="left"
                                        type="monotone" 
                                        dataKey="ventas" 
                                        name="Ventas (S/)" 
                                        stroke="#8884d8" 
                                        strokeWidth={3}
                                        dot={{ r: 4 }}
                                    />
                                    <Line 
                                        yAxisId="right"
                                        type="monotone" 
                                        dataKey="pedidos" 
                                        name="Pedidos Confirmados" 
                                        stroke="#82ca9d" 
                                        strokeWidth={2}
                                        dot={{ r: 3 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* NUEVA SECCIÓN: VENTAS POR TIENDA */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center">
                                    <Store className="mr-2 h-5 w-5" />
                                    Ventas Diarias por Tienda
                                </CardTitle>
                                <CardDescription>
                                    Comparativa de ingresos entre tiendas
                                </CardDescription>
                            </div>
                            <Select value={selectedStore} onValueChange={setSelectedStore}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filtrar tienda" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las tiendas</SelectItem>
                                    {salesMetrics.allStores.map((store) => (
                                        <SelectItem key={store} value={store}>
                                            {capitalize(store)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] overflow-x-auto">
                        <div className="min-w-[800px] h-full">
                            {salesMetrics.byStoreData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={salesMetrics.byStoreData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 11 }} 
                                            angle={-45}
                                            textAnchor="end"
                                            height={70}
                                        />
                                        <YAxis tickFormatter={(value) => `S/ ${value.toFixed(0)}`} />
                                        <Tooltip 
                                            formatter={(value: number, name: string) => {
                                                const storeName = name.replace('_ventas', '');
                                                return [`S/ ${value.toFixed(2)}`, capitalize(storeName)];
                                            }}
                                        />
                                        <Legend 
                                            formatter={(value) => capitalize(value.replace('_ventas', ''))}
                                        />
                                        {salesMetrics.allStores.map((store, idx) => {
                                            if (selectedStore !== "all" && selectedStore !== store) return null;
                                            return (
                                                <Area
                                                    key={store}
                                                    type="monotone"
                                                    dataKey={`${store}_ventas`}
                                                    stackId="1"
                                                    stroke={COLORS[idx % COLORS.length]}
                                                    fill={COLORS[idx % COLORS.length]}
                                                    fillOpacity={0.6}
                                                    name={`${store}_ventas`}
                                                />
                                            );
                                        })}
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    No hay datos de ventas por tienda
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* NUEVA SECCIÓN: VENTAS POR PROVINCIA */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center">
                                    <MapPin className="mr-2 h-5 w-5" />
                                    Ventas Diarias por Provincia (Top 10)
                                </CardTitle>
                                <CardDescription>
                                    Distribución geográfica de ingresos
                                </CardDescription>
                            </div>
                            <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                                <SelectTrigger className="w-[200px]">
                                    <SelectValue placeholder="Filtrar provincia" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas (Top 10)</SelectItem>
                                    {salesMetrics.allProvinces.map((province) => (
                                        <SelectItem key={province} value={province}>
                                            {province}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                    <CardContent className="h-[350px] overflow-x-auto">
                        <div className="min-w-[800px] h-full">
                            {salesMetrics.byProvinceData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={salesMetrics.byProvinceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 11 }} 
                                            angle={-45}
                                            textAnchor="end"
                                            height={70}
                                        />
                                        <YAxis tickFormatter={(value) => `S/ ${value.toFixed(0)}`} />
                                        <Tooltip 
                                            formatter={(value: number, name: string) => {
                                                const provinceName = name.replace('_ventas', '');
                                                return [`S/ ${value.toFixed(2)}`, provinceName];
                                            }}
                                        />
                                        <Legend 
                                            formatter={(value) => value.replace('_ventas', '')}
                                        />
                                        {salesMetrics.allProvinces.map((province, idx) => {
                                            if (selectedProvince !== "all" && selectedProvince !== province) return null;
                                            return (
                                                <Bar
                                                    key={province}
                                                    dataKey={`${province}_ventas`}
                                                    fill={COLORS[idx % COLORS.length]}
                                                    name={`${province}_ventas`}
                                                />
                                            );
                                        })}
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    No hay datos de ventas por provincia
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>


            <Card>
                <CardHeader>
                    <CardTitle>Desglose Diario por Tienda</CardTitle>
                    <CardDescription>Usa las pestañas para filtrar los datos por una tienda específica o ver el total.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-2">
                    <Tabs defaultValue="all" className="w-full" onValueChange={() => setVisibleItemsCount(ITEMS_PER_PAGE)}>
                        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 sticky top-0 bg-card z-10 p-1 h-auto">
                            <TabsTrigger value="all">General</TabsTrigger>
                            {MAIN_STORES.map(store => (
                                <TabsTrigger key={store} value={store} className="capitalize">{capitalize(store)}</TabsTrigger>
                            ))}
                            <TabsTrigger value="others">Otras</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="mt-4">
                            <DailyMetricsTable metrics={sortedMetrics} />
                        </TabsContent>
                        {MAIN_STORES.map(store => (
                            <TabsContent key={store} value={store} className="mt-4">
                                <DailyMetricsTable metrics={sortedMetrics} storeId={store} />
                            </TabsContent>
                        ))}
                         <TabsContent value="others" className="mt-4">
                            <DailyMetricsTable metrics={sortedMetrics.map(m => {
                                const otherStoresData = Object.keys(m.byStore || {}).filter(s => !MAIN_STORES.includes(s.toLowerCase())).reduce((acc, key) => {
                                    acc.confirmed += m.byStore![key].confirmed;
                                    acc.unconfirmed += m.byStore![key].unconfirmed;
                                    return acc;
                                }, { confirmed: 0, unconfirmed: 0 });
                                const total = otherStoresData.confirmed + otherStoresData.unconfirmed;
                                return {
                                    ...m,
                                    date: m.date,
                                    confirmed: otherStoresData.confirmed,
                                    unconfirmed: otherStoresData.unconfirmed,
                                    totalOrders: total,
                                    confirmationRate: total > 0 ? (otherStoresData.confirmed / total) * 100 : 0
                                };
                            }).filter(m => m.totalOrders > 0)} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </>
      )}
    </div>
  );
}
