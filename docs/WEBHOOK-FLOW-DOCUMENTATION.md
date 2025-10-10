# 📋 Documentación del Flujo de Webhooks - DataWeave BI

## 🎯 Arquitectura de Fuentes de Datos

### 1️⃣ Shopify Webhook → Pedidos Base
**Endpoint**: `/api/webhooks/shopify/{storeId}`
**Propósito**: Crear pedidos iniciales con información del cliente

**Datos capturados**:
- `orderName`: Nombre del pedido (#12345, N-10966, etc.)
- `storeId`: Tienda origen (blumi, novi, dearel, cumbre, trazto)
- `customerName`: Nombre completo del cliente
- `province`, `city`, `zip`, `country`: Dirección del cliente
- `products`: Array de productos con `{ title, quantity, price }`
- `totalPrice`: Precio total del pedido
- `createdAt`: Fecha de creación
- `isConfirmed`: `false` (inicial)
- `isDelivered`: `false` (inicial)

**ID del Documento Generado**:
```
{normalizedStoreId}-{orderNumber}
Ejemplo: "blumi-13674", "novi-10966", "dearel-42932"
```

---

### 2️⃣ Google Sheets "REPORTE_ENVIADOS" → Confirmaciones + Courier
**Endpoint**: `/api/webhooks/sheets`
**Propósito**: Actualizar pedidos confirmados y agregar información del courier

**Columnas del Sheet**:
| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `PEDIDO` | Nombre del pedido | #42932, N-10971, #B16548 |
| `TIENDA` | Nombre de la tienda | Dearel, Blumi Perú, Novi Perú, Cumbre |
| `COURIER` | Empresa de transporte | SHALOM, LIMA, OLVA, CLOCK |
| `ATENDIDO` | Quien atendió | ERIKA, WENDY, MARITE, etc. |
| `PROVINCIA` | Provincia destino | Lima, Junín, Cajamarca, etc. |
| `FECHA DE ATENCIÓN` | Fecha confirmación | 2/4/2025 17:05:00 |
| `PRODUCTO` | Productos separados por + | 1x LLAVE PARA GATO |

**Datos actualizados en Firestore**:
```typescript
{
  isConfirmed: true,
  confirmedAt: Timestamp,
  confirmedBy: "ERIKA",
  courier: "SHALOM",  // ← Campo clave para métricas
  province: "Lima" // Solo si no existe
}
```

**Lógica de Merge**: Usa `{merge: true}` para **preservar** todos los datos de Shopify.

**ID del Documento usado**:
```
getShopifyOrderDocId(PEDIDO, TIENDA)
→ normaliza TIENDA a lowercase sin espacios
→ extrae número del PEDIDO
→ resultado: "blumi-13674", "novi-10971"
```

---

### 3️⃣ Google Sheets "ENTREGADO" → Estado de Entrega
**Endpoint**: `/api/webhooks/delivered`
**Propósito**: Actualizar estado de entrega y método de pago

**Columnas del Sheet**:
| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| `ID` | Número de fila | 12702460 |
| `PEDIDO` | Nombre del pedido | N-12163, #49208 |
| `TIENDA` | Nombre de la tienda | Novi Perú, Dearel, Blumi Perú |
| `TOTAL` | Monto total | 59, 89, 159 |
| `MONTO PENDIENTE` | Monto pendiente | 39, 69, 0 |
| `FECHA ENVIADO` | Fecha de envío | 8/7/2025 21:24:00 |
| `FECHA ENTREGADO` | Fecha de entrega | 08/08/2025 15:10:27 |
| `FORMA DE PAGO` | Método de pago | YAPE, PLIN, AGENTE BOP |
| `USUARIO` | Quien registró | ALEXIS, MARITE, FIORELLA |

**Datos actualizados en Firestore**:
```typescript
{
  isDelivered: true,
  deliveredAt: Timestamp,
  shippedAt: Timestamp,
  paymentMethod: "YAPE", // ← Directo del sheet
  pendingAmount: 39,
  deliveryTimeInHours: 17.8, // Calculado
  deliveredBy: "ALEXIS"
}
```

**Cálculo de Tiempo de Entrega**:
```typescript
deliveryTimeInHours = (FECHA ENTREGADO - FECHA ENVIADO) / 3600000
```

**Lógica de Merge**: Usa `{merge: true}` para **preservar** datos de Shopify y REPORTE_ENVIADOS.

---

## 🔑 Normalización de IDs

### Función: `getShopifyOrderDocId(orderName, storeId)`

**Entrada**:
- `orderName`: "#42932", "N-10971", "#B16548"
- `storeId`: "Blumi Perú", "Novi Perú", "Dearel"

**Proceso**:
1. **Normalizar `orderName`**:
   - Extraer solo el número: `#42932` → `42932`
   - Mantener guiones: `N-10971` → `10971` (el N se elimina)
   - Pattern: `/[0-9]+(-[0-9]+)*$/`

2. **Normalizar `storeId`**:
   - Convertir a lowercase: `"Blumi Perú"` → `"blumi perú"`
   - Eliminar "Perú"/"Peru": `"blumi perú"` → `"blumi "`
   - Reemplazar espacios con `-`: `"blumi "` → `"blumi-"`
   - Colapsar múltiples `-`: `"blumi-"` → `"blumi"`
   - Eliminar `-` al inicio/final: `"blumi"` → `"blumi"`

3. **Generar ID**:
   ```
   `${normalizedStoreId}-${normalizedOrderNumber}`
   ```

**Salida**:
- `"blumi-42932"`
- `"novi-10971"`
- `"dearel-45044"`

---

## 📊 Estructura Final de Documento en Firestore

```typescript
// Collection: shopify_orders
// Document ID: "blumi-13674"
{
  // ✅ De Shopify Webhook
  orderName: "#13674",
  storeId: "blumi",
  customerName: "Juan Pérez López",
  province: "Lima",
  city: "Lima",
  zip: "15001",
  country: "Peru",
  products: [
    { title: "LLAVE PARA GATO", quantity: 1, price: 79.90 }
  ],
  totalPrice: 79.90,
  createdAt: Timestamp(2025-06-20T12:00:00Z),
  
  // ✅ De REPORTE_ENVIADOS
  isConfirmed: true,
  confirmedAt: Timestamp(2025-06-20T15:30:00Z),
  confirmedBy: "ERIKA",
  courier: "SHALOM", // ← Para métricas de couriers
  
  // ✅ De ENTREGADO
  isDelivered: true,
  deliveredAt: Timestamp(2025-08-08T15:10:27Z),
  shippedAt: Timestamp(2025-08-07T21:24:00Z),
  paymentMethod: "YAPE",
  pendingAmount: 0,
  deliveryTimeInHours: 17.8,
  deliveredBy: "ALEXIS"
}
```

---

## 🔄 Orden de Ejecución Recomendado

1. **Shopify Webhook** (automático cuando se crea pedido)
   - Crea documento base
   
2. **REPORTE_ENVIADOS** (manual o automático cada hora)
   - Actualiza confirmación + courier
   
3. **ENTREGADO** (manual o automático cada hora)
   - Actualiza entrega + método de pago

---

## ⚙️ Apps Script - Configuración

**Archivo**: `google-apps-script/inventory-sync.js`

**Triggers**:
```javascript
// Automático cada 1 hora
ScriptApp.newTrigger('triggerShippedSync')
  .timeBased()
  .everyHours(1)
  .create();

ScriptApp.newTrigger('triggerDeliveredSync')
  .timeBased()
  .everyHours(1)
  .create();
```

**Menú Manual**:
```
Sincronización DataWeave
├── 1. Sincronizar REPORTE ENVIADOS
├── 2. Sincronizar ENTREGADO
├── ──────────────────────────────
├── 3. Activar Sincronización Automática
└── 4. Desactivar Sincronización Automática
```

---

## 🚨 Validaciones Importantes

### ✅ Validación de PEDIDO y TIENDA
Ambos webhooks requieren:
```typescript
if (!rawOrderName || !storeId) {
  console.warn('Item ignorado por falta de PEDIDO o TIENDA');
  continue;
}
```

### ✅ Merge Mode
**SIEMPRE** usar `{merge: true}`:
```typescript
batch.set(orderDocRef, data, { merge: true });
```

Esto garantiza que:
- ✅ Datos de Shopify NO se sobrescriban
- ✅ Datos previos se preserven
- ✅ Solo se actualicen campos específicos

---

## 📈 Métricas Generadas

### Courier Metrics
```typescript
courierMetrics: [
  {
    name: "SHALOM",
    totalShipments: 57,
    totalRevenue: 4521.30,
    averageOrderValue: 79.32,
    provinceCount: 15,
    percentageOfTotal: 57.0
  }
]
```

### Payment Methods
```typescript
// Extraído de ENTREGADO
paymentMethods: ["YAPE", "PLIN", "AGENTE BOP", "Adelantado", "Contra Entrega"]
```

---

## 🔧 Troubleshooting

### Problema: Couriers no aparecen
**Causa**: Caché del navegador  
**Solución**: Botón "Limpiar Caché" en `/dashboard/shipments`

### Problema: IDs con doble guion
**Causa**: Normalización incorrecta  
**Solución**: Script de migración ejecutado ✅

### Problema: Datos de Shopify sobrescritos
**Causa**: No usar `{merge: true}`  
**Solución**: Corregido en `updateConfirmedOrders` ✅

---

## ✅ Estado Actual

- ✅ Normalización de IDs corregida
- ✅ Merge mode implementado
- ✅ Courier metrics agregado
- ✅ Payment method del sheet
- ✅ Delivery user tracking
- ✅ Migración de 1,002 documentos ejecutada

**Última actualización**: 8 de octubre de 2025
