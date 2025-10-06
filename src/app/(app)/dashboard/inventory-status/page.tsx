"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, AlertTriangle, PackageSearch, Store, ArrowUp, ArrowDown, BarChartHorizontal } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { CurrentInventoryItem, GetMetricsOutput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { SidebarTrigger } from "@/components/ui/sidebar";

const CACHE_KEY = 'dashboardMetricsCache_inventory_status';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos de caché
const LOW_STOCK_THRESHOLD = 5;
const ITEMS_PER_PAGE = 15;

type SortConfig = {
    key: keyof CurrentInventoryItem;
    direction: 'ascending' | 'descending';
};

export default function InventoryStatusPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<CurrentInventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("all");
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'productName', direction: 'ascending' });
  const [visibleItemsCount, setVisibleItemsCount] = useState(ITEMS_PER_PAGE);

  const { toast } = useToast();

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    if (!data) {
      setIsLoading(false);
      return;
    }
    const sanitizedInventory = (data.currentInventory || []).map(item => ({
        ...item,
        productName: String(item.productName || 'N/A'),
        sku: String(item.sku || 'N/A'),
    }));
    setInventoryData(sanitizedInventory);
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
            toast({ title: "Inventario cargado desde la caché" });
            return;
          }
        }
      } catch (e) {
        console.error("Error al leer la caché:", e);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    try {
      toast({ title: "Actualizando estado de inventario..." });
      const metricsData = await getMetrics({});

      try {
        const cachePayload = { data: metricsData, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      } catch (e) { console.error("Error al guardar en la caché:", e); }

      processAndSetMetrics(metricsData);
      toast({ title: "Inventario Actualizado", description: "Los datos se han cargado correctamente." });
    } catch (error) {
      console.error("Error al obtener el estado del inventario:", error);
      toast({ variant: "destructive", title: "Error de Conexión", description: "No se pudo cargar el estado del inventario." });
      setIsLoading(false);
    }
  }, [processAndSetMetrics, toast]);

  useEffect(() => {
    fetchMetrics(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const availableStores = useMemo(() => {
    const stores = new Set(inventoryData.map(item => item.store));
    return Array.from(stores).sort();
  }, [inventoryData]);

  const filteredAndSortedInventory = useMemo(() => {
    let filtered = inventoryData.filter(item => {
        const storeMatch = selectedStore === 'all' || item.store.toLowerCase() === selectedStore.toLowerCase();
        const searchMatch = searchQuery === '' || 
                            item.productName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.sku.toLowerCase().includes(searchQuery.toLowerCase());
        return storeMatch && searchMatch;
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
  }, [inventoryData, selectedStore, searchQuery, sortConfig]);

  const visibleInventory = useMemo(() => {
    return filteredAndSortedInventory.slice(0, visibleItemsCount);
  }, [filteredAndSortedInventory, visibleItemsCount]);

  const lowStockProducts = useMemo(() => {
    return inventoryData
      .filter(item => item.currentStock > 0 && item.currentStock <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 10);
  }, [inventoryData]);


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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden"/>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Estado de Inventario Actual</h2>
              <p className="text-muted-foreground">Consulta el stock en tiempo real y alertas de productos.</p>
            </div>
        </div>
         <div className="flex items-center gap-2 flex-wrap">
          <Button className="flex-1 sm:flex-initial" variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      <Card>
          <CardHeader>
              <CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5 text-destructive" />Top 10 Productos con Bajo Stock</CardTitle>
              <CardDescription>Productos con {LOW_STOCK_THRESHOLD} o menos unidades en stock. ¡Requieren atención!</CardDescription>
          </CardHeader>
          <CardContent>
              {isLoading ? (
                  <div className="flex items-center justify-center min-h-[400px]">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
              ) : lowStockProducts.length > 0 ? (
                <div style={{ height: `${Math.max(400, lowStockProducts.length * 40)}px` }}>
                  <ChartContainer config={{ currentStock: { label: "Stock", color: "hsl(var(--destructive))" } }}>
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={lowStockProducts} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis dataKey="productName" type="category" width={80} tick={{ fontSize: 12 }} interval={0} />
                              <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--destructive) / 0.1)' }}/>
                              <Legend />
                              <Bar dataKey="currentStock" name="Stock Actual" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                      </ResponsiveContainer>
                  </ChartContainer>
                </div>
              ) : (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                      <p className="text-muted-foreground">¡Felicidades! No hay productos con bajo stock.</p>
                  </div>
              )}
          </CardContent>
      </Card>


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
        <CardContent className="p-0 sm:p-2">
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Button variant="ghost" onClick={() => handleSort('sku')}>
                                    SKU {renderSortArrow('sku')}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => handleSort('productName')}>
                                    Producto {renderSortArrow('productName')}
                                </Button>
                            </TableHead>
                            <TableHead>
                                <Button variant="ghost" onClick={() => handleSort('store')}>
                                    Tienda {renderSortArrow('store')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-center">
                                <Button variant="ghost" onClick={() => handleSort('currentStock')}>
                                    Stock Actual {renderSortArrow('currentStock')}
                                </Button>
                            </TableHead>
                            <TableHead className="text-right">
                                <Button variant="ghost" onClick={() => handleSort('lastMovementDate')}>
                                    Último Movimiento {renderSortArrow('lastMovementDate')}
                                </Button>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibleInventory.length > 0 ? (
                            visibleInventory.map(item => (
                                <TableRow key={`${item.sku}-${item.store}`} className={cn(item.currentStock <= LOW_STOCK_THRESHOLD && "bg-destructive/10 hover:bg-destructive/20")}>
                                    <TableCell className="font-mono whitespace-nowrap">{item.sku}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{item.productName}</TableCell>
                                    <TableCell className="text-muted-foreground whitespace-nowrap">{item.store}</TableCell>
                                    <TableCell className="text-center font-bold">
                                        <div className="flex items-center justify-center gap-2">
                                            {item.currentStock <= LOW_STOCK_THRESHOLD && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                            <span className={cn(item.currentStock <= LOW_STOCK_THRESHOLD && "text-destructive")}>
                                                {item.currentStock}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">{item.lastMovementDate}</TableCell>
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
              </div>
            )}
        </CardContent>
         {filteredAndSortedInventory.length > 0 && (
          <CardFooter className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                  Mostrando <strong>{Math.min(visibleItemsCount, filteredAndSortedInventory.length)}</strong> de <strong>{filteredAndSortedInventory.length}</strong> productos.
              </div>
              {visibleItemsCount < filteredAndSortedInventory.length && (
                  <Button onClick={() => setVisibleItemsCount(prev => prev + ITEMS_PER_PAGE)}>
                      Cargar más
                  </Button>
              )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
