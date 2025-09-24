
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onSnapshot, collection } from "firebase/firestore";
import { Loader, CheckCircle, XCircle, Percent, CalendarDays, Upload, MapPin, Package, UserCheck, Banknote, TrendingUp, ArrowRight, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { normalizeProvinces } from "@/ai/flows/normalizeProvinceFlow";
import { normalizeProducts } from "@/ai/flows/normalizeProductsFlow";

// --- Tipos de Datos del Dashboard ---
interface DailyMetric {
  date: string;
  totalOrders: number;
  confirmed: number;
  unconfirmed: number;
  confirmationRate: number;
}

interface ProvinceMetric {
  name: string;
  totalOrders: number;
  confirmedOrders: number;
  confirmationRate: number;
  totalSpent: number;
}

interface ProductMetric {
  name: string;
  totalOrders: number;
}

interface PersonnelMetric {
  name: string;
  confirmedOrders: number;
}

interface OrderData {
  isConfirmed: boolean;
  createdAt: { toDate: () => Date };
  province?: string;
  totalPrice?: number;
  products?: { title: string }[];
  confirmedBy?: string;
}


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isNormalizing, setIsNormalizing] = useState(false);
  
  // --- Estados de Métricas Agregadas ---
  const [globalConfirmed, setGlobalConfirmed] = useState(0);
  const [globalUnconfirmed, setGlobalUnconfirmed] = useState(0);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [provinceMetrics, setProvinceMetrics] = useState<ProvinceMetric[]>([]);
  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [personnelMetrics, setPersonnelMetrics] = useState<PersonnelMetric[]>([]);
  
  // --- Estados de Caché para Normalización ---
  const [provinceCorrectionsCache, setProvinceCorrectionsCache] = useState<Record<string, string>>({});
  const [productCorrectionsCache, setProductCorrectionsCache] = useState<Record<string, string>>({});

  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const ordersCollectionRef = collection(db, "shopify_orders");

    const unsubscribe = onSnapshot(ordersCollectionRef, async (querySnapshot) => {
      if (querySnapshot.empty) {
        setIsLoading(false);
        // Reset all metrics if there are no orders
        setDailyMetrics([]);
        setProvinceMetrics([]);
        setProductMetrics([]);
        setPersonnelMetrics([]);
        setGlobalConfirmed(0);
        setGlobalUnconfirmed(0);
        return;
      }
      
      const orders: OrderData[] = querySnapshot.docs.map(doc => doc.data() as OrderData);

      // --- Normalización Inteligente de Provincias y Productos ---
      const uniqueProvinces = [...new Set(orders.map(order => order.province || 'Desconocida').filter(p => p !== 'Desconocida'))];
      const uniqueProducts = [...new Set(orders.flatMap(order => order.products?.map(p => p.title) || []))];
      
      // Filtra solo los nombres que no están en la caché
      const provincesToNormalize = uniqueProvinces.filter(p => !provinceCorrectionsCache[p]);
      const productsToNormalize = uniqueProducts.filter(p => !productCorrectionsCache[p]);
      
      let newProvinceCorrections: Record<string, string> = {};
      let newProductCorrections: Record<string, string> = {};

      if (provincesToNormalize.length > 0 || productsToNormalize.length > 0) {
        setIsNormalizing(true);
        try {
          // Llama a las IAs solo si hay datos nuevos que normalizar
          const provincePromise = provincesToNormalize.length > 0
            ? normalizeProvinces({ provinceNames: provincesToNormalize })
            : Promise.resolve({});
            
          const productPromise = productsToNormalize.length > 0
            ? normalizeProducts({ productTitles: productsToNormalize })
            : Promise.resolve({});
          
          const [provinceResult, productResult] = await Promise.all([provincePromise, productPromise]);
          
          newProvinceCorrections = provinceResult;
          newProductCorrections = productResult;

          // Actualiza la caché de forma inmutable
          setProvinceCorrectionsCache(prev => ({ ...prev, ...newProvinceCorrections }));
          setProductCorrectionsCache(prev => ({ ...prev, ...newProductCorrections }));

        } catch (aiError) {
          console.warn("AI normalization failed:", aiError);
          toast({
              variant: "destructive",
              title: "Error de IA",
              description: "La normalización de datos falló. Mostrando datos sin procesar."
          });
          // En caso de error, llena la caché con los valores originales para no reintentar
          provincesToNormalize.forEach(p => newProvinceCorrections[p] = p);
          productsToNormalize.forEach(p => newProductCorrections[p] = p);
          setProvinceCorrectionsCache(prev => ({ ...prev, ...newProvinceCorrections }));
          setProductCorrectionsCache(prev => ({ ...prev, ...newProductCorrections }));
        } finally {
          setIsNormalizing(false);
        }
      }
      
      // Fusiona la caché existente con las nuevas correcciones
      const finalProvinceCorrections = { ...provinceCorrectionsCache, ...newProvinceCorrections };
      const finalProductCorrections = { ...productCorrectionsCache, ...newProductCorrections };

      // --- Agregación de Datos ---
      let totalConfirmed = 0;
      let totalUnconfirmed = 0;
      const dailyData: { [key: string]: { confirmed: number; unconfirmed: number } } = {};
      const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
      const productData: { [key: string]: number } = {};
      const personnelData: { [key: string]: number } = {};

      orders.forEach((order) => {
        const isOrderConfirmed = order.isConfirmed === true;
        isOrderConfirmed ? totalConfirmed++ : totalUnconfirmed++;
        
        // Daily Metrics
        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
          const orderDate = order.createdAt.toDate();
          const dateStr = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;
          if (!dailyData[dateStr]) dailyData[dateStr] = { confirmed: 0, unconfirmed: 0 };
          isOrderConfirmed ? dailyData[dateStr].confirmed++ : dailyData[dateStr].unconfirmed++;
        }

        // Province Metrics
        const rawProvince = order.province || 'Desconocida';
        const correctedProvince = finalProvinceCorrections[rawProvince] || rawProvince;
        if (!provinceData[correctedProvince]) provinceData[correctedProvince] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
        provinceData[correctedProvince].totalOrders++;
        provinceData[correctedProvince].totalSpent += order.totalPrice || 0;
        if (isOrderConfirmed) provinceData[correctedProvince].confirmedOrders++;
        
        // Product Metrics
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product: { title: string }) => {
                const rawProduct = product.title || 'Producto Desconocido';
                const correctedProduct = finalProductCorrections[rawProduct] || rawProduct;
                productData[correctedProduct] = (productData[correctedProduct] || 0) + 1;
            });
        }
        
        // Personnel Metrics
        if (isOrderConfirmed && order.confirmedBy) {
            const person = order.confirmedBy || 'No especificado';
            personnelData[person] = (personnelData[person] || 0) + 1;
        }
      });
      
      // --- Preparación de Datos para el UI ---
      const aggregatedDailyMetrics: DailyMetric[] = Object.entries(dailyData).map(([date, data]) => {
          const dailyTotal = data.confirmed + data.unconfirmed;
          return { date, totalOrders: dailyTotal, confirmed: data.confirmed, unconfirmed: data.unconfirmed, confirmationRate: dailyTotal > 0 ? (data.confirmed / dailyTotal) * 100 : 0 };
      }).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

      const aggregatedProvinceMetrics: ProvinceMetric[] = Object.entries(provinceData).map(([name, data]) => ({
        name, ...data, confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
      })).sort((a, b) => b.totalOrders - a.totalOrders);

      const aggregatedProductMetrics: ProductMetric[] = Object.entries(productData).map(([name, totalOrders]) => ({
          name, totalOrders
      })).sort((a, b) => b.totalOrders - a.totalOrders);

      const aggregatedPersonnelMetrics: PersonnelMetric[] = Object.entries(personnelData).map(([name, confirmedOrders]) => ({
          name, confirmedOrders
      })).sort((a, b) => b.confirmedOrders - a.confirmedOrders);

      // --- Actualización de Estados del UI ---
      setGlobalConfirmed(totalConfirmed);
      setGlobalUnconfirmed(totalUnconfirmed);
      setDailyMetrics(aggregatedDailyMetrics);
      setProvinceMetrics(aggregatedProvinceMetrics);
      setProductMetrics(aggregatedProductMetrics);
      setPersonnelMetrics(aggregatedPersonnelMetrics);
      setIsLoading(false);

    }, (error) => {
      console.error("Error al obtener las métricas desde Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas. Revisa tu conexión y las reglas de Firestore.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]); // Se eliminan las dependencias de caché para evitar re-renders innecesarios

  const globalTotal = globalConfirmed + globalUnconfirmed;
  const globalRate = globalTotal > 0 ? (globalConfirmed / globalTotal) * 100 : 0;
  const totalSpentAllProvinces = provinceMetrics.reduce((acc, curr) => acc + curr.totalSpent, 0);
  const averageSpentPerOrder = globalTotal > 0 ? totalSpentAllProvinces / globalTotal : 0;

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 flex items-center justify-center h-screen">
          <div className="flex items-center gap-4">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-lg">
                {isNormalizing ? "Normalizando datos con IA..." : "Cargando métricas..."}
              </p>
          </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Inteligencia de Negocio</h2>
        <Link href="/dashboard/upload-data" passHref>
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Carga Manual
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalConfirmed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos marcados como confirmados.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Sin Confirmar</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalUnconfirmed.toLocaleString()}</div>
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
          
            
          <Card className="col-span-1 md:col-span-2 lg:grid-cols-2">
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

            <Card className="col-span-1 md:col-span-2 lg:grid-cols-2">
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
            
            <Card className="col-span-1 md:col-span-4 lg:col-span-4">
              <CardHeader>
                  <CardTitle className="flex items-center"><Package className="mr-2 h-5 w-5" />Top 10 Productos</CardTitle>
                  <CardDescription>Los productos más pedidos, con nombres normalizados por IA.</CardDescription>
              </CardHeader>
               <CardContent className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ChartContainer config={{
                        totalOrders: { label: "Total Pedidos", color: "hsl(var(--chart-2))" }
                    }}>
                        <BarChart data={productMetrics.slice(0, 10)} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" fontSize={12} />
                          <YAxis dataKey="name" type="category" fontSize={12} tickLine={false} axisLine={false} width={120} interval={0} />
                          <Tooltip content={<ChartTooltipContent />} cursor={{fill: 'hsl(var(--muted))'}} />
                          <Legend verticalAlign="top" />
                          <Bar dataKey="totalOrders" name="Total Pedidos" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ChartContainer>
                  </ResponsiveContainer>
              </CardContent>
            </Card>


           <Card className="col-span-1 md:col-span-4">
              <CardHeader>
                  <CardTitle className="flex items-center">
                      <CalendarDays className="mr-2 h-5 w-5" />
                      Análisis Detallado por Día
                  </CardTitle>
                  <CardDescription>
                      Desglose diario de pedidos confirmados vs. no confirmados y su tasa de éxito.
                  </CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[450px]">
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
                    {dailyMetrics.length > 0 ? (
                      dailyMetrics.map((metric) => (
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
                          No se encontraron datos de pedidos para mostrar.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}

    