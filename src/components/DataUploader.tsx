"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { analyzeAndStoreMetrics } from "@/lib/firestore";
import { Loader, Upload, AlertCircle } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

const formSchema = z.object({
  storeId: z.string().min(1, "El ID de la tienda es requerido."),
  shopifyFiles: z.any().refine(files => files?.length > 0, "Se requiere al menos un archivo de Shopify."),
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
      title: "Procesando Archivos de Shopify",
      description: "Esto puede tardar unos momentos...",
    });

    try {
      let shopifyDataUris: string[] = [];
      if (values.shopifyFiles && values.shopifyFiles.length > 0) {
        // Convertimos todos los archivos seleccionados a Data URIs
        shopifyDataUris = await Promise.all(
          Array.from(values.shopifyFiles as FileList).map(file => fileToDataUri(file))
        );
      }

      if (shopifyDataUris.length === 0) {
        throw new Error("No se han seleccionado archivos de Shopify válidos.");
      }

      // Llamamos a la función del servidor unificada
      const result = await analyzeAndStoreMetrics({
        storeId: values.storeId,
        shopifyDataUris,
      });

      if (result.status === "success") {
        toast({
          title: "Procesamiento Completo",
          description: result.message,
        });
      } else {
        // Si el servidor devuelve un error, lo mostramos
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
      form.reset();
      // Limpiamos el input de archivos para poder subir los mismos de nuevo si es necesario
      const fileInput = document.getElementById('shopifyFiles-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
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
                    <li>Este proceso **sobrescribirá los datos** de pedidos para las fechas incluidas en el archivo de la tienda especificada. Los datos de confirmación no se tocarán.</li>
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
                name="shopifyFiles"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Archivos CSV de Shopify</FormLabel>
                    <FormControl>
                        <Input
                        id="shopifyFiles-input"
                        type="file"
                        accept=".csv"
                        multiple
                        onChange={(e) => field.onChange(e.target.files)}
                        />
                    </FormControl>
                    <FormDescription>Puedes seleccionar múltiples reportes de pedidos exportados.</FormDescription>
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
