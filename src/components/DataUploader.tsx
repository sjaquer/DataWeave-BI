
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { analyzeMetrics } from "@/ai/flows/analyzeMetricsFlow";
import { Loader, Upload } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle } from "lucide-react";

const formSchema = z.object({
  storeId: z.string().min(1, "El ID de la tienda es requerido."),
  shopifyFile: z.any().optional(),
  sheetsFile: z.any().optional(),
})
.refine(data => data.shopifyFile?.length || data.sheetsFile?.length, {
    message: "Debes subir al menos un archivo.",
    path: ["shopifyFile"], // Attach error to one of the fields
});

const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function DataUploader() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      storeId: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsProcessing(true);
    toast({
      title: "Procesando Archivos",
      description: "Esto puede tardar unos momentos...",
    });

    try {
      let shopifyDataUri: string | undefined;
      if (values.shopifyFile && values.shopifyFile.length > 0) {
        shopifyDataUri = await fileToDataUri(values.shopifyFile[0]);
      }

      let sheetsDataUri: string | undefined;
       if (values.sheetsFile && values.sheetsFile.length > 0) {
        sheetsDataUri = await fileToDataUri(values.sheetsFile[0]);
      }

      const result = await analyzeMetrics({
        storeId: values.storeId,
        shopifyDataUri,
        sheetsDataUri,
      });

      if (result.status === "success") {
        toast({
          title: "Procesamiento Completo",
          description: result.message.replace(/\n/g, ' '),
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error en el Procesamiento",
        description: error.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Form {...form}>
        <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Instrucciones Importantes</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Exporta los pedidos de Shopify de los **últimos 6 meses** en formato **CSV sin formato**.</li>
                    <li>Asegúrate de que el `Store ID` (ej: `tienda-1`) sea el mismo que usarás en los webhooks.</li>
                    <li>Este proceso sobrescribirá los datos de pedidos para las fechas incluidas en el archivo de la tienda especificada.</li>
                </ul>
            </AlertDescription>
        </Alert>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="storeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ID de la Tienda (Store ID)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: tienda-1" {...field} />
                  </FormControl>
                  <FormDescription>
                    Identificador único para esta tienda.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="shopifyFile"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Archivo CSV de Shopify</FormLabel>
                    <FormControl>
                        <Input
                        type="file"
                        accept=".csv"
                        onChange={(e) => field.onChange(e.target.files)}
                        />
                    </FormControl>
                    <FormDescription>Reporte de pedidos exportado.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <Button type="submit" disabled={isProcessing} className="w-full">
          {isProcessing ? (
            <>
              <Loader className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Procesar Archivos
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
