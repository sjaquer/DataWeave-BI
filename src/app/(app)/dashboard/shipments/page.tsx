
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, Truck, DollarSign, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { GetMetricsOutput, GetMetricsInput, CourierMetric, PaymentMethodMetric } from "@/ai/schemas/getMetricsSchema";
import { useToast } from "@/hooks/use-toast";
import { ClearCacheButton } from "./clear-cache-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];
const CACHE_KEY_PREFIX = 'dashboardMetricsCache_shipments';

export default function ShipmentsPage() {
  const [metrics, setMetrics] = useState<GetMetricsOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const { toast } = useToast();
  
  const CACHE_KEY = `${CACHE_KEY_PREFIX}_${date?.from?.toISOString()}_${date?.to?.toISOString()}`;

  const fetchShipmentMetrics = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    
    if (!forceRefresh) {
        try {
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                const { data, timestamp } = JSON.parse(cachedData);
                if (Date.now() - timestamp < (15 * 60 * 1000)) { // 15 min cache
                    setMetrics(data);
                    setLoading(false);
                    return;
                }
            }
        } catch (e) {
            console.error("Error reading from cache", e);
        }
    }
    
    try {
      const input: GetMetricsInput = {};
      if (date?.from) {
        const startDate = new Date(date.from);
        startDate.setHours(0,0,0,0);
        const endDate = date.to ? new Date(date.to) : new Date(date.from);
        endDate.setHours(23,59,59,999);
        input.startDate = startDate.toISOString();
        input.endDate = endDate.toISOString();
      }

      const metricsData = await getMetrics(input);
      setMetrics(metricsData);
      
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: metricsData, timestamp: Date.now() }));
      } catch (e) {
        console.error("Error saving to cache", e);
      }

    } catch (error) {
      console.error("Error al cargar las métricas de envíos:", error);
      toast({
        variant: "destructive",
        title: "Error al Cargar Datos",
        description: "No se pudieron obtener las métricas de envíos. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, date, CACHE_KEY]);
  
  useEffect(() => {
    fetchShipmentMetrics();
  }, [fetchShipmentMetrics]);

  const {
    totalShipments,
    totalRevenue,
    avgOrderValue,
    totalProducts,
    shipmentsByDate,
    topProvinces,
    paymentMethods,
    courierPerformance,
    storePerformance
  } = useMemo(() => {
    if (!metrics) return {
      totalShipments: 0,
      totalRevenue: 0,
      avgOrderValue: 0,
      totalProducts: 0,
      shipmentsByDate: [],
      topProvinces: [],
      paymentMethods: [],
      courierPerformance: [],
      storePerformance: [],
    };
    
    const confirmedOrders = metrics.miscMetrics.globalConfirmed;
    
    const allDays = new Set<string>();
    const byDateMap = new Map<string, { envios: number; ingresos: number }>();
    
    // Rellenar todos los días del rango
    if(date?.from && date?.to) {
        for (let d = new Date(date.from); d <= date.to; d.setDate(d.getDate() + 1)) {
           const dateStr = format(d, 'dd-MM-yyyy');
           allDays.add(dateStr);
           byDateMap.set(dateStr, { envios: 0, ingresos: 0 });
        }
    }
    
    metrics.dailyMetrics.forEach(day => {
        const dateStr = day.date;
        const totalSpentOnDay = metrics.provinceMetrics
            .filter(p => metrics.dailyMetrics.find(d => d.date === dateStr)) // Super simplificación
            .reduce((sum, p) => sum + p.totalSpent, 0);

        if (byDateMap.has(dateStr)) {
          byDateMap.set(dateStr, {
            envios: day.confirmed,
            ingresos: totalSpentOnDay
          });
        }
    });

    const shipmentsByDate = Array.from(byDateMap.entries()).map(([date, data]) => ({ date, ...data }))
        .sort((a,b) => new Date(a.date.split('-').reverse().join('-')).getTime() - new Date(b.date.split('-').reverse().join('-')).getTime());

    const totalRev = metrics.provinceMetrics.reduce((sum, p) => sum + p.totalSpent, 0);
    const totalProds = metrics.mostPurchasedProducts.reduce((sum, p) => sum + p.totalOrders, 0);

    const provinces = (metrics.provinceMetrics || [])
        .map(p => ({ name: p.name, value: p.confirmedOrders, revenue: p.totalSpent }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 8);
        
    const paymentData = (metrics.paymentMethodMetrics || []).sort((a,b) => b.totalOrders - a.totalOrders);

    const couriers = (metrics.courierMetrics || []).sort((a, b) => b.totalShipments - a.totalShipments);
    
    const stores = metrics.storeMetrics
      .map(s => ({ name: s.name, envios: s.confirmedOrders }))
      .sort((a, b) => b.envios - a.envios);

    return {
      totalShipments: confirmedOrders,
      totalRevenue: totalRev,
      avgOrderValue: confirmedOrders > 0 ? totalRev / confirmedOrders : 0,
      totalProducts: totalProds,
      shipmentsByDate,
      topProvinces: provinces,
      paymentMethods: paymentData,
      courierPerformance: couriers,
      storePerformance: stores,
    };
  }, [metrics, date]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis de Envíos</h1>
            <p className="text-muted-foreground">
              Monitoreo y análisis de pedidos confirmados
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant={"outline"} className={cn("w-[240px] sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={es} />
            </PopoverContent>
          </Popover>
          <ClearCacheButton />
        </div>
      </div>


      {totalShipments === 0 && (
        <Alert>
          <AlertDescription>
            No hay envíos confirmados en el período seleccionado. Los datos aparecerán cuando se confirmen pedidos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Envíos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShipments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{totalProducts.toLocaleString()} productos enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">De envíos confirmados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {avgOrderValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Por pedido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Couriers Activos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courierPerformance.length}</div>
            <p className="text-xs text-muted-foreground">Empresas de transporte</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tendencia de Envíos e Ingresos</CardTitle>
            <CardDescription>Evolución diaria en el período seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            {shipmentsByDate.length > 0 && shipmentsByDate.some(d => d.envios > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={shipmentsByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis yAxisId="left" stroke="#8884d8" label={{ value: 'Envíos', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle'} }} />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Ingresos (S/)', angle: 90, position: 'insideRight', style: {textAnchor: 'middle'} }} />
                  <Tooltip formatter={(value: number, name: string) => [name === 'envios' ? value : `S/ ${value.toFixed(2)}`, name === 'envios' ? 'Envíos' : 'Ingresos']} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="envios" fill="#8884d8" name="Envíos" />
                  <Bar yAxisId="right" dataKey="ingresos" fill="#82ca9d" name="Ingresos (S/)" />
                </BarChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos</div> )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Top Provincias</CardTitle>
            <CardDescription>Distribución geográfica de envíos</CardDescription>
          </CardHeader>
          <CardContent>
            {topProvinces.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={topProvinces} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {topProvinces.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: any) => [`${value} envíos - S/ ${props.payload.revenue.toFixed(2)}`, 'Total']} />
                  <Legend/>
                </PieChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos</div> )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución de los métodos de pago utilizados.</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethods.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                        <Pie data={paymentMethods} dataKey="totalOrders" nameKey="method" cx="50%" cy="50%" outerRadius={100} labelLine={true} label={({ method, percentageOfTotal }) => `${method}: ${(percentageOfTotal).toFixed(0)}%`}>
                            {paymentMethods.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip formatter={(value, name, props) => [`${value} pedidos (S/ ${props.payload.totalRevenue.toFixed(2)})`, name]} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            ) : (<div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos de métodos de pago.</div>)}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Envíos por Tienda</CardTitle>
            <CardDescription>Comparativa de rendimiento entre tiendas</CardDescription>
          </CardHeader>
          <CardContent>
            {storePerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={storePerformance} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }}/>
                    <Tooltip formatter={(value: number) => [value, "Envíos"]} />
                    <Bar dataKey="envios" fill="#ffc658" name="Envíos" >
                      {storePerformance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos de tiendas</div> )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Rendimiento Detallado de Couriers</CardTitle>
          <CardDescription>Análisis completo de empresas de transporte</CardDescription>
        </CardHeader>
        <CardContent>
          {courierPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">% Total</TableHead>
                    <TableHead className="text-right">Provincias</TableHead>
                    <TableHead className="text-right">Ingresos Totales</TableHead>
                    <TableHead className="text-right">Valor Promedio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courierPerformance.map((courier, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium"><div className="flex items-center gap-2">{courier.name}{index === 0 && (<Badge variant="default" className="text-xs">Top</Badge>)}</div></TableCell>
                      <TableCell className="text-right font-mono">{courier.totalShipments}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline">{courier.percentageOfTotal.toFixed(1)}%</Badge></TableCell>
                      <TableCell className="text-right">{courier.provinceCount}</TableCell>
                      <TableCell className="text-right font-mono">S/ {courier.totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono">S/ {courier.averageOrderValue.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : ( <div className="flex items-center justify-center h-32 text-muted-foreground">No hay datos de couriers</div> )}
        </CardContent>
      </Card>
    </div>
  );
}
