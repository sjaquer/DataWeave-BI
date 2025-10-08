
// src/app/(app)/dashboard/shipments/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, Truck, DollarSign } from "lucide-react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface ShipmentData {
  orderName: string;
  confirmedAt: Date;
  courier: string;
  totalPrice: number;
  province: string;
  storeId: string;
  products: Array<{ title: string; quantity?: number; price?: number }>;
  paymentMethod?: string; // Hacemos opcional para manejar datos antiguos
  deliveryTimeInHours?: number | null; // Hacemos opcional y nulo
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c'];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });

  useEffect(() => {
    async function fetchShipments() {
      try {
        const thirtyDaysAgo = subDays(new Date(), 30);
        const ordersRef = collection(db, "shopify_orders");
        const q = query(
          ordersRef,
          where("isConfirmed", "==", true),
          where("confirmedAt", ">=", Timestamp.fromDate(startOfDay(thirtyDaysAgo)))
        );

        const querySnapshot = await getDocs(q);
        const data: ShipmentData[] = [];

        querySnapshot.forEach((doc) => {
          const order = doc.data();
          
          data.push({
            orderName: order.orderName || "N/A",
            confirmedAt: order.confirmedAt?.toDate() || new Date(),
            courier: order.courier || "No especificado",
            totalPrice: order.totalPrice || 0,
            province: order.province || "N/A",
            storeId: order.storeId || "N/A",
            products: order.products || [],
            paymentMethod: order.paymentMethod, // Puede ser undefined
            deliveryTimeInHours: order.deliveryTimeInHours, // Puede ser undefined
          });
        });

        data.sort((a, b) => b.confirmedAt.getTime() - a.confirmedAt.getTime());
        setShipments(data);
      } catch (error) {
        console.error("Error al cargar envíos:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchShipments();
  }, []);

  const filteredShipments = shipments; // Ya filtrados por la query

  const shipmentsByDate = useMemo(() => {
    const dateMap = new Map<string, { date: string, envios: number, ingresos: number }>();
    const last30Days = subDays(new Date(), 29);

    for (let i = 0; i < 30; i++) {
      const date = subDays(new Date(), 29 - i);
      const dateKey = format(date, "dd/MM");
      dateMap.set(dateKey, { date: dateKey, envios: 0, ingresos: 0 });
    }

    filteredShipments.forEach((shipment) => {
      if (shipment.confirmedAt >= last30Days) {
        const dateKey = format(shipment.confirmedAt, "dd/MM");
        const current = dateMap.get(dateKey);
        if (current) {
          current.envios += 1;
          current.ingresos += shipment.totalPrice;
        }
      }
    });

    return Array.from(dateMap.values());
  }, [filteredShipments]);

  const topProvinces = useMemo(() => {
    const provinceMap = new Map<string, { count: number; revenue: number }>();
    filteredShipments.forEach((shipment) => {
      const province = shipment.province || "Sin especificar";
      const current = provinceMap.get(province) || { count: 0, revenue: 0 };
      provinceMap.set(province, {
        count: current.count + 1,
        revenue: current.revenue + shipment.totalPrice,
      });
    });
    return Array.from(provinceMap.entries())
      .map(([name, data]) => ({ name, value: data.count, revenue: data.revenue }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filteredShipments]);

  const paymentMethods = useMemo(() => {
    const paymentMap = new Map<string, number>();
    filteredShipments.forEach((shipment) => {
      const method = shipment.paymentMethod || "Desconocido";
      paymentMap.set(method, (paymentMap.get(method) || 0) + 1);
    });
    return Array.from(paymentMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value);
  }, [filteredShipments]);

  const courierPerformance = useMemo(() => {
    const courierMap = new Map<string, { 
      count: number; 
      totalRevenue: number;
      provinces: Set<string>;
      totalDeliveryHours: number;
      deliveredCount: number;
    }>();

    filteredShipments.forEach((shipment) => {
      const courier = shipment.courier || "No especificado";
      const current = courierMap.get(courier) || { 
        count: 0, 
        totalRevenue: 0,
        provinces: new Set<string>(),
        totalDeliveryHours: 0,
        deliveredCount: 0,
      };
      
      current.count += 1;
      current.totalRevenue += shipment.totalPrice;
      current.provinces.add(shipment.province);

      if(shipment.deliveryTimeInHours !== undefined && shipment.deliveryTimeInHours !== null) {
        current.totalDeliveryHours += shipment.deliveryTimeInHours;
        current.deliveredCount += 1;
      }
      
      courierMap.set(courier, current);
    });

    return Array.from(courierMap.entries())
      .map(([courier, data]) => ({
        courier,
        envios: data.count,
        ingresos: data.totalRevenue,
        promedio: data.count > 0 ? data.totalRevenue / data.count : 0,
        provincias: data.provinces.size,
        porcentaje: filteredShipments.length > 0 ? (data.count / filteredShipments.length) * 100 : 0,
        avgDeliveryTime: data.deliveredCount > 0 ? data.totalDeliveryHours / data.deliveredCount : null,
      }))
      .sort((a, b) => b.envios - a.envios);
  }, [filteredShipments]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96 md:col-span-2" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const totalShipments = filteredShipments.length;
  const totalRevenue = filteredShipments.reduce((sum, s) => sum + s.totalPrice, 0);
  const avgOrderValue = totalShipments > 0 ? totalRevenue / totalShipments : 0;
  const totalProducts = filteredShipments.reduce((sum, s) => {
    return sum + (s.products?.reduce((pSum, p) => pSum + (p.quantity || 1), 0) || 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Análisis de Envíos</h1>
          <p className="text-muted-foreground">
            Monitoreo y análisis de pedidos confirmados - Últimos 30 días
          </p>
        </div>
      </div>

      {filteredShipments.length === 0 && (
        <Alert>
          <AlertDescription>
            No hay envíos confirmados en el período seleccionado. Los datos aparecerán cuando se confirmen pedidos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Envíos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShipments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{totalProducts.toLocaleString()} productos enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {totalRevenue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">De envíos confirmados</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">S/ {avgOrderValue.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Por pedido</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Couriers Activos</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courierPerformance.length}</div>
            <p className="text-xs text-muted-foreground">Empresas de transporte</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Tendencia de Envíos e Ingresos</CardTitle>
            <CardDescription>Evolución diaria en los últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            {shipmentsByDate.length > 0 && shipmentsByDate.some(d => d.envios > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={shipmentsByDate}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={70} />
                  <YAxis yAxisId="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip formatter={(value: number, name: string) => [name === 'envios' ? value : `S/ ${value.toFixed(2)}`, name === 'envios' ? 'Envíos' : 'Ingresos']} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="envios" fill="#8884d8" name="Envíos" />
                  <Bar yAxisId="right" dataKey="ingresos" fill="#82ca9d" name="Ingresos (S/)" />
                </BarChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos</div> )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Provincias</CardTitle>
            <CardDescription>Distribución geográfica de envíos</CardDescription>
          </CardHeader>
          <CardContent>
            {topProvinces.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={topProvinces} cx="50%" cy="50%" labelLine={true} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {topProvinces.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, props: any) => [`${value} envíos - S/ ${props.payload.revenue.toFixed(2)}`, 'Total']} />
                  <Legend/>
                </PieChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos</div> )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución por tipo de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentMethods.length > 0 && paymentMethods.some(p => p.value > 0) ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie data={paymentMethods} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {paymentMethods.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Envíos"]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : ( <div className="flex items-center justify-center h-[350px] text-muted-foreground">No hay datos de pago</div> )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" />Rendimiento Detallado de Couriers</CardTitle>
          <CardDescription>Análisis completo de empresas de transporte</CardDescription>
        </CardHeader>
        <CardContent>
          {courierPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Envíos</TableHead>
                    <TableHead className="text-right">% Total</TableHead>
                    <TableHead className="text-right">Provincias</TableHead>
                    <TableHead className="text-right">Ingresos Totales</TableHead>
                    <TableHead className="text-right">Valor Promedio</TableHead>
                    <TableHead className="text-right">Tiempo Entrega (h)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courierPerformance.map((courier, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium"><div className="flex items-center gap-2">{courier.courier}{index === 0 && (<Badge variant="default" className="text-xs">Top</Badge>)}</div></TableCell>
                      <TableCell className="text-right font-mono">{courier.envios}</TableCell>
                      <TableCell className="text-right"><Badge variant="outline">{courier.porcentaje.toFixed(1)}%</Badge></TableCell>
                      <TableCell className="text-right">{courier.provincias}</TableCell>
                      <TableCell className="text-right font-mono">S/ {courier.ingresos.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono">S/ {courier.promedio.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right font-mono">{courier.avgDeliveryTime ? courier.avgDeliveryTime.toFixed(1) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : ( <div className="flex items-center justify-center h-32 text-muted-foreground">No hay datos de couriers</div> )}
        </CardContent>
      </Card>
    </div>
  );
}
