
"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, Undo2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { CustomerReturn, GetMetricsOutput, GetMetricsInput, MostReturnedProducts } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_returns';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;

export default function ReturnsDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [returnsData, setReturnsData] = useState<CustomerReturn[]>([]);
  const [mostReturnedProducts, setMostReturnedProducts] = useState<MostReturnedProducts[]>([]);
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
    setReturnsData(data.customerReturns || []);
    setMostReturnedProducts(data.mostReturnedProducts || []);
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
      console.error("Error al obtener las métricas de devoluciones:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudieron cargar las devoluciones." });
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
          <h2 className="text-3xl font-bold tracking-tight">Análisis de Devoluciones</h2>
          <p className="text-muted-foreground">Detalle de productos devueltos por clientes.</p>
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
      
      <DashboardNav active="returns" />

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
            <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><Undo2 className="mr-2 h-5 w-5" />Top 10 Productos Más Devueltos</CardTitle>
                    <CardDescription>Productos con la mayor cantidad de unidades devueltas por clientes.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                    <ChartContainer config={{ returns: { label: "Devoluciones", color: "hsl(var(--chart-2))" } }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mostReturnedProducts.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 30, left: 120, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} interval={0} allowDataOverflow={false} />
                                <Tooltip content={<ChartTooltipContent />} />
                                <Legend />
                                <Bar dataKey="returns" name="Devoluciones" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
      
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center"><Undo2 className="mr-2 h-5 w-5" />Detalle de Devoluciones de Clientes</CardTitle>
                <CardDescription>Listado de movimientos de inventario registrados como "DEVOLUCION DE CLIENTE".</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[70vh] p-2">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Producto Devuelto</TableHead>
                      <TableHead className="text-center">Cantidad</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>N° de Pedido</TableHead>
                      <TableHead>Tienda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnsData.length > 0 ? (
                        returnsData.map((item, index) => (
                        <TableRow key={`${item.date}-${item.productName}-${index}`}>
                            <TableCell className="font-medium">{item.date}</TableCell>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-center font-bold">{item.quantity}</TableCell>
                            <TableCell>{item.user}</TableCell>
                            <TableCell>{item.orderNumber}</TableCell>
                            <TableCell className="font-medium">{item.store}</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">No se encontraron devoluciones para el período seleccionado.</TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
        </div>
        )}
    </div>
  );
}
