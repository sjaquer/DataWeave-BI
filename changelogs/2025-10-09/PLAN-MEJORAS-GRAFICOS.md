---
Date: 2025-10-09
---

# ðŸ“Š PLAN MAESTRO DE MEJORAS - DASHBOARDS Y GRÃFICOS

**Fecha**: 09/10/2025  
**Objetivo**: Maximizar el valor de TODOS los datos capturados  
**Status**: PLANIFICACIÃ“N COMPLETA

---

## ðŸŽ¯ RESUMEN EJECUTIVO

### **Datos Disponibles** (100% capturados, subutilizados)

#### **ðŸ“¦ Datos de Pedidos**:
- âœ… storeId, orderId, orderName, createdAt
- âœ… totalPrice, customerName
- âœ… province, city, zip, country
- âœ… products (array con tÃ­tulo, cantidad, precio)
- âœ… isConfirmed, confirmedAt, confirmedBy
- âœ… courier, isDelivered, deliveredAt
- âœ… paymentMethod, pendingAmount
- âœ… deliveryTimeInHours, deliveredBy

#### **ðŸ“Š MÃ©tricas Calculadas** (ya disponibles):
- âœ… Daily metrics (con byStore)
- âœ… Province metrics (global + by store)
- âœ… Product metrics (requested vs purchased)
- âœ… Product confirmation rates
- âœ… Personnel metrics
- âœ… Courier metrics
- âœ… Payment method metrics
- âœ… Store metrics (completo)
- âœ… Daily store performance

#### **ðŸ“¦ Datos de Inventario**:
- âœ… Inventory flow trend (entradas/salidas por dÃ­a y tienda)
- âœ… Most moved products
- âœ… Most incoming products
- âœ… Inventory personnel metrics
- âœ… Customer returns (devoluciones)
- âœ… Most returned products
- âœ… Current inventory (SKU, stock actual)
- âœ… Purchase forecast (predicciÃ³n de compra)
- âœ… Monthly product report (tendencias)

---

## ðŸ“ˆ PÃGINAS ACTUALES VS DATOS DISPONIBLES

### **1. Dashboard Principal** (`/dashboard`)
**Datos mostrados actualmente**:
- âœ… MÃ©tricas globales (totales, confirmados)
- âœ… GrÃ¡fico de pedidos diarios
- âœ… Top 10 provincias (barras)
- âœ… Top 5 productos solicitados
- âœ… Resumen por tienda
- âœ… MÃ©todos de pago (Pie + Bar)

**Datos NO mostrados** (disponibles):
- âŒ ConfirmaciÃ³n diaria por tienda (line chart)
- âŒ Tendencia de ticket promedio
- âŒ DistribuciÃ³n de pedidos por hora del dÃ­a
- âŒ Customer acquisition (nuevos clientes por dÃ­a)
- âŒ Productos mÃ¡s rentables
- âŒ Tiempo promedio de confirmaciÃ³n
- âŒ Tasa de conversiÃ³n por tienda

---

### **2. Shipments** (`/dashboard/shipments`)
**Datos mostrados actualmente**:
- âœ… Provincias mÃ¡s activas
- âœ… MÃ©todos de pago
- âœ… Performance por tienda
- âœ… Performance de couriers

**Datos NO mostrados** (disponibles):
- âŒ Mapa de calor de provincias
- âŒ Tiempo de entrega por courier
- âŒ Tiempo de entrega por provincia
- âŒ EvoluciÃ³n de pendingAmount
- âŒ Eficiencia de courier (tiempo vs costo)
- âŒ Rutas mÃ¡s rentables (provincia + courier)
- âŒ Comparativa de mÃ©todos de pago por provincia

---

### **3. Provinces** (`/dashboard/provinces`)
**Datos mostrados actualmente**:
- âœ… Tabla de provincias con mÃ©tricas
- âœ… Ordenamiento

**Datos NO mostrados** (disponibles):
- âŒ Mapa de PerÃº con heat map
- âŒ EvoluciÃ³n temporal por provincia
- âŒ Comparativa de provincias (radar chart)
- âŒ Ticket promedio por provincia
- âŒ Productos mÃ¡s vendidos por provincia
- âŒ Couriers mÃ¡s usados por provincia
- âŒ MÃ©todos de pago por provincia

---

### **4. Inventory** (`/dashboard/inventory`)
**Datos mostrados actualmente**:
- âœ… Flujo de inventario (entradas/salidas)
- âœ… Productos mÃ¡s movidos
- âœ… Personal de inventario

**Datos NO mostrados** (disponibles):
- âŒ Stock crÃ­tico (productos < 7 dÃ­as)
- âŒ Productos sin movimiento (estancados)
- âŒ Tendencia de rotaciÃ³n por producto
- âŒ Comparativa de velocidad de venta
- âŒ ProyecciÃ³n de quiebre de stock
- âŒ Eficiencia de reabastecimiento

---

### **5. Inventory Status** (`/dashboard/inventory-status`)
**Datos mostrados actualmente**:
- âœ… Estado actual de inventario
- âœ… PrevisiÃ³n de compra
- âœ… Reporte mensual

**Datos NO mostrados** (disponibles):
- âŒ GrÃ¡fico de dÃ­as hasta quiebre
- âŒ DistribuciÃ³n ABC de productos
- âŒ Costo de inventario inmovilizado
- âŒ Productos con tendencia negativa
- âŒ Recomendaciones de descuento

---

### **6. Returns** (`/dashboard/returns`)
**Datos mostrados actualmente**:
- âœ… Devoluciones de clientes
- âœ… Productos mÃ¡s devueltos

**Datos NO mostrados** (disponibles):
- âŒ Tasa de devoluciÃ³n por producto
- âŒ Tasa de devoluciÃ³n por tienda
- âŒ Razones de devoluciÃ³n (si se capturan)
- âŒ EvoluciÃ³n temporal de devoluciones
- âŒ Costo de devoluciones por mes
- âŒ Productos con alta tasa de devoluciÃ³n

---

### **7. Daily** (`/dashboard/daily`)
**Datos mostrados actualmente**:
- âœ… MÃ©tricas diarias detalladas

**Datos NO mostrados** (disponibles):
- âŒ DistribuciÃ³n horaria de pedidos
- âŒ Picos de actividad
- âŒ Comparativa dÃ­a actual vs promedio
- âŒ PredicciÃ³n de pedidos para hoy
- âŒ Alertas de anomalÃ­as

---

### **8. Performance** (`/dashboard/performance`)
**Datos mostrados actualmente**:
- âœ… Rendimiento de tiendas

**Datos NO mostrados** (disponibles):
- âŒ KPIs por tienda (conversion rate, AOV, etc.)
- âŒ Ranking de tiendas por mÃ©trica
- âŒ Benchmark entre tiendas
- âŒ EvoluciÃ³n de market share
- âŒ Productos estrella por tienda
- âŒ Eficiencia operativa (tiempo confirmaciÃ³n)

---

## ðŸŽ¨ NUEVOS GRÃFICOS PROPUESTOS

### **PRIORIDAD ALTA** (Impacto inmediato en toma de decisiones)

#### **1. AnÃ¡lisis de Tiempo de Entrega**
- **Datos**: `deliveryTimeInHours`, `courier`, `province`
- **GrÃ¡fico**: Box plot por courier
- **Valor**: Identificar couriers lentos
- **UbicaciÃ³n**: `/dashboard/shipments`

#### **2. Stock CrÃ­tico Dashboard**
- **Datos**: `purchaseForecast.daysLeft`, `currentStock`
- **GrÃ¡fico**: Gauge charts + tabla urgente
- **Valor**: Prevenir quiebres de stock
- **UbicaciÃ³n**: `/dashboard/inventory-status`

#### **3. Mapa de Calor de Provincias**
- **Datos**: `provinceMetrics.totalOrders`, coordenadas
- **GrÃ¡fico**: Mapa de PerÃº con gradiente
- **Valor**: VisualizaciÃ³n geogrÃ¡fica de ventas
- **UbicaciÃ³n**: `/dashboard/provinces`

#### **4. EvoluciÃ³n de Ticket Promedio**
- **Datos**: `storeMetrics.averageTicket` por dÃ­a
- **GrÃ¡fico**: Line chart multi-tienda
- **Valor**: Detectar cambios en comportamiento de compra
- **UbicaciÃ³n**: `/dashboard`

#### **5. DistribuciÃ³n Horaria de Pedidos**
- **Datos**: `createdAt` (hora extraÃ­da)
- **GrÃ¡fico**: Heatmap 24 horas x 7 dÃ­as
- **Valor**: Optimizar personal y promociones
- **UbicaciÃ³n**: `/dashboard/daily`

#### **6. Productos Rentables vs Populares**
- **Datos**: `products.price`, `totalOrders`
- **GrÃ¡fico**: Scatter plot (popularidad vs precio)
- **Valor**: Estrategia de pricing
- **UbicaciÃ³n**: `/dashboard`

#### **7. Eficiencia de ConfirmaciÃ³n**
- **Datos**: `createdAt`, `confirmedAt`
- **GrÃ¡fico**: Histogram de tiempo de confirmaciÃ³n
- **Valor**: Mejorar procesos operativos
- **UbicaciÃ³n**: `/dashboard/performance`

#### **8. Tasa de ConversiÃ³n por Tienda**
- **Datos**: `totalOrders`, `confirmedOrders` (timeline)
- **GrÃ¡fico**: Area chart con tasas
- **Valor**: Benchmark entre tiendas
- **UbicaciÃ³n**: `/dashboard/performance`

---

### **PRIORIDAD MEDIA** (AnÃ¡lisis profundo)

#### **9. AnÃ¡lisis ABC de Productos**
- **Datos**: `products`, `totalRevenue`
- **GrÃ¡fico**: Pareto chart (80/20)
- **Valor**: Enfoque en productos clave
- **UbicaciÃ³n**: Nueva pÃ¡gina `/dashboard/products`

#### **10. MÃ©todos de Pago por Provincia**
- **Datos**: `paymentMethod`, `province`
- **GrÃ¡fico**: Stacked bar chart
- **Valor**: Estrategia de pago regional
- **UbicaciÃ³n**: `/dashboard/provinces`

#### **11. Velocidad de RotaciÃ³n de Inventario**
- **Datos**: `monthlyProductReport.salesTrend`
- **GrÃ¡fico**: Line chart con predicciÃ³n
- **Valor**: GestiÃ³n de inventario Ã³ptima
- **UbicaciÃ³n**: `/dashboard/inventory`

#### **12. Comparativa de Couriers**
- **Datos**: `courier`, `deliveryTimeInHours`, `province`
- **GrÃ¡fico**: Radar chart multi-courier
- **Valor**: SelecciÃ³n de mejor courier
- **UbicaciÃ³n**: `/dashboard/shipments`

#### **13. Customer Returns Analysis**
- **Datos**: `customerReturns`, `products`
- **GrÃ¡fico**: Funnel de devoluciones
- **Valor**: Reducir tasa de devoluciÃ³n
- **UbicaciÃ³n**: `/dashboard/returns`

#### **14. Pendientes de Pago**
- **Datos**: `pendingAmount`, `deliveredAt`
- **GrÃ¡fico**: Timeline de pendientes
- **Valor**: GestiÃ³n de cobranzas
- **UbicaciÃ³n**: Nueva pÃ¡gina `/dashboard/financials`

---

### **PRIORIDAD BAJA** (Nice to have)

#### **15. PredicciÃ³n de Ventas**
- **Datos**: `dailyMetrics` (histÃ³rico)
- **GrÃ¡fico**: Line chart con forecast
- **Valor**: PlanificaciÃ³n
- **UbicaciÃ³n**: `/dashboard`

#### **16. AnÃ¡lisis de Clientes Recurrentes**
- **Datos**: `customerName`, `orderId`
- **GrÃ¡fico**: Cohort analysis
- **Valor**: FidelizaciÃ³n
- **UbicaciÃ³n**: Nueva pÃ¡gina `/dashboard/customers`

#### **17. DistribuciÃ³n GeogrÃ¡fica de Personal**
- **Datos**: `personnelMetrics`, `province`
- **GrÃ¡fico**: Map + stats
- **Valor**: OptimizaciÃ³n de recursos
- **UbicaciÃ³n**: `/dashboard/performance`

---

## ðŸ—‚ï¸ NUEVAS PÃGINAS PROPUESTAS

### **1. `/dashboard/products`** (NUEVA)
**Objetivo**: AnÃ¡lisis profundo de productos

**GrÃ¡ficos**:
1. AnÃ¡lisis ABC (Pareto)
2. Productos rentables vs populares (Scatter)
3. Matriz de Boston (crecimiento vs market share)
4. Comparativa de confirmation rate
5. Productos con mejor ticket promedio
6. Productos por tienda (treemap)

---

### **2. `/dashboard/financials`** (NUEVA)
**Objetivo**: AnÃ¡lisis financiero detallado

**GrÃ¡ficos**:
1. Ingresos por dÃ­a (con proyecciÃ³n)
2. Pendientes de pago (aging)
3. Ticket promedio por tienda (timeline)
4. Revenue por provincia (mapa)
5. MÃ©todos de pago (distribuciÃ³n temporal)
6. Costo de devoluciones

---

### **3. `/dashboard/customers`** (NUEVA)
**Objetivo**: AnÃ¡lisis de clientes

**GrÃ¡ficos**:
1. Nuevos clientes por dÃ­a
2. Clientes recurrentes (cohort)
3. Customer lifetime value
4. DistribuciÃ³n geogrÃ¡fica de clientes
5. Ticket promedio por cliente

---

### **4. `/dashboard/operations`** (NUEVA)
**Objetivo**: Eficiencia operativa

**GrÃ¡ficos**:
1. Tiempo de confirmaciÃ³n (histogram)
2. Tiempo de entrega por courier
3. Eficiencia de personal
4. Alertas de stock crÃ­tico
5. SLA compliance (entregas a tiempo)

---

### **5. `/dashboard/analytics`** (NUEVA)
**Objetivo**: Machine Learning insights

**GrÃ¡ficos**:
1. PredicciÃ³n de ventas (7 dÃ­as)
2. Productos en riesgo de quiebre
3. AnomalÃ­as detectadas
4. Recomendaciones automÃ¡ticas
5. Tendencias emergentes

---

## ðŸ“Š MEJORAS A PÃGINAS EXISTENTES

### **Dashboard Principal**
**Agregar**:
1. âœ… GrÃ¡fico de ticket promedio (line chart)
2. âœ… Top 5 productos rentables (bar chart)
3. âœ… Tasa de conversiÃ³n diaria (area chart)
4. âœ… Tiempo promedio de confirmaciÃ³n (KPI card)
5. âœ… DistribuciÃ³n de pedidos por dÃ­a de semana (radar)

---

### **Shipments**
**Agregar**:
1. âœ… Tiempo de entrega por courier (box plot)
2. âœ… Eficiencia de courier (scatter: tiempo vs costo)
3. âœ… Provincias mÃ¡s rentables (treemap)
4. âœ… EvoluciÃ³n de pendientes de pago (line chart)

---

### **Provinces**
**Agregar**:
1. âœ… Mapa de calor de PerÃº
2. âœ… MÃ©todos de pago por provincia (stacked bar)
3. âœ… Productos mÃ¡s vendidos por provincia (table)
4. âœ… Ticket promedio por provincia (bar chart)
5. âœ… EvoluciÃ³n temporal por provincia (multi-line)

---

### **Inventory**
**Agregar**:
1. âœ… Alerta de stock crÃ­tico (gauge)
2. âœ… Productos sin movimiento (table)
3. âœ… Velocidad de rotaciÃ³n (scatter)
4. âœ… ProyecciÃ³n de quiebre (timeline)

---

### **Performance**
**Agregar**:
1. âœ… Ranking de tiendas (radar chart)
2. âœ… KPIs comparativos (table)
3. âœ… Productos estrella por tienda (treemap)
4. âœ… Eficiencia de confirmaciÃ³n (histogram)

---

## ðŸŽ¯ MÃ‰TRICAS ADICIONALES A CALCULAR

### **En `getMetricsFlow.ts`**:

```typescript
// 1. Tiempo promedio de confirmaciÃ³n
averageConfirmationTime: number; // minutos

// 2. Tasa de conversiÃ³n por tienda
conversionRate: number; // %

// 3. Nuevos clientes por dÃ­a
newCustomers: number;

// 4. Clientes recurrentes
recurringCustomers: number;

// 5. DistribuciÃ³n horaria
hourlyDistribution: { hour: number, orders: number }[];

// 6. DistribuciÃ³n por dÃ­a de semana
weekdayDistribution: { day: string, orders: number }[];

// 7. Productos rentables
profitableProducts: { name: string, revenue: number, orders: number }[];

// 8. Stock crÃ­tico
criticalStock: { sku: string, daysLeft: number }[];

// 9. Pending payments timeline
pendingPayments: { date: string, amount: number }[];

// 10. Delivery efficiency by courier
deliveryEfficiency: { courier: string, avgTime: number, stdDev: number }[];
```

---

## ðŸš€ PLAN DE IMPLEMENTACIÃ“N PASO A PASO

### **FASE 1: MEJORAS RÃPIDAS** (1-2 dÃ­as)

#### **DÃ­a 1 - MaÃ±ana**:
1. âœ… Corregir gasto promedio (HECHO)
2. â³ Agregar tiempo de confirmaciÃ³n al schema
3. â³ Calcular en getMetricsFlow
4. â³ Agregar KPI card en dashboard principal

#### **DÃ­a 1 - Tarde**:
5. â³ Agregar distribuciÃ³n horaria al schema
6. â³ Calcular en getMetricsFlow
7. â³ Crear grÃ¡fico heatmap en `/dashboard/daily`

---

### **FASE 2: GRÃFICOS DE ALTO IMPACTO** (2-3 dÃ­as)

#### **DÃ­a 2**:
1. â³ Tiempo de entrega por courier (box plot)
2. â³ Stock crÃ­tico dashboard (gauges)
3. â³ Ticket promedio evolution (line chart)

#### **DÃ­a 3**:
4. â³ Productos rentables vs populares (scatter)
5. â³ Tasa de conversiÃ³n por tienda (area chart)
6. â³ MÃ©todos de pago por provincia (stacked bar)

---

### **FASE 3: NUEVAS PÃGINAS** (3-4 dÃ­as)

#### **DÃ­a 4-5**:
1. â³ Crear `/dashboard/products`
2. â³ Implementar anÃ¡lisis ABC
3. â³ Scatter plot rentabilidad

#### **DÃ­a 6-7**:
4. â³ Crear `/dashboard/financials`
5. â³ Pendientes de pago
6. â³ Revenue projections

---

### **FASE 4: ANÃLISIS AVANZADO** (1 semana)

1. â³ Mapa de calor de PerÃº
2. â³ PredicciÃ³n de ventas
3. â³ Cohort analysis
4. â³ Anomaly detection

---

## ðŸ“‹ CHECKLIST GENERAL

### **Datos**:
- [x] âœ… Todos los datos de pedidos capturados
- [x] âœ… Todos los datos de inventario capturados
- [x] âœ… MÃ©tricas bÃ¡sicas calculadas
- [ ] â³ MÃ©tricas avanzadas (tiempo confirmaciÃ³n, etc.)
- [ ] â³ Datos de clientes procesados
- [ ] â³ Coordenadas de provincias agregadas

### **GrÃ¡ficos Dashboard Principal**:
- [x] âœ… Pedidos diarios
- [x] âœ… Top provincias
- [x] âœ… Top productos
- [x] âœ… MÃ©todos de pago
- [ ] â³ Ticket promedio
- [ ] â³ Tasa de conversiÃ³n
- [ ] â³ DistribuciÃ³n semanal

### **GrÃ¡ficos Shipments**:
- [x] âœ… Couriers performance
- [x] âœ… MÃ©todos de pago
- [ ] â³ Tiempo de entrega
- [ ] â³ Eficiencia courier
- [ ] â³ Provincias rentables

### **Nuevas PÃ¡ginas**:
- [ ] â³ /dashboard/products
- [ ] â³ /dashboard/financials
- [ ] â³ /dashboard/customers
- [ ] â³ /dashboard/operations
- [ ] â³ /dashboard/analytics

---

## ðŸŽ¯ PRIORIDADES SUGERIDAS

### **ESTA SEMANA** (MÃ¡ximo impacto):
1. Tiempo de confirmaciÃ³n (KPI)
2. Stock crÃ­tico (alertas)
3. Tiempo de entrega por courier
4. Ticket promedio evolution
5. DistribuciÃ³n horaria

### **PRÃ“XIMA SEMANA**:
1. PÃ¡gina /dashboard/products
2. Mapa de calor provincias
3. AnÃ¡lisis ABC
4. Tasa de conversiÃ³n

### **ESTE MES**:
1. PÃ¡gina /dashboard/financials
2. PredicciÃ³n de ventas
3. Cohort analysis
4. Anomaly detection

---

**Total de grÃ¡ficos nuevos propuestos**: 40+  
**PÃ¡ginas nuevas**: 5  
**Mejoras a pÃ¡ginas existentes**: 8  
**Datos ya disponibles no usados**: ~60%  
**Potencial de insights**: ALTO ðŸš€

