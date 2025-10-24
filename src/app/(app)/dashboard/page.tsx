
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, CheckCircle, Percent, Calendar as CalendarIcon, Upload, MapPin, Package, UserCheck, Banknote, RefreshCw, Store, TrendingUp, ShoppingCart, Truck, LineChart as LineChartIcon, Users, ArrowRight, Package2, ArrowDown, ArrowUp, BarChartHorizontal, PieChart as PieChartIcon, TrendingDown, PackageSearch, Wallet, CreditCard } from "lucide-react";
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
import type { ProvinceMetric, ProductMetric, PersonnelMetric, MiscMetrics, GetMetricsOutput, StoreMetric, GetMetricsInput, DailyStorePerformance, DailyMetric, ProductConfirmationRate, PaymentMethodMetric } from "@/ai/schemas/getMetricsSchema";
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
  const [tempDate, setTempDate] = useState<DateRange | undefined>(date);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
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
    const filteredDailyMetrics: DailyMetric[] = fullMetrics.dailyMetrics
      .map((dm: DailyMetric) => {
        const storeData = dm.byStore?.[lowerCaseStoreName];
        if (!storeData) return null;
        const total = storeData.confirmed + storeData.unconfirmed;
        return {
          date: dm.date,
          totalOrders: total,
          confirmed: storeData.confirmed,
          unconfirmed: storeData.unconfirmed,
          confirmationRate: total > 0 ? (storeData.confirmed / total) * 100 : 0,
          revenue: dm.revenue,
          byStore: { [lowerCaseStoreName]: storeData },
          byProvince: dm.byProvince
        } as DailyMetric;
      })
      .filter((d): d is DailyMetric => d !== null && d.totalOrders > 0);
    
    // Recalculate Misc Metrics for the store
    let globalConfirmed = 0;
    let globalUnconfirmed = 0;
    filteredDailyMetrics.forEach(dm => {
      if (dm) {
        globalConfirmed += dm.confirmed;
        globalUnconfirmed += dm.unconfirmed;
      }
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

  const paymentMethodMetrics = fullMetrics?.paymentMethodMetrics || [];

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
        <div className="space-y-3 sm:space-y-4">
             <div className="relative">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setVisibleItemsCount(ITEMS_PER_PAGE);
                    }}
                    className="pl-10 w-full text-xs sm:text-sm"
                />
            </div>
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[120px]">
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="h-8 text-xs sm:text-sm">
                                            Producto {renderSortArrow('name')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-center">
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('requested')} className="h-8 text-xs sm:text-sm">
                                            Pedidos {renderSortArrow('requested')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-center hidden sm:table-cell">
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('confirmed')} className="h-8 text-xs sm:text-sm">
                                            Confirmados {renderSortArrow('confirmed')}
                                        </Button>
                                    </TableHead>
                                    <TableHead className="text-right w-[140px] sm:w-[200px]">
                                        <Button variant="ghost" size="sm" onClick={() => handleSort('confirmationRate')} className="h-8 text-xs sm:text-sm">
                                            Tasa {renderSortArrow('confirmationRate')}
                                        </Button>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleData.length > 0 ? (
                                    visibleData.map(p => (
                                        <TableRow key={p.name}>
                                            <TableCell className="font-medium text-xs sm:text-sm">
                                                <div className="max-w-[150px] sm:max-w-none truncate">{p.name}</div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs sm:text-sm">{p.requested}</TableCell>
                                            <TableCell className="text-center text-green-500 font-semibold text-xs sm:text-sm hidden sm:table-cell">{p.confirmed}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1 sm:gap-2">
                                                    <span className="font-mono font-semibold text-[10px] sm:text-sm w-10 sm:w-12">{p.confirmationRate.toFixed(1)}%</span>
                                                    <Progress value={p.confirmationRate} className={cn("h-1.5 sm:h-2 w-16 sm:w-24", getRateColor(p.confirmationRate))} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-xs sm:text-sm">No se encontraron productos.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                 {filteredAndSortedData.length > visibleItemsCount && (
                    <CardFooter className="flex justify-center pt-3 sm:pt-4">
                        <Button size="sm" onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)} className="text-xs sm:text-sm">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {selectedStore === 'all' ? 'Vista general de métricas clave.' : `Métricas para: ${capitalize(selectedStore)}`}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Select onValueChange={handleDatePreset}>
                  <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filtro Rápido" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="yesterday">Ayer</SelectItem>
                      <SelectItem value="7days">7 días</SelectItem>
                      <SelectItem value="30days">30 días</SelectItem>
                      <SelectItem value="6months">6 meses</SelectItem>
                      <SelectItem value="all">Todo</SelectItem>
                  </SelectContent>
              </Select>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button id="date" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate text-xs sm:text-sm">
                      {date?.from ? (date.to ? (<>{format(date.from, "dd/MM", { locale: es })} - {format(date.to, "dd/MM", { locale: es })}</>) : (format(date.from, "dd/MM/yy", { locale: es }))) : ("Rango")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={1} locale={es} className="sm:hidden" />
                  <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2} locale={es} className="hidden sm:block" />
                  <div className="flex items-center justify-end gap-2 p-3 border-t">
                    <Button variant="outline" size="sm" onClick={() => { setTempDate(date); setIsDatePickerOpen(false); }}>Cancelar</Button>
                    <Button size="sm" onClick={() => { if (tempDate) { setDate(tempDate); } setIsDatePickerOpen(false); }}>Aplicar</Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-full col-span-2 sm:col-span-1">
                      <SelectValue placeholder="Filtrar Tienda" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {fullMetrics?.storeMetrics.map(store => (
                        <SelectItem key={store.name} value={store.name.toLowerCase()}>{store.name}</SelectItem>
                      ))}
                  </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
                {isLoading ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Actualizar</span>
              </Button>
              <Link href="/dashboard/upload-data" passHref className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Upload className="h-4 w-4" />
                  <span className="ml-2 hidden sm:inline">Subir Datos</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      
       <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Pedidos Totales</CardTitle>
              <Package2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-4xl font-bold">{globalTotal.toLocaleString()}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Confirmados y pendientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Confirmados</CardTitle>
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-4xl font-bold">{(miscMetrics?.globalConfirmed ?? 0).toLocaleString()}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Pedidos completados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Tasa Confirmación</CardTitle>
              <Percent className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl sm:text-4xl font-bold", globalRate < 30 ? "text-red-500" : globalRate < 50 ? "text-yellow-500" : "text-green-500")}>
                {globalRate.toFixed(1)}%
              </div>
               <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">% de confirmados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Gasto Promedio</CardTitle>
              <Banknote className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-4xl font-bold">S/ {averageSpentPerOrder.toFixed(0)}</div>
               <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Por pedido</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Variación Diaria</CardTitle>
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={`text-2xl sm:text-4xl font-bold ${dailyVariation > 0 ? "text-green-500" : dailyVariation < 0 ? "text-red-500" : ""}`}>
                    {dailyVariation > 0 ? "+" : ""}
                    {dailyVariation.toFixed(1)}%
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">vs. día anterior</p>
            </CardContent>
          </Card>
      </div>
      
       {selectedStore === 'all' && (
        <>
          <div className="space-y-3 sm:space-y-4">
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight">Resumen por Tienda</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-6">
                  {(storeMetrics || []).map(store => {
                      const confirmationRateColor =
                          store.confirmationRate < 30
                              ? 'text-red-500'
                              : store.confirmationRate < 50
                              ? 'text-yellow-500'
                              : 'text-green-500';

                      return (
                          <Card key={store.name}>
                              <CardHeader className="flex flex-col items-start space-y-1 pb-3 sm:pb-4">
                                  <div className="w-full flex items-center justify-between">
                                    <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                                        <Store className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                                        {store.name}
                                    </CardTitle>
                                    <div className="text-right">
                                        <p className={`text-xl sm:text-2xl font-bold ${confirmationRateColor}`}>{store.confirmationRate.toFixed(1)}%</p>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground">Confirmación</p>
                                    </div>
                                  </div>
                                  <div className="w-full space-y-0.5 sm:space-y-1">
                                    <TrendIndicator value={store.dailyOrderVariation} text="vs día anterior" />
                                    <TrendIndicator value={store.confirmationRateTrend} text="vs día anterior" type="points" />
                                  </div>
                              </CardHeader>
                              <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                                    <div>
                                        <p className="text-[10px] sm:text-sm font-medium">Totales</p>
                                        <p className="text-base sm:text-lg font-bold">{store.totalOrders}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-sm font-medium">Confirmados</p>
                                        <p className="text-base sm:text-lg font-bold text-green-500">{store.confirmedOrders}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] sm:text-sm font-medium">Ticket</p>
                                        <p className="text-base sm:text-lg font-bold">S/ {store.averageTicket.toFixed(0)}</p>
                                    </div>
                                </div>
                                <Separator />
                                 <div>
                                    <p className="text-xs sm:text-sm font-medium mb-2">Top Productos</p>
                                    {store.topProducts.length > 0 ? (
                                        <ul className="space-y-1 text-[10px] sm:text-xs text-muted-foreground">
                                            {store.topProducts.map(p => (
                                                <li key={p.name} className="flex justify-between items-center gap-2">
                                                    <span className="truncate">{p.name}</span>
                                                    <span className="font-semibold text-foreground flex-shrink-0">{p.count}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-[10px] sm:text-xs text-center text-muted-foreground py-2">No hay datos</p>
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
                    <CardTitle className="text-base sm:text-xl flex items-center"><LineChartIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Rendimiento por Tienda</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Pedidos confirmados por día</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                 <div className="w-full h-[300px] sm:h-[400px]">
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
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveEnd" angle={-45} textAnchor="end" height={80} />
                          <YAxis tick={{ fontSize: 10 }} />
                           <Tooltip
                              content={({ active, payload, label }) => {
                                  if (active && payload && payload.length && dailyStorePerformance) {
                                      const currentIndex = dailyStorePerformance.findIndex(d => d.date === label);
                                      const prevData = currentIndex > 0 ? dailyStorePerformance[currentIndex - 1] : null;

                                      return (
                                          <div className="p-2 text-[10px] sm:text-xs bg-background border rounded-lg shadow-lg max-w-[200px]">
                                              <p className="font-bold mb-1 text-xs sm:text-sm">{label}</p>
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
                                                      <div key={storeName} className="flex justify-between items-center gap-2">
                                                          <span style={{ color }} className="truncate">● {capitalize(storeName)}: {currentValue}</span>
                                                          <span className={`font-mono text-right text-[9px] sm:text-xs ${variation.startsWith('+') ? 'text-green-500' : variation.startsWith('-') ? 'text-red-500' : 'text-muted-foreground'}`}>{variation}</span>
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      );
                                  }
                                  return null;
                              }}
                          />
                          <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                          {MAIN_STORES.map(store => (
                              <Line key={store} type="monotone" dataKey={store} stroke={`var(--color-${store})`} strokeWidth={2} dot={false} />
                          ))}
                      </LineChart>
                  </ResponsiveContainer>
              </ChartContainer>
             </div>
            </CardContent>
          </Card>
        </>
       )}
       
       <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-2">
           {selectedStore === 'all' && (
              <Card>
                <CardHeader>
                    <CardTitle className="text-base sm:text-xl flex items-center"><PieChartIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Distribución por Tienda</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">% de pedidos confirmados</CardDescription>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                   {storeMetrics && storeMetrics.filter(s => s.confirmedOrders > 0).length > 0 ? (
                     <div className="w-full h-[300px] sm:h-[400px]">
                     <ChartContainer config={{
                        ...storeMetrics?.reduce((acc, store, index) => {
                          acc[store.name] = { label: store.name, color: COLORS[index % COLORS.length] };
                          return acc;
                        }, {} as any)
                     }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                              <Legend wrapperStyle={{ fontSize: '10px' }} iconSize={8} />
                              <Pie
                                  data={storeMetrics.filter(s => s.confirmedOrders > 0)}
                                  dataKey="confirmedOrders"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  outerRadius="70%"
                                  labelLine={false}
                                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                                    if (!percent || percent < 0.05) return null;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                                    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                                    return (
                                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] sm:text-xs font-bold">
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
                   ) : (
                    <div className="flex items-center justify-center h-[300px]">
                        <p className="text-muted-foreground text-xs sm:text-sm">No hay datos</p>
                    </div>
                   )}
                </CardContent>
              </Card>
            )}

            <Card className={selectedStore !== 'all' ? 'col-span-2' : ''}>
              <CardHeader>
                  <CardTitle className="text-base sm:text-xl flex items-center"><MapPin className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Top 10 Provincias</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Pedidos y gasto total</CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
               <div className="w-full h-[350px] sm:h-[450px]">
                <ChartContainer config={{
                    totalOrders: { label: "Pedidos", color: "hsl(var(--chart-1))" },
                    totalSpent: { label: "Gasto S/", color: "hsl(var(--chart-2))" },
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={(provinceMetrics || []).slice(0, 10)} 
                      margin={{ top: 20, right: 20, left: 10, bottom: 80 }}
                      barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 9 }} 
                          tickLine={false} 
                          axisLine={false} 
                          angle={-45} 
                          textAnchor="end" 
                          interval={0}
                          height={70}
                        />
                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" tick={{ fontSize: 9 }} width={40} />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-1))" tick={{ fontSize: 9 }} width={40} />
                        <Tooltip 
                          content={<ChartTooltipContent 
                            formatter={(value, name) => (
                              <div className="flex flex-col text-xs">
                                <span className="font-bold">{name === 'totalOrders' ? 'Pedidos' : 'Gasto'}</span>
                                <span>{name === 'totalSpent' ? `S/ ${(value as number).toFixed(2)}` : value}</span>
                              </div>
                            )}
                          />}
                        />
                        <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} iconSize={8} />
                        <Bar 
                          yAxisId="left" 
                          dataKey="totalOrders" 
                          name="Pedidos" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                        <Bar 
                          yAxisId="right" 
                          dataKey="totalSpent" 
                          name="Gasto (S/)" 
                          fill="hsl(var(--chart-1))" 
                          radius={[4, 4, 0, 0]}
                          maxBarSize={60}
                        />
                      </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
               </div>
              </CardContent>
               <div className="p-2 sm:p-4 pt-0 text-center">
                  <Link href="/dashboard/provinces" passHref>
                    <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                        Ver Detalles <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </Link>
              </div>
          </Card>
      </div>
      
      {/* MÉTODOS DE PAGO */}
      {paymentMethodMetrics && paymentMethodMetrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-xl flex items-center">
                <Wallet className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Distribución por Método de Pago
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Gráfico de pastel de métodos de pago
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="w-full h-[300px] sm:h-[350px]">
                <ChartContainer config={{
                  revenue: { label: "Ingresos", color: "hsl(var(--chart-1))" },
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentMethodMetrics}
                        dataKey="totalRevenue"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="hsl(var(--primary))"
                        label={({ method, percentageOfTotal }) => 
                          `${method}: ${percentageOfTotal.toFixed(1)}%`
                        }
                      >
                        {paymentMethodMetrics.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`hsl(var(--chart-${(index % 5) + 1}))`} 
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-md">
                              <div className="font-semibold">{data.method}</div>
                              <div className="text-xs text-muted-foreground">
                                Pedidos: {data.totalOrders}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Ingresos: S/ {data.totalRevenue.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Promedio: S/ {data.averageOrderValue.toFixed(2)}
                              </div>
                              <div className="text-xs font-semibold">
                                {data.percentageOfTotal.toFixed(1)}% del total
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-xl flex items-center">
                <CreditCard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                Comparación de Métodos de Pago
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Pedidos e ingresos por método
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
              <div className="w-full h-[300px] sm:h-[350px]">
                <ChartContainer config={{
                  orders: { label: "Pedidos", color: "hsl(var(--primary))" },
                  revenue: { label: "Ingresos (S/)", color: "hsl(var(--chart-1))" },
                }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={paymentMethodMetrics}
                      margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="method" 
                        angle={-45} 
                        textAnchor="end" 
                        height={60}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis 
                        yAxisId="left"
                        orientation="left"
                        width={40}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        width={50}
                        style={{ fontSize: '11px' }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background p-2 shadow-md">
                              <div className="font-semibold">{data.method}</div>
                              <div className="text-xs text-muted-foreground">
                                Pedidos: {data.totalOrders}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Ingresos: S/ {data.totalRevenue.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Promedio: S/ {data.averageOrderValue.toFixed(2)}
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: '10px', paddingBottom: '10px' }} iconSize={8} />
                      <Bar 
                        yAxisId="left" 
                        dataKey="totalOrders" 
                        name="Pedidos" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      />
                      <Bar 
                        yAxisId="right" 
                        dataKey="totalRevenue" 
                        name="Ingresos (S/)" 
                        fill="hsl(var(--chart-1))" 
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-base sm:text-xl flex items-center"><Percent className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Tasa de Confirmación por Producto</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Analiza la efectividad de venta por producto</CardDescription>
            </CardHeader>
            <CardContent className="p-2 sm:p-6">
                <ProductConfirmationTable products={productConfirmationRates} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-base sm:text-xl flex items-center"><ShoppingCart className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Top 5 Más Comprados</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Productos con más ventas</CardDescription>
            </CardHeader>
            <CardContent>
                {renderProductList(mostPurchasedProducts)}
            </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
              <CardTitle className="text-base sm:text-xl flex items-center"><Truck className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />Resumen de Inventario</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Flujo de inventario y actividad del equipo</CardDescription>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Entradas</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-500">{(0).toLocaleString()}</p>
                  </div>
                  <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Total Salidas</p>
                      <p className="text-xl sm:text-2xl font-bold text-red-500">{(0).toLocaleString()}</p>
                  </div>
              </div>
          </CardContent>
          <div className="p-2 sm:p-4 pt-0 text-center">
              <Link href="/dashboard/inventory" passHref>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
                      Ver Inventario <ArrowRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
              </Link>
          </div>
      </Card>
    </div>
  );
}
