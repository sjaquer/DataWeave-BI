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

// Colores por tipo de estado
const getEstadoBadgeColor = (estado: string): string => {
  if (estado.includes('ENTREGADO')) return 'bg-green-500';
  if (estado.includes('TRANSITO') || estado.includes('RUTA')) return 'bg-blue-500';
  if (estado.includes('DESTINO')) return 'bg-cyan-500';
  if (estado.includes('DEVOLUCIÓN')) return 'bg-red-500';
  if (estado.includes('PREPARADO')) return 'bg-yellow-500';
  if (estado.includes('PAGADO')) return 'bg-green-600';
  return 'bg-gray-500';
};

export function EstadosTemporalesTable({ data }: EstadosTemporalesTableProps) {
  const { porEstado, totalActivos } = data;

  // Calcular distribución por origen para cada estado
  // Nota: Esto requeriría una query más detallada en el backend
  // Por ahora mostramos el total por estado
  
  const estados = Object.entries(porEstado)
    .sort(([, a], [, b]) => b - a) // Ordenar por cantidad descendente
    .map(([estado, total]) => {
      // Estimar provincia vs lima basado en prefijo "L -"
      const esLima = estado.startsWith('L -');
      const provincia = esLima ? 0 : total;
      const lima = esLima ? total : 0;
      
      return {
        estado,
        provincia,
        lima,
        total,
        porcentaje: ((total / totalActivos) * 100).toFixed(1),
      };
    });

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
