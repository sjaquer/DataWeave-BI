"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { generateDatabaseSchema, GenerateDatabaseSchemaOutput } from '@/ai/flows/database-schema-generator';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import MarkdownRenderer from '@/components/markdown-renderer';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const formSchema = z.object({
  salesDataDescription: z.string().min(10, 'Por favor, proporciona más detalles.'),
  customerDataDescription: z.string().min(10, 'Por favor, proporciona más detalles.'),
  regionalSalesDataDescription: z.string().min(10, 'Por favor, proporciona más detalles.'),
});

export default function DatabaseSchemaPage() {
  const [result, setResult] = useState<GenerateDatabaseSchemaOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      salesDataDescription: '',
      customerDataDescription: '',
      regionalSalesDataDescription: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);
    try {
      const response = await generateDatabaseSchema(values);
      setResult(response);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Ocurrió un error",
        description: "No se pudo generar el esquema de la base de datos. Por favor, inténtalo de nuevo.",
      });
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon">
                <Link href="/dashboard">
                    <ArrowLeft className="h-4 w-4"/>
                    <span className="sr-only">Volver</span>
                </Link>
            </Button>
            <div>
                 <h1 className="text-3xl font-bold tracking-tight">Esquema de BD con IA</h1>
                <p className="text-muted-foreground">
                    Describe tus datos y deja que la IA genere un esquema de base de datos óptimo para el análisis de KPIs.
                </p>
            </div>
       </div>
        <div className="grid gap-8 md:grid-cols-2">
            <Card>
            <CardHeader>
                <CardTitle>Descripción de Datos</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                    control={form.control}
                    name="salesDataDescription"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Datos de Ventas</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Ej: Los datos incluyen ID de pedido, SKU de producto, cantidad, precio, fecha de pedido..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="customerDataDescription"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Datos de Clientes</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Ej: Los datos incluyen ID de cliente, nombre, email, fecha de registro, ubicación..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="regionalSalesDataDescription"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Datos de Ventas Regionales</FormLabel>
                        <FormControl>
                            <Textarea placeholder="Ej: Los datos incluyen provincia, ciudad, monto de ventas por región..." {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generar Esquema
                    </Button>
                </form>
                </Form>
            </CardContent>
            </Card>
            <Card className="min-h-[600px]">
            <CardHeader>
                <CardTitle>Esquema Generado</CardTitle>
                <CardDescription>El esquema de base de datos óptimo aparecerá aquí.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading && (
                <div className="space-y-4">
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <br />
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                </div>
                )}
                {result && <MarkdownRenderer content={result.databaseSchemaMarkdown} />}
            </CardContent>
            </Card>
        </div>
    </div>
  );
}
