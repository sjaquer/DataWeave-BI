"use client";

import { useState, useEffect } from "react";
import { onSnapshot, collection, Timestamp } from "firebase/firestore";
import { Loader, CheckCircle, XCircle, Percent, CalendarDays, TrendingUp, TrendingDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";

interface DailyMetric {
  date: string;
  totalOrders: number;
  confirmed: number;
  unconfirmed: number;
  confirmationRate: number;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [globalConfirmed, setGlobalConfirmed] = useState(0);
  const [globalUnconfirmed, setGlobalUnconfirmed] = useState(0);
  const [globalRate, setGlobalRate] = useState(0);
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const ordersCollectionRef = collection(db, "shopify_orders");

    const unsubscribe = onSnapshot(ordersCollectionRef, (querySnapshot) => {
      let totalConfirmed = 0;
      let totalUnconfirmed = 0;
      const dailyData: { [key: string]: { confirmed: number; unconfirmed: number } } = {};

      querySnapshot.forEach((doc) => {
        const order = doc.data();
        
        if (!order.createdAt || typeof order.createdAt.toDate !== 'function') {
          return; 
        }
        
        const orderDate = order.createdAt.toDate();
        const dateStr = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { confirmed: 0, unconfirmed: 0 };
        }

        if (order.isConfirmed === true) {
          totalConfirmed++;
          dailyData[dateStr].confirmed++;
        } else {
          totalUnconfirmed++;
          dailyData[dateStr].unconfirmed++;
        }
      });

      const totalOrders = totalConfirmed + totalUnconfirmed;
      const overallRate = totalOrders > 0 ? (totalConfirmed / totalOrders) * 100 : 0;

      const aggregatedMetrics = Object.entries(dailyData).map(([date, data]) => {
          const dailyTotal = data.confirmed + data.unconfirmed;
          const rate = dailyTotal > 0 ? (data.confirmed / dailyTotal) * 100 : 0;
          return {
              date: date,
              totalOrders: dailyTotal,
              confirmed: data.confirmed,
              unconfirmed: data.unconfirmed,
              confirmationRate: parseFloat(rate.toFixed(2)),
          };
      }).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());

      setGlobalConfirmed(totalConfirmed);
      setGlobalUnconfirmed(totalUnconfirmed);
      setGlobalRate(overallRate);
      setDailyMetrics(aggregatedMetrics);
      setIsLoading(false);

    }, (error) => {
      console.error("Error al obtener las métricas desde Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas. La base de datos puede estar inaccesible.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

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

      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4">
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalConfirmed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos marcados como confirmados.</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pedidos No Confirmados</CardTitle>
              <XCircle className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalUnconfirmed.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Total de pedidos pendientes de confirmación.</p>
            </CardContent>
          </Card>
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tasa de Confirmación</CardTitle>
              <Percent className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{globalRate.toFixed(2)}%</div>
               <p className="text-xs text-muted-foreground">Porcentaje global de pedidos confirmados.</p>
            </CardContent>
          </Card>
           <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{(globalConfirmed + globalUnconfirmed).toLocaleString()}</div>
               <p className="text-xs text-muted-foreground">Suma de todos los pedidos registrados.</p>
            </CardContent>
          </Card>

           <Card className="col-span-1 md:col-span-3 lg:col-span-4">
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
                          No se encontraron datos para los días especificados.
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
