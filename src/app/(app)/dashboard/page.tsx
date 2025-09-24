"use client";

import { useState, useEffect } from "react";
import { onSnapshot, collection } from "firebase/firestore";
import { Loader, CheckCircle, XCircle, Percent, CalendarDays, TrendingUp, Upload, MapPin, Package, UserCheck, Banknote } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import DataUploader from "@/components/DataUploader";

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


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [globalConfirmed, setGlobalConfirmed] = useState(0);
  const [globalUnconfirmed, setGlobalUnconfirmed] = useState(0);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const [provinceMetrics, setProvinceMetrics] = useState<ProvinceMetric[]>([]);
  const [productMetrics, setProductMetrics] = useState<ProductMetric[]>([]);
  const [personnelMetrics, setPersonnelMetrics] = useState<PersonnelMetric[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const ordersCollectionRef = collection(db, "shopify_orders");

    const unsubscribe = onSnapshot(ordersCollectionRef, (querySnapshot) => {
      let totalConfirmed = 0;
      let totalUnconfirmed = 0;
      
      const dailyData: { [key: string]: { confirmed: number; unconfirmed: number } } = {};
      const provinceData: { [key: string]: { totalOrders: number; confirmedOrders: number; totalSpent: number; } } = {};
      const productData: { [key: string]: number } = {};
      const personnelData: { [key: string]: number } = {};

      querySnapshot.forEach((doc) => {
        const order = doc.data();
        const isOrderConfirmed = order.isConfirmed === true;

        if (isOrderConfirmed) {
          totalConfirmed++;
        } else {
          totalUnconfirmed++;
        }
        
        // --- Análisis Diario ---
        if (order.createdAt && typeof order.createdAt.toDate === 'function') {
          const orderDate = order.createdAt.toDate();
          const dateStr = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;
          if (!dailyData[dateStr]) dailyData[dateStr] = { confirmed: 0, unconfirmed: 0 };
          isOrderConfirmed ? dailyData[dateStr].confirmed++ : dailyData[dateStr].unconfirmed++;
        }

        // --- Análisis Demográfico (Provincia) ---
        const province = order.province || 'Desconocida';
        if (!provinceData[province]) provinceData[province] = { totalOrders: 0, confirmedOrders: 0, totalSpent: 0 };
        provinceData[province].totalOrders++;
        provinceData[province].totalSpent += order.totalPrice || 0;
        if (isOrderConfirmed) provinceData[province].confirmedOrders++;
        
        // --- Análisis de Productos ---
        if (order.products && Array.isArray(order.products)) {
            order.products.forEach((product: { title: string }) => {
                const productName = product.title || 'Producto Desconocido';
                productData[productName] = (productData[productName] || 0) + 1;
            });
        }
        
        // --- Análisis de Personal ---
        if (isOrderConfirmed && order.confirmedBy) {
            const person = order.confirmedBy || 'No especificado';
            personnelData[person] = (personnelData[person] || 0) + 1;
        }
      });
      
      // --- Procesar y Ordenar Métricas ---
      const aggregatedDailyMetrics: DailyMetric[] = Object.entries(dailyData).map(([date, data]) => {
          const dailyTotal = data.confirmed + data.unconfirmed;
          return {
              date,
              totalOrders: dailyTotal,
              confirmed: data.confirmed,
              unconfirmed: data.unconfirmed,
              confirmationRate: dailyTotal > 0 ? (data.confirmed / dailyTotal) * 100 : 0,
          };
      }).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

      const aggregatedProvinceMetrics: ProvinceMetric[] = Object.entries(provinceData).map(([name, data]) => ({
        name,
        ...data,
        confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0
      })).sort((a, b) => b.totalOrders - a.totalOrders);

      const aggregatedProductMetrics: ProductMetric[] = Object.entries(productData).map(([name, totalOrders]) => ({
          name, totalOrders
      })).sort((a, b) => b.totalOrders - a.totalOrders);

      const aggregatedPersonnelMetrics: PersonnelMetric[] = Object.entries(personnelData).map(([name, confirmedOrders]) => ({
          name, confirmedOrders
      })).sort((a, b) => b.confirmedOrders - a.confirmedOrders);


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
        description: "No se pudieron cargar las métricas. Revisa las reglas de seguridad de Firestore y tu conexión.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

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
                Cargando métricas...
              </p>
          </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Confirmación</h2>
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
              <div className="text-4xl font-bold">${averageSpentPerOrder.toFixed(2)}</div>
               <p className="text-xs text-muted-foreground">Promedio gastado en todos los pedidos.</p>
            </CardContent>
          </Card>
          
          <Card className="col-span-1 md:col-span-2 lg:col-span-4">
              <CardHeader>
                  <CardTitle className="flex items-center">
                      <Upload className="mr-2 h-5 w-5" />
                      Carga Manual de Datos (CSV)
                  </CardTitle>
                  <CardDescription>
                      Sube aquí los archivos CSV para las tiendas no conectadas por webhooks.
                  </CardDescription>
              </CardHeader>
              <CardContent>
                <DataUploader />
              </CardContent>
          </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 col-span-1 md:col-span-2 lg:col-span-4 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5" />Top Provincias por Pedidos</CardTitle>
                        <CardDescription>Provincias con más pedidos y su tasa de confirmación.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-auto max-h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Provincia</TableHead>
                                    <TableHead className="text-center">Pedidos</TableHead>
                                    <TableHead className="text-right">Tasa Conf.</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {provinceMetrics.map(p => (
                                    <TableRow key={p.name}>
                                        <TableCell className="font-medium">{p.name}</TableCell>
                                        <TableCell className="text-center">{p.totalOrders}</TableCell>
                                        <TableCell className="text-right">{p.confirmationRate.toFixed(1)}%</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                     <CardHeader>
                        <CardTitle className="flex items-center"><Package className="mr-2 h-5 w-5" />Top Productos Pedidos</CardTitle>
                        <CardDescription>Productos que aparecen con más frecuencia en los pedidos.</CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-auto max-h-[300px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="text-right">Nº de Pedidos</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                 {productMetrics.slice(0, 10).map(p => (
                                    <TableRow key={p.name}>
                                        <TableCell className="font-medium truncate" style={{maxWidth: '200px'}}>{p.name}</TableCell>
                                        <TableCell className="text-right">{p.totalOrders}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            
            <Card className="col-span-1 md:col-span-2 lg:col-span-4">
                  <CardHeader>
                    <CardTitle className="flex items-center"><UserCheck className="mr-2 h-5 w-5" />Rendimiento del Personal</CardTitle>
                    <CardDescription>Número de pedidos confirmados por cada miembro del equipo.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-auto max-h-[300px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Personal</TableHead>
                                <TableHead className="text-right">Pedidos Confirmados</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {personnelMetrics.map(p => (
                                <TableRow key={p.name}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right">{p.confirmedOrders}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

           <Card className="col-span-1 md:col-span-2 lg:col-span-4">
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
