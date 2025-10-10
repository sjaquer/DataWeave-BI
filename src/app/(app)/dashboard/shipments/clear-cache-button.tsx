"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ClearCacheButton({ onClick, disabled }: { onClick: () => void, disabled?: boolean }) {
  const { toast } = useToast();

  const handleClearCache = () => {
    try {
      const keys = Object.keys(localStorage);
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith('dashboardMetricsCache_shipments')) {
          localStorage.removeItem(key);
          clearedCount++;
        }
      });

      toast({
        title: "Caché Limpiada",
        description: `Se eliminaron ${clearedCount} cachés de envíos. Recargando datos...`,
      });

      onClick();

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo limpiar la caché.",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClearCache}
      disabled={disabled}
      className="gap-2"
    >
      <RefreshCw className="h-4 w-4" />
      Actualizar
    </Button>
  );
}
