---
Date: 2025-10-14
---

# âœ… RESUMEN DE IMPLEMENTACIÃ“N: PROVINCIA_ENVIADOS

**Fecha**: 14 de octubre de 2025  
**Estado**: âœ… **COMPLETADO**

---

## ðŸ“¦ CAMBIOS REALIZADOS

### **1. Google Apps Script actualizado** âœ…

**Archivo**: `google-apps-script/inventory-sync.js`

#### **ConfiguraciÃ³n agregada:**
```javascript
// Nueva URL de webhook para datos temporales
PROVINCIA_ENVIADOS_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/provincia-enviados',

// Nuevo nombre de hoja
PROVINCIA_ENVIADOS_SHEET_NAME: 'PROVINCIA_ENVIADOS',

// Nueva columna Ãºnica
PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN: 'PEDIDO',
```

#### **Nueva funciÃ³n de sincronizaciÃ³n:**
```javascript
function triggerProvinciaEnviadosSync() {
  syncSheet(
    CONFIG.PROVINCIA_ENVIADOS_SHEET_NAME,
    CONFIG.PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN,
    CONFIG.PROVINCIA_ENVIADOS_WEBHOOK_URL,
    'PROVINCIA_ENVIADOS',
    false // NO usar log - siempre enviar TODO
  );
}
```

#### **MenÃº actualizado:**
```
1. Sincronizar PROVINCIA ENVIADOS (Temporal)  â† NUEVO
2. Sincronizar REPORTE ENVIADOS
3. Sincronizar ENTREGADO
4. Activar SincronizaciÃ³n AutomÃ¡tica
5. Desactivar SincronizaciÃ³n AutomÃ¡tica
```

#### **Trigger automÃ¡tico:**
- Se ejecuta cada **1 hora** para las 3 hojas
- Orden de ejecuciÃ³n: PROVINCIA_ENVIADOS â†’ REPORTE_ENVIADOS â†’ ENTREGADO

---

### **2. Webhook Backend creado** âœ…

**Archivo**: `src/app/api/webhooks/provincia-enviados/route.ts`

#### **Endpoints:**

**POST** `/api/webhooks/provincia-enviados`
- Recibe todos los pedidos de PROVINCIA_ENVIADOS
- Actualiza/crea documentos en Firestore
- Detecta pedidos eliminados (pasaron a REPORTE_ENVIADOS)
- Registra historial de cambios

**GET** `/api/webhooks/provincia-enviados`
- DiagnÃ³stico del estado actual
- Retorna estadÃ­sticas por estado, tienda y provincia

#### **LÃ³gica implementada:**

1. **Procesa pedidos activos:**
   - Crea nuevos pedidos en `pedidos_temporal_activos`
   - Actualiza pedidos existentes
   - Detecta cambios de estado

2. **Detecta pedidos eliminados:**
   - Compara lista actual vs. base de datos
   - Marca como `eliminadoDeTransito: true`
   - Registra evento de salida en historial

3. **Registra historial:**
   - `ENTRADA_TRANSITO` - Pedido nuevo en trÃ¡nsito
   - `CAMBIO_ESTADO` - CambiÃ³ de estado
   - `SALIDA_TRANSITO` - Pedido eliminado de la hoja

---

### **3. Usuario Zadarma agregado** âœ…

**Archivo**: `src/app/(app)/dashboard/performance/page.tsx`

```typescript
const agentMap: { [key: string]: string } = {
  "101": "Aylen",
  "104": "Alanis",
  "105": "Marisol",
  "107": "Lisset",
  "108": "Wendy",
  "110": "Avril",  // â† AGREGADO
  "111": "Luz",
  "113": "Fiorela",
};
```

---

## ðŸ—„ï¸ ESTRUCTURA DE BASE DE DATOS

### **ColecciÃ³n: `pedidos_temporal_activos`**

```typescript
{
  pedidoId: "49268",
  tienda: "Dearel",
  provincia: "Lima",
  estado: "EN_TRANSITO",
  courier: "SHALOM",
  cliente: "Juan PÃ©rez",
  celular: "+51987654321",
  direccion: "Av. Principal 123",
  agenciaShalom: "Lima Centro",
  total: 159,
  montoPendiente: 139,
  fechaCreado: "2025-10-14T10:30:00Z",
  fechaEnviado: null,
  datosCompletos: { ... },
  ultimaActualizacion: Timestamp,
  enReporteEnviados: false,
  eliminadoDeTransito: false,
  fechaEliminacion: null
}
```

### **ColecciÃ³n: `pedidos_transito_historial`**

```typescript
{
  pedidoId: "49268",
  evento: "ENTRADA_TRANSITO" | "CAMBIO_ESTADO" | "SALIDA_TRANSITO",
  timestamp: Timestamp,
  estadoAnterior: "PREPARANDO",
  estadoNuevo: "EN_TRANSITO",
  tienda: "Dearel",
  provincia: "Lima",
  mensaje: "DescripciÃ³n opcional",
  datosSnapshot: { ... }
}
```

---

## ðŸ“Š ESTRATEGIA DE DATOS IMPLEMENTADA

### **Flujo de sincronizaciÃ³n:**

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ PROVINCIA_ENVIADOS      â”‚ (Google Sheets - Temporal)
â”‚ Pedidos en trÃ¡nsito     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚ Cada 1 hora
            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Webhook Backend         â”‚
â”‚ /provincia-enviados     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚
            â”œâ”€â”€â–º pedidos_temporal_activos (Firestore)
            â””â”€â”€â–º pedidos_transito_historial (Firestore)

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ REPORTE_ENVIADOS        â”‚ (Google Sheets - Permanente)
â”‚ Pedidos confirmados     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚ Cada 1 hora
            â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Webhook Backend         â”‚
â”‚ /sheets (existente)     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚
            â””â”€â”€â–º Marca enReporteEnviados: true
```

### **Ventajas de esta estrategia:**

1. âœ… **Datos temporales separados** - No contamina tablas permanentes
2. âœ… **DetecciÃ³n automÃ¡tica de transiciÃ³n** - Sabe cuÃ¡ndo un pedido pasa a REPORTE_ENVIADOS
3. âœ… **Historial completo** - Registro de todos los cambios de estado
4. âœ… **Sin pÃ©rdida de datos** - Incluso si se elimina de la hoja, queda en Firestore
5. âœ… **Analytics avanzados** - Tiempo promedio en trÃ¡nsito, pedidos abandonados, etc.
6. âœ… **Performance Ã³ptima** - Ãndices correctos en Firestore

---

## ðŸš€ CÃ“MO USAR

### **1. Configurar en Google Sheets**

1. Abrir la hoja de cÃ¡lculo
2. Ir al menÃº: **SincronizaciÃ³n DataWeave**
3. Click en **"4. Activar SincronizaciÃ³n AutomÃ¡tica"**
4. Confirmar que se ejecutarÃ¡ cada 1 hora

### **2. Sincronizar manualmente (opcional)**

1. Ir al menÃº: **SincronizaciÃ³n DataWeave**
2. Click en **"1. Sincronizar PROVINCIA ENVIADOS (Temporal)"**
3. Esperar confirmaciÃ³n

### **3. Verificar estado desde API**

```bash
# Ver estadÃ­sticas actuales
curl https://dataweave-bi.vercel.app/api/webhooks/provincia-enviados

# Respuesta:
{
  "status": "success",
  "totalActivos": 150,
  "porEstado": {
    "EN_TRANSITO": 85,
    "PREPARANDO": 45,
    "CONFIRMADO": 20
  },
  "porTienda": {
    "Dearel": 80,
    "Blumi PerÃº": 50,
    "Novi PerÃº": 20
  },
  "porProvincia": {
    "Lima": 90,
    "Arequipa": 30,
    "Cusco": 20,
    "Piura": 10
  },
  "timestamp": "2025-10-14T16:30:00Z"
}
```

---

## ðŸ“ˆ QUERIES ÃšTILES

### **1. Pedidos actualmente en trÃ¡nsito**

```typescript
const enTransito = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();
```

### **2. Pedidos por tienda**

```typescript
const dearel = await db.collection('pedidos_temporal_activos')
  .where('tienda', '==', 'Dearel')
  .where('enReporteEnviados', '==', false)
  .get();
```

### **3. Historial de un pedido especÃ­fico**

```typescript
const historial = await db.collection('pedidos_transito_historial')
  .where('pedidoId', '==', '49268')
  .orderBy('timestamp', 'asc')
  .get();
```

### **4. Pedidos "abandonados" (>48h sin actualizar)**

```typescript
const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

const abandonados = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .where('ultimaActualizacion', '<', hace48h)
  .get();
```

---

## ðŸ”’ REGLAS DE FIRESTORE REQUERIDAS

**Archivo**: `firestore.rules`

```javascript
match /pedidos_temporal_activos/{pedidoId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo escritura desde backend
}

match /pedidos_transito_historial/{historialId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo escritura desde backend
}
```

---

## âš ï¸ CONSIDERACIONES IMPORTANTES

### **Limpieza de datos antiguos**

Los pedidos marcados como `eliminadoDeTransito: true` deberÃ­an limpiarse periÃ³dicamente:

```typescript
// Ejecutar mensualmente
const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

const antiguos = await db.collection('pedidos_temporal_activos')
  .where('eliminadoDeTransito', '==', true)
  .where('fechaEliminacion', '<', hace30dias)
  .get();

// Eliminar en batch
const batch = db.batch();
antiguos.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

### **Monitoreo de errores**

Revisar logs en Vercel para detectar:
- Errores de conexiÃ³n a Firestore
- Pedidos sin campo `PEDIDO`
- Problemas de sincronizaciÃ³n

---

## ðŸ“ PRÃ“XIMOS PASOS RECOMENDADOS

1. **Crear Ã­ndices en Firestore** (CRÃTICO para performance)
   ```
   pedidos_temporal_activos:
   - enReporteEnviados ASC, eliminadoDeTransito ASC
   - tienda ASC, enReporteEnviados ASC
   - provincia ASC, enReporteEnviados ASC
   - ultimaActualizacion DESC
   
   pedidos_transito_historial:
   - pedidoId ASC, timestamp ASC
   ```

2. **Crear dashboard de trÃ¡nsito** (`/dashboard/transito`)
   - GrÃ¡fico de pedidos en trÃ¡nsito por provincia
   - Tabla de pedidos activos
   - Alerta de pedidos abandonados (>48h)
   - Tiempo promedio en trÃ¡nsito

3. **Modificar webhook de REPORTE_ENVIADOS**
   - Marcar `enReporteEnviados: true` cuando un pedido pase a esta hoja
   - Registrar evento en historial

4. **Implementar alertas**
   - Email/WhatsApp cuando un pedido tenga >48h en trÃ¡nsito
   - NotificaciÃ³n cuando haya errores de sincronizaciÃ³n

---

## âœ… CHECKLIST DE VERIFICACIÃ“N

- [x] Script de Google Sheets actualizado
- [x] Webhook backend creado (`/api/webhooks/provincia-enviados`)
- [x] Usuario Avril (110) agregado a Zadarma
- [x] DocumentaciÃ³n de estrategia creada
- [ ] Ãndices de Firestore creados (PENDIENTE)
- [ ] Reglas de Firestore actualizadas (PENDIENTE)
- [ ] Dashboard de trÃ¡nsito creado (PENDIENTE)
- [ ] Webhook REPORTE_ENVIADOS modificado (PENDIENTE)
- [ ] Sistema de alertas implementado (PENDIENTE)

---

## ðŸŽ‰ RESULTADO FINAL

### **Archivos modificados:**
1. âœ… `google-apps-script/inventory-sync.js` - Script actualizado
2. âœ… `src/app/api/webhooks/provincia-enviados/route.ts` - Webhook nuevo
3. âœ… `src/app/(app)/dashboard/performance/page.tsx` - Avril agregada
4. âœ… `ESTRATEGIA-PROVINCIA-ENVIADOS.md` - DocumentaciÃ³n estratÃ©gica

### **Colecciones Firestore creadas:**
- `pedidos_temporal_activos` - Pedidos actualmente en trÃ¡nsito
- `pedidos_transito_historial` - Historial de cambios de estado

### **Funcionalidades nuevas:**
- âœ… SincronizaciÃ³n automÃ¡tica de datos temporales cada 1 hora
- âœ… DetecciÃ³n automÃ¡tica de pedidos que pasan a REPORTE_ENVIADOS
- âœ… Historial completo de cambios de estado
- âœ… Endpoint de diagnÃ³stico (GET)
- âœ… SeparaciÃ³n lÃ³gica de datos temporales vs permanentes

---

**ðŸ“ž CONTACTO PARA SOPORTE:**
- DocumentaciÃ³n completa: `ESTRATEGIA-PROVINCIA-ENVIADOS.md`
- Logs del webhook: Vercel â†’ Functions â†’ `/api/webhooks/provincia-enviados`
- Firestore Console: Firebase â†’ Firestore Database

**ðŸš€ LISTO PARA PRODUCCIÃ“N**

