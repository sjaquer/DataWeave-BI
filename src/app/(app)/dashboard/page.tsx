"use client";

import { useState } from "react";
import { Loader, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { analyzeMetrics } from "@/ai/flows/analyzeMetricsFlow";
import type { AnalyzeMetricsInput } from "@/ai/schemas/analyzeMetricsSchema";

export default function Dashboard() {
  const [shopifyFile, setShopifyFile] = useState<File | null>(null);
  const [sheetsFile, setSheetsFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
    try {
      const shopifyDataUri = await toBase64(shopifyFile);
      const sheetsDataUri = await toBase64(sheetsFile);
      
      const result = await analyzeMetrics({
        shopifyDataUri,
        sheetsDataUri,
      });

      console.log("Análisis completado:", result);
      toast({
        title: "Análisis exitoso",
        description: "Los datos han sido procesados. Pronto verás el dashboard.",
      });
      // Aquí es donde procesaríamos 'result' y actualizaríamos el estado del dashboard.

    } catch (error) {
      console.error("Error al analizar los archivos:", error);
      toast({
        title: "Error en el análisis",
        description: "Hubo un problema al procesar los archivos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Métricas</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Cargar Documentos</CardTitle>
            <CardDescription>
              Sube los reportes de Shopify y Google Sheets para analizar las métricas de tu negocio.
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
                    {shopifyFile ? shopifyFile.name : 'Haz clic para subir'}
                  </span>
                  <input
                    id="shopify-upload"
                    type="file"
                    className="hidden"
                    accept=".csv,.xls,.xlsx"
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
                  <span className="mt-2 text-sm font-semibold">Reporte de Google Sheets</span>
                  <span className="text-xs text-muted-foreground">
                    {sheetsFile ? sheetsFile.name : 'Haz clic para subir'}
                  </span>
                  <input
                    id="sheets-upload"
                    type="file"
                    className="hidden"
                    accept=".csv,.xls,.xlsx"
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
      </div>
      
      {/* Aquí se mostrarán los componentes del dashboard una vez que los datos se procesen */}
    </div>
  );
}
