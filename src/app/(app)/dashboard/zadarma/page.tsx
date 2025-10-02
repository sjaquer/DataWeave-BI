"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader, RefreshCw, Phone, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import DashboardNav from "@/components/DashboardNav";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";


// Tipado para los datos de las llamadas que esperamos de nuestra API
interface ZadarmaCall {
  pbx_call_id: string;
  callstart: string; // Corregido de call_start a callstart
  sip: string;
  clid: string;
  destination: string | number; // Acepta número o texto
  disposition: "answered" | "busy" | "cancel" | "no answer" | "failed" | "congestion";
  seconds: number;
}

type SortConfig = {
    key: keyof ZadarmaCall;
    direction: 'ascending' | 'descending';
};

const dispositionMap: { [key: string]: { text: string; variant: "default" | "secondary" | "destructive" | "outline" } } = {
  answered: { text: "Contestada", variant: "default" },
  busy: { text: "Ocupado", variant: "secondary" },
  cancel: { text: "Cancelada", variant: "secondary" },
  "no answer": { text: "No contestada", variant: "destructive" },
  failed: { text: "Fallida", variant: "destructive" },
  congestion: { text: "Congestión", variant: "destructive" },
};

const agentMap: { [key: string]: string } = {
  "101": "Aylen",
  "104": "Alanis",
  "105": "Marisol",
  "107": "Lisset",
  "108": "Wendy",
  "111": "Luz",
};

export default function ZadarmaPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [calls, setCalls] = useState<ZadarmaCall[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'callstart', direction: 'descending' });
  const { toast } = useToast();

  const fetchCallStats = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/zadarma/stats');
      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setCalls(data.stats || []);
        if (forceRefresh) {
            toast({
                title: "Estadísticas de Zadarma actualizadas",
                description: `Se encontraron ${data.stats.length} registros de llamadas.`,
            });
        }
      } else {
        throw new Error(data.message || "Error al obtener los datos de Zadarma.");
      }
    } catch (error: any) {
      console.error("Error al obtener las estadísticas de Zadarma:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión con Zadarma",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCallStats();
  }, [fetchCallStats]);

  const sortedCalls = useMemo(() => {
    let sortableItems = [...calls];
    if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
            return 0;
        });
    }
    return sortableItems;
  }, [calls, sortConfig]);

  const handleSort = (key: keyof ZadarmaCall) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const renderSortArrow = (key: keyof ZadarmaCall) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCallDate = (dateString: string) => {
    if (!dateString) {
      return "No disponible";
    }
    try {
      const date = parse(dateString, 'yyyy-MM-dd HH:mm:ss', new Date());
      return format(date, 'dd/MM/yyyy HH:mm');
    } catch (error) {
      console.error(`Error al formatear la fecha: ${dateString}`, error);
      return "Fecha inválida";
    }
  };

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard de Zadarma</h2>
          <p className="text-muted-foreground">Estadísticas y registros del servicio de telefonía.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchCallStats(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar Ahora
          </Button>
        </div>
      </div>
      
      <DashboardNav active="zadarma" />

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <Loader className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Conectando con Zadarma...</p>
        </div>
      ) : (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><Phone className="mr-2 h-5 w-5" />Registros de Llamadas del Día</CardTitle>
                <CardDescription>Eventos de llamadas más recientes procesados por Zadarma.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-auto max-h-[70vh] p-2">
                <Table>
                <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('callstart')}>
                            Fecha y Hora {renderSortArrow('callstart')}
                        </Button>
                    </TableHead>
                    <TableHead>
                         <Button variant="ghost" onClick={() => handleSort('sip')}>
                            Agente {renderSortArrow('sip')}
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('clid')}>
                            Origen {renderSortArrow('clid')}
                        </Button>
                    </TableHead>
                    <TableHead>
                        <Button variant="ghost" onClick={() => handleSort('destination')}>
                            Destino {renderSortArrow('destination')}
                        </Button>
                    </TableHead>
                    <TableHead className="text-center">
                        <Button variant="ghost" onClick={() => handleSort('seconds')}>
                            Duración {renderSortArrow('seconds')}
                        </Button>
                    </TableHead>
                    <TableHead className="text-right">
                        <Button variant="ghost" onClick={() => handleSort('disposition')}>
                            Estado {renderSortArrow('disposition')}
                        </Button>
                    </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedCalls.length > 0 ? (
                    sortedCalls.map((call, index) => (
                        <TableRow key={`${call.pbx_call_id}-${index}`}>
                        <TableCell className="font-medium">{formatCallDate(call.callstart)}</TableCell>
                        <TableCell>{agentMap[call.sip] || call.sip}</TableCell>
                        <TableCell>{call.clid}</TableCell>
                        <TableCell>{call.destination}</TableCell>
                        <TableCell className="text-center">{formatDuration(call.seconds)}</TableCell>
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
                        No se encontraron registros de llamadas para el día de hoy.
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
