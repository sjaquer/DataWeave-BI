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
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import MarkdownRenderer from '@/components/markdown-renderer';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  salesDataDescription: z.string().min(10, 'Please provide more detail.'),
  customerDataDescription: z.string().min(10, 'Please provide more detail.'),
  regionalSalesDataDescription: z.string().min(10, 'Please provide more detail.'),
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
        title: "An error occurred",
        description: "Failed to generate database schema. Please try again.",
      });
    }
    setIsLoading(false);
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Database Schema AI</h1>
          <p className="text-muted-foreground">
            Describe your data, and let AI generate an optimal database schema for KPI analysis.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Data Descriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="salesDataDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Data</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Data includes order ID, product SKU, quantity, price, order date..." {...field} />
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
                      <FormLabel>Customer Data</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Data includes customer ID, name, email, sign-up date, location..." {...field} />
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
                      <FormLabel>Regional Sales Data</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g., Data includes province, city, sales amount per region..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Schema
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        <Card className="min-h-[600px]">
          <CardHeader>
            <CardTitle>Generated Schema</CardTitle>
            <CardDescription>The optimal database schema will appear here.</CardDescription>
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
