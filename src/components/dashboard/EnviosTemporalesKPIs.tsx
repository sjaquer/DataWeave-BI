/**
 * Componente de KPIs principales para envíos temporales
 * Muestra estadísticas clave: Total activos, Provincia vs Lima
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, MapPin, Building2, TrendingUp } from "lucide-react";
import { EnviosTemporalesStats } from "@/hooks/useEnviosTemporales";

interface EnviosTemporalesKPIsProps {
  data: EnviosTemporalesStats;
}

export function EnviosTemporalesKPIs({ data }: EnviosTemporalesKPIsProps) {
  const { totalActivos, porTipoOrigen } = data;

  const cards = [
    {
      title: "Total en Tránsito",
      value: totalActivos,
      description: "Pedidos activos totales",
      icon: Package,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Provincia",
      value: porTipoOrigen.PROVINCIA || 0,
      description: `${((porTipoOrigen.PROVINCIA / totalActivos) * 100).toFixed(1)}% del total`,
      icon: MapPin,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Lima",
      value: porTipoOrigen.LIMA || 0,
      description: `${((porTipoOrigen.LIMA / totalActivos) * 100).toFixed(1)}% del total`,
      icon: Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Rendimiento",
      value: `${(((porTipoOrigen.PROVINCIA + porTipoOrigen.LIMA) / totalActivos) * 100).toFixed(0)}%`,
      description: "Cobertura total",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`rounded-full p-2 ${card.bgColor}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
