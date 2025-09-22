"use client";

import {
  ArrowRight,
  BarChart3,
  Database,
  LayoutDashboard,
  Settings,
  Target,
  Upload,
  Users,
  Warehouse,
  FileText
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";

const menuItems = [
  {
    href: "/sales",
    label: "Análisis de Ventas",
    icon: BarChart3,
    description: "Análisis profundo del rendimiento de ventas",
    className: "md:col-span-2",
  },
  {
    href: "/inventory",
    label: "Inventario",
    icon: Warehouse,
    description: "Monitorea y analiza los niveles de stock",
    className: "",
  },
   {
    href: "/kpis",
    label: "KPIs",
    icon: Target,
    description: "Seguimiento de indicadores clave de rendimiento",
    className: "",
  },
  {
    href: "/demographics",
    label: "Demografía",
    icon: Users,
    description: "Comprende tu base de clientes",
    className: "",
  },
  {
    href: "/database-schema",
    label: "Esquema de BD con IA",
    icon: Database,
    description: "Genera esquemas con IA",
    className: "md:col-span-2",
  },
  {
    href: "/data-import",
    label: "Importar Datos",
    icon: Upload,
    description: "Importa datos de diversas fuentes",
    className: "",
  },
];

export default function Dashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2">
            <Logo className="size-7 text-primary" />
            <span className="text-xl font-semibold text-primary">DataWeave</span>
        </div>
        <div className="flex items-center gap-2">
            <Link href="#">
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Bienvenido, John Doe</h1>
            <p className="text-muted-foreground">Aquí tienes un resumen rápido de tu negocio.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
            {menuItems.map((item) => (
            <Card
                key={item.label}
                className={`group relative flex transform flex-col justify-between overflow-hidden rounded-xl border-2 border-transparent bg-card text-card-foreground shadow-lg transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-primary/20 ${item.className}`}
            >
                 <Link href={item.href} className="absolute inset-0 z-10" />
                <CardHeader>
                    <div className="mb-4 flex items-center justify-between">
                         <item.icon className="h-8 w-8 text-primary" />
                          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <CardTitle className="text-xl">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                </CardHeader>
            </Card>
            ))}
        </div>
      </main>
    </div>
  );
}
