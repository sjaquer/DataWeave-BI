---
Date: 2025-10-08
---

# ðŸ“‹ DocumentaciÃ³n del Flujo de Webhooks - DataWeave BI

## ðŸŽ¯ Arquitectura de Fuentes de Datos

### 1ï¸âƒ£ Shopify Webhook â†’ Pedidos Base
**Endpoint**: `/api/webhooks/shopify/{storeId}`
**PropÃ³sito**: Crear pedidos iniciales con informaciÃ³n del cliente

**Datos capturados**:
- `orderName`: Nombre del pedido (#12345, N-10966, etc.)
- `storeId`: Tienda origen (blumi, novi, dearel, cumbre, trazto)
- `customerName`: Nombre completo del cliente
- `province`, `city`, `zip`, `country`: DirecciÃ³n del cliente
- `products`: Array de productos con `{ title, quantity, price }`
- `totalPrice`: Precio total del pedido
- `createdAt`: Fecha de creaciÃ³n
- `isConfirmed`: `false` (inicial)
- `isDelivered`: `false` (inicial)

**ID del Documento Generado**:
```
{normalizedStoreId}-{orderNumber}
Ejemplo: "blumi-13674", "novi-10966", "dearel-42932"
```

---

### 2ï¸âƒ£ Google Sheets "REPORTE_ENVIADOS" â†’ Confirmaciones + Courier
**Endpoint**: `/api/webhooks/sheets`
**PropÃ³sito**: Actualizar pedidos confirmados y agregar informaciÃ³n del courier

**Columnas del Sheet**:
| Columna | DescripciÃ³n | Ejemplo |
|---------|-------------|---------|
| `PEDIDO` | Nombre del pedido | #42932, N-10971, #B16548 |
| `TIENDA` | Nombre de la tienda | Dearel, Blumi PerÃº, Novi PerÃº, Cumbre |
| `COURIER` | Empresa de transporte | SHALOM, LIMA, OLVA, CLOCK |
| `ATENDIDO` | Quien atendiÃ³ | ERIKA, WENDY, MARITE, etc. |
| `PROVINCIA` | Provincia destino | Lima, JunÃ­n, Cajamarca, etc. |
| `FECHA DE ATENCIÃ“N` | Fecha confirmaciÃ³n | 2/4/2025 17:05:00 |
| `PRODUCTO` | Productos separados por + | 1x LLAVE PARA GATO |

**Datos actualizados en Firestore**:
```typescript
{
  isConfirmed: true,
  confirmedAt: Timestamp,
  confirmedBy: "ERIKA",
  courier: "SHALOM",  // â† Campo clave para mÃ©tricas
  province: "Lima" // Solo si no existe
}
```

**LÃ³gica de Merge**: Usa `{merge: true}` para **preservar** todos los datos de Shopify.

**ID del Documento usado**:
```
getShopifyOrderDocId(PEDIDO, TIENDA)
â†’ normaliza TIENDA a lowercase sin espacios
â†’ extrae nÃºmero del PEDIDO
â†’ resultado: "blumi-13674", "novi-10971"
```

---

### 3ï¸âƒ£ Google Sheets "ENTREGADO" â†’ Estado de Entrega
**Endpoint**: `/api/webhooks/delivered`
**PropÃ³sito**: Actualizar estado de entrega y mÃ©todo de pago

**Columnas del Sheet**:
| Columna | DescripciÃ³n | Ejemplo |
|---------|-------------|---------|
| `ID` | NÃºmero de fila | 12702460 |
| `PEDIDO` | Nombre del pedido | N-12163, #49208 |
| `TIENDA` | Nombre de la tienda | Novi PerÃº, Dearel, Blumi PerÃº |
| `TOTAL` | Monto total | 59, 89, 159 |
| `MONTO PENDIENTE` | Monto pendiente | 39, 69, 0 |
| `FECHA ENVIADO` | Fecha de envÃ­o | 8/7/2025 21:24:00 |
| `FECHA ENTREGADO` | Fecha de entrega | 08/08/2025 15:10:27 |
| `FORMA DE PAGO` | MÃ©todo de pago | YAPE, PLIN, AGENTE BOP |
| `USUARIO` | Quien registrÃ³ | ALEXIS, MARITE, FIORELLA |

**Datos actualizados en Firestore**:
```typescript
{
  isDelivered: true,
  deliveredAt: Timestamp,
  shippedAt: Timestamp,
  paymentMethod: "YAPE", // â† Directo del sheet
  pendingAmount: 39,
  deliveryTimeInHours: 17.8, // Calculado
  deliveredBy: "ALEXIS"
}
```

**CÃ¡lculo de Tiempo de Entrega**:
```typescript
deliveryTimeInHours = (FECHA ENTREGADO - FECHA ENVIADO) / 3600000
```

**LÃ³gica de Merge**: Usa `{merge: true}` para **preservar** datos de Shopify y REPORTE_ENVIADOS.

---

## ðŸ”‘ NormalizaciÃ³n de IDs

### FunciÃ³n: `getShopifyOrderDocId(orderName, storeId)`

**Entrada**:
- `orderName`: "#42932", "N-10971", "#B16548"
- `storeId`: "Blumi PerÃº", "Novi PerÃº", "Dearel"

**Proceso**:
1. **Normalizar `orderName`**:
   - Extraer solo el nÃºmero: `#42932` â†’ `42932`
   - Mantener guiones: `N-10971` â†’ `10971` (el N se elimina)
   - Pattern: `/[0-9]+(-[0-9]+)*$/`

2. **Normalizar `storeId`**:
   - Convertir a lowercase: `"Blumi PerÃº"` â†’ `"blumi perÃº"`
   - Eliminar "PerÃº"/"Peru": `"blumi perÃº"` â†’ `"blumi "`
   - Reemplazar espacios con `-`: `"blumi "` â†’ `"blumi-"`
   - Colapsar mÃºltiples `-`: `"blumi-"` â†’ `"blumi"`
   - Eliminar `-` al inicio/final: `"blumi"` â†’ `"blumi"`

3. **Generar ID**:
   ```
   `${normalizedStoreId}-${normalizedOrderNumber}`
   ```

**Salida**:
- `"blumi-42932"`
- `"novi-10971"`
- `"dearel-45044"`

---

## ðŸ“Š Estructura Final de Documento en Firestore

```typescript
// Collection: shopify_orders
// Document ID: "blumi-13674"
{
  // âœ… De Shopify Webhook
  orderName: "#13674",
  storeId: "blumi",
  customerName: "Juan PÃ©rez LÃ³pez",
  province: "Lima",
  city: "Lima",
  zip: "15001",
  country: "Peru",
  products: [
    { title: "LLAVE PARA GATO", quantity: 1, price: 79.90 }
  ],
  totalPrice: 79.90,
  createdAt: Timestamp(2025-06-20T12:00:00Z),
  
  // âœ… De REPORTE_ENVIADOS
  isConfirmed: true,
  confirmedAt: Timestamp(2025-06-20T15:30:00Z),
  confirmedBy: "ERIKA",
  courier: "SHALOM", // â† Para mÃ©tricas de couriers
  
  // âœ… De ENTREGADO
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

## ðŸ”„ Orden de EjecuciÃ³n Recomendado

1. **Shopify Webhook** (automÃ¡tico cuando se crea pedido)
   - Crea documento base
   
2. **REPORTE_ENVIADOS** (manual o automÃ¡tico cada hora)
   - Actualiza confirmaciÃ³n + courier
   
3. **ENTREGADO** (manual o automÃ¡tico cada hora)
   - Actualiza entrega + mÃ©todo de pago

---

## âš™ï¸ Apps Script - ConfiguraciÃ³n

**Archivo**: `google-apps-script/inventory-sync.js`

**Triggers**:
```javascript
// AutomÃ¡tico cada 1 hora
ScriptApp.newTrigger('triggerShippedSync')
  .timeBased()
  .everyHours(1)
  .create();

ScriptApp.newTrigger('triggerDeliveredSync')
  .timeBased()
  .everyHours(1)
  .create();
```

**MenÃº Manual**:
```
SincronizaciÃ³n DataWeave
â”œâ”€â”€ 1. Sincronizar REPORTE ENVIADOS
â”œâ”€â”€ 2. Sincronizar ENTREGADO
â”œâ”€â”€ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
â”œâ”€â”€ 3. Activar SincronizaciÃ³n AutomÃ¡tica
â””â”€â”€ 4. Desactivar SincronizaciÃ³n AutomÃ¡tica
```

---

## ðŸš¨ Validaciones Importantes

### âœ… ValidaciÃ³n de PEDIDO y TIENDA
Ambos webhooks requieren:
```typescript
if (!rawOrderName || !storeId) {
  console.warn('Item ignorado por falta de PEDIDO o TIENDA');
  continue;
}
```

### âœ… Merge Mode
**SIEMPRE** usar `{merge: true}`:
```typescript
batch.set(orderDocRef, data, { merge: true });
```

Esto garantiza que:
- âœ… Datos de Shopify NO se sobrescriban
- âœ… Datos previos se preserven
- âœ… Solo se actualicen campos especÃ­ficos

---

## ðŸ“ˆ MÃ©tricas Generadas

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
// ExtraÃ­do de ENTREGADO
paymentMethods: ["YAPE", "PLIN", "AGENTE BOP", "Adelantado", "Contra Entrega"]
```

---

## ðŸ”§ Troubleshooting

### Problema: Couriers no aparecen
**Causa**: CachÃ© del navegador  
**SoluciÃ³n**: BotÃ³n "Limpiar CachÃ©" en `/dashboard/shipments`

### Problema: IDs con doble guion
**Causa**: NormalizaciÃ³n incorrecta  
**SoluciÃ³n**: Script de migraciÃ³n ejecutado âœ…

### Problema: Datos de Shopify sobrescritos
**Causa**: No usar `{merge: true}`  
**SoluciÃ³n**: Corregido en `updateConfirmedOrders` âœ…

---

## âœ… Estado Actual

- âœ… NormalizaciÃ³n de IDs corregida
- âœ… Merge mode implementado
- âœ… Courier metrics agregado
- âœ… Payment method del sheet
- âœ… Delivery user tracking
- âœ… MigraciÃ³n de 1,002 documentos ejecutada

**Ãšltima actualizaciÃ³n**: 8 de octubre de 2025

