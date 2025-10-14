# Índices de Firestore para Envíos Temporales

Este documento describe los índices compuestos necesarios en Firestore para optimizar las queries del sistema de envíos temporales.

## 📍 ¿Dónde crear estos índices?

1. **Firebase Console**: https://console.firebase.google.com/
2. Selecciona tu proyecto: **DataWeave-BI**
3. Ve a **Firestore Database** → **Indexes** → **Composite**

## 🔍 Índices Necesarios

### Colección: `envios_temporales`

#### Índice 1: Filtrado por Estado de Activos
```
Collection ID: envios_temporales
Fields indexed:
  - enReporteEnviados (Ascending)
  - eliminadoDeTransito (Ascending)
  - ultimaActualizacion (Descending)

Query scope: Collection
```

**Uso**: Query principal para obtener pedidos activos ordenados por fecha.

---

#### Índice 2: Por Tipo de Origen y Estado
```
Collection ID: envios_temporales
Fields indexed:
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)
  - eliminadoDeTransito (Ascending)

Query scope: Collection
```

**Uso**: Separar pedidos de PROVINCIA vs LIMA que están activos.

---

#### Índice 3: Por Estado de Pedido
```
Collection ID: envios_temporales
Fields indexed:
  - estado (Ascending)
  - enReporteEnviados (Ascending)
  - eliminadoDeTransito (Ascending)

Query scope: Collection
```

**Uso**: Agrupar por estado (EN TRANSITO, EN DESTINO, L - EN RUTA, etc.).

---

#### Índice 4: Por Courier
```
Collection ID: envios_temporales
Fields indexed:
  - courier (Ascending)
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: Análisis de rendimiento por courier separado por origen.

---

#### Índice 5: Por Provincia
```
Collection ID: envios_temporales
Fields indexed:
  - provincia (Ascending)
  - estado (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: Visualización geográfica de envíos.

---

#### Índice 6: Por Tienda
```
Collection ID: envios_temporales
Fields indexed:
  - tienda (Ascending)
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: Análisis por tienda de origen.

---

### Colección: `envios_temporales_historial`

#### Índice 7: Historial por Pedido
```
Collection ID: envios_temporales_historial
Fields indexed:
  - pedidoId (Ascending)
  - timestamp (Ascending)

Query scope: Collection
```

**Uso**: Ver el historial completo de un pedido específico.

---

#### Índice 8: Por Tipo de Evento
```
Collection ID: envios_temporales_historial
Fields indexed:
  - evento (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: Filtrar eventos específicos (ENTRADA_TRANSITO, CAMBIO_ESTADO, SALIDA_TRANSITO).

---

#### Índice 9: Por Tipo de Origen
```
Collection ID: envios_temporales_historial
Fields indexed:
  - tipoOrigen (Ascending)
  - evento (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: Análisis de eventos separados por PROVINCIA vs LIMA.

---

#### Índice 10: Por Courier en Historial
```
Collection ID: envios_temporales_historial
Fields indexed:
  - courier (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: Analizar rendimiento histórico de cada courier.

---

## 🚀 Creación Automática vía CLI

Si prefieres crear los índices vía línea de comandos, puedes usar el Firebase CLI:

```bash
# Instalar Firebase CLI (si no lo tienes)
npm install -g firebase-tools

# Login
firebase login

# Crear archivo firestore.indexes.json (ver abajo)
# Luego desplegar
firebase deploy --only firestore:indexes
```

### Archivo `firestore.indexes.json`

Crea este archivo en la raíz del proyecto:

```json
{
  "indexes": [
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" },
        { "fieldPath": "eliminadoDeTransito", "order": "ASCENDING" },
        { "fieldPath": "ultimaActualizacion", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tipoOrigen", "order": "ASCENDING" },
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" },
        { "fieldPath": "eliminadoDeTransito", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" },
        { "fieldPath": "eliminadoDeTransito", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "courier", "order": "ASCENDING" },
        { "fieldPath": "tipoOrigen", "order": "ASCENDING" },
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "provincia", "order": "ASCENDING" },
        { "fieldPath": "estado", "order": "ASCENDING" },
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tienda", "order": "ASCENDING" },
        { "fieldPath": "tipoOrigen", "order": "ASCENDING" },
        { "fieldPath": "enReporteEnviados", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales_historial",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "pedidoId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales_historial",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "evento", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales_historial",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tipoOrigen", "order": "ASCENDING" },
        { "fieldPath": "evento", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "envios_temporales_historial",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "courier", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 📊 Queries Que Usan Estos Índices

### Query 1: Pedidos Activos
```typescript
const activos = await db.collection('envios_temporales')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .orderBy('ultimaActualizacion', 'desc')
  .get();
```
**Usa Índice 1**

---

### Query 2: Pedidos por Tipo de Origen
```typescript
const provincia = await db.collection('envios_temporales')
  .where('tipoOrigen', '==', 'PROVINCIA')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();
```
**Usa Índice 2**

---

### Query 3: Por Estado
```typescript
const enTransito = await db.collection('envios_temporales')
  .where('estado', '==', 'EN TRANSITO')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();
```
**Usa Índice 3**

---

### Query 4: Por Courier
```typescript
const shalom = await db.collection('envios_temporales')
  .where('courier', '==', 'SHALOM')
  .where('tipoOrigen', '==', 'PROVINCIA')
  .where('enReporteEnviados', '==', false)
  .get();
```
**Usa Índice 4**

---

### Query 5: Historial de Pedido
```typescript
const historial = await db.collection('envios_temporales_historial')
  .where('pedidoId', '==', '49268')
  .orderBy('timestamp', 'asc')
  .get();
```
**Usa Índice 7**

---

### Query 6: Eventos Recientes
```typescript
const cambiosEstado = await db.collection('envios_temporales_historial')
  .where('evento', '==', 'CAMBIO_ESTADO')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();
```
**Usa Índice 8**

---

## ⚠️ IMPORTANTE

1. **Crear ANTES de usar las queries**: Firestore dará error si intentas hacer queries sin los índices.

2. **Tiempo de creación**: Los índices pueden tardar varios minutos en estar listos.

3. **Verificar estado**: En Firebase Console → Firestore → Indexes, verás el estado:
   - 🟢 **Enabled**: Listo para usar
   - 🟡 **Building**: En proceso
   - 🔴 **Error**: Revisa la configuración

4. **Solo crearlos una vez**: Una vez creados, no necesitas volver a crearlos.

---

## 🔗 Enlaces Útiles

- [Documentación de Índices de Firestore](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore CLI Reference](https://firebase.google.com/docs/cli)

---

## ✅ Checklist de Implementación

- [ ] Crear índices en Firebase Console
- [ ] Verificar que todos estén en estado "Enabled"
- [ ] Probar queries en la aplicación
- [ ] Verificar performance en Firestore → Usage
- [ ] Documentar cualquier índice adicional necesario

---

**Fecha de creación**: 14 de octubre de 2025  
**Autor**: GitHub Copilot  
**Proyecto**: DataWeave-BI - Sistema de Envíos Temporales
