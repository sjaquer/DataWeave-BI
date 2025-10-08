"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ClearCacheButton() {
  const { toast } = useToast();

  const clearCache = () => {
    try {
      // Limpiar todas las cachés relacionadas con el dashboard
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.includes('dashboardMetricsCache') || key.includes('shipments') || key.includes('metrics')) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });

      toast({
        title: "Caché Limpiada",
        description: `Se eliminaron ${clearedCount} cachés. La página se recargará para obtener datos frescos.`,
      });

      // Recargar la página después de 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo limpiar la caché. Intenta recargar manualmente (Ctrl+Shift+R).",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={clearCache}
      className="gap-2"
    >
      <Trash2 className="h-4 w-4" />
      Limpiar Caché
    </Button>
  );
}
