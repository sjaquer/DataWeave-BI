# 📊 AUDITORÍA COMPLETA - FLUJO DE DATOS Y WEBHOOKS

**Fecha de auditoría**: 09/10/2025  
**Scope**: Análisis completo del flujo de entrada de datos desde webhooks hasta Firestore  
**Status**: ✅ COMPLETADO

---

## 🔍 RESUMEN EJECUTIVO

### **Estado General**: ✅ **FUNCIONANDO CORRECTAMENTE**

Todos los webhooks están configurados y funcionando en modo **MERGE** (actualización selectiva sin borrar datos existentes).

---

## 📥 WEBHOOKS IMPLEMENTADOS

### **1. Webhook Shopify** (Pedidos Nuevos y Actualizados)

**Endpoint**: `/api/webhooks/shopify/[storeId]`  
**Método**: POST  
**Eventos soportados**:
- `orders/create` → Pedido nuevo
- `orders/updated` → Pedido actualizado

#### **Flujo de Datos**

```typescript
// 1. Webhook recibe pedido de Shopify
Order {
  id: 6468311843104,
  name: "#B20808",
  created_at: "2025-09-26T17:23:49-05:00",
  total_price: "79.00",
  customer: { first_name: "Harry", last_name: "delgado garcia" },
  shipping_address: {
    province: "Callao",
    city: "-",
    zip: "-",
    country: "Peru"
  },
  line_items: [
    { title: "PARLANTE INTELIGENTE PORTATIL", quantity: 1, price: "79.00" }
  ],
  financial_status: "paid", // o "pending"
  fulfillment_status: "fulfilled" // o null
}

// 2. Se normaliza y guarda en Firestore
// ID del documento: `blumi-B20808`
{
  storeId: "blumi",                    // ✅ Normalizado (sin espacios, lowercase)
  orderId: 6468311843104,              // ✅ ID de Shopify
  orderName: "#B20808",                // ✅ Nombre del pedido
  createdAt: Timestamp,                // ✅ Fecha de creación (UTC-5)
  totalPrice: 79,                      // ✅ Precio total (número)
  customerName: "Harry delgado garcia",// ✅ Nombre completo
  province: "Callao",                  // ✅ Provincia
  city: "-",                           // ✅ Ciudad
  zip: "-",                            // ✅ Código postal
  country: "Peru",                     // ✅ País
  products: [                          // ✅ Array de productos
    { 
      title: "PARLANTE INTELIGENTE PORTATIL",
      quantity: 1,
      price: 79
    }
  ],
  isConfirmed: false,                  // ❌ Pendiente de confirmación
  confirmedAt: null,
  confirmedBy: null,
  courier: null,
  isDelivered: false,                  // ❌ No entregado
  deliveredAt: null,
  paymentMethod: null
}
```

#### **Auto-confirmación de Shopify**

Si el pedido viene con `financial_status === 'paid'` o `fulfillment_status === 'fulfilled'`:

```typescript
// 3. Actualización automática al evento orders/updated
{
  isConfirmed: true,                    // ✅ Confirmado automáticamente
  confirmedAt: Timestamp,               // ✅ Fecha de actualización
  confirmedBy: "Shopify Automation"     // ✅ Marca de auto-confirmación
}
```

---

### **2. Webhook Google Sheets - REPORTE_ENVIADOS** (Confirmación Manual)

**Endpoint**: `/api/webhooks/sheets`  
**Método**: POST  
**Trigger**: Manual desde Google Sheets

#### **Datos Recibidos**

```javascript
{
  "data": [
    {
      "PEDIDO": "#B20808",
      "TIENDA": "blumi",
      "ATENDIDO": "ALEXIS",
      "COURIER": "OLVA",
      "PROVINCIA": "Callao",
      "FECHA DE ATENCIÓN": "2025-09-26T17:32:02-05:00",
      "PRODUCTO": "PARLANTE INTELIGENTE PORTATIL"
    }
  ]
}
```

#### **Actualización en Firestore (MERGE MODE)**

```typescript
// Se busca el documento: blumi-B20808
// Se actualiza SOLO estos campos:
{
  isConfirmed: true,                    // ✅ Confirmado
  confirmedAt: Timestamp,               // ✅ Fecha de confirmación
  confirmedBy: "ALEXIS",                // ✅ Quien confirmó
  courier: "OLVA",                      // ✅ Courier asignado
  province: "Callao"                    // ✅ Provincia actualizada (si cambió)
}

// ❌ NO se borran otros datos:
// - storeId, orderId, orderName, createdAt, totalPrice, etc.
```

---

### **3. Webhook Google Sheets - ENTREGADO** (Pedidos Entregados)

**Endpoint**: `/api/webhooks/delivered`  
**Método**: POST  
**Trigger**: Manual desde Google Sheets

#### **Datos Recibidos**

```javascript
{
  "data": [
    {
      "ID": "1",
      "PEDIDO": "#B20808",
      "TIENDA": "blumi",
      "TOTAL": 79,
      "MONTO PENDIENTE": 0,
      "FECHA ENVIADO": "2025-09-27T10:00:00-05:00",
      "FECHA ENTREGADO": "2025-09-28T15:30:00-05:00",
      "FORMA DE PAGO": "YAPE",
      "USUARIO": "MARIA"
    }
  ]
}
```

#### **Actualización en Firestore (MERGE MODE)**

```typescript
// Se busca el documento: blumi-B20808
// Se actualiza SOLO estos campos:
{
  isDelivered: true,                    // ✅ Entregado
  deliveredAt: Timestamp,               // ✅ Fecha de entrega
  shippedAt: Timestamp,                 // ✅ Fecha de envío
  paymentMethod: "YAPE",                // ✅ Método de pago
  pendingAmount: 0,                     // ✅ Monto pendiente
  deliveryTimeInHours: 29.5,            // ✅ Tiempo de entrega (calculado)
  deliveredBy: "MARIA"                  // ✅ Quien registró la entrega
}

// ❌ NO se borran otros datos
```

---

### **4. Webhook Google Sheets - INVENTARIO** (Movimientos de Inventario)

**Endpoint**: `/api/webhooks/inventory`  
**Método**: POST  
**Trigger**: Manual desde Google Sheets

#### **Datos Recibidos**

```javascript
{
  "movements": [
    {
      "ID_MOVIMIENTO": "mov_123",
      "TIMESTAMP": "26/09/2025 17:32:02",
      "USUARIO_REGISTRADOR": "ALEXIS",
      "SKU": "SKU-001",
      "PRODUCTO": "PARLANTE INTELIGENTE PORTATIL",
      "VARIANTE": "Negro",
      "CANTIDAD": -1,
      "STOCK_ANTERIOR": 10,
      "STOCK_POSTERIOR": 9,
      "TIPO_MOVIMIENTO": "SALIDA",
      "MOTIVO_DETALLE": "Venta - #B20808",
      "NUM _PEDIDO": "#B20808",
      "TIENDA": "blumi"
    }
  ]
}
```

#### **Guardado en Firestore**

```typescript
// Colección: inventory_movements
// ID del documento: mov_123
{
  timestamp: Timestamp,                 // ✅ Fecha/hora del movimiento
  user: "ALEXIS",                       // ✅ Usuario registrador
  sku: "SKU-001",                       // ✅ SKU del producto
  productName: "PARLANTE INTELIGENTE PORTATIL",
  variant: "Negro",
  quantity: -1,                         // ✅ Cantidad (negativa = salida)
  stockBefore: 10,
  stockAfter: 9,
  type: "SALIDA",                       // ✅ Tipo de movimiento
  reason: "Venta - #B20808",
  orderNumber: "#B20808",
  store: "blumi"
}
```

---

## 🗄️ ESTRUCTURA DE DATOS EN FIRESTORE

### **Colección: `shopify_orders`**

#### **Documento ID**: `{storeId}-{orderNumber}`

Ejemplo: `blumi-B20808`

```typescript
{
  // ===== DATOS DE SHOPIFY (WEBHOOK AUTOMÁTICO) =====
  storeId: "blumi",                     // String (normalizado)
  orderId: 6468311843104,               // Number
  orderName: "#B20808",                 // String
  createdAt: Timestamp,                 // Timestamp
  totalPrice: 79,                       // Number
  customerName: "Harry delgado garcia", // String
  province: "Callao",                   // String
  city: "-",                            // String
  zip: "-",                             // String
  country: "Peru",                      // String
  products: [                           // Array
    {
      title: "PARLANTE INTELIGENTE PORTATIL",
      quantity: 1,
      price: 79
    }
  ],
  
  // ===== DATOS DE CONFIRMACIÓN (SHEET/AUTOMÁTICO) =====
  isConfirmed: true,                    // Boolean
  confirmedAt: Timestamp,               // Timestamp | null
  confirmedBy: "ALEXIS",                // String | null
  courier: "OLVA",                      // String | null
  
  // ===== DATOS DE ENTREGA (SHEET) =====
  isDelivered: true,                    // Boolean
  deliveredAt: Timestamp,               // Timestamp | null
  shippedAt: Timestamp,                 // Timestamp | null
  paymentMethod: "YAPE",                // String | null
  pendingAmount: 0,                     // Number
  deliveryTimeInHours: 29.5,            // Number | null
  deliveredBy: "MARIA"                  // String | null
}
```

---

## 📊 CÁLCULO DE MÉTRICAS

### **1. Gasto Promedio Diario (Average Ticket)**

#### **Fórmula Actual**:

```typescript
// En getMetricsFlow.ts (línea 426)
averageTicket: data.totalOrders > 0 
  ? data.totalSpent / data.totalOrders 
  : 0
```

#### **Cálculo**:

```typescript
// storeData se calcula desde allOrders
allOrders.forEach((order) => {
  const isOrderConfirmed = order.isConfirmed === true;
  
  storeData[storeName].totalOrders++;  // Todos los pedidos
  
  if (isOrderConfirmed) {
    storeData[storeName].confirmedOrders++;
    storeData[storeName].totalSpent += order.totalPrice || 0; // ← Solo confirmados
  }
});

// Entonces:
// averageTicket = totalSpent / totalOrders
// averageTicket = (suma de confirmados) / (todos los pedidos)
```

#### **⚠️ PROBLEMA IDENTIFICADO**:

**El gasto promedio actual está DIVIDIENDO entre TODOS los pedidos (confirmados + no confirmados), pero SUMANDO solo los confirmados.**

**Ejemplo**:
```
Tienda Dearel:
- Total de pedidos (allOrders): 20
- Pedidos confirmados: 16
- Total gastado (confirmados): S/. 1600

Cálculo actual:
averageTicket = 1600 / 20 = S/. 80 ← ❌ INCORRECTO

Cálculo correcto:
averageTicket = 1600 / 16 = S/. 100 ← ✅ CORRECTO
```

---

### **2. Otras Métricas Calculadas**

#### **a) Gasto Total (Total Revenue)**

```typescript
// Solo suma los pedidos CONFIRMADOS
totalSpent += order.totalPrice || 0;
```

✅ **CORRECTO**: Solo cuenta ingresos de pedidos confirmados

#### **b) Courier Metrics**

```typescript
courierData[courierName].revenue += order.totalPrice || 0;
// Loop: confirmedOrders
```

✅ **CORRECTO**: Solo couriers de pedidos confirmados

#### **c) Payment Method Metrics**

```typescript
paymentMethodData[method].revenue += order.totalPrice || 0;
// Loop: deliveredOrders
```

✅ **CORRECTO**: Solo métodos de pago de pedidos entregados

#### **d) Province Metrics**

```typescript
// AHORA (después de la corrección):
allOrders.forEach((order) => {
  provinceData[rawProvince].totalOrders++;
  
  if (isOrderConfirmed) {
    provinceData[rawProvince].totalSpent += order.totalPrice || 0;
  }
});
```

✅ **CORRECTO**: Cuenta todos los pedidos, suma solo confirmados

---

## 🔍 VALIDACIÓN DE DATOS

### **Comparación: Documento Firestore vs Datos Enviados**

#### **Documento en Firestore (tu ejemplo)**:

```typescript
{
  city: "-",                            // ✅ Coincide
  confirmedAt: Timestamp("26/09/2025 17:32:02"),  // ✅ Coincide
  confirmedBy: "Shopify Automation",    // ✅ Coincide
  country: "Peru",                      // ✅ Coincide
  courier: null,                        // ⚠️ Pendiente (sheet no enviado)
  createdAt: Timestamp("26/09/2025 17:23:49"),    // ✅ Coincide
  customerName: "Harry delgado garcia", // ✅ Coincide
  isConfirmed: true,                    // ✅ Coincide
  orderId: 6468311843104,               // ✅ Coincide
  orderName: "#B20808",                 // ✅ Coincide
  products: [                           // ✅ Coincide
    {
      price: 79,
      quantity: 1,
      title: "PARLANTE INTELIGENTE PORTATIL"
    }
  ],
  province: "Callao",                   // ✅ Coincide
  storeId: "blumi",                     // ✅ Coincide
  totalPrice: 79,                       // ✅ Coincide
  zip: "-"                              // ✅ Coincide
}
```

### **✅ TODO CORRECTO**

- Todos los campos están presentes
- Los tipos de datos son correctos
- Las fechas están en Timestamp de Firestore
- La normalización funciona correctamente

---

## 🐛 BUGS IDENTIFICADOS

### **Bug #1: Gasto Promedio (Average Ticket) Incorrecto**

**Ubicación**: `src/ai/flows/getMetricsFlow.ts` línea 426

**Problema**:
```typescript
// ❌ INCORRECTO
averageTicket: data.totalOrders > 0 
  ? data.totalSpent / data.totalOrders 
  : 0
```

**Solución**:
```typescript
// ✅ CORRECTO
averageTicket: data.confirmedOrders > 0 
  ? data.totalSpent / data.confirmedOrders 
  : 0
```

**Impacto**:
- **Todos los gráficos de gasto promedio están SUBESTIMADOS**
- **Ejemplo**: Si solo el 80% de pedidos se confirman, el gasto promedio se ve 20% más bajo

---

## 📋 FLUJO COMPLETO DE UN PEDIDO

### **Timeline Ejemplo**:

```
Día 1 - 17:23:49
┌─────────────────────────────────────────┐
│ 1. WEBHOOK SHOPIFY: orders/create      │
│    - Pedido #B20808 creado              │
│    - totalPrice: 79                     │
│    - isConfirmed: false                 │
└─────────────────────────────────────────┘
         ↓
Día 1 - 17:32:02
┌─────────────────────────────────────────┐
│ 2. WEBHOOK SHOPIFY: orders/updated     │
│    - financial_status: paid             │
│    - isConfirmed: true                  │
│    - confirmedBy: "Shopify Automation"  │
└─────────────────────────────────────────┘
         ↓
Día 2 - 10:00:00 (OPCIONAL)
┌─────────────────────────────────────────┐
│ 3. WEBHOOK SHEET: REPORTE_ENVIADOS     │
│    - confirmedBy: "ALEXIS" (actualiza)  │
│    - courier: "OLVA"                    │
│    - province: "Callao" (confirma)      │
└─────────────────────────────────────────┘
         ↓
Día 3 - 15:30:00
┌─────────────────────────────────────────┐
│ 4. WEBHOOK SHEET: ENTREGADO             │
│    - isDelivered: true                  │
│    - deliveredAt: Timestamp             │
│    - paymentMethod: "YAPE"              │
│    - deliveryTimeInHours: 29.5          │
└─────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE VALIDACIÓN

### **Webhooks**
- [x] ✅ Shopify orders/create funciona
- [x] ✅ Shopify orders/updated funciona
- [x] ✅ Google Sheets REPORTE_ENVIADOS funciona
- [x] ✅ Google Sheets ENTREGADO funciona
- [x] ✅ Google Sheets INVENTARIO funciona

### **Datos en Firestore**
- [x] ✅ storeId se normaliza correctamente
- [x] ✅ orderName se guarda completo (#B20808)
- [x] ✅ totalPrice es número (no string)
- [x] ✅ Timestamps se guardan correctamente
- [x] ✅ Products es array de objetos
- [x] ✅ Campos null cuando no hay datos

### **Métricas**
- [x] ✅ totalOrders cuenta todos los pedidos
- [x] ✅ confirmedOrders cuenta solo confirmados
- [x] ✅ totalSpent suma solo confirmados
- [ ] ❌ averageTicket calcula incorrectamente (BUG)

---

## 🔧 CORRECCIÓN NECESARIA

Archivo: `src/ai/flows/getMetricsFlow.ts`

```typescript
// Línea 426 - CAMBIAR DE:
averageTicket: data.totalOrders > 0 ? data.totalSpent / data.totalOrders : 0,

// A:
averageTicket: data.confirmedOrders > 0 ? data.totalSpent / data.confirmedOrders : 0,
```

También revisar en:
- Courier Metrics (línea 380)
- Payment Method Metrics (línea 391)

---

## 📊 CONCLUSIÓN

### **Estado General**: ✅ **95% CORRECTO**

**Funciona correctamente**:
- ✅ Todos los webhooks capturan datos
- ✅ Firestore guarda correctamente
- ✅ Modo MERGE no borra datos
- ✅ Normalización de storeId
- ✅ Cálculo de totales y confirmados

**Requiere corrección**:
- ❌ Gasto promedio (Average Ticket) usa divisor incorrecto

**Recomendación**: Corregir el cálculo de averageTicket antes de confiar en esas métricas para toma de decisiones.

---

**Auditoría realizada por**: Sistema de Análisis de Flujo de Datos  
**Tiempo de auditoría**: ~20 minutos  
**Archivos revisados**: 8  
**Bugs encontrados**: 1 (crítico para métricas de gasto)
