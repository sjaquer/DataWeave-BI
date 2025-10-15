
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { subDays, format } from "date-fns";
import { es } from 'date-fns/locale';

import { Loader, RefreshCw, Truck, Users, LineChart as LineChartIcon, Undo2, ArrowDown, ArrowUp, HelpCircle, Lightbulb, Calendar as CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { GetMetricsOutput, GetMetricsInput, CustomerReturn, PurchaseForecastItem } from "@/ai/schemas/getMetricsSchema";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const CACHE_KEY = 'dashboardMetricsCache_inventory';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const ITEMS_PER_PAGE = 15;


type ReturnsSortConfig = {
    key: keyof CustomerReturn;
    direction: 'ascending' | 'descending';
};

const URGENCY_COLORS: { [key: string]: string } = {
  "Urgente (Comprar Ya)": "hsl(var(--destructive))",
  "Pronto (Próxima Semana)": "hsl(var(--chart-2))",
  "Revisar (Próximo Mes)": "hsl(var(--chart-5))",
  "Stock Saludable": "hsl(var(--chart-1))",
};


export default function InventoryDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [fullMetrics, setFullMetrics] = useState<GetMetricsOutput | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState<GetMetricsOutput | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [tempDate, setTempDate] = useState<DateRange | undefined>(date);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedStore, setSelectedStore] = useState('all');
  const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);
  
  const [returnsSortConfig, setReturnsSortConfig] = useState<ReturnsSortConfig | null>({ key: 'date', direction: 'descending' });

  const { toast } = useToast();

  const handleDatePreset = (preset: string) => {
    let from: Date | undefined;
    const to = new Date();

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
        from = undefined; 
        break;
    }
     setDate(preset === 'all' ? undefined : { from, to });
  };
  
    const availableStores = useMemo(() => {
        if (!fullMetrics?.currentInventory) return [];
        const stores = new Set(fullMetrics.currentInventory.map(item => item.store).filter(s => s !== 'N/A'));
        return Array.from(stores).sort();
    }, [fullMetrics?.currentInventory]);


  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    setFullMetrics(data);
    setDisplayMetrics(data); // Initially display all data
    setIsLoading(false);
  }, []);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    // Use a more stable cache key if the default is 'all time'
    const dateCacheKey = date?.from ? `${date.from.toISOString()}_${date.to?.toISOString()}` : 'all';
    const cacheKeyWithDate = `${CACHE_KEY}_${dateCacheKey}`;

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


    // --- Lógica de Filtro por Tienda ---
    const filterMetricsByStore = useCallback((storeName: string) => {
        if (!fullMetrics) return;

        if (storeName === 'all') {
            setDisplayMetrics(fullMetrics);
            return;
        }

        const lowerCaseStoreName = storeName.toLowerCase();

        const filterByStore = <T extends { store?: string }>(items: T[] | undefined) => {
            return items?.filter(item => item.store?.toLowerCase() === lowerCaseStoreName) || [];
        }

        // Recalcular métricas dependientes
        const filteredCurrentInventory = filterByStore(fullMetrics.currentInventory);

        const filteredPurchaseForecast = (fullMetrics.purchaseForecast || []).filter(item => {
            const inventoryItem = filteredCurrentInventory.find(inv => inv.productName === item.productName);
            return !!inventoryItem; // Solo incluir si el producto existe en el inventario de la tienda
        }).map(item => {
            const inventoryItem = filteredCurrentInventory.find(inv => inv.productName === item.productName);
            const currentStock = inventoryItem ? inventoryItem.currentStock : 0;
            return { ...item, currentStock };
        });

        const newDisplayMetrics: GetMetricsOutput = {
            ...fullMetrics,
            inventoryFlowTrend: fullMetrics.inventoryFlowTrend?.filter(d => d.store?.toLowerCase() === lowerCaseStoreName),
            mostIncomingProducts: fullMetrics.mostIncomingProducts?.filter(p => p.store?.toLowerCase() === lowerCaseStoreName),
            mostMovedProducts: fullMetrics.mostMovedProducts?.filter(p => p.store?.toLowerCase() === lowerCaseStoreName),
            inventoryPersonnelMetrics: fullMetrics.inventoryPersonnelMetrics, // El personal es global
            customerReturns: filterByStore(fullMetrics.customerReturns),
            mostReturnedProducts: fullMetrics.mostReturnedProducts?.filter(p => p.store?.toLowerCase() === lowerCaseStoreName),
            currentInventory: filteredCurrentInventory,
            purchaseForecast: filteredPurchaseForecast,
        };

        setDisplayMetrics(newDisplayMetrics);
        setVisibleItemsCount(ITEMS_PER_PAGE);

    }, [fullMetrics]);

    useEffect(() => {
        filterMetricsByStore(selectedStore);
    }, [selectedStore, filterMetricsByStore]);


  // --- Lógica de Ordenamiento para Tabla de Devoluciones ---
  const handleReturnsSort = (key: ReturnsSortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (returnsSortConfig?.key === key && returnsSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setReturnsSortConfig({ key, direction });
    setVisibleItemsCount(ITEMS_PER_PAGE);
  };
  
  const sortedReturns = useMemo(() => {
    let sortableItems = [...(displayMetrics?.customerReturns || [])];
    if (returnsSortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = returnsSortConfig.key === 'date' ? new Date(a.date.split('-').reverse().join('-')).getTime() : a[returnsSortConfig.key];
        const bValue = returnsSortConfig.key === 'date' ? new Date(b.date.split('-').reverse().join('-')).getTime() : b[returnsSortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return returnsSortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        if ((aValue as number) < (bValue as number)) {
          return returnsSortConfig.direction === 'ascending' ? -1 : 1;
        }
        if ((aValue as number) > (bValue as number)) {
          return returnsSortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [displayMetrics?.customerReturns, returnsSortConfig]);
  
  const visibleReturns = useMemo(() => {
    return sortedReturns.slice(0, visibleItemsCount);
  }, [sortedReturns, visibleItemsCount]);

  const renderReturnsSortArrow = (key: ReturnsSortConfig['key']) => {
    if (returnsSortConfig?.key !== key) return null;
    return returnsSortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const forecastDataByUrgency = useMemo(() => {
      const data = displayMetrics?.purchaseForecast || [];
      const grouped: { [key: string]: PurchaseForecastItem[] } = {
        "Urgente (Comprar Ya)": [],
        "Pronto (Próxima Semana)": [],
        "Revisar (Próximo Mes)": [],
        "Stock Saludable": [],
      };
      data.forEach(item => {
        if (grouped[item.urgency]) {
            grouped[item.urgency].push(item);
        }
      });
      return grouped;
  }, [displayMetrics?.purchaseForecast]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden"/>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Análisis de Inventario</h2>
              <p className="text-muted-foreground">Flujo, rotación, devoluciones y previsión de compras.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleDatePreset} defaultValue="all">
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtro Rápido" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Ver todo</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="7days">Últimos 7 días</SelectItem>
                  <SelectItem value="30days">Últimos 30 días</SelectItem>
                  <SelectItem value="6months">Últimos 6 meses</SelectItem>
              </SelectContent>
          </Select>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={tempDate} onSelect={setTempDate} numberOfMonths={2} locale={es} />
                 <div className="flex justify-end gap-2 p-4">
                    <Button variant="ghost" onClick={() => setIsDatePickerOpen(false)}>Cancelar</Button>
                    <Button onClick={() => { setDate(tempDate); setIsDatePickerOpen(false); }}>Aplicar</Button>
                 </div>
              </PopoverContent>
            </Popover>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por Tienda" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas las Tiendas</SelectItem>
                    {availableStores.map(store => (
                        <SelectItem key={store} value={store}>{store}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
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
        <div className="space-y-8">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><LineChartIcon className="mr-2 h-5 w-5" />Tendencia de Flujo de Inventario (Entradas vs. Salidas)</CardTitle>
                    <CardDescription>Unidades que entran y salen del inventario por día para {selectedStore === 'all' ? 'todas las tiendas' : `la tienda ${selectedStore}`}.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <div className="min-w-[600px] h-[400px]">
                    <ChartContainer config={{
                        Entradas: { label: "Entradas", color: "hsl(var(--chart-1))" },
                        Salidas: { label: "Salidas", color: "hsl(var(--chart-2))" },
                      }}>
                       <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={displayMetrics?.inventoryFlowTrend || []} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd"/>
                           <YAxis />
                           <Tooltip content={<ChartTooltipContent />} />
                           <Legend />
                           <Line type="monotone" dataKey="Entradas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                           <Line type="monotone" dataKey="Salidas" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                        </LineChart>
                       </ResponsiveContainer>
                     </ChartContainer>
                  </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Lightbulb className="mr-2 h-5 w-5 text-yellow-400" /> Pronóstico de Reabastecimiento de Stock
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                        Productos que requieren atención, agrupados por urgencia de compra y basados en la velocidad de ventas de los últimos 30 días.
                        <TooltipProvider>
                            <UiTooltip>
                                <TooltipTrigger>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <UiTooltipContent>
                                    <p className="max-w-xs">La "Urgencia" se calcula según los días de stock restantes. Pase el mouse sobre una barra para ver detalles como la compra sugerida.</p>
                                </UiTooltipContent>
                            </UiTooltip>
                        </TooltipProvider>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(forecastDataByUrgency).filter(([, items]) => items.length > 0).map(([urgency, items]) => {
                    const barHeight = 40;
                    const containerHeight = Math.max(400, items.length * barHeight);
                    return (
                        <div key={urgency}>
                            <h3 className="font-semibold mb-2" style={{ color: URGENCY_COLORS[urgency] || 'inherit' }}>{urgency} ({items.length} productos)</h3>
                            <div className="w-full overflow-x-auto">
                                <div className="min-w-[600px]" style={{ height: `${containerHeight}px` }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={items} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" dataKey="daysLeft" />
                                            <YAxis dataKey="productName" type="category" width={120} tick={{ fontSize: 12 }} interval={0} />
                                            <Tooltip 
                                                cursor={{ fill: 'hsl(var(--muted))' }}
                                                content={({ active, payload }) => {
                                                    if (active && payload && payload.length) {
                                                        const data: PurchaseForecastItem = payload[0].payload;
                                                        return (
                                                            <div className="p-2 text-xs bg-background border rounded-lg shadow-lg">
                                                                <p className="font-bold mb-2">{data.productName}</p>
                                                                <p><span className="font-semibold">Días de Stock Restantes:</span> {data.daysLeft}</p>
                                                                <p><span className="font-semibold">Stock Actual:</span> {data.currentStock}</p>
                                                                <p><span className="font-semibold">Ventas (30d):</span> {data.last30dSales}</p>
                                                                <p className="text-primary font-bold"><span className="font-semibold">Compra Sugerida:</span> {data.suggestedPurchase}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar dataKey="daysLeft" name="Días de Stock Restantes" fill={URGENCY_COLORS[urgency]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )
                  })}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Truck className="mr-2 h-5 w-5 text-green-500" />Top 10 Productos por Entradas</CardTitle>
                        <CardDescription>Productos con mayor cantidad de unidades ingresadas.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div style={{ height: `${Math.max(400, (displayMetrics?.mostIncomingProducts?.slice(0, 10).length || 0) * 40)}px`, minWidth: '600px' }}>
                          <ChartContainer config={{ movements: { label: "Entradas", color: "hsl(var(--chart-1))" } }}>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={(displayMetrics?.mostIncomingProducts || []).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis type="number" />
                                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                      <Tooltip content={<ChartTooltipContent />} />
                                      <Legend />
                                      <Bar dataKey="movements" name="Entradas" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </ChartContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Truck className="mr-2 h-5 w-5 text-red-500" />Top 10 Productos por Rotación (Salidas)</CardTitle>
                        <CardDescription>Productos con mayor cantidad de movimientos de salida.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div style={{ height: `${Math.max(400, (displayMetrics?.mostMovedProducts?.slice(0, 10).length || 0) * 40)}px`, minWidth: '600px' }}>
                          <ChartContainer config={{ movements: { label: "Salidas", color: "hsl(var(--chart-2))" } }}>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={(displayMetrics?.mostMovedProducts || []).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis type="number" />
                                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                      <Tooltip content={<ChartTooltipContent />} />
                                      <Legend />
                                      <Bar dataKey="movements" name="Salidas" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </ChartContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
             <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Undo2 className="mr-2 h-5 w-5" />Top 10 Productos Más Devueltos</CardTitle>
                        <CardDescription>Productos con la mayor cantidad de unidades devueltas por clientes.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div style={{ height: `${Math.max(400, (displayMetrics?.mostReturnedProducts?.slice(0, 10).length || 0) * 40)}px`, minWidth: '600px' }}>
                          <ChartContainer config={{ returns: { label: "Devoluciones", color: "hsl(var(--chart-5))" } }}>
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={(displayMetrics?.mostReturnedProducts || []).slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                                      <CartesianGrid strokeDasharray="3 3" />
                                      <XAxis type="number" />
                                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                      <Tooltip content={<ChartTooltipContent />} />
                                      <Legend />
                                      <Bar dataKey="returns" name="Devoluciones" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </ChartContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5" />Actividad del Equipo de Inventario</CardTitle>
                        <CardDescription>Movimientos de entrada y salida procesados por cada miembro del equipo (Global).</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div style={{ height: `${Math.max(400, (displayMetrics?.inventoryPersonnelMetrics?.length || 0) * 50)}px`, minWidth: '600px' }}>
                           <ChartContainer config={{
                                entries: { label: "Entradas", color: "hsl(var(--chart-1))" },
                                exits: { label: "Salidas", color: "hsl(var(--chart-2))" },
                             }}>
                             <ResponsiveContainer width="100%" height="100%">
                               <BarChart data={displayMetrics?.inventoryPersonnelMetrics || []} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis type="number" stacked />
                                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                                  <Tooltip content={<ChartTooltipContent />} />
                                  <Legend />
                                  <Bar dataKey="entries" name="Entradas" fill="hsl(var(--chart-1))" stackId="a" />
                                  <Bar dataKey="exits" name="Salidas" fill="hsl(var(--chart-2))" stackId="a" />
                               </BarChart>
                             </ResponsiveContainer>
                           </ChartContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Undo2 className="mr-2 h-5 w-5" />Detalle de Devoluciones de Clientes</CardTitle>
                <CardDescription>Listado de movimientos de inventario registrados como "DEVOLUCION DE CLIENTE".</CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-2">
                <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>
                            <Button variant="ghost" onClick={() => handleReturnsSort('date')}>
                                Fecha {renderReturnsSortArrow('date')}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" onClick={() => handleReturnsSort('productName')}>
                                Producto Devuelto {renderReturnsSortArrow('productName')}
                            </Button>
                          </TableHead>
                          <TableHead className="text-center">
                            <Button variant="ghost" onClick={() => handleReturnsSort('quantity')}>
                                Cantidad {renderReturnsSortArrow('quantity')}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" onClick={() => handleReturnsSort('user')}>
                                Usuario {renderReturnsSortArrow('user')}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" onClick={() => handleReturnsSort('orderNumber')}>
                                N° de Pedido {renderReturnsSortArrow('orderNumber')}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button variant="ghost" onClick={() => handleReturnsSort('store')}>
                                Tienda {renderReturnsSortArrow('store')}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleReturns.length > 0 ? (
                            visibleReturns.map((item, index) => (
                            <TableRow key={`${item.date}-${item.productName}-${index}`}>
                                <TableCell className="font-medium whitespace-nowrap">{item.date}</TableCell>
                                <TableCell className="whitespace-nowrap">{item.productName}</TableCell>
                                <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                                <TableCell className="whitespace-nowrap">{item.user}</TableCell>
                                <TableCell className="whitespace-nowrap">{item.orderNumber}</TableCell>
                                <TableCell className="font-medium whitespace-nowrap">{item.store}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">No se encontraron devoluciones para el período seleccionado.</TableCell>
                            </TableRow>
                        )}
                      </TableBody>
                    </Table>
                </div>
              </CardContent>
                {sortedReturns.length > visibleItemsCount && (
                    <CardFooter className="flex items-center justify-center pt-4">
                        <Button onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}>
                            Cargar más
                        </Button>
                    </CardFooter>
                )}
            </Card>
        </div>
      )}
    </div>
  );
}
