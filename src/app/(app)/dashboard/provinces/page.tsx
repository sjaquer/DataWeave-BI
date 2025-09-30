
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, subDays } from "date-fns";
import { DateRange } from "react-day-picker";
import { es } from "date-fns/locale";

import { Loader, Calendar as CalendarIcon, RefreshCw, MapPin, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn, findBestProvinceMatch } from "@/lib/utils";
import { provinceList } from "@/lib/provinces";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { ProvinceMetric, GetMetricsOutput, GetMetricsInput, StoreMetric } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_provinces';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;

type SortConfig = {
  key: keyof ProvinceMetric;
  direction: 'ascending' | 'descending';
};

export default function ProvincesDetailPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [fullMetrics, setFullMetrics] = useState<GetMetricsOutput | null>(null);
  const [displayMetrics, setDisplayMetrics] = useState<ProvinceMetric[]>([]);
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'totalOrders', direction: 'descending' });
  const [selectedStore, setSelectedStore] = useState('all');
  const [availableStores, setAvailableStores] = useState<StoreMetric[]>([]);
  const { toast } = useToast();

  const handleDatePreset = (preset: string) => {
    const to = new Date();
    let from: Date | undefined;

    switch (preset) {
      case 'today': from = new Date(); break;
      case 'yesterday': from = subDays(new Date(), 1); setDate({ from, to: from }); return;
      case '7days': from = new Date(); from.setDate(from.getDate() - 6); break;
      case '30days': from = new Date(); from.setDate(from.getDate() - 29); break;
      case '6months': from = new Date(); from.setMonth(from.getMonth() - 6); break;
      case 'all': from = undefined; break;
    }
    setDate({ from, to });
  };

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null, store: string) => {
    if (!data) {
      setIsLoading(false);
      return;
    }

    const provinceCorrectionsCache: Record<string, string> = {};
    const getBestMatch = (name: string) => {
      if (!provinceCorrectionsCache[name]) {
        provinceCorrectionsCache[name] = findBestProvinceMatch(name, provinceList);
      }
      return provinceCorrectionsCache[name];
    };

    let metricsToProcess: ProvinceMetric[];

    if (store === 'all') {
      metricsToProcess = data.provinceMetrics || [];
    } else {
      const lowerCaseStore = store.toLowerCase();
      const storeData = data.provinceMetricsByStore?.[lowerCaseStore];
      metricsToProcess = storeData || [];
    }

    const aggregatedProvinces: Record<string, ProvinceMetric> = {};

    for (const metric of metricsToProcess) {
      const correctedName = getBestMatch(metric.name);
      if (!aggregatedProvinces[correctedName]) {
        aggregatedProvinces[correctedName] = {
          name: correctedName,
          totalOrders: 0,
          confirmedOrders: 0,
          totalSpent: 0,
          confirmationRate: 0,
        };
      }
      aggregatedProvinces[correctedName].totalOrders += metric.totalOrders;
      aggregatedProvinces[correctedName].confirmedOrders += metric.confirmedOrders;
      aggregatedProvinces[correctedName].totalSpent += metric.totalSpent;
    }
    
    const finalMetrics = Object.values(aggregatedProvinces).map(p => ({
        ...p,
        confirmationRate: p.totalOrders > 0 ? (p.confirmedOrders / p.totalOrders) * 100 : 0
    }));

    setDisplayMetrics(finalMetrics);

    if (fullMetrics === null) {
      setFullMetrics(data);
      const stores = (data.storeMetrics || []).map(s => ({
        ...s,
        name: s.name.charAt(0).toUpperCase() + s.name.slice(1)
      }));
      setAvailableStores(stores);
    }
    
    setIsLoading(false);
  }, [fullMetrics]);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    const cacheKeyWithDate = `${CACHE_KEY}_${date?.from?.toISOString()}_${date?.to?.toISOString()}`;

    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(cacheKeyWithDate);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            processAndSetMetrics(data, selectedStore);
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
      } catch (e) {
        console.error("Error al guardar en la caché:", e);
      }

      processAndSetMetrics(metricsData, selectedStore);
    } catch (error) {
      console.error("Error al obtener las métricas:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudieron cargar las métricas." });
      setIsLoading(false);
    }
  }, [date, processAndSetMetrics, toast, selectedStore]);
  
  useEffect(() => {
    fetchMetrics(false);
  }, [date, fetchMetrics]);
  
  useEffect(() => {
      if (fullMetrics) {
        processAndSetMetrics(fullMetrics, selectedStore);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStore]);

  const handleSort = (key: keyof ProvinceMetric) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedMetrics = useMemo(() => {
    let sortableItems = [...displayMetrics];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if ((aValue as number) < (bValue as number)) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if ((aValue as number) > (bValue as number)) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [displayMetrics, sortConfig]);

  const renderSortArrow = (key: keyof ProvinceMetric) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis Detallado por Provincia</h2>
          <p className="text-muted-foreground">Desglose completo de pedidos, gasto y tasas de confirmación por provincia.</p>
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
          <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por Tienda" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="all">Todas las Tiendas</SelectItem>
                  {availableStores.map(store => (
                      <SelectItem key={store.name} value={store.name.toLowerCase()}>{store.name}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
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
          <CardDescription>Desglose completo de pedidos y gasto para {selectedStore === 'all' ? 'todas las tiendas' : `la tienda ${selectedStore}`}.</CardDescription>
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
                  <TableHead>
                    <Button variant="ghost" onClick={() => handleSort('name')}>
                      Provincia {renderSortArrow('name')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" onClick={() => handleSort('totalOrders')}>
                      Pedidos Totales {renderSortArrow('totalOrders')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button variant="ghost" onClick={() => handleSort('confirmedOrders')}>
                      Pedidos Confirmados {renderSortArrow('confirmedOrders')}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" onClick={() => handleSort('totalSpent')}>
                      Gasto Total (S/) {renderSortArrow('totalSpent')}
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
                {sortedMetrics.length > 0 ? (
                  sortedMetrics.filter(p => p.totalOrders > 0).map((p) => (
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No se encontraron datos para los filtros seleccionados.
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

    