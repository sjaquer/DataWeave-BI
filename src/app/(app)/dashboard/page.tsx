"use client";

import { useState, useEffect } from "react";
import { Loader, TrendingUp, CheckCircle, Percent, AlertCircle, Trash2, Upload, RefreshCw } from "lucide-react";
import { onSnapshot, collection, query, where, Timestamp } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { db } from "@/lib/firebase";
import { deleteOldMetrics } from "@/lib/firestore";
import DataUploader from "@/components/DataUploader";
import SyncButton from "@/components/SyncButton";

interface Metric {
  date: string;
  totalOrders: number;
  confirmedOrders: number;
  confirmationRate: number;
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isCleaning, setIsCleaning] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const { toast } = useToast();

  const handleCleanData = async () => {
    setIsCleaning(true);
    toast({
      title: "Iniciando Limpieza",
      description: "Eliminando registros de más de 6 meses...",
    });
    const result = await deleteOldMetrics();
    if (result.status === 'success') {
      toast({
        title: "Limpieza Completada",
        description: result.message,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Error en la Limpieza",
        description: result.message,
      });
    }
    setIsCleaning(false);
  };

  useEffect(() => {
    setIsLoading(true);
    const ordersCollectionRef = collection(db, "shopify_orders");
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoTimestamp = Timestamp.fromDate(sixMonthsAgo);

    const q = query(ordersCollectionRef, where("createdAt", ">=", sixMonthsAgoTimestamp));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const dailyData: { [key: string]: { total: number; confirmed: number } } = {};

      querySnapshot.forEach((doc) => {
        const order = doc.data();
        const orderDate = (order.createdAt as Timestamp).toDate();
        const dateStr = `${String(orderDate.getUTCDate()).padStart(2, '0')}-${String(orderDate.getUTCMonth() + 1).padStart(2, '0')}-${orderDate.getUTCFullYear()}`;

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = { total: 0, confirmed: 0 };
        }
        dailyData[dateStr].total++;
        if (order.isConfirmed) {
          dailyData[dateStr].confirmed++;
        }
      });

      const aggregatedMetrics = Object.entries(dailyData).map(([date, data]) => {
          const rate = data.total > 0 ? (data.confirmed / data.total) * 100 : 0;
          return {
              date: date,
              totalOrders: data.total,
              confirmedOrders: data.confirmed,
              confirmationRate: parseFloat(rate.toFixed(2)),
          };
      }).sort((a, b) => new Date(b.date.split('-').reverse().join('-')).getTime() - new Date(a.date.split('-').reverse().join('-')).getTime());


      setMetrics(aggregatedMetrics);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching metrics from Firestore:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: "No se pudieron cargar las métricas desde la base de datos.",
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [toast]);

  
  const totalOrders = metrics.reduce((acc, item) => acc + item.totalOrders, 0) ?? 0;
  const totalConfirmedOrders = metrics.reduce((acc, item) => acc + item.confirmedOrders, 0) ?? 0;
  const overallConfirmationRate = totalOrders > 0 ? (totalConfirmedOrders / totalOrders) * 100 : 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Tasa de Confirmación (Global)</h2>
         <AlertDialog>
          <AlertDialogTrigger asChild>
             <Button variant="destructive" disabled={isCleaning}>
                <Trash2 className="mr-2 h-4 w-4" />
                {isCleaning ? "Eliminando..." : "Eliminar Datos Antiguos"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará permanentemente todos los registros de pedidos con más de 6 meses de antigüedad. Esta operación no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCleanData}>Continuar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

       <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Dashboard en Tiempo Real</AlertTitle>
          <AlertDescription>
           Este dashboard se actualiza automáticamente con datos agregados de todas tus tiendas. Solo se muestran datos de los últimos 6 meses.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <RefreshCw className="mr-2 h-5 w-5" />
                        Sincronización con API de Shopify
                    </CardTitle>
                    <CardDescription>
                        Usa este botón para hacer una carga única del historial de los últimos 6 meses de una tienda específica, directamente desde la API de Shopify.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <SyncButton />
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Upload className="mr-2 h-5 w-5" />
                        Carga Manual de Historial con CSV
                    </CardTitle>
                    <CardDescription>
                        Sube un archivo CSV de pedidos exportado desde Shopify para hacer una carga masiva del historial de una tienda.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataUploader />
                </CardContent>
            </Card>
        </div>


      {(isLoading) && (
          <div className="flex justify-center items-center p-8">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">
                Cargando métricas desde la base de datos...
              </p>
          </div>
      )}

      {!isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Totales (Global)</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos de todas las tiendas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Confirmados (Global)</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalConfirmedOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de confirmados en logística</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Confirmación (Global)</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallConfirmationRate.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Porcentaje global de confirmados</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Análisis Detallado por Día (Agregado)</CardTitle>
              <CardDescription>
                Métricas de confirmación diarias sumando todas las tiendas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Pedidos Totales</TableHead>
                    <TableHead className="text-right">Pedidos Confirmados</TableHead>
                    <TableHead className="w-[200px]">Tasa de Confirmación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.length > 0 ? (
                    metrics.map((metric) => (
                      <TableRow key={metric.date}>
                        <TableCell className="font-medium">{metric.date}</TableCell>
                        <TableCell className="text-right">{metric.totalOrders}</TableCell>
                        <TableCell className="text-right">{metric.confirmedOrders}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={metric.confirmationRate} className="h-2" />
                            <span className="text-right font-medium text-sm w-16">
                               {isNaN(metric.confirmationRate) ? '0.00%' : `${metric.confirmationRate.toFixed(2)}%`}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No se encontraron datos de métricas. Esperando nuevos pedidos...
                      </TableCell>
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
