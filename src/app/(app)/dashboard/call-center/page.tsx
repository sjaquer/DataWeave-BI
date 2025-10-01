
"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader, RefreshCw, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Tipado para los datos de las llamadas que esperamos de nuestra API
interface ZadarmaCall {
  id: string;
  call_start: string;
  internal: string;
  caller_id: string;
  destination: string;
  disposition: "answered" | "busy" | "cancel" | "no answer" | "failed" | "congestion";
  duration: number;
  is_recorded: boolean;
}

const dispositionMap: { [key: string]: { text: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
  answered: { text: "Contestada", variant: "default" },
  busy: { text: "Ocupado", variant: "secondary" },
  cancel: { text: "Cancelada", variant: "secondary" },
  "no answer": { text: "No contestada", variant: "destructive" },
  failed: { text: "Fallida", variant: "destructive" },
  congestion: { text: "Congestión", variant: "destructive" },
};

export default function CallCenterPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [callStats, setCallStats] = useState<ZadarmaCall[]>([]);
  const { toast } = useToast();

  const fetchCallStats = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      // Por ahora, siempre refrescamos para obtener los últimos datos.
      // En el futuro, podríamos cachear esto.
      const response = await fetch('/api/zadarma/stats');
      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setCallStats(data.stats || []);
        toast({
          title: "Estadísticas de llamadas actualizadas",
          description: `Se encontraron ${data.stats?.length || 0} registros.`,
        });
      } else {
        throw new Error(data.message || "Error al obtener los datos de Zadarma.");
      }
    } catch (error: any) {
      console.error("Error al obtener las estadísticas de llamadas:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCallStats();
  }, [fetchCallStats]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Call Center</h2>
          <p className="text-muted-foreground">Análisis de rendimiento de llamadas con datos de Zadarma.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCallStats(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
      <DashboardNav active="call-center" />

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center"><Phone className="mr-2 h-5 w-5" />Últimas 100 Llamadas</CardTitle>
            <CardDescription>Registro de las llamadas más recientes procesadas por Zadarma.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto max-h-[70vh] p-2">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-center">Duración</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callStats.length > 0 ? (
                  callStats.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(call.call_start), "d MMM yyyy, HH:mm:ss", { locale: es })}
                      </TableCell>
                      <TableCell>{call.internal}</TableCell>
                      <TableCell>{call.caller_id}</TableCell>
                      <TableCell>{call.destination}</TableCell>
                      <TableCell className="text-center">{formatDuration(call.duration)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={dispositionMap[call.disposition]?.variant || "secondary"}>
                          {dispositionMap[call.disposition]?.text || call.disposition}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No se encontraron registros de llamadas. Verifica tu conexión o el rango de fechas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
