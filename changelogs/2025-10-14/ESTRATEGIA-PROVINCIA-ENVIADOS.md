---
Date: 2025-10-14
---

# ðŸ“¦ ESTRATEGIA: GESTIÃ“N DE PEDIDOS EN TRÃNSITO (PROVINCIA_ENVIADOS)

**Fecha**: 14 de octubre de 2025  
**Objetivo**: Manejar datos temporales de pedidos en trÃ¡nsito de forma inteligente

---

## ðŸŽ¯ PROBLEMA IDENTIFICADO

### **Flujo de estados de un pedido:**
1. **PROVINCIA_ENVIADOS** â†’ Pedido en trÃ¡nsito o por entrar en trÃ¡nsito (TEMPORAL)
2. **REPORTE_ENVIADOS** â†’ Pedido confirmado como enviado (PERMANENTE)
3. **ENTREGADO** â†’ Pedido entregado al cliente (FINAL)

### **DesafÃ­o:**
- La hoja `PROVINCIA_ENVIADOS` contiene datos **temporales** que cambian constantemente
- Los pedidos pueden estar en mÃºltiples estados durante el trÃ¡nsito
- Cuando un pedido pasa a `REPORTE_ENVIADOS`, debe **eliminarse** de la tabla temporal

---

## ðŸ’¡ ESTRATEGIA RECOMENDADA

### **OpciÃ³n 1: Tabla Temporal con Timestamps (RECOMENDADO)**

#### **Base de datos: Firestore**

**Estructura de colecciÃ³n:**
```javascript
// ColecciÃ³n: provincia_enviados_temporal
{
  pedidoId: "49268",           // ID del pedido
  tienda: "Dearel",
  provincia: "Lima",
  estado: "EN_TRANSITO",       // EN_TRANSITO | PREPARANDO | CONFIRMADO
  courier: "SHALOM",
  fechaCreacion: "2025-10-14T10:30:00Z",
  ultimaActualizacion: "2025-10-14T15:45:00Z",
  datosCompletos: { ... },     // Todos los campos de la fila
  enReporteEnviados: false     // Cambia a true cuando pasa a REPORTE_ENVIADOS
}
```

**Ventajas:**
âœ… Historial completo de cambios de estado  
âœ… FÃ¡cil identificar pedidos "abandonados" en trÃ¡nsito  
âœ… No se pierde informaciÃ³n cuando el pedido avanza  
âœ… Consultas rÃ¡pidas por estado  

---

### **OpciÃ³n 2: Snapshot Completo con SincronizaciÃ³n (SIMPLE)**

#### **Base de datos: Firestore**

**Estructura:**
```javascript
// ColecciÃ³n: provincia_enviados_snapshot
// Documento ID: fecha del snapshot (ej: "2025-10-14_15-00")
{
  timestamp: "2025-10-14T15:00:00Z",
  totalPedidos: 150,
  pedidos: [
    { pedido: "49268", tienda: "Dearel", estado: "EN_TRANSITO", ... },
    { pedido: "49383", tienda: "Dearel", estado: "PREPARANDO", ... },
    ...
  ]
}
```

**Ventajas:**
âœ… ImplementaciÃ³n mÃ¡s simple  
âœ… Ãštil para comparar snapshots en el tiempo  
âœ… FÃ¡cil rollback a estado anterior  

**Desventajas:**
âŒ Datos duplicados en cada snapshot  
âŒ Mayor uso de almacenamiento  

---

### **OpciÃ³n 3: Estado HÃ­brido (Ã“PTIMO PARA ANALYTICS)**

#### **Base de datos: Firestore**

**ColecciÃ³n 1: `pedidos_temporal_activos`**
```javascript
// Solo pedidos que ACTUALMENTE estÃ¡n en PROVINCIA_ENVIADOS
{
  pedidoId: "49268",
  estado: "EN_TRANSITO",
  datosCompletos: { ... },
  ultimaActualizacion: "2025-10-14T15:45:00Z"
}
```

**ColecciÃ³n 2: `pedidos_transito_historial`**
```javascript
// Historial de TODOS los cambios de estado
{
  pedidoId: "49268",
  evento: "ENTRADA_TRANSITO",
  timestamp: "2025-10-14T10:30:00Z",
  estadoAnterior: null,
  estadoNuevo: "EN_TRANSITO",
  datosSnapshot: { ... }
}
```

**Ventajas:**
âœ… Mejor de ambos mundos  
âœ… Consultas ultra-rÃ¡pidas de estado actual  
âœ… Historial completo para analytics  
âœ… FÃ¡cil limpieza de datos antiguos  

---

## ðŸ”„ FLUJO DE SINCRONIZACIÃ“N PROPUESTO

### **1. Script de Google Sheets (Actualizado)**

```javascript
// Se ejecuta cada 1 hora
triggerProvinciaEnviadosSync() {
  // 1. Lee TODOS los pedidos de PROVINCIA_ENVIADOS
  // 2. EnvÃ­a al webhook con flag: syncType: "TEMPORAL_UPDATE"
  // 3. NO guarda log (porque es temporal)
}

triggerShippedSync() {
  // 1. Lee NUEVOS pedidos de REPORTE_ENVIADOS
  // 2. EnvÃ­a al webhook con flag: syncType: "CONFIRMED_SHIPPED"
  // 3. Guarda en log (porque es permanente)
}
```

### **2. Webhook Backend (Nuevo endpoint)**

**Archivo**: `src/app/api/webhooks/provincia-enviados/route.ts`

```typescript
export async function POST(request: Request) {
  const { data } = await request.json();
  
  // 1. Obtener lista actual de pedidos en PROVINCIA_ENVIADOS
  const pedidosActuales = data.map(row => row.PEDIDO);
  
  // 2. Actualizar o crear documentos temporales
  const batch = db.batch();
  
  for (const row of data) {
    const docRef = db.collection('pedidos_temporal_activos').doc(row.PEDIDO);
    batch.set(docRef, {
      pedidoId: row.PEDIDO,
      estado: row.ESTADO || 'EN_TRANSITO',
      tienda: row.TIENE,
      provincia: row.PROV,
      courier: row.COURIER,
      datosCompletos: row,
      ultimaActualizacion: FieldValue.serverTimestamp(),
      enReporteEnviados: false
    }, { merge: true });
    
    // Registrar en historial
    const historialRef = db.collection('pedidos_transito_historial').doc();
    batch.set(historialRef, {
      pedidoId: row.PEDIDO,
      evento: 'ACTUALIZACION_TRANSITO',
      timestamp: FieldValue.serverTimestamp(),
      datosSnapshot: row
    });
  }
  
  // 3. Marcar como eliminados los pedidos que ya NO estÃ¡n en PROVINCIA_ENVIADOS
  const snapshot = await db.collection('pedidos_temporal_activos')
    .where('enReporteEnviados', '==', false)
    .get();
    
  for (const doc of snapshot.docs) {
    if (!pedidosActuales.includes(doc.data().pedidoId)) {
      // Este pedido ya no estÃ¡ en PROVINCIA_ENVIADOS
      // Probablemente pasÃ³ a REPORTE_ENVIADOS
      batch.update(doc.ref, {
        eliminadoDeTransito: true,
        fechaEliminacion: FieldValue.serverTimestamp()
      });
    }
  }
  
  await batch.commit();
  
  return NextResponse.json({ 
    status: 'success', 
    message: `${data.length} pedidos temporales sincronizados` 
  });
}
```

### **3. Webhook REPORTE_ENVIADOS (Modificar existente)**

**Agregar lÃ³gica para marcar pedidos como "confirmados":**

```typescript
// En el webhook de sheets (REPORTE_ENVIADOS)
for (const row of data) {
  // ... lÃ³gica actual ...
  
  // NUEVO: Marcar como confirmado en tabla temporal
  const tempDocRef = db.collection('pedidos_temporal_activos').doc(row.PEDIDO);
  const tempDoc = await tempDocRef.get();
  
  if (tempDoc.exists) {
    await tempDocRef.update({
      enReporteEnviados: true,
      fechaPasoAEnviados: FieldValue.serverTimestamp()
    });
    
    // Registrar evento en historial
    await db.collection('pedidos_transito_historial').add({
      pedidoId: row.PEDIDO,
      evento: 'CONFIRMADO_ENVIADO',
      timestamp: FieldValue.serverTimestamp(),
      mensaje: 'Pedido confirmado en REPORTE_ENVIADOS'
    });
  }
}
```

---

## ðŸ“Š QUERIES ÃšTILES PARA ANALYTICS

### **1. Pedidos actualmente en trÃ¡nsito**
```typescript
const enTransito = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .get();
```

### **2. Tiempo promedio en trÃ¡nsito**
```typescript
const historial = await db.collection('pedidos_transito_historial')
  .where('pedidoId', '==', pedidoId)
  .orderBy('timestamp', 'asc')
  .get();

const entrada = historial.docs.find(d => d.data().evento === 'ENTRADA_TRANSITO');
const salida = historial.docs.find(d => d.data().evento === 'CONFIRMADO_ENVIADO');

const tiempoTransito = salida.timestamp - entrada.timestamp;
```

### **3. Pedidos "abandonados" en trÃ¡nsito (mÃ¡s de 48h)**
```typescript
const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

const abandonados = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .where('ultimaActualizacion', '<', hace48h)
  .get();
```

---

## ðŸš€ IMPLEMENTACIÃ“N PASO A PASO

### **Fase 1: Setup BÃ¡sico (1-2 horas)**
1. âœ… Actualizar script de Google Sheets (COMPLETADO)
2. â³ Crear webhook `/api/webhooks/provincia-enviados/route.ts`
3. â³ Crear esquemas Firestore

### **Fase 2: LÃ³gica de Estado (2-3 horas)**
4. â³ Implementar lÃ³gica de actualizaciÃ³n temporal
5. â³ Implementar detecciÃ³n de pedidos eliminados
6. â³ Modificar webhook de REPORTE_ENVIADOS

### **Fase 3: Dashboard (3-4 horas)**
7. â³ Crear pÃ¡gina `/dashboard/transito`
8. â³ GrÃ¡fico: Pedidos en trÃ¡nsito vs. Confirmados
9. â³ Tabla: Pedidos actualmente en trÃ¡nsito
10. â³ Alerta: Pedidos con mÃ¡s de 48h sin actualizar

---

## ðŸŽ¨ VISUALIZACIONES SUGERIDAS

### **GrÃ¡fico 1: Pipeline de Estados**
```
[PROVINCIA_ENVIADOS] â†’ [REPORTE_ENVIADOS] â†’ [ENTREGADO]
      150 pedidos          1,240 pedidos       980 pedidos
      (Temporal)           (Confirmados)        (Finalizados)
```

### **GrÃ¡fico 2: Tiempo Promedio en cada Estado**
```
Promedio en trÃ¡nsito: 18.5 horas
Promedio desde enviado a entregado: 2.3 dÃ­as
```

### **GrÃ¡fico 3: Mapa de Calor por Provincia**
```
Lima: 85 pedidos en trÃ¡nsito
Arequipa: 23 pedidos
Cusco: 12 pedidos
```

---

## âœ… RESUMEN DE CAMBIOS EN EL SCRIPT

### **ConfiguraciÃ³n actualizada:**
- âœ… Nueva URL de webhook: `PROVINCIA_ENVIADOS_WEBHOOK_URL`
- âœ… Nuevo nombre de hoja: `PROVINCIA_ENVIADOS_SHEET_NAME`
- âœ… Nueva columna Ãºnica: `PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN: 'PEDIDO'`

### **Nuevas funciones:**
- âœ… `triggerProvinciaEnviadosSync()` - Sincroniza datos temporales
- âœ… Trigger automÃ¡tico cada 1 hora para las 3 hojas
- âœ… MenÃº actualizado con orden lÃ³gico (Temporal â†’ Confirmado â†’ Entregado)

### **Comportamiento:**
- âœ… **PROVINCIA_ENVIADOS**: NO usa log, siempre envÃ­a TODO (para detectar cambios)
- âœ… **REPORTE_ENVIADOS**: USA log, solo envÃ­a nuevos (datos permanentes)
- âœ… **ENTREGADO**: NO usa log, siempre envÃ­a TODO (para actualizaciones de estado)

---

## ðŸ“ PRÃ“XIMOS PASOS

1. **Crear el webhook backend** para procesar los datos temporales
2. **Definir esquema de Firestore** para las 2 colecciones
3. **Implementar lÃ³gica de limpieza** de pedidos antiguos (>7 dÃ­as)
4. **Crear dashboard de trÃ¡nsito** con mÃ©tricas en tiempo real
5. **Configurar alertas** para pedidos abandonados

---

## ðŸ”’ REGLAS DE FIRESTORE RECOMENDADAS

```javascript
// firestore.rules
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

**ðŸŽ‰ VENTAJAS DE ESTA ESTRATEGIA:**

1. âœ… **Datos temporales separados** de datos permanentes
2. âœ… **Historial completo** de cambios de estado
3. âœ… **DetecciÃ³n automÃ¡tica** de pedidos que pasan a REPORTE_ENVIADOS
4. âœ… **Performance Ã³ptima** con Ã­ndices correctos
5. âœ… **Analytics avanzados** de tiempos y estados
6. âœ… **FÃ¡cil mantenimiento** y limpieza de datos antiguos

