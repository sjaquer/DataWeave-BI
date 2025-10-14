/**
 * Gráficos de rendimiento por courier
 * Muestra distribución y estadísticas de cada courier
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EnviosTemporalesStats } from "@/hooks/useEnviosTemporales";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

interface CourierPerformanceChartProps {
  data: EnviosTemporalesStats;
}

// Colores para cada courier
const COURIER_COLORS: Record<string, string> = {
  'SHALOM': '#3b82f6', // blue
  'DIN': '#10b981',    // green
  'CLOCK': '#f59e0b',  // amber
  'OTROS': '#6b7280',  // gray
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function CourierPerformanceChart({ data }: CourierPerformanceChartProps) {
  const { porCourier, totalActivos } = data;

  // Preparar datos para gráfico de pastel
  const pieData = Object.entries(porCourier).map(([courier, cantidad]) => ({
    name: courier,
    value: cantidad,
    percentage: ((cantidad / totalActivos) * 100).toFixed(1),
  }));

  // Preparar datos para gráfico de barras
  const barData = Object.entries(porCourier)
    .sort(([, a], [, b]) => b - a)
    .map(([courier, cantidad]) => ({
      courier,
      cantidad,
      porcentaje: parseFloat(((cantidad / totalActivos) * 100).toFixed(1)),
    }));

  // Custom label para el pie chart
  const renderLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Gráfico de Pastel - Distribución */}
      <Card>
        <CardHeader>
          <CardTitle>Distribución por Courier</CardTitle>
          <CardDescription>
            Porcentaje de pedidos por empresa de envío
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COURIER_COLORS[entry.name] || COLORS[index % COLORS.length]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`${value} pedidos`, 'Cantidad']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de Barras - Rendimiento */}
      <Card>
        <CardHeader>
          <CardTitle>Rendimiento por Courier</CardTitle>
          <CardDescription>
            Cantidad y porcentaje de pedidos activos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="courier" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number, name: string) => {
                  if (name === 'cantidad') return [`${value} pedidos`, 'Cantidad'];
                  if (name === 'porcentaje') return [`${value}%`, 'Porcentaje'];
                  return value;
                }}
              />
              <Legend />
              <Bar 
                dataKey="cantidad" 
                fill="#3b82f6" 
                name="Pedidos Activos"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
