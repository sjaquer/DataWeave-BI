
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, AlertTriangle, PackageSearch, Store, ArrowUp, ArrowDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { CurrentInventoryItem, GetMetricsOutput } from "@/ai/schemas/getMetricsSchema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DashboardNav from "@/components/DashboardNav";

const CACHE_KEY = 'dashboardMetricsCache_inventory_status_global';
const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos de caché
const LOW_STOCK_THRESHOLD = 5;

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
  
  const { toast } = useToast();

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
    if (!data) {
      setIsLoading(false);
      return;
    }
    // Asegurarse de que productName sea siempre un string para evitar errores
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
    toast({ title: "Actualizando estado de inventario..." });

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
        localStorage.removeItem(CACHE_KEY);
      }
    }

    try {
      // No se envían fechas para obtener el estado de inventario global
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

    return filtered;
  }, [inventoryData, selectedStore, searchQuery, sortConfig]);

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
          <h2 className="text-3xl font-bold tracking-tight">Estado de Inventario Actual</h2>
          <p className="text-muted-foreground">Consulta el stock en tiempo real de tus productos.</p>
        </div>
         <div className="flex items-center gap-2 flex-wrap">
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
                        {filteredAndSortedInventory.length > 0 ? (
                            filteredAndSortedInventory.map(item => (
                                <TableRow key={`${item.sku}-${item.store}`} className={cn(item.currentStock <= LOW_STOCK_THRESHOLD && "bg-destructive/10 hover:bg-destructive/20")}>
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
