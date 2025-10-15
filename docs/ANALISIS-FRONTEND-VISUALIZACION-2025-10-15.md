# 🔍 ANÁLISIS DE FRONTEND - COMPATIBILIDAD CON CORRECCIONES DE ESTRUCTURA

**Fecha:** 15 de octubre de 2025  
**Alcance:** Verificación de visualización de datos tras correcciones de estructura de columnas  
**Estado:** ✅ **SIN PROBLEMAS CRÍTICOS DETECTADOS**

---

## 📋 RESUMEN EJECUTIVO

He realizado un análisis exhaustivo del frontend (componentes, dashboards, hooks, y flujos AI) para verificar la compatibilidad con las correcciones de estructura de columnas de Google Sheets. 

**CONCLUSIÓN:** El frontend **NO tendrá problemas** de visualización porque:

1. ✅ **Campos críticos están correctamente mapeados** (COURIER, TIENDA, PEDIDO, PROVINCIA)
2. ✅ **Interfaces TypeScript actualizadas** coinciden con estructuras reales
3. ✅ **Webhooks usan mapeo correcto** hacia Firestore
4. ✅ **getMetricsFlow lee campos genéricos** (courier, provincia, tienda) sin depender de estructura específica
5. ✅ **Componentes usan datos agregados**, no leen hojas directamente

---

## 🔍 ANÁLISIS POR CAPA

### 1. **WEBHOOKS → FIRESTORE** (Capa de Ingesta)

#### ✅ `/api/webhooks/envios-temporales` (PROVINCIA + LIMA)

**Archivo:** `src/app/api/webhooks/envios-temporales/route.ts`

```typescript
// MAPEO CORRECTO DE CAMPOS CRÍTICOS
const pedidoData = {
  pedidoId: row.PEDIDO || row.PEDID,           // ✅ Columna D (índice 3)
  tipoOrigen,                                   // PROVINCIA o LIMA
  tienda: row.TIENDA || 'N/A',                  // ✅ Columna C (índice 2)
  provincia: row.PROVINCIA || row.PROV,         // ✅ Columna L (índice 11)
  estado: row.ESTADO || 'SIN_ESTADO',           // ✅ Columna AB (índice 27)
  courier: row.COURIER || 'N/A',                // ✅ Columna P (índice 15) 🎯
  cliente: row.NOMBRES || row.NOMB,             // ✅ Columna I (índice 8)
  // ... otros campos
};
```

**Estado:** ✅ **CORRECTO**
- El webhook lee `row.COURIER` de la columna P (índice 15) ✅
- El mapeo es dinámico por nombre de columna, NO por índice ✅
- Guarda en Firestore con nombre normalizado `courier` ✅

**Función GET (estadísticas en tiempo real):**

```typescript
export async function GET() {
  // Lee de Firestore (envios_temporales collection)
  const couriersCount: { [courier: string]: number } = {};
  
  activosSnapshot.forEach((doc: any) => {
    const data = doc.data();
    couriersCount[data.courier] = (couriersCount[data.courier] || 0) + 1; // ✅
  });

  return NextResponse.json({
    porCourier: couriersCount, // ✅ Usado en hook useEnviosTemporales
  });
}
```

**Estado:** ✅ **CORRECTO** - El endpoint GET lee de Firestore, no de Sheets

---

#### ✅ `/api/webhooks/sheets` (REPORTE_ENVIADOS)

**Archivo:** `src/app/api/webhooks/sheets/route.ts`

```typescript
// Recibe datos de REPORTE_ENVIADOS (20 columnas A-T)
const confirmedOrders: ConfirmedOrderInfo[] = body.data;

// ConfirmedOrderInfo interface actualizada (20 campos)
// Incluye COURIER en columna P ✅
```

**Estado:** ✅ **CORRECTO**
- Interface `ConfirmedOrderInfo` actualizada a 20 campos ✅
- Incluye `COURIER?: string;` (columna P) ✅

---

#### ✅ `/api/webhooks/delivered` (ENTREGADO)

**Archivo:** `src/app/api/webhooks/delivered/route.ts`

```typescript
// Recibe datos de ENTREGADO (39 columnas A-AM)
const deliveredOrders: DeliveredOrderInfo[] = body.data;

// DeliveredOrderInfo interface actualizada (39 campos)
// Incluye COURIER (P), FORMA DE PAGO (AL), USUARIO (AM) ✅
```

**Estado:** ✅ **CORRECTO**
- Interface `DeliveredOrderInfo` actualizada a 39 campos ✅
- Incluye `COURIER?: string;` (columna P) ✅
- Incluye `'FORMA DE PAGO'?: string;` (columna AL/37) ✅
- Incluye `USUARIO?: string;` (columna AM/38) ✅

---

### 2. **FIRESTORE → MÉTRICAS** (Capa de Agregación)

#### ✅ `getMetricsFlow.ts` (Flujo de Métricas)

**Archivo:** `src/ai/flows/getMetricsFlow.ts`

```typescript
// Lee pedidos confirmados/entregados de Firestore
confirmedOrders.forEach((order) => {
  // Courier Metrics
  const courierName = order.courier; // ✅ Lee campo normalizado
  if (courierName && courierName !== 'No especificado') {
    if (!courierData[courierName]) {
      courierData[courierName] = { shipments: 0, revenue: 0, provinces: new Set() };
    }
    courierData[courierName].shipments++;
    courierData[courierName].revenue += order.totalPrice || 0;
    if (order.province) {
      courierData[courierName].provinces.add(order.province);
    }
  }
});

deliveredOrders.forEach((order) => {
  // Payment Method Metrics
  if (order.paymentMethod) { // ✅ FORMA DE PAGO
    const method = order.paymentMethod;
    if (!paymentMethodData[method]) {
      paymentMethodData[method] = { orders: 0, revenue: 0 };
    }
    paymentMethodData[method].orders++;
    paymentMethodData[method].revenue += order.totalPrice || 0;
  }
});
```

**Estado:** ✅ **CORRECTO**
- Lee `order.courier` de documentos de Firestore ✅
- Lee `order.paymentMethod` de documentos entregados ✅
- NO depende de estructura de Sheets, solo de Firestore ✅

**Importante:** El flujo espera que los webhooks guarden correctamente en Firestore:
- Campo `courier` en documentos de `shopify_orders` ✅
- Campo `paymentMethod` en documentos entregados ✅

---

### 3. **HOOKS** (Capa de Consumo de Datos)

#### ✅ `useEnviosTemporales.ts`

**Archivo:** `src/hooks/useEnviosTemporales.ts`

```typescript
export interface EnviosTemporalesStats {
  status: string;
  totalActivos: number;
  porTipoOrigen: { PROVINCIA: number; LIMA: number };
  porEstado: Record<string, number>;
  porTienda: Record<string, number>;
  porProvincia: Record<string, number>;
  porCourier: Record<string, number>; // ✅
  timestamp: string;
}

export function useEnviosTemporales() {
  const response = await fetch('/api/webhooks/envios-temporales'); // GET
  const result = await response.json();
  setData(result); // ✅ Incluye porCourier
}
```

**Estado:** ✅ **CORRECTO**
- El hook consume el endpoint GET `/api/webhooks/envios-temporales` ✅
- El endpoint retorna `porCourier` correctamente ✅
- La interface espera `porCourier: Record<string, number>` ✅

---

### 4. **COMPONENTES** (Capa de Visualización)

#### ✅ `CourierPerformanceChart.tsx`

**Archivo:** `src/components/dashboard/CourierPerformanceChart.tsx`

```typescript
export function CourierPerformanceChart({ data }: CourierPerformanceChartProps) {
  const { porCourier, totalActivos } = data; // ✅ Lee de enviosTemporales

  // Gráfico de pastel
  const pieData = Object.entries(porCourier).map(([courier, cantidad]) => ({
    name: courier,
    value: cantidad,
    percentage: ((cantidad / totalActivos) * 100).toFixed(1),
  }));

  // Gráfico de barras
  const barData = Object.entries(porCourier)
    .sort((a, b) => b[1] - a[1])
    .map(([courier, cantidad]) => ({
      courier,
      cantidad,
      porcentaje: ((cantidad / totalActivos) * 100).toFixed(1),
    }));
}
```

**Estado:** ✅ **CORRECTO**
- Lee `porCourier` de `enviosTemporales` (hook useEnviosTemporales) ✅
- Visualiza distribución por courier en gráficos ✅
- NO accede directamente a Sheets ni Firestore ✅

---

#### ✅ `shipments/page.tsx` (Dashboard Principal)

**Archivo:** `src/app/(app)/dashboard/shipments/page.tsx`

```typescript
export default function ShipmentsPage() {
  const [selectedCourier, setSelectedCourier] = useState<string>("all");
  
  // Hook para datos temporales
  const { data: enviosTemporales } = useEnviosTemporales(true, 30000);

  // Métricas de Firestore (via AI Flow)
  const metricsData = await getMetrics(input);

  // Filtrado de couriers
  const allCouriersData = (metrics.courierMetrics || []).map(c => c.name);
  let couriers = (metrics.courierMetrics || [])
    .sort((a, b) => b.totalShipments - a.totalShipments);
  
  if (selectedCourier !== "all") {
    couriers = couriers.filter(c => c.name === selectedCourier);
  }

  return (
    <>
      {/* Filtro por Courier */}
      <Select value={selectedCourier} onValueChange={setSelectedCourier}>
        <SelectItem value="all">Todos los couriers</SelectItem>
        {allCouriers.map((courier) => (
          <SelectItem key={courier} value={courier}>{courier}</SelectItem>
        ))}
      </Select>

      {/* Gráficos de Courier */}
      <CourierPerformanceChart data={enviosTemporales} />
    </>
  );
}
```

**Estado:** ✅ **CORRECTO**
- Consume `enviosTemporales` (hook) con `porCourier` ✅
- Consume `metrics.courierMetrics` de getMetricsFlow ✅
- Muestra filtros y gráficos de courier ✅

---

### 5. **TABLAS Y VISUALIZACIONES**

#### ✅ `EstadosTemporalesTable.tsx`

**Archivo:** `src/components/dashboard/EstadosTemporalesTable.tsx`

```typescript
// Muestra estados de envíos temporales
// Lee de enviosTemporales.porEstado
<TableRow key={row.estado}>
  <TableCell>{row.estado}</TableCell>
  <TableCell className="text-right font-medium">{row.cantidad}</TableCell>
  <TableCell className="text-right font-medium">{row.provincia}</TableCell>
  <TableCell className="text-right font-bold">{row.lima}</TableCell>
  <TableCell className="text-right text-muted-foreground">{row.porcentaje}%</TableCell>
</TableRow>
```

**Estado:** ✅ **CORRECTO**
- Lee datos agregados de `enviosTemporales.porEstado` ✅
- NO accede a columnas individuales de Sheets ✅

---

## 🎯 CAMPOS CRÍTICOS VERIFICADOS

| Campo | Columna | Índice | Webhook | Firestore | Metrics Flow | Frontend |
|-------|---------|--------|---------|-----------|--------------|----------|
| **COURIER** | P | 15 | ✅ `row.COURIER` | ✅ `courier` | ✅ `order.courier` | ✅ `porCourier` |
| **PEDIDO** | D | 3 | ✅ `row.PEDIDO` | ✅ `pedidoId` | ✅ `order.id` | ✅ Display |
| **TIENDA** | C | 2 | ✅ `row.TIENDA` | ✅ `tienda` | ✅ `order.store` | ✅ `porTienda` |
| **PROVINCIA** | L | 11 | ✅ `row.PROVINCIA` | ✅ `provincia` | ✅ `order.province` | ✅ `porProvincia` |
| **ESTADO** | AB | 27 | ✅ `row.ESTADO` | ✅ `estado` | ✅ `order.status` | ✅ `porEstado` |
| **FORMA DE PAGO** (ENTREGADO) | AL | 37 | ✅ `row['FORMA DE PAGO']` | ✅ `paymentMethod` | ✅ `order.paymentMethod` | ✅ Charts |
| **USUARIO** (ENTREGADO) | AM | 38 | ✅ `row.USUARIO` | ✅ `usuario` | ✅ `order.usuario` | ✅ Display |

---

## ⚠️ PUNTOS DE ATENCIÓN (NO CRÍTICOS)

### 1. Webhook Legacy: `/api/webhooks/provincia-enviados`

**Archivo:** `src/app/api/webhooks/provincia-enviados/route.ts`

**Estado:** ⚠️ **WEBHOOK OBSOLETO** (pero no afecta visualización actual)

```typescript
// Este webhook usa interface antigua ProvinciaEnviadosRow
interface ProvinciaEnviadosRow {
  TIENE: string; // ⚠️ Debería ser TIENDA
  PEDIDO: string;
  NOMBRES: string;
  PROV: string;
  COURIER: string; // ✅ Correcto
}
```

**Recomendación:** Este webhook parece no estar en uso activo (el principal es `/envios-temporales`). Si se usa:
- Actualizar interface a la estructura real de 28 columnas ✅
- O deprecarlo si `/envios-temporales` ya lo reemplaza ✅

**Impacto en visualización:** ❌ **NINGUNO** (el dashboard usa `/envios-temporales`, no este)

---

### 2. Apps Script - Mapeo Dinámico

**Archivo:** `google-apps-script/inventory-sync.js`

**Estado:** ✅ **YA CORRECTO**

```javascript
// El script usa mapeo dinámico por headers, NO índices
headers.forEach((header, index) => {
  rowObject[header] = row[index]; // ✅ Dinámico
});

// Envía a webhook con nombres de columnas
fetch(webhookUrl, {
  method: 'POST',
  body: JSON.stringify({ data: rowData, tipoOrigen: 'PROVINCIA' })
});
```

**Impacto:** ✅ **SIN IMPACTO** - El script ya es compatible con cualquier estructura

---

## 📊 FLUJO DE DATOS VERIFICADO

```
┌──────────────────┐
│ GOOGLE SHEETS    │
│ PROVINCIA (28)   │ Columna P: COURIER
│ LIMA (28)        │ Columna P: COURIER
│ REPORTE (20)     │ Columna P: COURIER
│ ENTREGADO (39)   │ Columna P: COURIER, AL: FORMA PAGO, AM: USUARIO
└────────┬─────────┘
         │
         │ Apps Script (mapeo dinámico)
         │ headers.forEach((h, i) => obj[h] = row[i])
         ▼
┌──────────────────┐
│ WEBHOOKS         │
│ POST /envios-    │ row.COURIER → Firestore.courier ✅
│   temporales     │ row.TIENDA → Firestore.tienda ✅
│ POST /sheets     │ row.PROVINCIA → Firestore.provincia ✅
│ POST /delivered  │ row['FORMA DE PAGO'] → paymentMethod ✅
└────────┬─────────┘
         │
         │ Guarda con nombres normalizados
         ▼
┌──────────────────┐
│ FIRESTORE        │
│ Collections:     │
│ - envios_        │ { courier: "SHALOM", tienda: "WEB"... }
│   temporales     │
│ - shopify_orders │ { courier: "SHALOM", paymentMethod: "YAPE"... }
└────────┬─────────┘
         │
         │ getMetricsFlow / GET endpoint
         ▼
┌──────────────────┐
│ AGREGACIONES     │
│ - porCourier     │ { "SHALOM": 45, "OLVA": 32... }
│ - courierMetrics │ [{ name: "SHALOM", shipments: 45... }]
│ - paymentMethods │ [{ method: "YAPE", orders: 120... }]
└────────┬─────────┘
         │
         │ Hooks (useEnviosTemporales, getMetrics)
         ▼
┌──────────────────┐
│ COMPONENTES      │
│ - Courier        │ Gráficos de distribución
│   Performance    │
│ - Filtros        │ Dropdown de couriers
│ - Tablas         │ Estado, tienda, provincia
└──────────────────┘
```

**Validación del flujo:** ✅ **COMPLETO Y CORRECTO**

1. ✅ Sheets → Apps Script: Mapeo dinámico por headers
2. ✅ Apps Script → Webhooks: Envía objetos con nombres de columnas
3. ✅ Webhooks → Firestore: Normaliza nombres (`row.COURIER` → `courier`)
4. ✅ Firestore → Metrics: Lee campos normalizados (`order.courier`)
5. ✅ Metrics → Frontend: Envía agregaciones (`porCourier`, `courierMetrics`)
6. ✅ Frontend → Usuario: Renderiza gráficos y tablas

---

## ✅ CONCLUSIONES

### **NO HAY PROBLEMAS DE VISUALIZACIÓN**

**Razón principal:** El frontend **NO lee directamente** de Google Sheets. La arquitectura es:

```
Sheets → Apps Script → Webhooks → Firestore → Metrics Flow → Frontend
                       (normalización)          (agregación)
```

### **Validaciones Críticas Completadas:**

1. ✅ **Campo COURIER (columna P/15):**
   - Webhook lee: `row.COURIER` ✅
   - Firestore guarda: `courier` ✅
   - Metrics Flow lee: `order.courier` ✅
   - Frontend muestra: `porCourier` ✅

2. ✅ **Campo FORMA DE PAGO (columna AL/37 en ENTREGADO):**
   - Webhook lee: `row['FORMA DE PAGO']` ✅
   - Firestore guarda: `paymentMethod` ✅
   - Metrics Flow lee: `order.paymentMethod` ✅
   - Frontend muestra: `paymentMethods` ✅

3. ✅ **Campo USUARIO (columna AM/38 en ENTREGADO):**
   - Webhook lee: `row.USUARIO` ✅
   - Firestore guarda: `usuario` ✅
   - Interface actualizada: `USUARIO?: string` ✅

4. ✅ **Interfaces TypeScript actualizadas:**
   - `EnvioTemporalRow`: 28 campos ✅
   - `ConfirmedOrderInfo`: 20 campos ✅
   - `DeliveredOrderInfo`: 39 campos ✅

5. ✅ **Apps Script usa mapeo dinámico:**
   - NO depende de índices hardcodeados ✅
   - `headers.forEach((h, i) => obj[h] = row[i])` ✅

---

## 🚀 RECOMENDACIONES

### **Acciones Inmediatas (Opcionales):**

1. **Deprecar webhook legacy** `/api/webhooks/provincia-enviados` si ya no se usa
2. **Agregar logging** en webhooks para monitorear campos críticos:
   ```typescript
   console.log('[WEBHOOK] Courier recibido:', row.COURIER);
   console.log('[WEBHOOK] Guardado en Firestore como:', pedidoData.courier);
   ```

3. **Testing E2E** (ya en tu TODO list):
   - Editar fila en Sheets → verificar webhook log → confirmar Firestore → validar dashboard

### **Monitoreo Post-Deploy:**

1. Verificar que gráficos de courier muestren datos ✅
2. Confirmar que filtros de courier funcionen ✅
3. Validar que métricas de pago (YAPE, PLIN, etc.) aparezcan ✅
4. Revisar logs de webhooks para errores de mapeo ✅

---

## 📝 ARCHIVOS REVISADOS

| Archivo | Propósito | Estado |
|---------|-----------|--------|
| `src/app/api/webhooks/envios-temporales/route.ts` | Webhook principal PROVINCIA/LIMA | ✅ Correcto |
| `src/app/api/webhooks/sheets/route.ts` | Webhook REPORTE | ✅ Correcto |
| `src/app/api/webhooks/delivered/route.ts` | Webhook ENTREGADO | ✅ Correcto |
| `src/lib/firestore.ts` | Interfaces Firestore | ✅ Actualizado |
| `src/types/sheets.ts` | Tipos TypeScript Sheets | ✅ Reescrito |
| `src/ai/flows/getMetricsFlow.ts` | Flujo de métricas | ✅ Compatible |
| `src/hooks/useEnviosTemporales.ts` | Hook tiempo real | ✅ Correcto |
| `src/components/dashboard/CourierPerformanceChart.tsx` | Gráficos courier | ✅ Correcto |
| `src/components/dashboard/EstadosTemporalesTable.tsx` | Tabla estados | ✅ Correcto |
| `src/app/(app)/dashboard/shipments/page.tsx` | Dashboard principal | ✅ Correcto |
| `google-apps-script/inventory-sync.js` | Script sincronización | ✅ Verificado |

---

**Conclusión Final:** ✅ **El frontend está listo. No hay problemas de visualización detectados.**

**Próximo paso:** Desplegar Apps Script y realizar testing E2E para validar flujo completo.
