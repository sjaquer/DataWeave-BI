# 🎯 PLAN DE IMPLEMENTACIÓN PASO A PASO

**Proyecto**: Mejoras de Dashboards DataWeave-BI  
**Fecha inicio**: 09/10/2025  
**Estimación**: 2 semanas  
**Prioridad**: ALTA

---

## 📅 CRONOGRAMA DETALLADO

### **FASE 1: FUNDAMENTOS** (Días 1-2)

#### **DÍA 1 - PARTE 1: Métricas Base** (3-4 horas)

##### **Step 1.1: Agregar Tiempo de Confirmación al Schema**
```bash
Archivo: src/ai/schemas/getMetricsSchema.ts
```

**Acción**:
```typescript
// Agregar al StoreMetricSchema
export const StoreMetricSchema = z.object({
  name: z.string(),
  totalOrders: z.number(),
  confirmedOrders: z.number(),
  confirmationRate: z.number(),
  totalSpent: z.number(),
  averageTicket: z.number(),
  averageConfirmationTime: z.number().optional(), // ← NUEVO (en minutos)
  topProducts: z.array(z.object({
    name: z.string(),
    count: z.number()
  })),
  dailyOrderVariation: z.number().optional(),
  confirmationRateTrend: z.number().optional(),
});

// Agregar nuevo schema para distribución horaria
export const HourlyDistributionSchema = z.object({
  hour: z.number(), // 0-23
  orders: z.number(),
  confirmed: z.number(),
  revenue: z.number(),
});
export type HourlyDistribution = z.infer<typeof HourlyDistributionSchema>;

// Agregar nuevo schema para distribución semanal
export const WeekdayDistributionSchema = z.object({
  day: z.string(), // "Lunes", "Martes", etc.
  dayNumber: z.number(), // 0-6
  orders: z.number(),
  confirmed: z.number(),
  revenue: z.number(),
});
export type WeekdayDistribution = z.infer<typeof WeekdayDistributionSchema>;

// Actualizar GetMetricsOutputSchema
export const GetMetricsOutputSchema = z.object({
  // ... campos existentes ...
  hourlyDistribution: z.array(HourlyDistributionSchema).optional(),
  weekdayDistribution: z.array(WeekdayDistributionSchema).optional(),
});
```

**Tiempo estimado**: 30 min

---

##### **Step 1.2: Calcular Métricas en getMetricsFlow.ts**
```bash
Archivo: src/ai/flows/getMetricsFlow.ts
```

**Acción 1 - Tiempo de confirmación por tienda**:
```typescript
// En el loop de confirmedOrders (línea ~190)
confirmedOrders.forEach((order) => {
  const storeName = order.storeId || 'Desconocida';
  
  // Calcular tiempo de confirmación
  if (order.createdAt && order.confirmedAt && typeof order.createdAt.toDate === 'function' && typeof order.confirmedAt.toDate === 'function') {
    const createdDate = order.createdAt.toDate();
    const confirmedDate = order.confirmedAt.toDate();
    const diffMs = confirmedDate.getTime() - createdDate.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    
    if (!storeData[storeName].confirmationTimes) {
      storeData[storeName].confirmationTimes = [];
    }
    storeData[storeName].confirmationTimes.push(diffMinutes);
  }
  
  // ... resto del código ...
});

// Al calcular aggregatedStoreMetrics (línea ~420)
const aggregatedStoreMetrics = Object.entries(storeData).map(([name, data]) => {
  // Calcular promedio de tiempo de confirmación
  const avgConfirmationTime = data.confirmationTimes && data.confirmationTimes.length > 0
    ? data.confirmationTimes.reduce((a, b) => a + b, 0) / data.confirmationTimes.length
    : 0;
  
  return {
    name,
    totalOrders: data.totalOrders,
    confirmedOrders: data.confirmedOrders,
    totalSpent: data.totalSpent,
    confirmationRate: data.totalOrders > 0 ? (data.confirmedOrders / data.totalOrders) * 100 : 0,
    averageTicket: data.confirmedOrders > 0 ? data.totalSpent / data.confirmedOrders : 0,
    averageConfirmationTime: avgConfirmationTime, // ← NUEVO
    topProducts,
    dailyOrderVariation,
    confirmationRateTrend,
  };
});
```

**Tiempo estimado**: 45 min

---

**Acción 2 - Distribución horaria**:
```typescript
// Después del loop de allOrders (línea ~185)
const hourlyData: { [hour: number]: { orders: number, confirmed: number, revenue: number } } = {};
const weekdayData: { [day: number]: { orders: number, confirmed: number, revenue: number } } = {};

allOrders.forEach((order) => {
  if (order.createdAt && typeof order.createdAt.toDate === 'function') {
    const orderDate = order.createdAt.toDate();
    const hour = orderDate.getHours();
    const dayOfWeek = orderDate.getDay(); // 0 = Domingo, 6 = Sábado
    const isConfirmed = order.isConfirmed === true;
    const revenue = isConfirmed ? (order.totalPrice || 0) : 0;
    
    // Distribución horaria
    if (!hourlyData[hour]) {
      hourlyData[hour] = { orders: 0, confirmed: 0, revenue: 0 };
    }
    hourlyData[hour].orders++;
    if (isConfirmed) {
      hourlyData[hour].confirmed++;
      hourlyData[hour].revenue += revenue;
    }
    
    // Distribución semanal
    if (!weekdayData[dayOfWeek]) {
      weekdayData[dayOfWeek] = { orders: 0, confirmed: 0, revenue: 0 };
    }
    weekdayData[dayOfWeek].orders++;
    if (isConfirmed) {
      weekdayData[dayOfWeek].confirmed++;
      weekdayData[dayOfWeek].revenue += revenue;
    }
  }
});

// Al final del return (línea ~630)
const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

return {
  // ... campos existentes ...
  hourlyDistribution: Object.entries(hourlyData).map(([hour, data]) => ({
    hour: Number(hour),
    orders: data.orders,
    confirmed: data.confirmed,
    revenue: data.revenue,
  })).sort((a, b) => a.hour - b.hour),
  
  weekdayDistribution: Object.entries(weekdayData).map(([day, data]) => ({
    day: dayNames[Number(day)],
    dayNumber: Number(day),
    orders: data.orders,
    confirmed: data.confirmed,
    revenue: data.revenue,
  })).sort((a, b) => a.dayNumber - b.dayNumber),
};
```

**Tiempo estimado**: 1 hora

---

#### **DÍA 1 - PARTE 2: Dashboard Principal** (2-3 horas)

##### **Step 1.3: Agregar KPI de Tiempo de Confirmación**
```bash
Archivo: src/app/(app)/dashboard/page.tsx
```

**Acción**:
```typescript
// En la sección de KPIs (línea ~200)
const avgConfirmationTime = displayMetrics?.storeMetrics
  .reduce((sum, store) => sum + (store.averageConfirmationTime || 0), 0) / 
  (displayMetrics?.storeMetrics.length || 1);

// Agregar card nuevo
<Card>
  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
    <CardTitle className="text-sm font-medium">Tiempo Prom. Confirmación</CardTitle>
    <Clock className="w-4 h-4 text-muted-foreground" />
  </CardHeader>
  <CardContent>
    <div className="text-2xl font-bold">
      {avgConfirmationTime.toFixed(0)} min
    </div>
    <p className="text-xs text-muted-foreground">
      {avgConfirmationTime < 60 ? 'Excelente' : avgConfirmationTime < 120 ? 'Bueno' : 'Mejorar'}
    </p>
  </CardContent>
</Card>
```

**Tiempo estimado**: 30 min

---

##### **Step 1.4: Agregar Gráfico de Distribución Horaria**
```typescript
// Después del gráfico de Top Provincias (línea ~850)
<Card className="col-span-2">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Clock className="w-5 h-5" />
      Distribución Horaria de Pedidos
    </CardTitle>
    <CardDescription>Pedidos por hora del día</CardDescription>
  </CardHeader>
  <CardContent>
    <ChartContainer config={{}} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayMetrics?.hourlyDistribution || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="hour" 
            tickFormatter={(value) => `${value}:00`}
          />
          <YAxis />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-background border rounded p-2 shadow-md">
                    <p className="font-bold">{payload[0].payload.hour}:00</p>
                    <p>Pedidos: {payload[0].payload.orders}</p>
                    <p>Confirmados: {payload[0].payload.confirmed}</p>
                    <p>Tasa: {((payload[0].payload.confirmed / payload[0].payload.orders) * 100).toFixed(1)}%</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="orders" fill="hsl(var(--chart-1))" name="Total" />
          <Bar dataKey="confirmed" fill="hsl(var(--chart-2))" name="Confirmados" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  </CardContent>
</Card>
```

**Tiempo estimado**: 45 min

---

##### **Step 1.5: Agregar Gráfico de Distribución Semanal**
```typescript
// Después del gráfico horario
<Card className="col-span-2">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <CalendarIcon className="w-5 h-5" />
      Distribución por Día de la Semana
    </CardTitle>
    <CardDescription>Comportamiento semanal de pedidos</CardDescription>
  </CardHeader>
  <CardContent>
    <ChartContainer config={{}} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={displayMetrics?.weekdayDistribution || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="orders" fill="hsl(var(--chart-1))" name="Total Pedidos" />
          <Bar dataKey="confirmed" fill="hsl(var(--chart-2))" name="Confirmados" />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  </CardContent>
</Card>
```

**Tiempo estimado**: 30 min

---

**Total Día 1**: 4-5 horas

---

### **DÍA 2: ANÁLISIS DE ENTREGAS** (4-5 horas)

#### **Step 2.1: Calcular Tiempo de Entrega por Courier**
```bash
Archivo: src/ai/flows/getMetricsFlow.ts
```

**Acción**:
```typescript
// En el loop de deliveredOrders (línea ~240)
const courierDeliveryTimes: { [courier: string]: number[] } = {};

deliveredOrders.forEach((order) => {
  if (order.deliveryTimeInHours && order.courier && order.courier !== 'No especificado') {
    if (!courierDeliveryTimes[order.courier]) {
      courierDeliveryTimes[order.courier] = [];
    }
    courierDeliveryTimes[order.courier].push(order.deliveryTimeInHours);
  }
});

// Agregar al schema CourierMetricSchema
export const CourierMetricSchema = z.object({
  name: z.string(),
  totalShipments: z.number(),
  totalRevenue: z.number(),
  averageOrderValue: z.number(),
  provinceCount: z.number(),
  percentageOfTotal: z.number(),
  averageDeliveryTime: z.number().optional(), // ← NUEVO (horas)
  minDeliveryTime: z.number().optional(),     // ← NUEVO
  maxDeliveryTime: z.number().optional(),     // ← NUEVO
  stdDevDeliveryTime: z.number().optional(),  // ← NUEVO
});

// Al calcular aggregatedCourierMetrics (línea ~380)
const aggregatedCourierMetrics: any[] = Object.entries(courierData).map(([name, data]) => {
  const deliveryTimes = courierDeliveryTimes[name] || [];
  const avgDeliveryTime = deliveryTimes.length > 0
    ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
    : 0;
  const minDeliveryTime = deliveryTimes.length > 0 ? Math.min(...deliveryTimes) : 0;
  const maxDeliveryTime = deliveryTimes.length > 0 ? Math.max(...deliveryTimes) : 0;
  
  // Calcular desviación estándar
  const mean = avgDeliveryTime;
  const variance = deliveryTimes.length > 0
    ? deliveryTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / deliveryTimes.length
    : 0;
  const stdDevDeliveryTime = Math.sqrt(variance);
  
  return {
    name,
    totalShipments: data.shipments,
    totalRevenue: data.revenue,
    averageOrderValue: data.shipments > 0 ? data.revenue / data.shipments : 0,
    provinceCount: data.provinces.size,
    percentageOfTotal: totalShipments > 0 ? (data.shipments / totalShipments) * 100 : 0,
    averageDeliveryTime: avgDeliveryTime,
    minDeliveryTime: minDeliveryTime,
    maxDeliveryTime: maxDeliveryTime,
    stdDevDeliveryTime: stdDevDeliveryTime,
  };
}).sort((a, b) => b.totalShipments - a.totalShipments);
```

**Tiempo estimado**: 1 hora

---

#### **Step 2.2: Agregar Gráfico Box Plot de Tiempos de Entrega**
```bash
Archivo: src/app/(app)/dashboard/shipments/page.tsx
```

**Acción**:
```typescript
// Agregar después del gráfico de couriers (línea ~400)
<Card className="col-span-2">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Timer className="w-5 h-5" />
      Tiempo de Entrega por Courier
    </CardTitle>
    <CardDescription>Comparativa de eficiencia (en horas)</CardDescription>
  </CardHeader>
  <CardContent>
    <ChartContainer config={{}} className="h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart 
          data={metrics.courierMetrics || []} 
          layout="horizontal"
          margin={{ top: 20, right: 30, left: 40, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" label={{ value: 'Horas', position: 'insideBottom', offset: -10 }} />
          <YAxis dataKey="name" type="category" width={100} />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-background border rounded p-3 shadow-md">
                    <p className="font-bold">{data.name}</p>
                    <p>Promedio: {data.averageDeliveryTime?.toFixed(1)} hrs</p>
                    <p>Mínimo: {data.minDeliveryTime?.toFixed(1)} hrs</p>
                    <p>Máximo: {data.maxDeliveryTime?.toFixed(1)} hrs</p>
                    <p>Desv. Est.: {data.stdDevDeliveryTime?.toFixed(1)} hrs</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {data.stdDevDeliveryTime < 12 ? '✅ Consistente' : '⚠️ Variable'}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar dataKey="averageDeliveryTime" fill="hsl(var(--chart-3))">
            <LabelList dataKey="averageDeliveryTime" position="right" formatter={(value: number) => `${value.toFixed(1)} hrs`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  </CardContent>
</Card>
```

**Tiempo estimado**: 1 hora

---

**Total Día 2**: 4-5 horas

---

### **DÍA 3: STOCK CRÍTICO** (4-5 horas)

#### **Step 3.1: Crear Vista de Stock Crítico**
```bash
Archivo: src/app/(app)/dashboard/inventory-status/page.tsx
```

**Acción - Agregar sección de alertas**:
```typescript
// Al inicio del componente
const criticalStock = metrics?.purchaseForecast?.filter(item => item.daysLeft <= 7) || [];
const lowStock = metrics?.purchaseForecast?.filter(item => item.daysLeft > 7 && item.daysLeft <= 15) || [];
const healthyStock = metrics?.purchaseForecast?.filter(item => item.daysLeft > 15) || [];

// Agregar antes de la tabla de previsión
<div className="grid gap-4 md:grid-cols-3 mb-6">
  <Card className="border-red-500">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-500" />
        Stock Crítico (&lt; 7 días)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-red-600">{criticalStock.length}</div>
      <p className="text-xs text-muted-foreground mt-1">
        Productos requieren compra URGENTE
      </p>
      <Progress value={(criticalStock.length / (metrics?.purchaseForecast?.length || 1)) * 100} className="mt-2" />
    </CardContent>
  </Card>

  <Card className="border-yellow-500">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <Clock className="w-4 h-4 text-yellow-500" />
        Stock Bajo (7-15 días)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-yellow-600">{lowStock.length}</div>
      <p className="text-xs text-muted-foreground mt-1">
        Productos a monitorear
      </p>
      <Progress value={(lowStock.length / (metrics?.purchaseForecast?.length || 1)) * 100} className="mt-2" />
    </CardContent>
  </Card>

  <Card className="border-green-500">
    <CardHeader className="pb-3">
      <CardTitle className="text-sm font-medium flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        Stock Saludable (&gt; 15 días)
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-green-600">{healthyStock.length}</div>
      <p className="text-xs text-muted-foreground mt-1">
        Productos en buen estado
      </p>
      <Progress value={(healthyStock.length / (metrics?.purchaseForecast?.length || 1)) * 100} className="mt-2" />
    </CardContent>
  </Card>
</div>
```

**Tiempo estimado**: 1.5 horas

---

#### **Step 3.2: Agregar Gráfico de Gauge para Stock**
```typescript
// Agregar después de las cards
<Card className="col-span-2">
  <CardHeader>
    <CardTitle>Distribución de Stock por Urgencia</CardTitle>
  </CardHeader>
  <CardContent>
    <ChartContainer config={{}} className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[
              { name: 'Crítico', value: criticalStock.length, fill: '#ef4444' },
              { name: 'Bajo', value: lowStock.length, fill: '#f59e0b' },
              { name: 'Saludable', value: healthyStock.length, fill: '#10b981' },
            ]}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={100}
            dataKey="value"
          >
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  </CardContent>
</Card>
```

**Tiempo estimado**: 1 hora

---

**Total Día 3**: 4-5 horas

---

### **DÍA 4-5: NUEVA PÁGINA /dashboard/products** (8-10 horas)

#### **Step 4.1: Calcular Métricas de Productos**
```bash
Archivo: src/ai/flows/getMetricsFlow.ts
```

**Acción - Agregar análisis de rentabilidad**:
```typescript
// Después del cálculo de purchasedProductData (línea ~200)
const productProfitability: { [product: string]: { orders: number, revenue: number, avgPrice: number } } = {};

confirmedOrders.forEach((order) => {
  if (order.products && Array.isArray(order.products)) {
    order.products.forEach((product: { title: string, quantity: number, price: number }) => {
      const cleanedProduct = product.title.replace(/^[0-9]+\s*x\s+/i, '').trim();
      
      if (!productProfitability[cleanedProduct]) {
        productProfitability[cleanedProduct] = { orders: 0, revenue: 0, avgPrice: 0 };
      }
      
      productProfitability[cleanedProduct].orders += product.quantity;
      productProfitability[cleanedProduct].revenue += product.price * product.quantity;
    });
  }
});

// Calcular precio promedio
Object.keys(productProfitability).forEach(product => {
  if (productProfitability[product].orders > 0) {
    productProfitability[product].avgPrice = 
      productProfitability[product].revenue / productProfitability[product].orders;
  }
});

// Agregar al schema
export const ProductProfitabilitySchema = z.object({
  name: z.string(),
  orders: z.number(),
  revenue: z.number(),
  avgPrice: z.number(),
  popularityScore: z.number(), // 0-100
  profitabilityScore: z.number(), // 0-100
});

// Agregar al return
const maxOrders = Math.max(...Object.values(productProfitability).map(p => p.orders), 1);
const maxRevenue = Math.max(...Object.values(productProfitability).map(p => p.revenue), 1);

const productProfitabilityMetrics = Object.entries(productProfitability).map(([name, data]) => ({
  name,
  orders: data.orders,
  revenue: data.revenue,
  avgPrice: data.avgPrice,
  popularityScore: (data.orders / maxOrders) * 100,
  profitabilityScore: (data.revenue / maxRevenue) * 100,
})).sort((a, b) => b.revenue - a.revenue);

return {
  // ... campos existentes ...
  productProfitability: productProfitabilityMetrics,
};
```

**Tiempo estimado**: 2 horas

---

#### **Step 4.2: Crear página /dashboard/products**
```bash
Archivo: src/app/(app)/dashboard/products/page.tsx
```

**Estructura completa de la página** (ver archivo adjunto)

**Tiempo estimado**: 6-8 horas

---

**Total Días 4-5**: 8-10 horas

---

## 📋 RESUMEN DE ARCHIVOS A MODIFICAR

### **Schemas** (`src/ai/schemas/getMetricsSchema.ts`):
1. ✅ Agregar `averageConfirmationTime` a StoreMetricSchema
2. ✅ Crear HourlyDistributionSchema
3. ✅ Crear WeekdayDistributionSchema
4. ✅ Agregar campos de delivery a CourierMetricSchema
5. ✅ Crear ProductProfitabilitySchema
6. ✅ Actualizar GetMetricsOutputSchema

### **Flow** (`src/ai/flows/getMetricsFlow.ts`):
1. ✅ Calcular tiempo de confirmación
2. ✅ Calcular distribución horaria
3. ✅ Calcular distribución semanal
4. ✅ Calcular tiempos de entrega por courier
5. ✅ Calcular rentabilidad de productos

### **Dashboards**:
1. ✅ `src/app/(app)/dashboard/page.tsx` - Agregar 3 gráficos nuevos
2. ✅ `src/app/(app)/dashboard/shipments/page.tsx` - Agregar 1 gráfico
3. ✅ `src/app/(app)/dashboard/inventory-status/page.tsx` - Agregar alertas y 1 gráfico
4. ✅ `src/app/(app)/dashboard/products/page.tsx` - CREAR NUEVA PÁGINA

---

## ⏱️ ESTIMACIÓN TOTAL

- **Día 1**: 4-5 horas (Fundamentos + Dashboard principal)
- **Día 2**: 4-5 horas (Análisis de entregas)
- **Día 3**: 4-5 horas (Stock crítico)
- **Días 4-5**: 8-10 horas (Nueva página productos)

**TOTAL**: 20-25 horas (2.5-3 días de trabajo efectivo)

---

## 🎯 ORDEN DE EJECUCIÓN RECOMENDADO

1. ✅ Schemas (completar primero)
2. ✅ Cálculos en getMetricsFlow.ts (uno por uno)
3. ✅ Dashboard principal (validar datos)
4. ✅ Shipments (agregar tiempo entrega)
5. ✅ Inventory Status (alertas stock)
6. ✅ Nueva página Products (al final)

---

## ✅ CHECKLIST DE TESTING

Después de cada implementación:

- [ ] Verificar que compila sin errores TypeScript
- [ ] Verificar que los datos se calculan correctamente
- [ ] Verificar que los gráficos se renderizan
- [ ] Verificar responsive design
- [ ] Verificar que no hay errores en consola
- [ ] Verificar performance (tiempo de carga)

---

## 🚀 SIGUIENTES FASES

Después de completar esto:

**FASE 2** (Semana 2):
- Mapa de calor de provincias
- Página /dashboard/financials
- Análisis ABC de productos
- Tasa de conversión por tienda

**FASE 3** (Semana 3):
- Página /dashboard/customers
- Cohort analysis
- Predicción de ventas
- Anomaly detection

---

**¿Comenzamos con el Día 1?** 🚀
