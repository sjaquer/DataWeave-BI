"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Package, CreditCard, Truck } from "lucide-react";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ShipmentData {
  orderName: string;
  confirmedAt: Date;
  courier: string;
  totalPrice: number;
  paymentMethod: string; // Simulado por ahora
  province: string;
  storeId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchShipments() {
      try {
        const ordersRef = collection(db, "shopify_orders");
        const q = query(
          ordersRef,
          where("isConfirmed", "==", true)
        );

        const querySnapshot = await getDocs(q);
        const data: ShipmentData[] = [];

        querySnapshot.forEach((doc) => {
          const order = doc.data();
          
          // Simular método de pago basado en el total (esto se debe reemplazar con datos reales)
          let paymentMethod = "Efectivo";
          const total = order.totalPrice || 0;
          if (total > 100) {
            paymentMethod = Math.random() > 0.5 ? "Tarjeta de Crédito" : "Transferencia";
          } else if (total > 50) {
            paymentMethod = Math.random() > 0.5 ? "Tarjeta de Débito" : "Efectivo";
          }

          data.push({
            orderName: order.orderName || "N/A",
            confirmedAt: order.confirmedAt?.toDate() || new Date(),
            courier: order.courier || "No especificado",
            totalPrice: order.totalPrice || 0,
            paymentMethod: paymentMethod,
            province: order.province || "N/A",
            storeId: order.storeId || "N/A",
          });
        });

        // Ordenar por fecha más reciente
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

  // Procesamiento de datos para gráficos

  // 1. Envíos por Fecha (últimos 30 días)
  const shipmentsByDate = () => {
    const dateMap = new Map<string, number>();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    shipments.forEach((shipment) => {
      if (shipment.confirmedAt >= thirtyDaysAgo) {
        const dateKey = format(shipment.confirmedAt, "dd/MM", { locale: es });
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
      }
    });

    const sortedDates = Array.from(dateMap.entries())
      .sort((a, b) => {
        const [dayA, monthA] = a[0].split('/').map(Number);
        const [dayB, monthB] = b[0].split('/').map(Number);
        return monthA !== monthB ? monthA - monthB : dayA - dayB;
      });

    return sortedDates.map(([date, count]) => ({
      date,
      envios: count,
    }));
  };

  // 2. Métodos de Pago
  const paymentMethodsData = () => {
    const methodMap = new Map<string, number>();

    shipments.forEach((shipment) => {
      methodMap.set(shipment.paymentMethod, (methodMap.get(shipment.paymentMethod) || 0) + 1);
    });

    return Array.from(methodMap.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  };

  // 3. Rendimiento de Couriers
  const courierPerformance = () => {
    const courierMap = new Map<string, { count: number; totalRevenue: number }>();

    shipments.forEach((shipment) => {
      const current = courierMap.get(shipment.courier) || { count: 0, totalRevenue: 0 };
      courierMap.set(shipment.courier, {
        count: current.count + 1,
        totalRevenue: current.totalRevenue + shipment.totalPrice,
      });
    });

    return Array.from(courierMap.entries())
      .map(([courier, data]) => ({
        courier,
        envios: data.count,
        ingresos: data.totalRevenue,
        promedio: data.totalRevenue / data.count,
      }))
      .sort((a, b) => b.envios - a.envios);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      </div>
    );
  }

  const dateData = shipmentsByDate();
  const paymentData = paymentMethodsData();
  const courierData = courierPerformance();

  const totalShipments = shipments.length;
  const totalRevenue = shipments.reduce((sum, s) => sum + s.totalPrice, 0);
  const avgOrderValue = totalShipments > 0 ? totalRevenue / totalShipments : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Análisis de Envíos</h1>
        <p className="text-muted-foreground">
          Monitoreo y análisis de pedidos confirmados y enviados
        </p>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Envíos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalShipments.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pedidos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRevenue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">De envíos confirmados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgOrderValue.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">Por pedido</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Gráfico de Envíos por Fecha */}
        <Card>
          <CardHeader>
            <CardTitle>Envíos por Fecha</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            {dateData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dateData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="envios"
                    stroke="#8884d8"
                    strokeWidth={2}
                    name="Envíos"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No hay datos de los últimos 30 días
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Métodos de Pago */}
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
            <CardDescription>Distribución de métodos de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No hay datos de métodos de pago
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Rendimiento de Couriers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Rendimiento de Couriers
          </CardTitle>
          <CardDescription>Comparativa de empresas de transporte</CardDescription>
        </CardHeader>
        <CardContent>
          {courierData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courier</TableHead>
                  <TableHead className="text-right">Envíos</TableHead>
                  <TableHead className="text-right">Ingresos Totales</TableHead>
                  <TableHead className="text-right">Valor Promedio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierData.map((courier, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {courier.courier}
                        {index === 0 && (
                          <Badge variant="default" className="text-xs">Top</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{courier.envios}</TableCell>
                    <TableCell className="text-right">
                      ${courier.ingresos.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${courier.promedio.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No hay datos de couriers
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
