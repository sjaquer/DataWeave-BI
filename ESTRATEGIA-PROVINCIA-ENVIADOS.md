# 📦 ESTRATEGIA: GESTIÓN DE PEDIDOS EN TRÁNSITO (PROVINCIA_ENVIADOS)

**Fecha**: 14 de octubre de 2025  
**Objetivo**: Manejar datos temporales de pedidos en tránsito de forma inteligente

---

## 🎯 PROBLEMA IDENTIFICADO

### **Flujo de estados de un pedido:**
1. **PROVINCIA_ENVIADOS** → Pedido en tránsito o por entrar en tránsito (TEMPORAL)
2. **REPORTE_ENVIADOS** → Pedido confirmado como enviado (PERMANENTE)
3. **ENTREGADO** → Pedido entregado al cliente (FINAL)

### **Desafío:**
- La hoja `PROVINCIA_ENVIADOS` contiene datos **temporales** que cambian constantemente
- Los pedidos pueden estar en múltiples estados durante el tránsito
- Cuando un pedido pasa a `REPORTE_ENVIADOS`, debe **eliminarse** de la tabla temporal

---

## 💡 ESTRATEGIA RECOMENDADA

### **Opción 1: Tabla Temporal con Timestamps (RECOMENDADO)**

#### **Base de datos: Firestore**

**Estructura de colección:**
```javascript
// Colección: provincia_enviados_temporal
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
✅ Historial completo de cambios de estado  
✅ Fácil identificar pedidos "abandonados" en tránsito  
✅ No se pierde información cuando el pedido avanza  
✅ Consultas rápidas por estado  

---

### **Opción 2: Snapshot Completo con Sincronización (SIMPLE)**

#### **Base de datos: Firestore**

**Estructura:**
```javascript
// Colección: provincia_enviados_snapshot
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
✅ Implementación más simple  
✅ Útil para comparar snapshots en el tiempo  
✅ Fácil rollback a estado anterior  

**Desventajas:**
❌ Datos duplicados en cada snapshot  
❌ Mayor uso de almacenamiento  

---

### **Opción 3: Estado Híbrido (ÓPTIMO PARA ANALYTICS)**

#### **Base de datos: Firestore**

**Colección 1: `pedidos_temporal_activos`**
```javascript
// Solo pedidos que ACTUALMENTE están en PROVINCIA_ENVIADOS
{
  pedidoId: "49268",
  estado: "EN_TRANSITO",
  datosCompletos: { ... },
  ultimaActualizacion: "2025-10-14T15:45:00Z"
}
```

**Colección 2: `pedidos_transito_historial`**
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
✅ Mejor de ambos mundos  
✅ Consultas ultra-rápidas de estado actual  
✅ Historial completo para analytics  
✅ Fácil limpieza de datos antiguos  

---

## 🔄 FLUJO DE SINCRONIZACIÓN PROPUESTO

### **1. Script de Google Sheets (Actualizado)**

```javascript
// Se ejecuta cada 1 hora
triggerProvinciaEnviadosSync() {
  // 1. Lee TODOS los pedidos de PROVINCIA_ENVIADOS
  // 2. Envía al webhook con flag: syncType: "TEMPORAL_UPDATE"
  // 3. NO guarda log (porque es temporal)
}

triggerShippedSync() {
  // 1. Lee NUEVOS pedidos de REPORTE_ENVIADOS
  // 2. Envía al webhook con flag: syncType: "CONFIRMED_SHIPPED"
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
  
  // 3. Marcar como eliminados los pedidos que ya NO están en PROVINCIA_ENVIADOS
  const snapshot = await db.collection('pedidos_temporal_activos')
    .where('enReporteEnviados', '==', false)
    .get();
    
  for (const doc of snapshot.docs) {
    if (!pedidosActuales.includes(doc.data().pedidoId)) {
      // Este pedido ya no está en PROVINCIA_ENVIADOS
      // Probablemente pasó a REPORTE_ENVIADOS
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

**Agregar lógica para marcar pedidos como "confirmados":**

```typescript
// En el webhook de sheets (REPORTE_ENVIADOS)
for (const row of data) {
  // ... lógica actual ...
  
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

## 📊 QUERIES ÚTILES PARA ANALYTICS

### **1. Pedidos actualmente en tránsito**
```typescript
const enTransito = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .get();
```

### **2. Tiempo promedio en tránsito**
```typescript
const historial = await db.collection('pedidos_transito_historial')
  .where('pedidoId', '==', pedidoId)
  .orderBy('timestamp', 'asc')
  .get();

const entrada = historial.docs.find(d => d.data().evento === 'ENTRADA_TRANSITO');
const salida = historial.docs.find(d => d.data().evento === 'CONFIRMADO_ENVIADO');

const tiempoTransito = salida.timestamp - entrada.timestamp;
```

### **3. Pedidos "abandonados" en tránsito (más de 48h)**
```typescript
const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

const abandonados = await db.collection('pedidos_temporal_activos')
  .where('enReporteEnviados', '==', false)
  .where('ultimaActualizacion', '<', hace48h)
  .get();
```

---

## 🚀 IMPLEMENTACIÓN PASO A PASO

### **Fase 1: Setup Básico (1-2 horas)**
1. ✅ Actualizar script de Google Sheets (COMPLETADO)
2. ⏳ Crear webhook `/api/webhooks/provincia-enviados/route.ts`
3. ⏳ Crear esquemas Firestore

### **Fase 2: Lógica de Estado (2-3 horas)**
4. ⏳ Implementar lógica de actualización temporal
5. ⏳ Implementar detección de pedidos eliminados
6. ⏳ Modificar webhook de REPORTE_ENVIADOS

### **Fase 3: Dashboard (3-4 horas)**
7. ⏳ Crear página `/dashboard/transito`
8. ⏳ Gráfico: Pedidos en tránsito vs. Confirmados
9. ⏳ Tabla: Pedidos actualmente en tránsito
10. ⏳ Alerta: Pedidos con más de 48h sin actualizar

---

## 🎨 VISUALIZACIONES SUGERIDAS

### **Gráfico 1: Pipeline de Estados**
```
[PROVINCIA_ENVIADOS] → [REPORTE_ENVIADOS] → [ENTREGADO]
      150 pedidos          1,240 pedidos       980 pedidos
      (Temporal)           (Confirmados)        (Finalizados)
```

### **Gráfico 2: Tiempo Promedio en cada Estado**
```
Promedio en tránsito: 18.5 horas
Promedio desde enviado a entregado: 2.3 días
```

### **Gráfico 3: Mapa de Calor por Provincia**
```
Lima: 85 pedidos en tránsito
Arequipa: 23 pedidos
Cusco: 12 pedidos
```

---

## ✅ RESUMEN DE CAMBIOS EN EL SCRIPT

### **Configuración actualizada:**
- ✅ Nueva URL de webhook: `PROVINCIA_ENVIADOS_WEBHOOK_URL`
- ✅ Nuevo nombre de hoja: `PROVINCIA_ENVIADOS_SHEET_NAME`
- ✅ Nueva columna única: `PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN: 'PEDIDO'`

### **Nuevas funciones:**
- ✅ `triggerProvinciaEnviadosSync()` - Sincroniza datos temporales
- ✅ Trigger automático cada 1 hora para las 3 hojas
- ✅ Menú actualizado con orden lógico (Temporal → Confirmado → Entregado)

### **Comportamiento:**
- ✅ **PROVINCIA_ENVIADOS**: NO usa log, siempre envía TODO (para detectar cambios)
- ✅ **REPORTE_ENVIADOS**: USA log, solo envía nuevos (datos permanentes)
- ✅ **ENTREGADO**: NO usa log, siempre envía TODO (para actualizaciones de estado)

---

## 📝 PRÓXIMOS PASOS

1. **Crear el webhook backend** para procesar los datos temporales
2. **Definir esquema de Firestore** para las 2 colecciones
3. **Implementar lógica de limpieza** de pedidos antiguos (>7 días)
4. **Crear dashboard de tránsito** con métricas en tiempo real
5. **Configurar alertas** para pedidos abandonados

---

## 🔒 REGLAS DE FIRESTORE RECOMENDADAS

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

**🎉 VENTAJAS DE ESTA ESTRATEGIA:**

1. ✅ **Datos temporales separados** de datos permanentes
2. ✅ **Historial completo** de cambios de estado
3. ✅ **Detección automática** de pedidos que pasan a REPORTE_ENVIADOS
4. ✅ **Performance óptima** con índices correctos
5. ✅ **Analytics avanzados** de tiempos y estados
6. ✅ **Fácil mantenimiento** y limpieza de datos antiguos
