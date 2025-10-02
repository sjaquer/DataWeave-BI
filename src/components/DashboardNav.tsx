"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardNavProps {
  active: 'main' | 'provinces' | 'daily' | 'inventory' | 'inventory-status' | 'returns' | 'performance';
}

export default function DashboardNav({ active }: DashboardNavProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex items-center gap-2 rounded-md bg-muted p-1 w-full lg:w-auto flex-wrap justify-center">
      <Link href="/dashboard" passHref className="flex-1">
        <Button variant={active === 'main' ? "default" : "ghost"} size="sm" className="w-full">
          Dashboard Principal
        </Button>
      </Link>
       <Link href="/dashboard/performance" passHref className="flex-1">
        <Button variant={active === 'performance' ? "default" : "ghost"} size="sm" className="w-full">
          Rendimiento Asesores
        </Button>
      </Link>
      <Link href="/dashboard/provinces" passHref className="flex-1">
        <Button variant={active === 'provinces' ? "default" : "ghost"} size="sm" className="w-full">
          Análisis por Provincia
        </Button>
      </Link>
      <Link href="/dashboard/daily" passHref className="flex-1">
        <Button variant={active === 'daily' ? "default" : "ghost"} size="sm" className="w-full">
          Análisis Diario
        </Button>
      </Link>
      <Link href="/dashboard/inventory" passHref className="flex-1">
        <Button variant={active === 'inventory' ? "default" : "ghost"} size="sm" className="w-full">
          Análisis de Inventario
        </Button>
      </Link>
      <Link href="/dashboard/inventory-status" passHref className="flex-1">
        <Button variant={active === 'inventory-status' ? "default" : "ghost"} size="sm" className="w-full">
          Estado de Inventario
        </Button>
      </Link>
       <Link href="/dashboard/returns" passHref className="flex-1">
        <Button variant={active === 'returns' ? "default" : "ghost"} size="sm" className="w-full">
          Análisis Mensual
        </Button>
      </Link>
    </div>
  );
}
