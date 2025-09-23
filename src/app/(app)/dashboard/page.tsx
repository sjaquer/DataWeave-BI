"use client";

import { useState, useEffect } from "react";
import { Loader, TrendingUp, CheckCircle, Percent, AlertCircle, RefreshCw } from "lucide-react";
import { collection, getDocs, onSnapshot, orderBy, query } from "firebase/firestore";

import { fetchAndProcessShopifyOrders } from "@/ai/flows/fetchShopifyOrdersFlow";
import type { DailyMetric } from "@/ai/schemas/analyzeMetricsSchema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { db } from "@/lib/firebase";


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    const metricsCollectionRef = collection(db, "daily_metrics");
    // Ordenar por fecha en formato DD-MM-YYYY de forma descendente.
    // Necesitamos convertir el string a algo comparable, pero Firestore no lo soporta.
    // Así que ordenamos en el cliente.
    const q = query(metricsCollectionRef);

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const fetchedMetrics: DailyMetric[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const rate = (data.totalOrders > 0) ? (data.confirmedOrders / data.totalOrders) * 100 : 0;
        fetchedMetrics.push({
          date: data.date,
          totalOrders: data.totalOrders || 0,
          confirmedOrders: data.confirmedOrders || 0,
          confirmationRate: parseFloat(rate.toFixed(2)),
        });
      });

      // Ordenar en el cliente
      fetchedMetrics.sort((a, b) => {
        const [dayA, monthA, yearA] = a.date.split('-').map(Number);
        const [dayB, monthB, yearB] = b.date.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateB.getTime() - dateA.getTime();
      });

      setMetrics(fetchedMetrics);
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

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [toast]);


  const handleSyncShopify = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchAndProcessShopifyOrders();
      if (result.status === 'success') {
        toast({
          title: "Sincronización Exitosa",
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido durante la sincronización.";
       toast({
        variant: "destructive",
        title: "Error de Sincronización",
        description: errorMessage,
      });
      console.error("Error syncing Shopify orders:", error);
    } finally {
      setIsSyncing(false);
    }
  }
  
  const totalOrders = metrics.reduce((acc, item) => acc + item.totalOrders, 0) ?? 0;
  const totalConfirmedOrders = metrics.reduce((acc, item) => acc + item.confirmedOrders, 0) ?? 0;
  const overallConfirmationRate = totalOrders > 0 ? (totalConfirmedOrders / totalOrders) * 100 : 0;


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Tasa de Convertibilidad</h2>
         <Button onClick={handleSyncShopify} disabled={isSyncing || isLoading}>
            {isSyncing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar Datos
        </Button>
      </div>

       <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Datos en Tiempo Real</AlertTitle>
          <AlertDescription>
            El dashboard se actualiza automáticamente con los datos de Shopify y Google Sheets. Usa el botón "Actualizar Datos" para forzar una sincronización con Shopify.
          </AlertDescription>
        </Alert>

      {(isLoading) && (
          <div className="flex justify-center items-center p-8">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">
                {isSyncing ? 'Sincronizando pedidos de Shopify...' : 'Cargando métricas desde la base de datos...'}
              </p>
          </div>
      )}

      {!isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos recibidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalConfirmedOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos confirmados en logística</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Confirmación General</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallConfirmationRate.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Porcentaje de pedidos confirmados</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Análisis Detallado por Día</CardTitle>
              <CardDescription>
                Métricas de conversión diarias basadas en los datos de Shopify y Google Sheets.
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
                              {metric.confirmationRate.toFixed(2)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No se encontraron datos de métricas. Sincroniza los datos para empezar.
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
