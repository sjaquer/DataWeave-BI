"use client";

import { useState } from "react";
import { Loader, UploadCloud, TrendingUp, CheckCircle, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { analyzeMetrics } from "@/ai/flows/analyzeMetricsFlow";
import type { DailyMetric } from "@/ai/schemas/analyzeMetricsSchema";

const ITEMS_PER_PAGE = 50;

export default function Dashboard() {
  const [shopifyFile, setShopifyFile] = useState<File | null>(null);
  const [sheetsFile, setSheetsFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DailyMetric[]>([]);
  const { toast } = useToast();
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'shopify' | 'sheets') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (fileType === 'shopify') {
        setShopifyFile(file);
      } else {
        setSheetsFile(file);
      }
    }
  };

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async () => {
    if (!shopifyFile || !sheetsFile) {
      toast({
        title: "Faltan archivos",
        description: "Por favor, sube ambos documentos para continuar.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setDashboardData([]);
    setVisibleItems(ITEMS_PER_PAGE); // Reset pagination on new analysis
    try {
      const shopifyDataUri = await toBase64(shopifyFile);
      const sheetsDataUri = await toBase64(sheetsFile);
      
      const result = await analyzeMetrics({
        shopifyDataUri,
        sheetsDataUri,
      });
      
      if (result.status === 'success' && result.dashboardData) {
        setDashboardData(result.dashboardData);
        toast({
          title: "Análisis completado",
          description: "Tu dashboard está listo.",
        });
      } else {
        throw new Error(result.message || "Ocurrió un error en el análisis.");
      }

    } catch (error) {
      console.error("Error al analizar los archivos:", error);
      const errorMessage = error instanceof Error ? error.message : "Hubo un problema al procesar los archivos. Inténtalo de nuevo.";
      toast({
        title: "Error en el análisis",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleShowMore = () => {
    setVisibleItems((prev) => prev + ITEMS_PER_PAGE);
  };

  const totalOrders = dashboardData.reduce((acc, item) => acc + item.totalOrders, 0);
  const totalConfirmedOrders = dashboardData.reduce((acc, item) => acc + item.confirmedOrders, 0);
  const overallConfirmationRate = totalOrders > 0 ? (totalConfirmedOrders / totalOrders) * 100 : 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Tasa de Convertibilidad</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cargar Documentos</CardTitle>
          <CardDescription>
            Sube los reportes de Shopify (CSV) y Logística (CSV) para analizar las métricas de tu negocio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center justify-center space-y-2">
              <label
                htmlFor="shopify-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                <span className="mt-2 text-sm font-semibold">Reporte de Shopify</span>
                <span className="text-xs text-muted-foreground">
                  {shopifyFile ? shopifyFile.name : 'Haz clic para subir (.csv)'}
                </span>
                <input
                  id="shopify-upload"
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e, 'shopify')}
                />
              </label>
            </div>
            <div className="flex flex-col items-center justify-center space-y-2">
              <label
                htmlFor="sheets-upload"
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted"
              >
                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                <span className="mt-2 text-sm font-semibold">Reporte de Logística</span>
                <span className="text-xs text-muted-foreground">
                  {sheetsFile ? sheetsFile.name : 'Haz clic para subir (.csv)'}
                </span>
                <input
                  id="sheets-upload"
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e, 'sheets')}
                />
              </label>
            </div>
          </div>
          <div className="flex justify-center">
            <Button onClick={handleSubmit} disabled={isLoading || !shopifyFile || !sheetsFile}>
              {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Analizando..." : "Generar Dashboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isLoading && (
          <div className="flex justify-center items-center p-8">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Generando métricas...</p>
          </div>
      )}

      {dashboardData.length > 0 && (
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
                <p className="text-xs text-muted-foreground">Total de pedidos confirmados</p>
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
              <CardTitle>Rendimiento Diario</CardTitle>
              <CardDescription>Comparación de pedidos totales vs. confirmados por día.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="totalOrders" fill="var(--color-chart-2)" name="Pedidos Totales" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="confirmedOrders" fill="var(--color-chart-1)" name="Pedidos Confirmados" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Análisis Detallado por Día</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Pedidos Totales</TableHead>
                    <TableHead className="text-right">Pedidos Confirmados</TableHead>
                    <TableHead className="text-right">Tasa de Confirmación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboardData.slice(0, visibleItems).map((metric) => (
                    <TableRow key={metric.date}>
                      <TableCell>{metric.date}</TableCell>
                      <TableCell className="text-right">{metric.totalOrders}</TableCell>
                      <TableCell className="text-right">{metric.confirmedOrders}</TableCell>
                      <TableCell className="text-right font-medium">{metric.confirmationRate.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {visibleItems < dashboardData.length && (
                <div className="flex justify-center mt-4">
                  <Button onClick={handleShowMore}>
                    Ver más
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
