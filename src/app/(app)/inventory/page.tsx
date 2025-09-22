"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { analyzeInventoryMovement, InventoryInsightsOutput } from '@/ai/flows/inventory-insights-generator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Lightbulb, Wrench } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  inventoryData: z.string().min(50, 'Please paste a representative sample of your inventory data.'),
});

const exampleData = `ID_MOVIMIENTO	TIMESTAMP	USUARIO_REGISTRADOR	SKU	PRODUCTO	VARIANTE	CANTIDAD	STOCK_ANTERIOR	STOCK_POSTERIOR	TIPO_MOVIMIENTO	MOTIVO_DETALLE	ID_REFERENCIA	ALMACEN	NUM _PEDIDO	TIENDA
mov_1754517191052_116	06/08/2025 16:53:09	ALEXIS	5102	Amoladora Angular	DEAREL	-1	3	2	SALIDA	PREPARACIÓN PEDIDO	13533948	23/6/2025 2:24:41	#49414	Dearel
mov_1754517191053_117	06/08/2025 17:12:21	JUAN	7321	Taladro Percutor	MAKITA	-1	10	9	SALIDA	PREPARACIÓN PEDIDO	13533949	23/6/2025 2:30:11	#49415	Makita`;

export default function InventoryPage() {
  const [insights, setInsights] = useState<InventoryInsightsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      inventoryData: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setInsights(null);
    try {
      const result = await analyzeInventoryMovement(values);
      setInsights(result);
    } catch (error) {
      console.error('Error analyzing inventory:', error);
      toast({
        variant: 'destructive',
        title: 'Analysis Failed',
        description: 'There was an error analyzing your data. Please try again.',
      });
    }
    setIsLoading(false);
  }
  
  const handlePasteExample = () => {
    form.setValue('inventoryData', exampleData);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Inventory Movement Analysis</h1>
        <p className="text-muted-foreground">
          Paste your inventory data to get AI-powered insights and optimization suggestions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Data Input</CardTitle>
          <CardDescription>
            Paste your tab-separated inventory data below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="inventoryData"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tab-separated data from your spreadsheet</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Paste your data here..."
                        className="min-h-[200px] font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Analyze Data
                </Button>
                 <Button type="button" variant="outline" onClick={handlePasteExample}>
                  Paste Example
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-5/6" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-5/6" />
            </CardContent>
          </Card>
        </div>
      )}

      {insights && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="text-primary" /> Key Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 list-disc pl-5">
                {insights.insights.map((insight, index) => (
                  <li key={`insight-${index}`}>{insight}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="text-accent" /> Optimization Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 list-disc pl-5">
                {insights.suggestions.map((suggestion, index) => (
                  <li key={`suggestion-${index}`}>{suggestion}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
