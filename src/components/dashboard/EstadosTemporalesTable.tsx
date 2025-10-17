/**
 * Tabla comparativa de estados: PROVINCIA vs LIMA
 * Muestra la distribución de pedidos por estado según origen
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnviosTemporalesStats } from "@/hooks/useEnviosTemporales";

interface EstadosTemporalesTableProps {
  data: EnviosTemporalesStats;
}

// Colores por tipo de estado (considerando estados de Provincia y Lima)
const getEstadoBadgeColor = (estado: string): string => {
  const estadoUpper = estado.toUpperCase();
  
  // Estados de entrega (verde)
  if (estadoUpper.includes('ENTREGADO') || estadoUpper.includes('PAGADO')) return 'bg-green-500';
  
  // Estados en tránsito (azul)
  if (estadoUpper.includes('TRANSITO') || estadoUpper.includes('EN RUTA') || estadoUpper.includes('ENVIADO')) return 'bg-blue-500';
  
  // Estados en destino/preparado (cian/amarillo)
  if (estadoUpper.includes('DESTINO')) return 'bg-cyan-500';
  if (estadoUpper.includes('PREPARADO')) return 'bg-yellow-500';
  
  // Estados de tienda (púrpura)
  if (estadoUpper.includes('TIENDA') || estadoUpper.includes('ORIGEN')) return 'bg-purple-500';
  
  // Estados problemáticos (rojo/naranja)
  if (estadoUpper.includes('DEVOLUCIÓN') || estadoUpper.includes('DEVOLUCION')) return 'bg-red-500';
  if (estadoUpper.includes('NO CONTESTA') || estadoUpper.includes('REPROGRAMAR')) return 'bg-orange-500';
  
  // Default
  return 'bg-gray-500';
};

export function EstadosTemporalesTable({ data }: EstadosTemporalesTableProps) {
  const { porEstado, totalActivos } = data;

  // DEBUG: Mostrar estados recibidos
  console.log('[EstadosTemporalesTable] Estados recibidos:', porEstado);
  console.log('[EstadosTemporalesTable] Total activos:', totalActivos);

  // Agrupar estados por nombre limpio (sin L-)
  // Esto permite contar "ENTREGADO" de provincia y "L-ENTREGADO" de Lima juntos
  const estadosAgrupados: Record<string, { provincia: number; lima: number; total: number }> = {};

  Object.entries(porEstado).forEach(([estadoOriginal, cantidad]) => {
    // Detectar si es Lima (empieza con "L-" o "L -")
    const esLima = estadoOriginal.startsWith('L-') || estadoOriginal.startsWith('L -');
    
    // Limpiar el nombre del estado (remover "L-" o "L -")
    const estadoLimpio = esLima 
      ? estadoOriginal.replace(/^L\s*-\s*/i, '').trim()
      : estadoOriginal.trim();
    
    // Inicializar si no existe
    if (!estadosAgrupados[estadoLimpio]) {
      estadosAgrupados[estadoLimpio] = { provincia: 0, lima: 0, total: 0 };
    }
    
    // Acumular por origen
    if (esLima) {
      estadosAgrupados[estadoLimpio].lima += cantidad;
    } else {
      estadosAgrupados[estadoLimpio].provincia += cantidad;
    }
    estadosAgrupados[estadoLimpio].total += cantidad;
  });

  // DEBUG: Mostrar agrupación
  console.log('[EstadosTemporalesTable] Estados agrupados:', estadosAgrupados);

  // Convertir a array y ordenar por total descendente
  const estados = Object.entries(estadosAgrupados)
    .map(([estado, counts]) => ({
      estado,
      provincia: counts.provincia,
      lima: counts.lima,
      total: counts.total,
      porcentaje: ((counts.total / totalActivos) * 100).toFixed(1),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estados de Pedidos Temporales</CardTitle>
        <CardDescription>
          Distribución de {totalActivos} pedidos activos por estado
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Provincia</TableHead>
                <TableHead className="text-right">Lima</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No hay pedidos en tránsito
                  </TableCell>
                </TableRow>
              ) : (
                estados.map((row) => (
                  <TableRow key={row.estado}>
                    <TableCell>
                      <Badge 
                        className={`${getEstadoBadgeColor(row.estado)} text-white`}
                      >
                        {row.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.provincia > 0 ? row.provincia : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.lima > 0 ? row.lima : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {row.total}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.porcentaje}%
                    </TableCell>
                  </TableRow>
                ))
              )}
              {estados.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">
                    {estados.reduce((sum, r) => sum + r.provincia, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {estados.reduce((sum, r) => sum + r.lima, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {totalActivos}
                  </TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
