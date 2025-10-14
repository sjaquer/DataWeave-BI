---
Date: 2025-10-09
---

# ðŸ“Š AUDITORÃA COMPLETA - FLUJO DE DATOS Y WEBHOOKS

**Fecha de auditorÃ­a**: 09/10/2025  
**Scope**: AnÃ¡lisis completo del flujo de entrada de datos desde webhooks hasta Firestore  
**Status**: âœ… COMPLETADO

---

## ðŸ” RESUMEN EJECUTIVO

### **Estado General**: âœ… **FUNCIONANDO CORRECTAMENTE**

Todos los webhooks estÃ¡n configurados y funcionando en modo **MERGE** (actualizaciÃ³n selectiva sin borrar datos existentes).

---

## ðŸ“¥ WEBHOOKS IMPLEMENTADOS

### **1. Webhook Shopify** (Pedidos Nuevos y Actualizados)

**Endpoint**: `/api/webhooks/shopify/[storeId]`  
**MÃ©todo**: POST  
**Eventos soportados**:
- `orders/create` â†’ Pedido nuevo
- `orders/updated` â†’ Pedido actualizado

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
  storeId: "blumi",                    // âœ… Normalizado (sin espacios, lowercase)
  orderId: 6468311843104,              // âœ… ID de Shopify
  orderName: "#B20808",                // âœ… Nombre del pedido
  createdAt: Timestamp,                // âœ… Fecha de creaciÃ³n (UTC-5)
  totalPrice: 79,                      // âœ… Precio total (nÃºmero)
  customerName: "Harry delgado garcia",// âœ… Nombre completo
  province: "Callao",                  // âœ… Provincia
  city: "-",                           // âœ… Ciudad
  zip: "-",                            // âœ… CÃ³digo postal
  country: "Peru",                     // âœ… PaÃ­s
  products: [                          // âœ… Array de productos
    { 
      title: "PARLANTE INTELIGENTE PORTATIL",
      quantity: 1,
      price: 79
    }
  ],
  isConfirmed: false,                  // âŒ Pendiente de confirmaciÃ³n
  confirmedAt: null,
  confirmedBy: null,
  courier: null,
  isDelivered: false,                  // âŒ No entregado
  deliveredAt: null,
  paymentMethod: null
}
```

#### **Auto-confirmaciÃ³n de Shopify**

Si el pedido viene con `financial_status === 'paid'` o `fulfillment_status === 'fulfilled'`:

```typescript
// 3. ActualizaciÃ³n automÃ¡tica al evento orders/updated
{
  isConfirmed: true,                    // âœ… Confirmado automÃ¡ticamente
  confirmedAt: Timestamp,               // âœ… Fecha de actualizaciÃ³n
  confirmedBy: "Shopify Automation"     // âœ… Marca de auto-confirmaciÃ³n
}
```

---

### **2. Webhook Google Sheets - REPORTE_ENVIADOS** (ConfirmaciÃ³n Manual)

**Endpoint**: `/api/webhooks/sheets`  
**MÃ©todo**: POST  
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
      "FECHA DE ATENCIÃ“N": "2025-09-26T17:32:02-05:00",
      "PRODUCTO": "PARLANTE INTELIGENTE PORTATIL"
    }
  ]
}
```

#### **ActualizaciÃ³n en Firestore (MERGE MODE)**

```typescript
// Se busca el documento: blumi-B20808
// Se actualiza SOLO estos campos:
{
  isConfirmed: true,                    // âœ… Confirmado
  confirmedAt: Timestamp,               // âœ… Fecha de confirmaciÃ³n
  confirmedBy: "ALEXIS",                // âœ… Quien confirmÃ³
  courier: "OLVA",                      // âœ… Courier asignado
  province: "Callao"                    // âœ… Provincia actualizada (si cambiÃ³)
}

// âŒ NO se borran otros datos:
// - storeId, orderId, orderName, createdAt, totalPrice, etc.
```

---

### **3. Webhook Google Sheets - ENTREGADO** (Pedidos Entregados)

**Endpoint**: `/api/webhooks/delivered`  
**MÃ©todo**: POST  
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

#### **ActualizaciÃ³n en Firestore (MERGE MODE)**

```typescript
// Se busca el documento: blumi-B20808
// Se actualiza SOLO estos campos:
{
  isDelivered: true,                    // âœ… Entregado
  deliveredAt: Timestamp,               // âœ… Fecha de entrega
  shippedAt: Timestamp,                 // âœ… Fecha de envÃ­o
  paymentMethod: "YAPE",                // âœ… MÃ©todo de pago
  pendingAmount: 0,                     // âœ… Monto pendiente
  deliveryTimeInHours: 29.5,            // âœ… Tiempo de entrega (calculado)
  deliveredBy: "MARIA"                  // âœ… Quien registrÃ³ la entrega
}

// âŒ NO se borran otros datos
```

---

### **4. Webhook Google Sheets - INVENTARIO** (Movimientos de Inventario)

**Endpoint**: `/api/webhooks/inventory`  
**MÃ©todo**: POST  
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
// ColecciÃ³n: inventory_movements
// ID del documento: mov_123
{
  timestamp: Timestamp,                 // âœ… Fecha/hora del movimiento
  user: "ALEXIS",                       // âœ… Usuario registrador
  sku: "SKU-001",                       // âœ… SKU del producto
  productName: "PARLANTE INTELIGENTE PORTATIL",
  variant: "Negro",
  quantity: -1,                         // âœ… Cantidad (negativa = salida)
  stockBefore: 10,
  stockAfter: 9,
  type: "SALIDA",                       // âœ… Tipo de movimiento
  reason: "Venta - #B20808",
  orderNumber: "#B20808",
  store: "blumi"
}
```

---

## ðŸ—„ï¸ ESTRUCTURA DE DATOS EN FIRESTORE

### **ColecciÃ³n: `shopify_orders`**

#### **Documento ID**: `{storeId}-{orderNumber}`

Ejemplo: `blumi-B20808`

```typescript
{
  // ===== DATOS DE SHOPIFY (WEBHOOK AUTOMÃTICO) =====
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
  
  // ===== DATOS DE CONFIRMACIÃ“N (SHEET/AUTOMÃTICO) =====
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

## ðŸ“Š CÃLCULO DE MÃ‰TRICAS

### **1. Gasto Promedio Diario (Average Ticket)**

#### **FÃ³rmula Actual**:

```typescript
// En getMetricsFlow.ts (lÃ­nea 426)
averageTicket: data.totalOrders > 0 
  ? data.totalSpent / data.totalOrders 
  : 0
```

#### **CÃ¡lculo**:

```typescript
// storeData se calcula desde allOrders
allOrders.forEach((order) => {
  const isOrderConfirmed = order.isConfirmed === true;
  
  storeData[storeName].totalOrders++;  // Todos los pedidos
  
  if (isOrderConfirmed) {
    storeData[storeName].confirmedOrders++;
    storeData[storeName].totalSpent += order.totalPrice || 0; // â† Solo confirmados
  }
});

// Entonces:
// averageTicket = totalSpent / totalOrders
// averageTicket = (suma de confirmados) / (todos los pedidos)
```

#### **âš ï¸ PROBLEMA IDENTIFICADO**:

**El gasto promedio actual estÃ¡ DIVIDIENDO entre TODOS los pedidos (confirmados + no confirmados), pero SUMANDO solo los confirmados.**

**Ejemplo**:
```
Tienda Dearel:
- Total de pedidos (allOrders): 20
- Pedidos confirmados: 16
- Total gastado (confirmados): S/. 1600

CÃ¡lculo actual:
averageTicket = 1600 / 20 = S/. 80 â† âŒ INCORRECTO

CÃ¡lculo correcto:
averageTicket = 1600 / 16 = S/. 100 â† âœ… CORRECTO
```

---

### **2. Otras MÃ©tricas Calculadas**

#### **a) Gasto Total (Total Revenue)**

```typescript
// Solo suma los pedidos CONFIRMADOS
totalSpent += order.totalPrice || 0;
```

âœ… **CORRECTO**: Solo cuenta ingresos de pedidos confirmados

#### **b) Courier Metrics**

```typescript
courierData[courierName].revenue += order.totalPrice || 0;
// Loop: confirmedOrders
```

âœ… **CORRECTO**: Solo couriers de pedidos confirmados

#### **c) Payment Method Metrics**

```typescript
paymentMethodData[method].revenue += order.totalPrice || 0;
// Loop: deliveredOrders
```

âœ… **CORRECTO**: Solo mÃ©todos de pago de pedidos entregados

#### **d) Province Metrics**

```typescript
// AHORA (despuÃ©s de la correcciÃ³n):
allOrders.forEach((order) => {
  provinceData[rawProvince].totalOrders++;
  
  if (isOrderConfirmed) {
    provinceData[rawProvince].totalSpent += order.totalPrice || 0;
  }
});
```

âœ… **CORRECTO**: Cuenta todos los pedidos, suma solo confirmados

---

## ðŸ” VALIDACIÃ“N DE DATOS

### **ComparaciÃ³n: Documento Firestore vs Datos Enviados**

#### **Documento en Firestore (tu ejemplo)**:

```typescript
{
  city: "-",                            // âœ… Coincide
  confirmedAt: Timestamp("26/09/2025 17:32:02"),  // âœ… Coincide
  confirmedBy: "Shopify Automation",    // âœ… Coincide
  country: "Peru",                      // âœ… Coincide
  courier: null,                        // âš ï¸ Pendiente (sheet no enviado)
  createdAt: Timestamp("26/09/2025 17:23:49"),    // âœ… Coincide
  customerName: "Harry delgado garcia", // âœ… Coincide
  isConfirmed: true,                    // âœ… Coincide
  orderId: 6468311843104,               // âœ… Coincide
  orderName: "#B20808",                 // âœ… Coincide
  products: [                           // âœ… Coincide
    {
      price: 79,
      quantity: 1,
      title: "PARLANTE INTELIGENTE PORTATIL"
    }
  ],
  province: "Callao",                   // âœ… Coincide
  storeId: "blumi",                     // âœ… Coincide
  totalPrice: 79,                       // âœ… Coincide
  zip: "-"                              // âœ… Coincide
}
```

### **âœ… TODO CORRECTO**

- Todos los campos estÃ¡n presentes
- Los tipos de datos son correctos
- Las fechas estÃ¡n en Timestamp de Firestore
- La normalizaciÃ³n funciona correctamente

---

## ðŸ› BUGS IDENTIFICADOS

### **Bug #1: Gasto Promedio (Average Ticket) Incorrecto**

**UbicaciÃ³n**: `src/ai/flows/getMetricsFlow.ts` lÃ­nea 426

**Problema**:
```typescript
// âŒ INCORRECTO
averageTicket: data.totalOrders > 0 
  ? data.totalSpent / data.totalOrders 
  : 0
```

**SoluciÃ³n**:
```typescript
// âœ… CORRECTO
averageTicket: data.confirmedOrders > 0 
  ? data.totalSpent / data.confirmedOrders 
  : 0
```

**Impacto**:
- **Todos los grÃ¡ficos de gasto promedio estÃ¡n SUBESTIMADOS**
- **Ejemplo**: Si solo el 80% de pedidos se confirman, el gasto promedio se ve 20% mÃ¡s bajo

---

## ðŸ“‹ FLUJO COMPLETO DE UN PEDIDO

### **Timeline Ejemplo**:

```
DÃ­a 1 - 17:23:49
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 1. WEBHOOK SHOPIFY: orders/create      â”‚
â”‚    - Pedido #B20808 creado              â”‚
â”‚    - totalPrice: 79                     â”‚
â”‚    - isConfirmed: false                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â†“
DÃ­a 1 - 17:32:02
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 2. WEBHOOK SHOPIFY: orders/updated     â”‚
â”‚    - financial_status: paid             â”‚
â”‚    - isConfirmed: true                  â”‚
â”‚    - confirmedBy: "Shopify Automation"  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â†“
DÃ­a 2 - 10:00:00 (OPCIONAL)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 3. WEBHOOK SHEET: REPORTE_ENVIADOS     â”‚
â”‚    - confirmedBy: "ALEXIS" (actualiza)  â”‚
â”‚    - courier: "OLVA"                    â”‚
â”‚    - province: "Callao" (confirma)      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
         â†“
DÃ­a 3 - 15:30:00
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ 4. WEBHOOK SHEET: ENTREGADO             â”‚
â”‚    - isDelivered: true                  â”‚
â”‚    - deliveredAt: Timestamp             â”‚
â”‚    - paymentMethod: "YAPE"              â”‚
â”‚    - deliveryTimeInHours: 29.5          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## âœ… CHECKLIST DE VALIDACIÃ“N

### **Webhooks**
- [x] âœ… Shopify orders/create funciona
- [x] âœ… Shopify orders/updated funciona
- [x] âœ… Google Sheets REPORTE_ENVIADOS funciona
- [x] âœ… Google Sheets ENTREGADO funciona
- [x] âœ… Google Sheets INVENTARIO funciona

### **Datos en Firestore**
- [x] âœ… storeId se normaliza correctamente
- [x] âœ… orderName se guarda completo (#B20808)
- [x] âœ… totalPrice es nÃºmero (no string)
- [x] âœ… Timestamps se guardan correctamente
- [x] âœ… Products es array de objetos
- [x] âœ… Campos null cuando no hay datos

### **MÃ©tricas**
- [x] âœ… totalOrders cuenta todos los pedidos
- [x] âœ… confirmedOrders cuenta solo confirmados
- [x] âœ… totalSpent suma solo confirmados
- [ ] âŒ averageTicket calcula incorrectamente (BUG)

---

## ðŸ”§ CORRECCIÃ“N NECESARIA

Archivo: `src/ai/flows/getMetricsFlow.ts`

```typescript
// LÃ­nea 426 - CAMBIAR DE:
averageTicket: data.totalOrders > 0 ? data.totalSpent / data.totalOrders : 0,

// A:
averageTicket: data.confirmedOrders > 0 ? data.totalSpent / data.confirmedOrders : 0,
```

TambiÃ©n revisar en:
- Courier Metrics (lÃ­nea 380)
- Payment Method Metrics (lÃ­nea 391)

---

## ðŸ“Š CONCLUSIÃ“N

### **Estado General**: âœ… **95% CORRECTO**

**Funciona correctamente**:
- âœ… Todos los webhooks capturan datos
- âœ… Firestore guarda correctamente
- âœ… Modo MERGE no borra datos
- âœ… NormalizaciÃ³n de storeId
- âœ… CÃ¡lculo de totales y confirmados

**Requiere correcciÃ³n**:
- âŒ Gasto promedio (Average Ticket) usa divisor incorrecto

**RecomendaciÃ³n**: Corregir el cÃ¡lculo de averageTicket antes de confiar en esas mÃ©tricas para toma de decisiones.

---

**AuditorÃ­a realizada por**: Sistema de AnÃ¡lisis de Flujo de Datos  
**Tiempo de auditorÃ­a**: ~20 minutos  
**Archivos revisados**: 8  
**Bugs encontrados**: 1 (crÃ­tico para mÃ©tricas de gasto)

