# 📊 PLAN MAESTRO DE MEJORAS - DASHBOARDS Y GRÁFICOS

**Fecha**: 09/10/2025  
**Objetivo**: Maximizar el valor de TODOS los datos capturados  
**Status**: PLANIFICACIÓN COMPLETA

---

## 🎯 RESUMEN EJECUTIVO

### **Datos Disponibles** (100% capturados, subutilizados)

#### **📦 Datos de Pedidos**:
- ✅ storeId, orderId, orderName, createdAt
- ✅ totalPrice, customerName
- ✅ province, city, zip, country
- ✅ products (array con título, cantidad, precio)
- ✅ isConfirmed, confirmedAt, confirmedBy
- ✅ courier, isDelivered, deliveredAt
- ✅ paymentMethod, pendingAmount
- ✅ deliveryTimeInHours, deliveredBy

#### **📊 Métricas Calculadas** (ya disponibles):
- ✅ Daily metrics (con byStore)
- ✅ Province metrics (global + by store)
- ✅ Product metrics (requested vs purchased)
- ✅ Product confirmation rates
- ✅ Personnel metrics
- ✅ Courier metrics
- ✅ Payment method metrics
- ✅ Store metrics (completo)
- ✅ Daily store performance

#### **📦 Datos de Inventario**:
- ✅ Inventory flow trend (entradas/salidas por día y tienda)
- ✅ Most moved products
- ✅ Most incoming products
- ✅ Inventory personnel metrics
- ✅ Customer returns (devoluciones)
- ✅ Most returned products
- ✅ Current inventory (SKU, stock actual)
- ✅ Purchase forecast (predicción de compra)
- ✅ Monthly product report (tendencias)

---

## 📈 PÁGINAS ACTUALES VS DATOS DISPONIBLES

### **1. Dashboard Principal** (`/dashboard`)
**Datos mostrados actualmente**:
- ✅ Métricas globales (totales, confirmados)
- ✅ Gráfico de pedidos diarios
- ✅ Top 10 provincias (barras)
- ✅ Top 5 productos solicitados
- ✅ Resumen por tienda
- ✅ Métodos de pago (Pie + Bar)

**Datos NO mostrados** (disponibles):
- ❌ Confirmación diaria por tienda (line chart)
- ❌ Tendencia de ticket promedio
- ❌ Distribución de pedidos por hora del día
- ❌ Customer acquisition (nuevos clientes por día)
- ❌ Productos más rentables
- ❌ Tiempo promedio de confirmación
- ❌ Tasa de conversión por tienda

---

### **2. Shipments** (`/dashboard/shipments`)
**Datos mostrados actualmente**:
- ✅ Provincias más activas
- ✅ Métodos de pago
- ✅ Performance por tienda
- ✅ Performance de couriers

**Datos NO mostrados** (disponibles):
- ❌ Mapa de calor de provincias
- ❌ Tiempo de entrega por courier
- ❌ Tiempo de entrega por provincia
- ❌ Evolución de pendingAmount
- ❌ Eficiencia de courier (tiempo vs costo)
- ❌ Rutas más rentables (provincia + courier)
- ❌ Comparativa de métodos de pago por provincia

---

### **3. Provinces** (`/dashboard/provinces`)
**Datos mostrados actualmente**:
- ✅ Tabla de provincias con métricas
- ✅ Ordenamiento

**Datos NO mostrados** (disponibles):
- ❌ Mapa de Perú con heat map
- ❌ Evolución temporal por provincia
- ❌ Comparativa de provincias (radar chart)
- ❌ Ticket promedio por provincia
- ❌ Productos más vendidos por provincia
- ❌ Couriers más usados por provincia
- ❌ Métodos de pago por provincia

---

### **4. Inventory** (`/dashboard/inventory`)
**Datos mostrados actualmente**:
- ✅ Flujo de inventario (entradas/salidas)
- ✅ Productos más movidos
- ✅ Personal de inventario

**Datos NO mostrados** (disponibles):
- ❌ Stock crítico (productos < 7 días)
- ❌ Productos sin movimiento (estancados)
- ❌ Tendencia de rotación por producto
- ❌ Comparativa de velocidad de venta
- ❌ Proyección de quiebre de stock
- ❌ Eficiencia de reabastecimiento

---

### **5. Inventory Status** (`/dashboard/inventory-status`)
**Datos mostrados actualmente**:
- ✅ Estado actual de inventario
- ✅ Previsión de compra
- ✅ Reporte mensual

**Datos NO mostrados** (disponibles):
- ❌ Gráfico de días hasta quiebre
- ❌ Distribución ABC de productos
- ❌ Costo de inventario inmovilizado
- ❌ Productos con tendencia negativa
- ❌ Recomendaciones de descuento

---

### **6. Returns** (`/dashboard/returns`)
**Datos mostrados actualmente**:
- ✅ Devoluciones de clientes
- ✅ Productos más devueltos

**Datos NO mostrados** (disponibles):
- ❌ Tasa de devolución por producto
- ❌ Tasa de devolución por tienda
- ❌ Razones de devolución (si se capturan)
- ❌ Evolución temporal de devoluciones
- ❌ Costo de devoluciones por mes
- ❌ Productos con alta tasa de devolución

---

### **7. Daily** (`/dashboard/daily`)
**Datos mostrados actualmente**:
- ✅ Métricas diarias detalladas

**Datos NO mostrados** (disponibles):
- ❌ Distribución horaria de pedidos
- ❌ Picos de actividad
- ❌ Comparativa día actual vs promedio
- ❌ Predicción de pedidos para hoy
- ❌ Alertas de anomalías

---

### **8. Performance** (`/dashboard/performance`)
**Datos mostrados actualmente**:
- ✅ Rendimiento de tiendas

**Datos NO mostrados** (disponibles):
- ❌ KPIs por tienda (conversion rate, AOV, etc.)
- ❌ Ranking de tiendas por métrica
- ❌ Benchmark entre tiendas
- ❌ Evolución de market share
- ❌ Productos estrella por tienda
- ❌ Eficiencia operativa (tiempo confirmación)

---

## 🎨 NUEVOS GRÁFICOS PROPUESTOS

### **PRIORIDAD ALTA** (Impacto inmediato en toma de decisiones)

#### **1. Análisis de Tiempo de Entrega**
- **Datos**: `deliveryTimeInHours`, `courier`, `province`
- **Gráfico**: Box plot por courier
- **Valor**: Identificar couriers lentos
- **Ubicación**: `/dashboard/shipments`

#### **2. Stock Crítico Dashboard**
- **Datos**: `purchaseForecast.daysLeft`, `currentStock`
- **Gráfico**: Gauge charts + tabla urgente
- **Valor**: Prevenir quiebres de stock
- **Ubicación**: `/dashboard/inventory-status`

#### **3. Mapa de Calor de Provincias**
- **Datos**: `provinceMetrics.totalOrders`, coordenadas
- **Gráfico**: Mapa de Perú con gradiente
- **Valor**: Visualización geográfica de ventas
- **Ubicación**: `/dashboard/provinces`

#### **4. Evolución de Ticket Promedio**
- **Datos**: `storeMetrics.averageTicket` por día
- **Gráfico**: Line chart multi-tienda
- **Valor**: Detectar cambios en comportamiento de compra
- **Ubicación**: `/dashboard`

#### **5. Distribución Horaria de Pedidos**
- **Datos**: `createdAt` (hora extraída)
- **Gráfico**: Heatmap 24 horas x 7 días
- **Valor**: Optimizar personal y promociones
- **Ubicación**: `/dashboard/daily`

#### **6. Productos Rentables vs Populares**
- **Datos**: `products.price`, `totalOrders`
- **Gráfico**: Scatter plot (popularidad vs precio)
- **Valor**: Estrategia de pricing
- **Ubicación**: `/dashboard`

#### **7. Eficiencia de Confirmación**
- **Datos**: `createdAt`, `confirmedAt`
- **Gráfico**: Histogram de tiempo de confirmación
- **Valor**: Mejorar procesos operativos
- **Ubicación**: `/dashboard/performance`

#### **8. Tasa de Conversión por Tienda**
- **Datos**: `totalOrders`, `confirmedOrders` (timeline)
- **Gráfico**: Area chart con tasas
- **Valor**: Benchmark entre tiendas
- **Ubicación**: `/dashboard/performance`

---

### **PRIORIDAD MEDIA** (Análisis profundo)

#### **9. Análisis ABC de Productos**
- **Datos**: `products`, `totalRevenue`
- **Gráfico**: Pareto chart (80/20)
- **Valor**: Enfoque en productos clave
- **Ubicación**: Nueva página `/dashboard/products`

#### **10. Métodos de Pago por Provincia**
- **Datos**: `paymentMethod`, `province`
- **Gráfico**: Stacked bar chart
- **Valor**: Estrategia de pago regional
- **Ubicación**: `/dashboard/provinces`

#### **11. Velocidad de Rotación de Inventario**
- **Datos**: `monthlyProductReport.salesTrend`
- **Gráfico**: Line chart con predicción
- **Valor**: Gestión de inventario óptima
- **Ubicación**: `/dashboard/inventory`

#### **12. Comparativa de Couriers**
- **Datos**: `courier`, `deliveryTimeInHours`, `province`
- **Gráfico**: Radar chart multi-courier
- **Valor**: Selección de mejor courier
- **Ubicación**: `/dashboard/shipments`

#### **13. Customer Returns Analysis**
- **Datos**: `customerReturns`, `products`
- **Gráfico**: Funnel de devoluciones
- **Valor**: Reducir tasa de devolución
- **Ubicación**: `/dashboard/returns`

#### **14. Pendientes de Pago**
- **Datos**: `pendingAmount`, `deliveredAt`
- **Gráfico**: Timeline de pendientes
- **Valor**: Gestión de cobranzas
- **Ubicación**: Nueva página `/dashboard/financials`

---

### **PRIORIDAD BAJA** (Nice to have)

#### **15. Predicción de Ventas**
- **Datos**: `dailyMetrics` (histórico)
- **Gráfico**: Line chart con forecast
- **Valor**: Planificación
- **Ubicación**: `/dashboard`

#### **16. Análisis de Clientes Recurrentes**
- **Datos**: `customerName`, `orderId`
- **Gráfico**: Cohort analysis
- **Valor**: Fidelización
- **Ubicación**: Nueva página `/dashboard/customers`

#### **17. Distribución Geográfica de Personal**
- **Datos**: `personnelMetrics`, `province`
- **Gráfico**: Map + stats
- **Valor**: Optimización de recursos
- **Ubicación**: `/dashboard/performance`

---

## 🗂️ NUEVAS PÁGINAS PROPUESTAS

### **1. `/dashboard/products`** (NUEVA)
**Objetivo**: Análisis profundo de productos

**Gráficos**:
1. Análisis ABC (Pareto)
2. Productos rentables vs populares (Scatter)
3. Matriz de Boston (crecimiento vs market share)
4. Comparativa de confirmation rate
5. Productos con mejor ticket promedio
6. Productos por tienda (treemap)

---

### **2. `/dashboard/financials`** (NUEVA)
**Objetivo**: Análisis financiero detallado

**Gráficos**:
1. Ingresos por día (con proyección)
2. Pendientes de pago (aging)
3. Ticket promedio por tienda (timeline)
4. Revenue por provincia (mapa)
5. Métodos de pago (distribución temporal)
6. Costo de devoluciones

---

### **3. `/dashboard/customers`** (NUEVA)
**Objetivo**: Análisis de clientes

**Gráficos**:
1. Nuevos clientes por día
2. Clientes recurrentes (cohort)
3. Customer lifetime value
4. Distribución geográfica de clientes
5. Ticket promedio por cliente

---

### **4. `/dashboard/operations`** (NUEVA)
**Objetivo**: Eficiencia operativa

**Gráficos**:
1. Tiempo de confirmación (histogram)
2. Tiempo de entrega por courier
3. Eficiencia de personal
4. Alertas de stock crítico
5. SLA compliance (entregas a tiempo)

---

### **5. `/dashboard/analytics`** (NUEVA)
**Objetivo**: Machine Learning insights

**Gráficos**:
1. Predicción de ventas (7 días)
2. Productos en riesgo de quiebre
3. Anomalías detectadas
4. Recomendaciones automáticas
5. Tendencias emergentes

---

## 📊 MEJORAS A PÁGINAS EXISTENTES

### **Dashboard Principal**
**Agregar**:
1. ✅ Gráfico de ticket promedio (line chart)
2. ✅ Top 5 productos rentables (bar chart)
3. ✅ Tasa de conversión diaria (area chart)
4. ✅ Tiempo promedio de confirmación (KPI card)
5. ✅ Distribución de pedidos por día de semana (radar)

---

### **Shipments**
**Agregar**:
1. ✅ Tiempo de entrega por courier (box plot)
2. ✅ Eficiencia de courier (scatter: tiempo vs costo)
3. ✅ Provincias más rentables (treemap)
4. ✅ Evolución de pendientes de pago (line chart)

---

### **Provinces**
**Agregar**:
1. ✅ Mapa de calor de Perú
2. ✅ Métodos de pago por provincia (stacked bar)
3. ✅ Productos más vendidos por provincia (table)
4. ✅ Ticket promedio por provincia (bar chart)
5. ✅ Evolución temporal por provincia (multi-line)

---

### **Inventory**
**Agregar**:
1. ✅ Alerta de stock crítico (gauge)
2. ✅ Productos sin movimiento (table)
3. ✅ Velocidad de rotación (scatter)
4. ✅ Proyección de quiebre (timeline)

---

### **Performance**
**Agregar**:
1. ✅ Ranking de tiendas (radar chart)
2. ✅ KPIs comparativos (table)
3. ✅ Productos estrella por tienda (treemap)
4. ✅ Eficiencia de confirmación (histogram)

---

## 🎯 MÉTRICAS ADICIONALES A CALCULAR

### **En `getMetricsFlow.ts`**:

```typescript
// 1. Tiempo promedio de confirmación
averageConfirmationTime: number; // minutos

// 2. Tasa de conversión por tienda
conversionRate: number; // %

// 3. Nuevos clientes por día
newCustomers: number;

// 4. Clientes recurrentes
recurringCustomers: number;

// 5. Distribución horaria
hourlyDistribution: { hour: number, orders: number }[];

// 6. Distribución por día de semana
weekdayDistribution: { day: string, orders: number }[];

// 7. Productos rentables
profitableProducts: { name: string, revenue: number, orders: number }[];

// 8. Stock crítico
criticalStock: { sku: string, daysLeft: number }[];

// 9. Pending payments timeline
pendingPayments: { date: string, amount: number }[];

// 10. Delivery efficiency by courier
deliveryEfficiency: { courier: string, avgTime: number, stdDev: number }[];
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN PASO A PASO

### **FASE 1: MEJORAS RÁPIDAS** (1-2 días)

#### **Día 1 - Mañana**:
1. ✅ Corregir gasto promedio (HECHO)
2. ⏳ Agregar tiempo de confirmación al schema
3. ⏳ Calcular en getMetricsFlow
4. ⏳ Agregar KPI card en dashboard principal

#### **Día 1 - Tarde**:
5. ⏳ Agregar distribución horaria al schema
6. ⏳ Calcular en getMetricsFlow
7. ⏳ Crear gráfico heatmap en `/dashboard/daily`

---

### **FASE 2: GRÁFICOS DE ALTO IMPACTO** (2-3 días)

#### **Día 2**:
1. ⏳ Tiempo de entrega por courier (box plot)
2. ⏳ Stock crítico dashboard (gauges)
3. ⏳ Ticket promedio evolution (line chart)

#### **Día 3**:
4. ⏳ Productos rentables vs populares (scatter)
5. ⏳ Tasa de conversión por tienda (area chart)
6. ⏳ Métodos de pago por provincia (stacked bar)

---

### **FASE 3: NUEVAS PÁGINAS** (3-4 días)

#### **Día 4-5**:
1. ⏳ Crear `/dashboard/products`
2. ⏳ Implementar análisis ABC
3. ⏳ Scatter plot rentabilidad

#### **Día 6-7**:
4. ⏳ Crear `/dashboard/financials`
5. ⏳ Pendientes de pago
6. ⏳ Revenue projections

---

### **FASE 4: ANÁLISIS AVANZADO** (1 semana)

1. ⏳ Mapa de calor de Perú
2. ⏳ Predicción de ventas
3. ⏳ Cohort analysis
4. ⏳ Anomaly detection

---

## 📋 CHECKLIST GENERAL

### **Datos**:
- [x] ✅ Todos los datos de pedidos capturados
- [x] ✅ Todos los datos de inventario capturados
- [x] ✅ Métricas básicas calculadas
- [ ] ⏳ Métricas avanzadas (tiempo confirmación, etc.)
- [ ] ⏳ Datos de clientes procesados
- [ ] ⏳ Coordenadas de provincias agregadas

### **Gráficos Dashboard Principal**:
- [x] ✅ Pedidos diarios
- [x] ✅ Top provincias
- [x] ✅ Top productos
- [x] ✅ Métodos de pago
- [ ] ⏳ Ticket promedio
- [ ] ⏳ Tasa de conversión
- [ ] ⏳ Distribución semanal

### **Gráficos Shipments**:
- [x] ✅ Couriers performance
- [x] ✅ Métodos de pago
- [ ] ⏳ Tiempo de entrega
- [ ] ⏳ Eficiencia courier
- [ ] ⏳ Provincias rentables

### **Nuevas Páginas**:
- [ ] ⏳ /dashboard/products
- [ ] ⏳ /dashboard/financials
- [ ] ⏳ /dashboard/customers
- [ ] ⏳ /dashboard/operations
- [ ] ⏳ /dashboard/analytics

---

## 🎯 PRIORIDADES SUGERIDAS

### **ESTA SEMANA** (Máximo impacto):
1. Tiempo de confirmación (KPI)
2. Stock crítico (alertas)
3. Tiempo de entrega por courier
4. Ticket promedio evolution
5. Distribución horaria

### **PRÓXIMA SEMANA**:
1. Página /dashboard/products
2. Mapa de calor provincias
3. Análisis ABC
4. Tasa de conversión

### **ESTE MES**:
1. Página /dashboard/financials
2. Predicción de ventas
3. Cohort analysis
4. Anomaly detection

---

**Total de gráficos nuevos propuestos**: 40+  
**Páginas nuevas**: 5  
**Mejoras a páginas existentes**: 8  
**Datos ya disponibles no usados**: ~60%  
**Potencial de insights**: ALTO 🚀
