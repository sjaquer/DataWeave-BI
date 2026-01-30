
'use client';

import { useState, useEffect } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, BarChart, Bar } from 'recharts';
import { DollarSign, MousePointerClick, Percent } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { isDemoModeActive, generateDemoMetaCampaigns, generateDemoCampaignMetrics } from '@/lib/demo-data';

// DateRangePicker (si existe como componente separado)
// Asumimos que tienes un componente DatePickerWithRange en ui/date-range-picker.tsx
// Si no, necesitaríamos crearlo o simplificar a un input de fecha.
// import { DatePickerWithRange } from "@/components/ui/date-range-picker";


// --- Tipos de Datos ---
type Campaign = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'UNKNOWN';
  objective: string;
  spend: number;
  cpc: number;
  ctr: number;
  impressions: number;
  clicks: number;
};

// --- Componente Principal ---
export default function MetaCampaignsPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!dateRange?.from || !dateRange?.to) return;

      setLoading(true);
      setError(null);

      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');
      const url = `/api/meta/campaigns?startDate=${startDate}&endDate=${endDate}`;

      try {
        if (isDemoModeActive()) {
          const startDate = format(dateRange.from, 'yyyy-MM-dd');
          const endDate = format(dateRange.to, 'yyyy-MM-dd');
          const campaignsDemo = generateDemoCampaignMetrics(new Date(startDate), new Date(endDate));
          // generateDemoCampaignMetrics retorna estructura con métricas, convertir a la forma esperada
          const flat = campaignsDemo.map((c:any) => ({ id: c.id, name: c.name, status: c.status === 'active' ? 'ACTIVE' : 'PAUSED', objective: 'Conversion', spend: c.spent || c.spent, cpc: c.cpc || 1.0, ctr: c.ctr || 1.0, impressions: c.impressions || 0, clicks: c.clicks || 0 }));
          setCampaigns(flat);
          setLoading(false);
          return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al obtener los datos de la API');
        }
        const data = await response.json();
        setCampaigns(data.campaigns || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateRange]);

  // --- Cálculos de KPIs ---
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE');
  const totalSpend = activeCampaigns.reduce((acc, c) => acc + c.spend, 0);
  const totalClicks = activeCampaigns.reduce((acc, c) => acc + c.clicks, 0);
  const totalImpressions = activeCampaigns.reduce((acc, c) => acc + c.impressions, 0);
  const averageCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // --- Componente de Badge de Estado ---
  const StatusBadge = ({ status }: { status: Campaign['status'] }) => {
    const statusConfig = {
      ACTIVE: { label: 'Activa', className: 'bg-green-500 hover:bg-green-600' },
      PAUSED: { label: 'Pausada', className: 'bg-yellow-500 hover:bg-yellow-600' },
      ARCHIVED: { label: 'Archivada', className: 'bg-gray-500 hover:bg-gray-600' },
      UNKNOWN: { label: 'Desconocido', className: 'bg-gray-400' },
    };
    const config = statusConfig[status] || statusConfig.UNKNOWN;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // --- Renderizado ---
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
        {/* Aquí puedes añadir el DatePickerWithRange si lo tienes */}
      </div>

      {loading ? (
        <p className='text-center py-10'>Cargando datos de campañas...</p>
      ) : error ? (
        <Card className="border-destructive bg-destructive/10">
            <CardHeader>
                <CardTitle className="text-destructive">Error de Conexión</CardTitle>
            </CardHeader>
            <CardContent>
                <p>No se pudieron cargar los datos desde la API de Meta. Por favor, verifica tu conexión o las credenciales configuradas.</p>
                <p className='text-sm text-muted-foreground mt-2'>Detalle: {error}</p>
            </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Gasto Total (Activas)" value={`$${totalSpend.toFixed(2)}`} icon={DollarSign} />
            <KpiCard title="CPC Promedio (Activas)" value={`$${averageCpc.toFixed(2)}`} icon={MousePointerClick} />
            <KpiCard title="CTR Promedio (Activas)" value={`${averageCtr.toFixed(2)}%`} icon={Percent} />
          </div>
          
          {/* Gráficos */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <ChartCard title="Gasto por Campaña">
              <BarChart data={campaigns} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }}/>
                <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`}/>
                <Legend />
                <Bar dataKey="spend" name="Gasto" fill="#8884d8" />
              </BarChart>
            </ChartCard>
             <ChartCard title="Clics por Campaña" className="lg:col-span-4">
                <LineChart data={campaigns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80}/>
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="clicks" name="Clics" stroke="#82ca9d" />
                </LineChart>
            </ChartCard>
          </div>

          {/* Tabla de Campañas */}
          <TableCard campaigns={campaigns} StatusBadge={StatusBadge}/>
        </div>
      )}
    </div>
  );
}

// --- Sub-componentes --- 

const KpiCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

const ChartCard = ({ title, children, className }: { title: string, children: React.ReactNode, className?: string }) => (
    <Card className={className || 'lg:col-span-3'}>
        <CardHeader>
            <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
                {children}
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

const TableCard = ({ campaigns, StatusBadge }: { campaigns: Campaign[], StatusBadge: React.ElementType }) => (
    <Card>
        <CardHeader>
            <CardTitle>Detalle de Campañas</CardTitle>
            <CardDescription>Un desglose de todas las campañas activas y pasadas en el rango de fechas seleccionado.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Nombre de Campaña</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Impresiones</TableHead>
                        <TableHead className="text-right">Clics</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead className="text-right">CTR (%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {campaigns.length > 0 ? campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                            <TableCell className="font-medium">{campaign.name}</TableCell>
                            <TableCell><StatusBadge status={campaign.status} /></TableCell>
                            <TableCell className="text-right">${campaign.spend.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{campaign.impressions.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{campaign.clicks.toLocaleString()}</TableCell>
                            <TableCell className="text-right">${campaign.cpc.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{campaign.ctr.toFixed(2)}%</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center">No se encontraron campañas para el rango de fechas seleccionado.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);
