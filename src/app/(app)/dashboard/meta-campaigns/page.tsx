"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { es } from "date-fns/locale";

import { Loader, RefreshCw, Calendar as CalendarIcon, DollarSign, MousePointerClick, TrendingUp, Percent, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "@/components/ui/sidebar";

// --- Tipos de Datos (simulados por ahora) ---
interface MetaCampaign {
  id: string;
  name: string;
  spend: number;
  cpc: number;
  ctr: number;
  impressions: number;
  clicks: number;
  objective: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
}

type SortConfig = {
    key: keyof MetaCampaign;
    direction: 'ascending' | 'descending';
};


export default function MetaCampaignsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'spend', direction: 'descending' });
  const [date, setDate] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: subDays(today, 7), to: today };
  });

  const { toast } = useToast();

   const handleDatePreset = (preset: string) => {
    const to = new Date();
    let from: Date | undefined;

    switch (preset) {
      case 'today': from = new Date(); break;
      case 'yesterday': from = subDays(new Date(), 1); setDate({ from, to: from }); return;
      case '7days': from = new Date(); from.setDate(from.getDate() - 6); break;
      case '30days': from = new Date(); from.setDate(from.getDate() - 29); break;
    }
    setDate({ from, to });
  };

  const fetchCampaignData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    toast({ title: "Cargando datos de campañas..." });

    try {
      const params = new URLSearchParams();
      if (date?.from) params.append('startDate', date.from.toISOString());
      if (date?.to) params.append('endDate', date.to.toISOString());

      const response = await fetch(`/api/meta/campaigns?${params.toString()}`);
      const data = await response.json();

      if (!response.ok || data.status !== 'success') {
        throw new Error(data.message || "Error al obtener los datos de Meta.");
      }
      
      setCampaigns(data.campaigns || []);

      toast({
          title: "Datos de Campañas Cargados",
          description: `Se encontraron ${data.campaigns?.length || 0} campañas.`,
        });

    } catch (error: any) {
      console.error("Error al obtener datos de campañas de Meta:", error);
      toast({
        variant: "destructive",
        title: "Error de Conexión",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [date, toast]);

  useEffect(() => {
    fetchCampaignData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);


  const handleSort = (key: SortConfig['key']) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const renderSortArrow = (key: SortConfig['key']) => {
    if (sortConfig?.key !== key) return null;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />;
  };
  
  const sortedCampaigns = useMemo(() => {
    let sortableItems = [...campaigns];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
        
        if ((aValue as number) < (bValue as number)) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if ((aValue as number) > (bValue as number)) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [campaigns, sortConfig]);

  const globalMetrics = useMemo(() => {
    const totalSpend = campaigns.reduce((acc, c) => acc + c.spend, 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return { totalSpend, avgCpc, avgCtr, totalImpressions };
  }, [campaigns]);

  const getStatusBadge = (status: MetaCampaign['status']) => {
    switch (status) {
        case 'ACTIVE': return 'bg-green-500/20 text-green-700';
        case 'PAUSED': return 'bg-yellow-500/20 text-yellow-700';
        case 'ARCHIVED': return 'bg-gray-500/20 text-gray-700';
        default: return 'bg-gray-200';
    }
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden"/>
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Rendimiento de Campañas (Meta)</h2>
              <p className="text-muted-foreground">Análisis de las métricas clave de tus campañas publicitarias.</p>
            </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
           <Select onValueChange={handleDatePreset}>
              <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtro Rápido" />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="7days">Últimos 7 días</SelectItem>
                  <SelectItem value="30days">Últimos 30 días</SelectItem>
              </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button id="date" variant={"outline"} className={cn("w-full sm:w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (date.to ? (<>{format(date.from, "LLL dd, y", { locale: es })} - {format(date.to, "LLL dd, y", { locale: es })}</>) : (format(date.from, "LLL dd, y", { locale: es }))) : (<span>Selecciona un rango</span>)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2} locale={es} />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => fetchCampaignData(true)} disabled={isLoading}>
            {isLoading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>
      
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Gasto Total</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">S/ {globalMetrics.totalSpend.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Inversión en el período seleccionado</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Impresiones Totales</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{globalMetrics.totalImpressions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Alcance total de las campañas</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CPC Promedio</CardTitle>
                    <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">S/ {globalMetrics.avgCpc.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">Costo por cada clic</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">CTR Promedio</CardTitle>
                    <Percent className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{globalMetrics.avgCtr.toFixed(2)}%</div>
                    <p className="text-xs text-muted-foreground">Tasa de clics por impresión</p>
                </CardContent>
            </Card>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Detalle de Campañas</CardTitle>
                <CardDescription>Análisis individual del rendimiento de cada campaña activa en el período.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
               ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Campaña {renderSortArrow('name')}</Button></TableHead>
                            <TableHead className="text-center"><Button variant="ghost" onClick={() => handleSort('status')}>Estado {renderSortArrow('status')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('spend')}>Gasto (S/) {renderSortArrow('spend')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('impressions')}>Impresiones {renderSortArrow('impressions')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('clicks')}>Clics {renderSortArrow('clicks')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('cpc')}>CPC (S/) {renderSortArrow('cpc')}</Button></TableHead>
                            <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('ctr')}>CTR (%) {renderSortArrow('ctr')}</Button></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {sortedCampaigns.length > 0 ? (
                        sortedCampaigns.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                        <span>{c.name}</span>
                                        <span className="text-xs text-muted-foreground">{c.objective}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", getStatusBadge(c.status))}>
                                        {c.status}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right font-mono">S/ {c.spend.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{c.impressions.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono">{c.clicks.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-mono">S/ {c.cpc.toFixed(2)}</TableCell>
                                <TableCell className="text-right font-mono">{c.ctr.toFixed(2)}%</TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">No se encontraron datos de campañas para el período seleccionado.</TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
              )}
            </CardContent>
        </Card>
    </div>
  );
}
