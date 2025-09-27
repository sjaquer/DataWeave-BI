
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, AlertTriangle, PackageSearch, Store } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { CurrentInventoryItem, GetMetricsOutput, GetMetricsInput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_inventory_status';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos de caché
const LOW_STOCK_THRESHOLD = 5;

export default function InventoryStatusPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<CurrentInventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("all");
  
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
    setInventoryData(data.currentInventory || []);
    setIsLoading(false);
  }, []);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    toast({ title: "Actualizando estado de inventario..." });
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
      toast({ title: "Inventario Actualizado", description: "Los datos se han cargado correctamente." });
    } catch (error) {
      console.error("Error al obtener el estado del inventario:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo cargar el estado del inventario." });
      setIsLoading(false);
    }
  }, [date, processAndSetMetrics, toast]);

  useEffect(() => {
    fetchMetrics(false);
  }, [date, fetchMetrics]);
  
  const availableStores = useMemo(() => {
    const stores = new Set(inventoryData.map(item => item.store));
    return Array.from(stores).sort();
  }, [inventoryData]);

  const filteredInventory = useMemo(() => {
    return inventoryData.filter(item => {
      const storeMatch = selectedStore === 'all' || item.store.toLowerCase() === selectedStore.toLowerCase();
      const searchMatch = searchQuery === '' || 
                          item.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return storeMatch && searchMatch;
    });
  }, [inventoryData, selectedStore, searchQuery]);


  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Estado de Inventario Actual</h2>
          <p className="text-muted-foreground">Consulta el stock en tiempo real de tus productos.</p>
        </div>
         <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleDatePreset}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtro Rápido (Fecha)" />
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
      
      <DashboardNav active="inventory-status" />

      <Card>
        <CardHeader>
          <CardTitle>Inventario de Productos</CardTitle>
          <CardDescription>
            Busca por SKU o nombre de producto y filtra por tienda. El stock se basa en el último movimiento registrado.
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <div className="relative flex-1">
                <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por SKU o Nombre de Producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full"
                />
              </div>
              <div className="relative flex-1">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Select value={selectedStore} onValueChange={setSelectedStore}>
                    <SelectTrigger className="pl-10 w-full">
                        <SelectValue placeholder="Filtrar por Tienda" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las Tiendas</SelectItem>
                        {availableStores.map(store => (
                            <SelectItem key={store} value={store}>{store}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>
          </div>
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
                            <TableHead>SKU</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Tienda</TableHead>
                            <TableHead className="text-center">Stock Actual</TableHead>
                            <TableHead className="text-right">Último Movimiento</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredInventory.length > 0 ? (
                            filteredInventory.map(item => (
                                <TableRow key={item.sku} className={cn(item.currentStock <= LOW_STOCK_THRESHOLD && "bg-destructive/10 hover:bg-destructive/20")}>
                                    <TableCell className="font-mono">{item.sku}</TableCell>
                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                    <TableCell className="text-muted-foreground">{item.store}</TableCell>
                                    <TableCell className="text-center font-bold">
                                        <div className="flex items-center justify-center gap-2">
                                            {item.currentStock <= LOW_STOCK_THRESHOLD && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                            <span className={cn(item.currentStock <= LOW_STOCK_THRESHOLD && "text-destructive")}>
                                                {item.currentStock}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">{item.lastMovementDate}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">
                                    No se encontraron productos que coincidan con los filtros seleccionados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
