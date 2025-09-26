"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardNavProps {
  active: 'main' | 'provinces' | 'daily';
}

export default function DashboardNav({ active }: DashboardNavProps) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted p-1 w-full sm:w-auto">
      <Link href="/dashboard" passHref className="flex-1">
        <Button variant={active === 'main' ? "default" : "ghost"} size="sm" className="w-full">
          Dashboard Principal
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
    </div>
  );
}
