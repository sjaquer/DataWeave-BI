"use client"

import { Pie, PieChart, ResponsiveContainer, Cell } from "recharts"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { customerDemographics, peruOrderData } from "@/lib/data"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import PeruMap from "@/components/peru-map"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"

export default function DemographicsPage() {
  const totalOrders = peruOrderData.reduce((acc, d) => acc + d.orders, 0);
  const maxOrders = Math.max(...peruOrderData.map(d => d.orders));

  // Sort data by orders descending
  const sortedOrderData = [...peruOrderData].sort((a, b) => b.orders - a.orders);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
            <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4"/>
                <span className="sr-only">Volver</span>
            </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Análisis Demográfico</h1>
            <p className="text-muted-foreground">
            Obtén información sobre tu base de clientes para adaptar el marketing y el desarrollo de productos.
            </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mapa de Calor de Pedidos por Departamento</CardTitle>
            <CardDescription>Densidad de pedidos en los departamentos de Perú. Las áreas más rojas indican más pedidos.</CardDescription>
          </CardHeader>
          <CardContent className="h-[500px] w-full p-0">
             <PeruMap data={peruOrderData} maxOrders={maxOrders} />
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Pedidos por Departamento</CardTitle>
                <CardDescription>Porcentaje y total de pedidos por cada departamento.</CardDescription>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[450px]">
                <div className="space-y-4">
                    {sortedOrderData.map(d => {
                        const percentage = totalOrders > 0 ? (d.orders / totalOrders) * 100 : 0;
                        return (
                        <div key={d.province} className="space-y-1">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">{d.province}</span>
                                <span className="text-muted-foreground">{d.orders.toLocaleString()} pedidos</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <Progress value={percentage} className="h-2" />
                               <span className="w-12 text-right text-xs text-muted-foreground">{percentage.toFixed(1)}%</span>
                            </div>
                        </div>
                        )
                    })}
                </div>
                </ScrollArea>
            </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Clientes por Grupo de Edad</CardTitle>
            <CardDescription>Distribución de clientes por rango de edad.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={{}} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={customerDemographics.byAge}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    label
                  >
                     {customerDemographics.byAge.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                   <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
