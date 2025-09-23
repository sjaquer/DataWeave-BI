"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader, TrendingUp, CheckCircle, Percent, AlertCircle, FileUp, BarChart, Download } from "lucide-react";

import { analyzeMetrics } from "@/ai/flows/analyzeMetricsFlow";
import { fetchAndProcessShopifyOrders } from "@/ai/flows/fetchShopifyOrdersFlow";
import type { DailyMetric, AnalyzeMetricsOutput } from "@/ai/schemas/analyzeMetricsSchema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  shopifyFile: z
    .any()
    .refine((files) => files?.length === 1, "El reporte de Shopify es requerido."),
  sheetsFile: z
    .any()
    .refine((files) => files?.length === 1, "El reporte de logística es requerido."),
});

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function Dashboard() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalyzeMetricsOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onAnalyzeSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const shopifyDataUri = await fileToDataUri(values.shopifyFile[0]);
      const sheetsDataUri = await fileToDataUri(values.sheetsFile[0]);

      const result = await analyzeMetrics({
        shopifyDataUri,
        sheetsDataUri,
      });

      if (result.status === 'error') {
        throw new Error(result.message);
      }
      
      setAnalysisResult(result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
      toast({
        variant: "destructive",
        title: "Error en el Análisis",
        description: errorMessage,
      });
      console.error("Error processing files:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSyncShopify = async () => {
    setIsSyncing(true);
    try {
      const result = await fetchAndProcessShopifyOrders();
      if (result.status === 'success') {
        toast({
          title: "Sincronización Exitosa",
          description: result.message,
        });
        // Aquí podrías recargar los datos del dashboard si fuera necesario
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
  
  const totalOrders = analysisResult?.dashboardData.reduce((acc, item) => acc + item.totalOrders, 0) ?? 0;
  const totalConfirmedOrders = analysisResult?.dashboardData.reduce((acc, item) => acc + item.confirmedOrders, 0) ?? 0;
  const overallConfirmationRate = totalOrders > 0 ? (totalConfirmedOrders / totalOrders) * 100 : 0;


  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Tasa de Convertibilidad</h2>
      </div>

       <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Análisis Bajo Demanda y Sincronización</AlertTitle>
          <AlertDescription>
            Usa el botón para sincronizar los pedidos de Shopify. Luego, sube los reportes CSV para un análisis completo.
          </AlertDescription>
        </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
           <CardHeader>
            <CardTitle>Sincronización de Datos</CardTitle>
            <CardDescription>Obtén los últimos pedidos directamente desde Shopify.</CardDescription>
          </CardHeader>
          <CardContent>
              <Button onClick={handleSyncShopify} disabled={isSyncing} className="w-full">
                {isSyncing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Sincronizar Pedidos de Shopify
              </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cargar Archivos para Análisis</CardTitle>
            <CardDescription>Selecciona los reportes en formato CSV para comenzar el análisis.</CardDescription>
          </CardHeader>
          <CardContent>
            <FormProvider {...form}>
              <form onSubmit={form.handleSubmit(onAnalyzeSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="shopifyFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reporte de Pedidos de Shopify (.csv)</FormLabel>
                        <FormControl>
                          <Input type="file" accept=".csv" {...form.register("shopifyFile")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sheetsFile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reporte de Logística (.csv)</FormLabel>
                        <FormControl>
                          <Input type="file" accept=".csv" {...form.register("sheetsFile")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={isAnalyzing} className="w-full md:w-auto">
                  {isAnalyzing ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <BarChart className="mr-2 h-4 w-4" />}
                  Analizar Datos
                </Button>
              </form>
            </FormProvider>
          </CardContent>
        </Card>
      </div>

      {(isAnalyzing || isSyncing) && (
          <div className="flex justify-center items-center p-8">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">
                {isSyncing ? 'Sincronizando pedidos de Shopify...' : 'Procesando archivos y analizando métricas...'}
              </p>
          </div>
      )}

      {analysisResult && analysisResult.status === 'success' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos recibidos en el reporte</p>
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
                Métricas de conversión diarias basadas en los archivos cargados.
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
                  {analysisResult.dashboardData.length > 0 ? (
                    analysisResult.dashboardData.map((metric) => (
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
                        No se encontraron datos de métricas para mostrar.
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
