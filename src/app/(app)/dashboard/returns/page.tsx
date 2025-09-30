
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, TrendingUp, TrendingDown, ArrowRight, PackageSearch, ArrowUp, ArrowDown } from "lucide-react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { MonthlyProductReport, GetMetricsOutput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_monthly_report';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000;
const ITEMS_PER_PAGE = 20;

type SortConfig = {
    key: keyof MonthlyProductReport;
    direction: 'ascending' | 'descending';
};

const TrendIndicator = ({ value }: { value: number }) => {
    const isPositive = value > 0;
    const isNegative = value < 0;
    const color = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-muted-foreground';
    const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : ArrowRight;

    return (
        <div className={`flex items-center font-semibold ${color}`}>
            <Icon className="h-4 w-4 mr-1" />
            {value.toFixed(1)}%
        </div>
    );
};


export default function MonthlyReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<MonthlyProductReport[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'monthlySales', direction: 'descending' });
  const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);

  const { toast } = useToast();

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    if (!data || !data.monthlyProductReport) {
      setIsLoading(false);
      return;
    }
    setReportData(data.monthlyProductReport);
    setIsLoading(false);
  }, []);

  const fetchMetrics = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);

    if (!forceRefresh) {
      try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData) {
          const { data, timestamp } = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
            processAndSetMetrics(data);
            return;
          }
        }
      } catch (e) {
        console.error("Error al leer la caché:", e);
      }
    }

    try {
      const metricsData = await getMetrics({});

      try {
        const cachePayload = { data: metricsData, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      } catch (e) { console.error("Error al guardar en la caché:", e); }

      processAndSetMetrics(metricsData);
    } catch (error) {
      console.error("Error al obtener el reporte mensual:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo cargar el reporte mensual." });
      setIsLoading(false);
    }
  }, [processAndSetMetrics, toast]);

  useEffect(() => {
    fetchMetrics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const filteredAndSortedData = useMemo(() => {
    let filtered = reportData.filter(item => {
        const searchMatch = searchQuery === '' || 
                            item.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.sku.toLowerCase().includes(searchQuery.toLowerCase());
        return searchMatch;
    });

    if (sortConfig !== null) {
        filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];
            
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    // Reset visible items when filter changes
    setVisibleItemsCount(ITEMS_PER_PAGE);
    return filtered;
  }, [reportData, searchQuery, sortConfig]);

  const visibleData = useMemo(() => {
    return filteredAndSortedData.slice(0, visibleItemsCount);
  }, [filteredAndSortedData, visibleItemsCount]);


  const handleSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    if (sortConfig.direction === 'ascending') return <ArrowUp className="ml-2 h-4 w-4" />;
    return <ArrowDown className="ml-2 h-4 w-4" />;
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Análisis de Movimiento Mensual</h2>
          <p className="text-muted-foreground">Revisa las ventas mensuales, tendencias y sugerencias de compra.</p>
        </div>
         <div className="flex items-center gap-2 flex-wrap">
          <Button className="flex-1 sm:flex-initial" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      <DashboardNav active="returns" />
      
      <Card>
        <CardHeader>
          <CardTitle>Reporte Mensual de Productos</CardTitle>
          <CardDescription>
            Compara las ventas del último mes completo con el mes anterior para identificar tendencias y planificar compras.
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
                            <TableHead>
                                <Button variant="ghost" onClick={() => handleSort('productName')}>
                                    Producto {renderSortArrow('productName')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('currentStock')}>
                                    Stock Actual {renderSortArrow('currentStock')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('monthlySales')}>
                                    Ventas (Últ. Mes) {renderSortArrow('monthlySales')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('previousMonthSales')}>
                                    Ventas (Mes Ant.) {renderSortArrow('previousMonthSales')}
                                </Button>
                            </TableHead>
                             <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('salesTrend')}>
                                    Tendencia {renderSortArrow('salesTrend')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-right">
                                <Button variant="ghost" onClick={() => handleSort('suggestedPurchase')}>
                                    Compra Sugerida {renderSortArrow('suggestedPurchase')}
                                </Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleData.length > 0 ? (
                            visibleData.map(item => (
                                <TableRow key={item.sku}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{item.productName}</span>
                                            <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold">{item.currentStock}</TableCell>
                                    <TableCell className="text-center font-bold text-primary">{item.monthlySales}</TableCell>
                                    <TableCell className="text-center">{item.previousMonthSales}</TableCell>
                                    <TableCell className="text-center">
                                        <TrendIndicator value={item.salesTrend} />
                                    </TableCell>
                                    <TableCell className={cn("text-right font-bold", item.suggestedPurchase > 0 && "text-amber-500")}>
                                        {item.suggestedPurchase > 0 ? item.suggestedPurchase : '—'}
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No se encontraron productos que coincidan con la búsqueda.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
         {filteredAndSortedData.length > visibleItemsCount && (
          <CardFooter className="flex items-center justify-center pt-4">
              <Button onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}>
                  Cargar más
              </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

    