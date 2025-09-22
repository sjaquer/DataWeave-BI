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

export default function DemographicsPage() {
  const maxOrders = Math.max(...peruOrderData.map(d => d.orders));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
            <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4"/>
                <span className="sr-only">Back</span>
            </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Demographic Analysis</h1>
            <p className="text-muted-foreground">
            Gain insights into your customer base to tailor marketing and product development.
            </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Order Heatmap by Province</CardTitle>
            <CardDescription>Order density across provinces in Peru. Redder areas indicate more orders.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <PeruMap data={peruOrderData} maxOrders={maxOrders} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customers by Age Group</CardTitle>
            <CardDescription>Breakdown of customers by their age range.</CardDescription>
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
