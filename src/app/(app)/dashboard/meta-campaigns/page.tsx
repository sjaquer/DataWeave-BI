"use client";

import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function MetaCampaignsPage() {
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
      </div>

      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-6">
                <Lock className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Próximamente</CardTitle>
            <CardDescription className="text-base">
              Esta funcionalidad estará disponible muy pronto
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>
              Estamos trabajando en la integración con Meta Business para traerte
              métricas detalladas de tus campañas publicitarias en Facebook e Instagram.
            </p>
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">Funcionalidades en desarrollo:</p>
              <ul className="text-sm space-y-1">
                <li>📊 Análisis de rendimiento en tiempo real</li>
                <li>💰 Seguimiento de presupuesto y gastos</li>
                <li>🎯 Métricas de conversión y ROI</li>
                <li>📈 Comparativas entre campañas</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
