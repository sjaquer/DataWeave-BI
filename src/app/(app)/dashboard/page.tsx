
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader, CheckCircle, XCircle, Percent, CalendarDays, Upload, MapPin, Package, UserCheck, Banknote, RefreshCw, Store, TrendingUp, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { findBestProvinceMatch } from "@/lib/utils";
import { provinceList } from "@/lib/provinces";
import { getMetrics } from "@/ai/flows/getMetricsFlow";
import type { DailyMetric, ProvinceMetric, ProductMetric, PersonnelMetric, MiscMetrics, GetMetricsOutput, StoreMetric } from "@/ai/schemas/getMetricsSchema";

const CACHE_KEY = 'dashboardMetricsCache';
const CACHE_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutos
const MAIN_STORES = ["dearel", "blumi", "novi", "trazto", "cumbre"];


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  
  // --- Estados de Métricas Agregadas ---
  const [miscMetrics, setMiscMetrics] = useState<MiscMetrics | null>(null);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [provinceMetrics, setProvinceMetrics] = useState<ProvinceMetric[]>([]);
  const [mostRequestedProducts, setMostRequestedProducts] = useState<ProductMetric[]>([]);
  const [mostPurchasedProducts, setMostPurchasedProducts] = useState<ProductMetric[]>([]);
  const [personnelMetrics, setPersonnelMetrics] = useState<PersonnelMetric[]>([]);
  const [storeMetrics, setStoreMetrics] = useState<StoreMetric[]>([]);
  
  const { toast } = useToast();

  const processAndSetMetrics = useCallback((data: GetMetricsOutput | null) => {
      if (!data) {
        setIsLoading(false);
        return;
      }
      
      // --- Normalización Local de Provincias ---
      const provinceCorrectionsCache: Record<string, string> = {};
      const uniqueProvinces = [...new Set(data.provinceMetrics.map((p: ProvinceMetric) => p.name).filter((p: string) => p !== 'Desconocida'))];
      
      uniqueProvinces.forEach((provinceName: string) => {
        if (!provinceCorrectionsCache[provinceName]) {
          const bestMatch = findBestProvinceMatch(provinceName, provinceList);
          provinceCorrectionsCache[provinceName] = bestMatch || provinceName;
        }
      });
      
      // Aplicar correcciones a las métricas de provincia
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


      setMiscMetrics(data.miscMetrics);
      setDailyMetrics(data.dailyMetrics);
      setProvinceMetrics(aggregatedProvinceMetrics);
      setMostRequestedProducts(data.mostRequestedProducts || []);
      setMostPurchasedProducts(data.mostPurchasedProducts || []);
      setPersonnelMetrics(data.personnelMetrics);
      setStoreMetrics(data.storeMetrics || []);
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
            toast({ title: "Métricas cargadas desde la caché", description: "Mostrando datos guardados localmente." });
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
      toast({ title: "Actualizando métricas...", description: "Obteniendo los datos más recientes desde la base de datos." });
      const metricsData = await getMetrics();
      
      try {
        const cachePayload = { data: metricsData, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      } catch (e) {
         console.error("Error al guardar en la caché:", e);
         toast({ variant: "destructive", title: "Error de Caché", description: "No se pudieron guardar las métricas localmente." });
      }

      processAndSetMetrics(metricsData);

    } catch (error) {
      console.error("Error al obtener las métricas:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas. Revisa tu conexión y el estado del servidor.",
      });
      setIsLoading(false);
    }
  }, [toast, processAndSetMetrics]);


  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);


  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center h-screen">
          <div className="flex items-center gap-4">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg">
                Cargando métricas...
              </p>
          </div>
      </div>
    );
  }

  const globalTotal = (miscMetrics?.globalConfirmed ?? 0) + (miscMetrics?.globalUnconfirmed ?? 0);
  const globalRate = globalTotal > 0 ? ((miscMetrics?.globalConfirmed ?? 0) / globalTotal) * 100 : 0;
  const totalSpentAllProvinces = provinceMetrics.reduce((acc, curr) => acc + curr.totalSpent, 0);
  const averageSpentPerOrder = globalTotal > 0 ? totalSpentAllProvinces / globalTotal : 0;
  const otherStores = storeMetrics.filter(s => !MAIN_STORES.includes(s.name.toLowerCase()));

  // Función para renderizar la tabla de métricas diarias
  const renderDailyMetricsTable = (metrics: DailyMetric[], storeId?: string) => {
    const dataToRender = storeId
      ? metrics.map(m => {
          const storeData = m.byStore?.[storeId] || { confirmed: 0, unconfirmed: 0 };
          const total = storeData.confirmed + storeData.unconfirmed;
          return {
            date: m.date,
            confirmed: storeData.confirmed,
            unconfirmed: storeData.unconfirmed,
            totalOrders: total,
            confirmationRate: total > 0 ? (storeData.confirmed / total) * 100 : 0,
          };
        }).filter(m => m.totalOrders > 0)
      : metrics;

    return (
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead className="w-[120px]">Fecha</TableHead>
            <TableHead className="text-center">Confirmados</TableHead>
            <TableHead className="text-center">No Confirmados</TableHead>
            <TableHead className="text-center">Pedidos Totales</TableHead>
            <TableHead className="w-[220px] text-right">Tasa de Confirmación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dataToRender.length > 0 ? (
            dataToRender.map((metric) => (
              <TableRow key={metric.date}>
                <TableCell className="font-medium">{metric.date}</TableCell>
                <TableCell className="text-center text-green-500 font-semibold">{metric.confirmed}</TableCell>
                <TableCell className="text-center text-red-500 font-semibold">{metric.unconfirmed}</TableCell>
                <TableCell className="text-center">{metric.totalOrders}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className="font-medium text-sm w-16">
                      {metric.confirmationRate.toFixed(2)}%
                    </span>
                    <Progress value={metric.confirmationRate} className="h-2 w-[100px]" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No se encontraron datos de pedidos para esta selección.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };
  
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
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Inteligencia de Negocio</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchMetrics(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar Datos
          </Button>
          <Link href="/dashboard/upload-data" passHref>
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Carga Manual
            </Button>
          </Link>
        </div>
      </div>

       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{(miscMetrics?.globalConfirmed ?? 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos marcados como confirmados.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Sin Confirmar</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{(miscMetrics?.globalUnconfirmed ?? 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos pendientes o sin confirmar.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Confirmación Global</CardTitle>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalRate.toFixed(2)}%</div>
               <p className="text-xs text-muted-foreground">Porcentaje global de pedidos confirmados.</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gasto Promedio por Pedido</CardTitle>
              <Banknote className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">S/ {averageSpentPerOrder.toFixed(2)}</div>
               <p className="text-xs text-muted-foreground">Promedio gastado en todos los pedidos.</p>
            </CardContent>
          </Card>
      </div>

       {/* --- Métricas por Tienda --- */}
      <div className="space-y-2">
          <h3 className="text-2xl font-bold tracking-tight">Análisis por Tienda</h3>
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-6">
              {MAIN_STORES.map(storeName => {
                  const storeData = storeMetrics.find(s => s.name.toLowerCase() === storeName);
                  const rate = storeData ? storeData.confirmationRate : 0;
                  return (
                      <Card key={storeName}>
                          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                              <CardTitle className="text-sm font-medium capitalize">{storeName}</CardTitle>
                              <Store className="h-5 w-5 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                              <div className="text-3xl font-bold">{rate.toFixed(2)}%</div>
                              <p className="text-xs text-muted-foreground">Tasa de Confirmación</p>
                          </CardContent>
                      </Card>
                  );
              })}
              {/* Card para 'Otras' si existen */}
              {otherStores.length > 0 && (
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Otras Tiendas</CardTitle>
                          <Store className="h-5 w-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-3xl font-bold">
                            {
                              (() => {
                                const total = otherStores.reduce((acc, s) => acc + s.totalOrders, 0);
                                const confirmed = otherStores.reduce((acc, s) => acc + s.confirmedOrders, 0);
                                return total > 0 ? ((confirmed/total) * 100).toFixed(2) : '0.00'
                              })()
                            }%
                          </div>
                          <p className="text-xs text-muted-foreground">Tasa de Confirmación</p>
                      </CardContent>
                  </Card>
              )}
          </div>
      </div>


      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="col-span-1 md:col-span-2 lg:col-span-2">
              <CardHeader>
                  <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5" />Análisis de Provincias</CardTitle>
                  <CardDescription>Top 10 provincias con más pedidos y su tasa de confirmación.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ChartContainer config={{
                      totalOrders: { label: "Pedidos Totales", color: "hsl(var(--chart-1))" },
                      confirmationRate: { label: "Tasa de Confirmación", color: "hsl(var(--chart-2))" },
                  }}>
                    <BarChart data={provinceMetrics.slice(0, 10)} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" fontSize={12} />
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-1))" fontSize={12} />
                        <Tooltip 
                          content={<ChartTooltipContent 
                            formatter={(value, name) => (
                              <div className="flex flex-col">
                                <span className="font-bold">{name === 'totalOrders' ? 'Total Pedidos' : 'Tasa Confirmación'}</span>
                                <span>{name === 'confirmationRate' ? `${(value as number).toFixed(1)}%` : value}</span>
                              </div>
                            )}
                          />}
                        />
                        <Legend verticalAlign="top" />
                        <Bar yAxisId="left" dataKey="totalOrders" name="Pedidos Totales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="confirmationRate" name="Tasa de Confirmación (%)" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ChartContainer>
                </ResponsiveContainer>
              </CardContent>
          </Card>

            <Card className="col-span-1 md:col-span-2 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center"><UserCheck className="mr-2 h-5 w-5" />Rendimiento del Personal</CardTitle>
                  <CardDescription>Pedidos confirmados por cada miembro del equipo.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <ChartContainer config={{
                        confirmedOrders: { label: "Pedidos Confirmados", color: "hsl(var(--chart-1))" }
                    }}>
                        <BarChart data={personnelMetrics.slice(0, 10)} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={12} />
                          <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={80} />
                          <Tooltip content={<ChartTooltipContent />} cursor={{fill: 'hsl(var(--muted))'}} />
                          <Legend verticalAlign="top" />
                          <Bar dataKey="confirmedOrders" name="Pedidos Confirmados" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ChartContainer>
                  </ResponsiveContainer>
              </CardContent>
            </Card>
            
             <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><TrendingUp className="mr-2 h-5 w-5" />Top 5 Productos Más Pedidos</CardTitle>
                    <CardDescription>Productos con mayor demanda (confirmados o no).</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderProductList(mostRequestedProducts)}
                </CardContent>
            </Card>

            <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                    <CardTitle className="flex items-center"><ShoppingCart className="mr-2 h-5 w-5" />Top 5 Productos Más Comprados</CardTitle>
                    <CardDescription>Productos con más ventas confirmadas.</CardDescription>
                </CardHeader>
                <CardContent>
                    {renderProductList(mostPurchasedProducts)}
                </CardContent>
            </Card>


           <Card className="col-span-1 md:col-span-4">
              <CardHeader>
                  <CardTitle className="flex items-center">
                      <CalendarDays className="mr-2 h-5 w-5" />
                      Análisis Detallado por Día
                  </CardTitle>
                  <CardDescription>
                      Desglose diario de pedidos por tienda y tasa de éxito.
                  </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[550px] p-2">
                 <Tabs defaultValue="all" className="w-full">
                    <TabsList className="grid w-full grid-cols-6">
                        <TabsTrigger value="all">General</TabsTrigger>
                        {MAIN_STORES.map(store => (
                            <TabsTrigger key={store} value={store} className="capitalize">{store}</TabsTrigger>
                        ))}
                    </TabsList>
                    <TabsContent value="all" className="mt-4">
                        {renderDailyMetricsTable(dailyMetrics)}
                    </TabsContent>
                    {MAIN_STORES.map(store => (
                        <TabsContent key={store} value={store} className="mt-4">
                            {renderDailyMetricsTable(dailyMetrics, store)}
                        </TabsContent>
                    ))}
                </Tabs>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
