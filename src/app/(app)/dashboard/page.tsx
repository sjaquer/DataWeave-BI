
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, CheckCircle, Percent, Calendar as CalendarIcon, Upload, MapPin, Package, UserCheck, Banknote, RefreshCw, Store, TrendingUp, ShoppingCart, Truck, LineChart as LineChartIcon, Users, ArrowRight, Package2, ArrowDown, ArrowUp, BarChartHorizontal, PieChart as PieChartIcon, TrendingDown, PackageSearch } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList, LineChart, Line, PieChart, Pie, Cell } from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn, findBestProvinceMatch } from "@/lib/utils";
import { provinceList } from "@/lib/provinces";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { ProvinceMetric, ProductMetric, PersonnelMetric, MiscMetrics, GetMetricsOutput, StoreMetric, GetMetricsInput, DailyStorePerformance, DailyMetric, ProductConfirmationRate } from "@/ai/schemas/getMetricsSchema";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";


const CACHE_KEY = 'dashboardMetricsCache_main';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];
const ITEMS_PER_PAGE = 10;


type ProductConfirmationSortConfig = {
    key: keyof ProductConfirmationRate;
    direction: 'ascending' | 'descending';
};

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--primary))",
];

const capitalize = (s: string) => {
  if (typeof s !== 'string' || !s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [fullMetrics, setFullMetrics] = useState<GetMetricsOutput | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState<GetMetricsOutput | null>(null);
  const [selectedStore, setSelectedStore] = useState('all');

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
      case 'yesterday': 
        from = subDays(new Date(), 1);
        setDate({ from, to: from });
        return;
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
      
      const provinceCorrectionsCache: Record<string, string> = {};
      
      if (data.provinceMetrics) {
        const uniqueProvinces = [...new Set(data.provinceMetrics.map((p: ProvinceMetric) => p.name).filter((p: string) => p !== 'Desconocida'))];
        
        uniqueProvinces.forEach((provinceName: string) => {
          if (!provinceCorrectionsCache[provinceName]) {
            const bestMatch = findBestProvinceMatch(provinceName, provinceList);
            provinceCorrectionsCache[provinceName] = bestMatch || provinceName;
          }
        });
        
        const correctedProvinceMetrics = data.provinceMetrics.map((metric: ProvinceMetric) => ({
            ...metric,
            name: provinceCorrectionsCache[metric.name] || metric.name,
        }));

        const aggregatedProvinceMetrics: ProvinceMetric[] = Object.values(
          correctedProvinceMetrics.reduce((acc: Record<string, ProvinceMetric>, metric: ProvinceMetric) => {
              if (!acc[metric.name]) {
                  acc[metric.name] = { ...metric, totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
              }
              acc[metric.name].totalOrders += metric.totalOrders;
              acc[metric.name].confirmedOrders += metric.confirmedOrders;
              acc[metric.name].totalSpent += metric.totalSpent;
              acc[metric.name].confirmationRate = acc[metric.name].totalOrders > 0 ? (acc[metric.name].confirmedOrders / acc[metric.name].totalOrders) * 100 : 0;
              return acc;
          }, {})
        ).sort((a: ProvinceMetric, b: ProvinceMetric) => b.totalOrders - a.totalOrders);
        data.provinceMetrics = aggregatedProvinceMetrics;
      }

      const capitalizedStoreMetrics = (data.storeMetrics || []).map(s => ({
        ...s,
        name: capitalize(s.name)
      })).sort((a,b) => (MAIN_STORES.indexOf(a.name.toLowerCase()) > -1 ? MAIN_STORES.indexOf(a.name.toLowerCase()) : 99) - (MAIN_STORES.indexOf(b.name.toLowerCase()) > -1 ? MAIN_STORES.indexOf(b.name.toLowerCase()) : 99));

      data.storeMetrics = capitalizedStoreMetrics;
      
      setFullMetrics(data);
      setDisplayMetrics(data);
      setIsLoading(false);
  }, []);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setSelectedStore('all'); // Reset store filter on new fetch
    const cacheKeyWithDate = `${CACHE_KEY}_${date?.from?.toISOString()}_${date?.to?.toISOString()}`;

    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(cacheKeyWithDate);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            toast({ title: "Métricas cargadas desde la caché", description: "Mostrando datos guardados localmente." });
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
      toast({ title: "Actualizando métricas...", description: "Obteniendo datos para el período seleccionado." });
      
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
        toast({ variant: "destructive", title: "Error de Caché", description: "No se pudieron guardar las métricas localmente." });
      }

      processAndSetMetrics(metricsData);
      toast({ title: "Métricas Actualizadas", description: "Los datos se han cargado correctamente." });
    } catch (error) {
      console.error("Error al obtener las métricas:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas. Revisa tu conexión y el estado del servidor.",
      });
      setIsLoading(false);
    }
  }, [date, processAndSetMetrics, toast]);

  useEffect(() => {
    fetchMetrics(false);
  }, [date, fetchMetrics]);


  const filterMetricsByStore = useCallback((storeName: string) => {
    if (!fullMetrics) return;

    if (storeName === 'all') {
      setDisplayMetrics(fullMetrics);
      return;
    }
    
    const lowerCaseStoreName = storeName.toLowerCase();
    
    // Filter Daily Metrics
    const filteredDailyMetrics = fullMetrics.dailyMetrics.map((dm: DailyMetric) => {
      const storeData = dm.byStore?.[lowerCaseStoreName];
      if (!storeData) return null;
      const total = storeData.confirmed + storeData.unconfirmed;
      return {
        date: dm.date,
        totalOrders: total,
        confirmed: storeData.confirmed,
        unconfirmed: storeData.unconfirmed,
        confirmationRate: total > 0 ? (storeData.confirmed / total) * 100 : 0,
        byStore: { [lowerCaseStoreName]: storeData }
      };
    }).filter((d): d is DailyMetric => d !== null && d.totalOrders > 0);
    
    // Recalculate Misc Metrics for the store
    let globalConfirmed = 0;
    let globalUnconfirmed = 0;
    filteredDailyMetrics.forEach(dm => {
      globalConfirmed += dm.confirmed;
      globalUnconfirmed += dm.unconfirmed;
    });

    const filteredStoreMetric = fullMetrics.storeMetrics.find(sm => sm.name.toLowerCase() === lowerCaseStoreName);
    
    const filteredPurchasedProducts = filteredStoreMetric?.topProducts.map(p => ({
      name: p.name,
      totalOrders: p.count
    })).sort((a,b) => b.totalOrders - a.totalOrders) || [];

    const filteredMiscMetrics: MiscMetrics = {
      globalConfirmed: globalConfirmed,
      globalUnconfirmed: globalUnconfirmed,
      dailyOrderVariation: fullMetrics.miscMetrics.dailyOrderVariation // This remains global for context
    };

    const newDisplayMetrics: GetMetricsOutput = {
      ...fullMetrics,
      dailyMetrics: filteredDailyMetrics,
      miscMetrics: filteredMiscMetrics,
      mostPurchasedProducts: filteredPurchasedProducts,
      // For simplicity, we keep some metrics global, as recalculating them client-side would be complex
      // For a full implementation, these would need to be recalculated or fetched again
      provinceMetrics: fullMetrics.provinceMetricsByStore?.[lowerCaseStoreName] || [],
      mostRequestedProducts: fullMetrics.mostRequestedProducts, // Requested is global, not store-specific
      personnelMetrics: fullMetrics.personnelMetrics, // This is global across stores
      storeMetrics: fullMetrics.storeMetrics.filter(sm => sm.name.toLowerCase() === lowerCaseStoreName),
      dailyStorePerformance: fullMetrics.dailyStorePerformance, // Keep this global for comparison
      productConfirmationRates: fullMetrics.productConfirmationRates,
    };
    
    setDisplayMetrics(newDisplayMetrics);
    
  }, [fullMetrics]);

  useEffect(() => {
    filterMetricsByStore(selectedStore);
    
    // Set theme
    document.body.classList.remove(...MAIN_STORES.map(s => `theme-${s}`));
    if (selectedStore !== 'all' && MAIN_STORES.includes(selectedStore.toLowerCase())) {
        document.body.classList.add(`theme-${selectedStore.toLowerCase()}`);
    }

  }, [selectedStore, filterMetricsByStore]);


  if (isLoading && !displayMetrics) { 
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-4">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg">Cargando métricas...</p>
          </div>
      </div>
    );
  }

  const {
    miscMetrics,
    provinceMetrics,
    mostRequestedProducts,
    mostPurchasedProducts,
    storeMetrics,
    dailyStorePerformance,
    productConfirmationRates
  } = displayMetrics || {};

  const globalTotal = (miscMetrics?.globalConfirmed ?? 0) + (miscMetrics?.globalUnconfirmed ?? 0);
  const globalRate = globalTotal > 0 ? ((miscMetrics?.globalConfirmed ?? 0) / globalTotal) * 100 : 0;
  
  const totalSpentAllProvinces = provinceMetrics?.reduce((acc, curr) => acc + curr.totalSpent, 0) || 0;
  const averageSpentPerOrder = globalTotal > 0 ? totalSpentAllProvinces / globalTotal : 0;
  
  const dailyVariation = miscMetrics?.dailyOrderVariation ?? 0;
  
  const renderProductList = (products: ProductMetric[] | undefined) => (
    <ul className="space-y-3">
      {products && products.length > 0 ? (
        products.slice(0, 5).map((product, index) => (
          <li key={product.name} className="flex justify-between items-center text-sm">
            <span className="truncate pr-4">{index + 1}. {product.name}</span>
            <span className="font-bold text-primary">{product.totalOrders}</span>
          </li>
        ))
      ) : (
        <li className="text-center text-muted-foreground">No hay datos.</li>
      )}
    </ul>
  );

  const ProductConfirmationTable = ({ products }: { products: ProductConfirmationRate[] | undefined }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortConfig, setSortConfig] = useState<ProductConfirmationSortConfig | null>({ key: 'requested', direction: 'descending' });
    const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);

    const handleSort = (key: ProductConfirmationSortConfig['key']) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const renderSortArrow = (key: ProductConfirmationSortConfig['key']) => {
        if (sortConfig?.key !== key) return null;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
    };

    const filteredAndSortedData = useMemo(() => {
        if (!products) return [];
        let filtered = products.filter(item =>
            searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        if (sortConfig !== null) {
            filtered.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [products, searchQuery, sortConfig]);

    const visibleData = useMemo(() => {
        return filteredAndSortedData.slice(0, visibleItemsCount);
    }, [filteredAndSortedData, visibleItemsCount]);
    
    const getRateColor = (rate: number) => {
        if (rate < 40) return "bg-red-500/20";
        if (rate < 70) return "bg-yellow-500/20";
        return "bg-green-500/20";
    }

    return (
        <div className="space-y-4">
             <div className="relative">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setVisibleItemsCount(ITEMS_PER_PAGE);
                    }}
                    className="pl-10 w-full"
                />
            </div>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        <Button variant="ghost" onClick={() => handleSort('name')}>
                                            Producto {renderSortArrow('name')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-center">
                                        <Button variant="ghost" onClick={() => handleSort('requested')}>
                                            Pedidos {renderSortArrow('requested')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-center">
                                        <Button variant="ghost" onClick={() => handleSort('confirmed')}>
                                            Confirmados {renderSortArrow('confirmed')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right w-[200px]">
                                        <Button variant="ghost" onClick={() => handleSort('confirmationRate')}>
                                            Tasa de Confirmación {renderSortArrow('confirmationRate')}
                                        </Button>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleData.length > 0 ? (
                                    visibleData.map(p => (
                                        <TableRow key={p.name}>
                                            <TableCell className="font-medium whitespace-nowrap">{p.name}</TableCell>
                                            <TableCell className="text-center">{p.requested}</TableCell>
                                            <TableCell className="text-center text-green-500 font-semibold">{p.confirmed}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="font-mono font-semibold w-12">{p.confirmationRate.toFixed(1)}%</span>
                                                    <Progress value={p.confirmationRate} className={cn("h-2 w-24", getRateColor(p.confirmationRate))} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No se encontraron productos.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 {filteredAndSortedData.length > visibleItemsCount && (
                    <CardFooter className="flex justify-center pt-4">
                        <Button onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}>
                            Cargar más
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
  };
  
  const TrendIndicator = ({ value, text, type = 'percent' }: { value: number | undefined; text: string, type?: 'percent' | 'points' }) => {
    if (value === undefined) return null;
    const isPositive = value > 0;
    const isNegative = value < 0;
    const color = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground';
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : ArrowRight;

    const formattedValue = type === 'percent' 
      ? `${value.toFixed(1)}%` 
      : `${value.toFixed(1)} pp`; // pp = puntos porcentuales

    return (
        <div className={`flex items-center text-xs font-semibold ${color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {isPositive && '+'}{formattedValue} {text}
        </div>
    );
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
         <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden"/>
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">
                    {selectedStore === 'all' ? 'Vista general de métricas clave.' : `Métricas para: ${capitalize(selectedStore)}`}
                </p>
            </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleDatePreset}>
              <SelectTrigger className="w-full sm:w-[120px]">
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
              <Button id="date" variant={"outline"} className={cn("w-full sm:w-[260px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={es} />
            </PopoverContent>
          </Popover>
          <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filtrar por Tienda" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Ver Todas las Tiendas</SelectItem>
                  {fullMetrics?.storeMetrics.map(store => (
                    <SelectItem key={store.name} value={store.name.toLowerCase()}>{store.name}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-initial" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
              {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
            <Link href="/dashboard/upload-data" passHref className="flex-1 sm:flex-initial">
              <Button variant="outline" size="sm" className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                Carga Manual
              </Button>
            </Link>
          </div>
        </div>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
              <Package2 className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalTotal.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Confirmados y no confirmados.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{(miscMetrics?.globalConfirmed ?? 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos completados.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Confirmación</CardTitle>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-4xl font-bold", globalRate < 30 ? "text-red-500" : globalRate < 50 ? "text-yellow-500" : "text-green-500")}>
                {globalRate.toFixed(2)}%
              </div>
               <p className="text-xs text-muted-foreground">Porcentaje de confirmados.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Promedio</CardTitle>
              <Banknote className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">S/ {averageSpentPerOrder.toFixed(2)}</div>
               <p className="text-xs text-muted-foreground">Promedio por pedido.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Variación Diaria</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-4xl font-bold ${dailyVariation > 0 ? "text-green-500" : dailyVariation < 0 ? "text-red-500" : ""}`}>
                    {dailyVariation > 0 ? "+" : ""}
                    {dailyVariation.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">vs. el día anterior (Global).</p>
            </CardContent>
          </Card>
      </div>
      
       {selectedStore === 'all' && (
        <>
          <div className="space-y-4 pt-6">
              <h3 className="text-2xl font-bold tracking-tight">Resumen por Tienda</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {(storeMetrics || []).map(store => {
                      const confirmationRateColor =
                          store.confirmationRate < 30
                              ? 'text-red-500'
                              : store.confirmationRate < 50
                              ? 'text-yellow-500'
                              : 'text-green-500';

                      return (
                          <Card key={store.name}>
                              <CardHeader className="flex flex-col items-start space-y-1 pb-4">
                                  <div className="w-full flex items-center justify-between">
                                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                                        <Store className="h-5 w-5 text-primary" />
                                        {store.name}
                                    </CardTitle>
                                    <div className="text-right">
                                        <p className={`text-2xl font-bold ${confirmationRateColor}`}>{store.confirmationRate.toFixed(1)}%</p>
                                        <p className="text-xs text-muted-foreground">Confirmación</p>
                                    </div>
                                  </div>
                                  <div className="w-full space-y-1">
                                    <TrendIndicator value={store.dailyOrderVariation} text="vs día anterior" />
                                    <TrendIndicator value={store.confirmationRateTrend} text="vs día anterior" type="points" />
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-sm font-medium">Totales</p>
                                        <p className="text-lg font-bold">{store.totalOrders}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Confirmados</p>
                                        <p className="text-lg font-bold text-green-500">{store.confirmedOrders}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Ticket Prom.</p>
                                        <p className="text-lg font-bold">S/ {store.averageTicket.toFixed(2)}</p>
                                    </div>
                                </div>
                                <Separator />
                                 <div>
                                    <p className="text-sm font-medium mb-2">Top 2 Productos Comprados</p>
                                    {store.topProducts.length > 0 ? (
                                        <ul className="space-y-1 text-xs text-muted-foreground">
                                            {store.topProducts.map(p => (
                                                <li key={p.name} className="flex justify-between items-center">
                                                    <span className="truncate pr-2">{p.name}</span>
                                                    <span className="font-semibold text-foreground">{p.count}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-center text-muted-foreground py-2">No hay datos de productos.</p>
                                    )}
                                </div>
                              </CardContent>
                          </Card>
                      )
                  })}
              </div>
          </div>
          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5" />Rendimiento Comparativo de Tiendas (Pedidos Confirmados)</CardTitle>
                <CardDescription>Evolución de los pedidos confirmados por día para las tiendas principales.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="min-w-[600px] h-[400px]">
                <ChartContainer
                    config={{
                        dearel: { label: "Dearel", color: "hsl(var(--chart-1))" },
                        blumi: { label: "Blumi", color: "hsl(var(--chart-2))" },
                        novi: { label: "Novi", color: "hsl(var(--chart-3))" },
                        trazto: { label: "Trazto", color: "hsl(var(--chart-4))" },
                        cumbre: { label: "Cumbre", color: "hsl(var(--chart-5))" },
                    }}
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dailyStorePerformance} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                             <Tooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length && dailyStorePerformance) {
                                        const currentIndex = dailyStorePerformance.findIndex(d => d.date === label);
                                        const prevData = currentIndex > 0 ? dailyStorePerformance[currentIndex - 1] : null;

                                        return (
                                            <div className="p-2 text-xs bg-background border rounded-lg shadow-lg">
                                                <p className="font-bold mb-2">{label}</p>
                                                {payload.map((p, i) => {
                                                    const storeName = p.dataKey as string;
                                                    const currentValue = p.value as number;
                                                    const prevValue = prevData ? (prevData[storeName] as number) : null;
                                                    let variation = "N/A";
                                                    if (prevValue !== null && prevValue !== 0) {
                                                        const diff = ((currentValue - prevValue) / prevValue) * 100;
                                                        variation = `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
                                                    } else if (prevValue === 0 && currentValue > 0) {
                                                        variation = "+100%";
                                                    }
                                                    
                                                    const color = p.color || `hsl(var(--chart-${i + 1}))`;

                                                    return (
                                                        <div key={storeName} className="flex justify-between items-center gap-4">
                                                            <span style={{ color }}>● {capitalize(storeName)}: {currentValue}</span>
                                                            <span className={`font-mono text-right ${variation.startsWith('+') ? 'text-green-500' : variation.startsWith('-') ? 'text-red-500' : 'text-muted-foreground'}`}>{variation}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Legend />
                            {MAIN_STORES.map(store => (
                                <Line key={store} type="monotone" dataKey={store} stroke={`var(--color-${store})`} strokeWidth={2} dot={false} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
       )}
       
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 pt-6">
           {selectedStore === 'all' && (
              <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5" />Distribución de Pedidos Confirmados por Tienda</CardTitle>
                    <CardDescription>Porcentaje de contribución de cada tienda al total de pedidos confirmados.</CardDescription>
                </CardHeader>
                <CardContent>
                   {storeMetrics && storeMetrics.filter(s => s.confirmedOrders > 0).length > 0 ? (
                    <div className="overflow-x-auto">
                      <div className="min-w-[400px] h-[400px]">
                     <ChartContainer config={{
                        ...storeMetrics?.reduce((acc, store, index) => {
                          acc[store.name] = { label: store.name, color: COLORS[index % COLORS.length] };
                          return acc;
                        }, {} as any)
                     }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                              <Legend />
                              <Pie
                                  data={storeMetrics.filter(s => s.confirmedOrders > 0)}
                                  dataKey="confirmedOrders"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={120}
                                  labelLine={false}
                                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                    if (!percent || percent === 0) return null;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                    return (
                                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
                                        {`${(percent * 100).toFixed(0)}%`}
                                      </text>
                                    );
                                  }}
                              >
                                  {(storeMetrics.filter(s => s.confirmedOrders > 0)).map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                              </Pie>
                          </PieChart>
                      </ResponsiveContainer>
                     </ChartContainer>
                     </div>
                    </div>
                   ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">No hay datos de pedidos confirmados para mostrar en el gráfico.</p>
                    </div>
                   )}
                </CardContent>
              </Card>
            )}

            <Card className={selectedStore !== 'all' ? 'col-span-2' : ''}>
              <CardHeader>
                  <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5" />Análisis de Provincias</CardTitle>
                  <CardDescription>{selectedStore === 'all' ? 'Top 10 provincias con más pedidos y su gasto total.' : `Top 10 provincias para la tienda ${capitalize(selectedStore)}.`}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[600px] h-[400px]">
                <ChartContainer config={{
                    totalOrders: { label: "Pedidos Totales", color: "hsl(var(--chart-1))" },
                    totalSpent: { label: "Gasto Total", color: "hsl(var(--chart-2))" },
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={(provinceMetrics || []).slice(0, 10)} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} angle={-45} textAnchor="end" />
                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-1))" fontSize={12} />
                        <Tooltip 
                          content={<ChartTooltipContent 
                            formatter={(value, name) => (
                              <div className="flex flex-col">
                                <span className="font-bold">{name === 'totalOrders' ? 'Total Pedidos' : 'Gasto Total'}</span>
                                <span>{name === 'totalSpent' ? `S/ ${(value as number).toFixed(2)}` : value}</span>
                              </div>
                            )}
                          />}
                        />
                        <Legend verticalAlign="top" />
                        <Bar yAxisId="left" dataKey="totalOrders" name="Pedidos Totales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="totalSpent" name="Gasto Total (S/)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
                  </div>
                </div>
              </CardContent>
               <div className="p-4 pt-0 text-center">
                  <Link href="/dashboard/provinces" passHref>
                    <Button variant="outline" className="w-full sm:w-auto">
                        Ver Detalles por Provincia <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
              </div>
          </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5" />Análisis de Tasa de Confirmación por Producto</CardTitle>
                <CardDescription>Busca y filtra para analizar la efectividad de venta por producto.</CardDescription>
            </CardHeader>
            <CardContent>
                <ProductConfirmationTable products={productConfirmationRates} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><ShoppingCart className="mr-2 h-5 w-5" />Top 5 Productos Más Comprados</CardTitle>
                <CardDescription>Productos con más ventas confirmadas.</CardDescription>
            </CardHeader>
            <CardContent>
                {renderProductList(mostPurchasedProducts)}
            </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
              <CardTitle className="flex items-center"><Truck className="mr-2 h-5 w-5" />Resumen de Inventario</CardTitle>
              <CardDescription>Una vista rápida del flujo de inventario y la actividad del equipo.</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                      <p className="text-sm text-muted-foreground">Total Entradas</p>
                      <p className="text-2xl font-bold text-green-500">{(0).toLocaleString()}</p>
                  </div>
                  <div>
                      <p className="text-sm text-muted-foreground">Total Salidas</p>
                      <p className="text-2xl font-bold text-red-500">{(0).toLocaleString()}</p>
                  </div>
              </div>
          </CardContent>
          <div className="p-4 pt-0 text-center">
              <Link href="/dashboard/inventory" passHref>
                  <Button variant="outline" className="w-full sm:w-auto">
                      Ver Análisis de Inventario <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
              </Link>
          </div>
      </Card>
    </div>
  );
}
