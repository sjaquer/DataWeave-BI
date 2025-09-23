'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader, RefreshCw } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertCircle } from 'lucide-react';
import { syncShopifyHistory } from '@/ai/flows/syncShopifyHistoryFlow';

const formSchema = z.object({
  storeId: z.string().min(1, 'El ID de la tienda es requerido (ej: dearel).'),
});

export default function SyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      storeId: 'dearel',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSyncing(true);
    toast({
      title: 'Iniciando Sincronización con Shopify',
      description: 'Esto puede tomar varios minutos. Por favor, no cierres esta página.',
    });

    try {
      const result = await syncShopifyHistory({
        storeId: values.storeId,
      });

      if (result.status === 'success') {
        toast({
          title: 'Sincronización Completa',
          description: result.message,
        });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error en la Sincronización',
        description: error.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Acción de Sincronización Manual</AlertTitle>
        <AlertDescription>
          Usa este botón para hacer una carga única del historial de pedidos de los últimos 6 meses directamente desde la API de Shopify.
          Este proceso puede tardar varios minutos. Asegúrate de que las credenciales de la API para el `Store ID` estén configuradas.
        </AlertDescription>
      </Alert>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="storeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID de la Tienda (Store ID)</FormLabel>
                <FormControl>
                  <Input placeholder="Ej: dearel" {...field} />
                </FormControl>
                <FormDescription>
                  El mismo ID usado en las variables de entorno (ej. SHOPIFY_API_KEY_DEAREL).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isSyncing} className="w-full">
            {isSyncing ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Historial de 6 Meses
              </>
            )}
          </Button>
        </form>
      </Form>
    </>
  );
}
