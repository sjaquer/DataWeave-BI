"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader, TrendingUp, CheckCircle, Percent, Calendar as CalendarIcon, Filter, AlertCircle } from "lucide-react";
import { onSnapshot, collection, query, orderBy, getDocs } from "firebase/firestore";

import { db } from "@/lib/firebase"; // Import db from firebase config
import type { DailyMetric } from "@/ai/schemas/analyzeMetricsSchema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


const ITEMS_PER_PAGE = 50;

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DailyMetric[]>([]);
  const [visibleItems, setVisibleItems] = useState(ITEMS_PER_PAGE);

  const [sortOrder, setSortOrder] = useState("date-desc");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  useEffect(() => {
    const dailyMetricsCollection = collection(db, "daily_metrics");
    const q = query(dailyMetricsCollection, orderBy("date", "desc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: DailyMetric[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        const confirmationRate = docData.totalOrders > 0
          ? parseFloat(((docData.confirmedOrders / docData.totalOrders) * 100).toFixed(2))
          : 0;

        data.push({
          date: doc.id, // El ID del documento es la fecha 'DD-MM-YYYY'
          totalOrders: docData.totalOrders,
          confirmedOrders: docData.confirmedOrders,
          confirmationRate: confirmationRate
        });
      });
      setDashboardData(data);
      setIsLoading(false);
    }, (error) => {
      console.error("Error al obtener datos de Firestore:", error);
      setIsLoading(false);
    });

    // Limpiar el listener cuando el componente se desmonte
    return () => unsubscribe();
  }, []);

  const handleShowMore = () => {
    setVisibleItems((prev) => prev + ITEMS_PER_PAGE);
  };
  
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...dashboardData];

    if (selectedDate) {
      const formattedDate = format(selectedDate, "dd-MM-yyyy");
      filtered = filtered.filter(item => item.date === formattedDate);
    }

    switch (sortOrder) {
      case 'rate-desc':
        filtered.sort((a, b) => b.confirmationRate - a.confirmationRate);
        break;
      case 'rate-asc':
        filtered.sort((a, b) => a.confirmationRate - b.confirmationRate);
        break;
      case 'total-desc':
        filtered.sort((a, b) => b.totalOrders - a.totalOrders);
        break;
      case 'confirmed-desc':
        filtered.sort((a, b) => b.confirmedOrders - a.confirmedOrders);
        break;
      case 'date-desc':
      default:
        // Los datos ya vienen ordenados por fecha descendente desde Firestore
        break;
    }
    
    return filtered;
  }, [dashboardData, sortOrder, selectedDate]);


  const totalOrders = useMemo(() => dashboardData.reduce((acc, item) => acc + item.totalOrders, 0), [dashboardData]);
  const totalConfirmedOrders = useMemo(() => dashboardData.reduce((acc, item) => acc + item.confirmedOrders, 0), [dashboardData]);
  const overallConfirmationRate = totalOrders > 0 ? (totalConfirmedOrders / totalOrders) * 100 : 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard de Tasa de Convertibilidad (En Tiempo Real)</h2>
      </div>

       <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Datos en Tiempo Real</AlertTitle>
          <AlertDescription>
            Este dashboard se actualiza automáticamente. Los datos de pedidos de Shopify y confirmaciones de logística llegan a través de webhooks.
          </AlertDescription>
        </Alert>
      
      {isLoading && (
          <div className="flex justify-center items-center p-8">
              <Loader className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-4 text-muted-foreground">Cargando datos en tiempo real...</p>
          </div>
      )}

      {!isLoading && dashboardData.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Totales</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos recibidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos Confirmados</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalConfirmedOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total de pedidos confirmados</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tasa de Confirmación General</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{overallConfirmationRate.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Porcentaje de pedidos confirmados</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle>Análisis Detallado por Día</CardTitle>
                    <CardDescription>
                      Métricas de conversión diarias. Usa los filtros para explorar los datos.
                    </CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full sm:w-[240px] justify-start text-left font-normal",
                              !selectedDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Filtrar por fecha...</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <Select value={sortOrder} onValueChange={setSortOrder}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                          <Filter className="mr-2 h-4 w-4" />
                          <SelectValue placeholder="Ordenar por..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-desc">Más Recientes</SelectItem>
                          <SelectItem value="rate-desc">Mayor Tasa de Confirmación</SelectItem>
                          <SelectItem value="rate-asc">Menor Tasa de Confirmación</SelectItem>
                          <SelectItem value="total-desc">Más Pedidos Totales</SelectItem>
                          <SelectItem value="confirmed-desc">Más Pedidos Confirmados</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedDate && <Button variant="ghost" onClick={() => setSelectedDate(undefined)}>Limpiar</Button>}
                  </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Pedidos Totales</TableHead>
                    <TableHead className="text-right">Pedidos Confirmados</TableHead>
                    <TableHead className="w-[200px]">Tasa de Confirmación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.slice(0, visibleItems).map((metric) => (
                    <TableRow key={metric.date}>
                      <TableCell className="font-medium">{metric.date}</TableCell>
                      <TableCell className="text-right">{metric.totalOrders}</TableCell>
                      <TableCell className="text-right">{metric.confirmedOrders}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={metric.confirmationRate} className="h-2" />
                          <span className="text-right font-medium text-sm w-16">
                            {metric.confirmationRate.toFixed(2)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredAndSortedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No se encontraron resultados para los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {visibleItems < filteredAndSortedData.length && (
                <div className="flex justify-center mt-4">
                  <Button onClick={handleShowMore}>
                    Ver más
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

    