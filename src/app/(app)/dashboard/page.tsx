"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, CheckCircle, Percent, Calendar as CalendarIcon, Upload, MapPin, Package, UserCheck, Banknote, RefreshCw, Store, TrendingUp, ShoppingCart, Truck, LineChart as LineChartIcon, Users, ArrowRight, Package2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LabelList, LineChart, Line } from "recharts";

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
import type { ProvinceMetric, ProductMetric, PersonnelMetric, MiscMetrics, GetMetricsOutput, StoreMetric, GetMetricsInput, InventoryOutflowTrend, MostMovedProducts } from "@/ai/schemas/getMetricsSchema";
import DashboardNav from "@/components/DashboardNav";
import { Separator } from "@/components/ui/separator";

const CACHE_KEY = 'dashboardMetricsCache';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutos
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];


// Helper function to capitalize the first letter of a string
const capitalize = (s: string) => {
  if (typeof s !== 'string' || !s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
};


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Estados de Métricas Agregadas ---
  const [miscMetrics, setMiscMetrics] = useState<MiscMetrics | null>(null);
  const [provinceMetrics, setProvinceMetrics] = useState<ProvinceMetric[]>([]);
  const [mostRequestedProducts, setMostRequestedProducts] = useState<ProductMetric[]>([]);
  const [mostPurchasedProducts, setMostPurchasedProducts] = useState<ProductMetric[]>([]);
  const [personnelMetrics, setPersonnelMetrics] = useState<PersonnelMetric[]>([]);
  const [storeMetrics, setStoreMetrics] = useState<StoreMetric[]>([]);
  const [inventoryOutflowTrend, setInventoryOutflowTrend] = useState<InventoryOutflowTrend[]>([]);
  const [mostMovedProducts, setMostMovedProducts] = useState<MostMovedProducts[]>([]);


  // Estado para el filtro de fechas
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 6);
    return { from: startDate, to: endDate };
  });
  
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
        setProvinceMetrics(aggregatedProvinceMetrics);
      }

      const capitalizedStoreMetrics = (data.storeMetrics || []).map(s => ({
        ...s,
        name: capitalize(s.name)
      })).sort((a,b) => (MAIN_STORES.indexOf(a.name.toLowerCase()) > -1 ? MAIN_STORES.indexOf(a.name.toLowerCase()) : 99) - (MAIN_STORES.indexOf(b.name.toLowerCase()) > -1 ? MAIN_STORES.indexOf(b.name.toLowerCase()) : 99));

      setMiscMetrics(data.miscMetrics || null);
      setMostRequestedProducts(data.mostRequestedProducts || []);
      setMostPurchasedProducts(data.mostPurchasedProducts || []);
      setPersonnelMetrics(data.personnelMetrics || []);
      setStoreMetrics(capitalizedStoreMetrics);
      setInventoryOutflowTrend(data.inventoryOutflowTrend || []);
      setMostMovedProducts(data.mostMovedProducts || []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);


  if (isLoading && !miscMetrics) { 
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center min-h-screen">
          <div className="flex items-center gap-4">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg">Cargando métricas...</p>
          </div>
      </div>
    );
  }

  const globalTotal = (miscMetrics?.globalConfirmed ?? 0) + (miscMetrics?.globalUnconfirmed ?? 0);
  const globalRate = globalTotal > 0 ? ((miscMetrics?.globalConfirmed ?? 0) / globalTotal) * 100 : 0;
  const totalSpentAllProvinces = provinceMetrics.reduce((acc, curr) => acc + curr.totalSpent, 0);
  const averageSpentPerOrder = globalTotal > 0 ? totalSpentAllProvinces / globalTotal : 0;
  
  const renderProductList = (products: ProductMetric[]) => (
    <ul className="space-y-3">
      {products.length > 0 ? (
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

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Inteligencia de Negocio</h2>
          <p className="text-muted-foreground">Una vista general de las métricas clave de tu negocio.</p>
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
              <Button
                id="date"
                variant={"outline"}
                className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                      {format(date.to, "LLL dd, y", { locale: es })}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y", { locale: es })
                  )
                ) : (
                  <span>Selecciona un rango</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                locale={es}
              />
            </PopoverContent>
          </Popover>
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
      
      <DashboardNav active="main" />

       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Gasto Promedio por Pedido</CardTitle>
              <Banknote className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">S/ {averageSpentPerOrder.toFixed(2)}</div>
               <p className="text-xs text-muted-foreground">Promedio en todos los pedidos.</p>
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
              <CardTitle className="text-sm font-medium">Tasa de Confirmación Global</CardTitle>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalRate.toFixed(2)}%</div>
               <p className="text-xs text-muted-foreground">Porcentaje global de confirmados.</p>
            </CardContent>
          </Card>
      </div>
      
       <div className="space-y-4 pt-6">
          <h3 className="text-2xl font-bold tracking-tight">Análisis por Tienda</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {storeMetrics.map(store => (
                  <Card key={store.name}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                          <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <Store className="h-5 w-5 text-primary" />
                            {store.name}
                          </CardTitle>
                          <div className="text-right">
                             <p className="text-2xl font-bold">{store.confirmationRate.toFixed(1)}%</p>
                             <p className="text-xs text-muted-foreground">Confirmación</p>
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
              ))}
          </div>
      </div>

       <Card>
          <CardHeader>
              <CardTitle className="flex items-center"><Store className="mr-2 h-5 w-5" />Pedidos vs Confirmados por Tienda</CardTitle>
              <CardDescription>Comparativa de pedidos totales vs. pedidos confirmados para cada tienda.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px]">
             <ChartContainer config={{
                  totalOrders: { label: "Pedidos", color: "hsl(var(--chart-1))" },
                  confirmedOrders: { label: "Confirmados", color: "hsl(var(--chart-2))" },
              }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={storeMetrics.filter(s => s.totalOrders > 0)} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis fontSize={12} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend verticalAlign="top" />
                        <Bar dataKey="totalOrders" name="Pedidos" fill="hsl(var(--primary-foreground))" fillOpacity={0.3} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="confirmedOrders" name="Confirmados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                           <LabelList
                              dataKey="confirmationRate"
                              position="top"
                              formatter={(value: number) => `${value.toFixed(1)}%`}
                              className="fill-foreground"
                              fontSize={12}
                            />
                        </Bar>
                      </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
          </CardContent>
      </Card>

      <div className="space-y-4 pt-6">
          <h3 className="text-2xl font-bold tracking-tight">Análisis de Inventario</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
              <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5" />Tendencia de Salida de Inventario</CardTitle>
                    <CardDescription>Unidades totales que salen del inventario por día.</CardDescription>
                </CardHeader>
                <CardContent className="w-full aspect-video">
                  <ChartContainer config={{ units: { label: "Unidades", color: "hsl(var(--chart-1))" } }}>
                     <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={inventoryOutflowTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                         <CartesianGrid strokeDasharray="3 3" />
                         <XAxis dataKey="date" />
                         <YAxis />
                         <Tooltip content={<ChartTooltipContent />} />
                         <Legend />
                         <Line type="monotone" dataKey="units" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                      </LineChart>
                     </ResponsiveContainer>
                   </ChartContainer>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Truck className="mr-2 h-5 w-5" />Top 10 Productos por Rotación (Salidas)</CardTitle>
                    <CardDescription>Productos con mayor cantidad de movimientos de salida.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                    <ChartContainer config={{ movements: { label: "Movimientos", color: "hsl(var(--chart-2))" } }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mostMovedProducts.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
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
                    <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Rendimiento del Equipo (Movimientos)</CardTitle>
                    <CardDescription>Movimientos de salida procesados por cada miembro del equipo.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                   <ChartContainer config={{ confirmedOrders: { label: "Movimientos", color: "hsl(var(--chart-1))" } }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={personnelMetrics} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={80} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Legend />
                          <Bar dataKey="confirmedOrders" name="Movimientos" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                   </ChartContainer>
                </CardContent>
            </Card>
          </div>
      </div>


      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 pt-6">
           <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5" />Análisis de Provincias</CardTitle>
                  <CardDescription>Top 10 provincias con más pedidos y su gasto total.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartContainer config={{
                      totalOrders: { label: "Pedidos Totales", color: "hsl(var(--chart-1))" },
                      totalSpent: { label: "Gasto Total", color: "hsl(var(--chart-2))" },
                  }}>
                    <BarChart data={provinceMetrics.slice(0, 10)} margin={{ top: 20, right: 20, left: 20, bottom: 60 }}>
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
                  </ChartContainer>
                </ResponsiveContainer>
              </CardContent>
               <div className="p-4 pt-0 text-center">
                  <Link href="/dashboard/provinces" passHref>
                    <Button variant="outline" className="w-full sm:w-auto">
                        Ver Detalles por Provincia <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
              </div>
          </Card>
            
            <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><CalendarIcon className="mr-2 h-5 w-5" />Análisis Diario</CardTitle>
                  <CardDescription>Resumen general de la actividad diaria de pedidos.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pedidos</p>
                      <p className="text-2xl font-bold">{globalTotal.toLocaleString()}</p>
                    </div>
                     <div>
                      <p className="text-sm text-muted-foreground">Tasa de Confirmación</p>
                      <p className="text-2xl font-bold">{globalRate.toFixed(2)}%</p>
                    </div>
                 </div>
              </CardContent>
               <div className="p-4 pt-0 text-center">
                  <Link href="/dashboard/daily" passHref>
                    <Button variant="outline" className="w-full sm:w-auto">
                        Ver Desglose por Día y Tienda <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
              </div>
          </Card>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6">
           <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" />Top 5 Productos Más Pedidos</CardTitle>
                    <CardDescription>Productos con mayor demanda (confirmados o no).</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderProductList(mostRequestedProducts)}
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
    </div>
  );
}
