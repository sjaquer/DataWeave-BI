---
Date: 2025-10-14
---

# Ãndices de Firestore para EnvÃ­os Temporales

Este documento describe los Ã­ndices compuestos necesarios en Firestore para optimizar las queries del sistema de envÃ­os temporales.

## ðŸ“ Â¿DÃ³nde crear estos Ã­ndices?

1. **Firebase Console**: https://console.firebase.google.com/
2. Selecciona tu proyecto: **DataWeave-BI**
3. Ve a **Firestore Database** â†’ **Indexes** â†’ **Composite**

## ðŸ” Ãndices Necesarios

### ColecciÃ³n: `envios_temporales`

#### Ãndice 1: Filtrado por Estado de Activos
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

#### Ãndice 2: Por Tipo de Origen y Estado
```
Collection ID: envios_temporales
Fields indexed:
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)
  - eliminadoDeTransito (Ascending)

Query scope: Collection
```

**Uso**: Separar pedidos de PROVINCIA vs LIMA que estÃ¡n activos.

---

#### Ãndice 3: Por Estado de Pedido
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

#### Ãndice 4: Por Courier
```
Collection ID: envios_temporales
Fields indexed:
  - courier (Ascending)
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: AnÃ¡lisis de rendimiento por courier separado por origen.

---

#### Ãndice 5: Por Provincia
```
Collection ID: envios_temporales
Fields indexed:
  - provincia (Ascending)
  - estado (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: VisualizaciÃ³n geogrÃ¡fica de envÃ­os.

---

#### Ãndice 6: Por Tienda
```
Collection ID: envios_temporales
Fields indexed:
  - tienda (Ascending)
  - tipoOrigen (Ascending)
  - enReporteEnviados (Ascending)

Query scope: Collection
```

**Uso**: AnÃ¡lisis por tienda de origen.

---

### ColecciÃ³n: `envios_temporales_historial`

#### Ãndice 7: Historial por Pedido
```
Collection ID: envios_temporales_historial
Fields indexed:
  - pedidoId (Ascending)
  - timestamp (Ascending)

Query scope: Collection
```

**Uso**: Ver el historial completo de un pedido especÃ­fico.

---

#### Ãndice 8: Por Tipo de Evento
```
Collection ID: envios_temporales_historial
Fields indexed:
  - evento (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: Filtrar eventos especÃ­ficos (ENTRADA_TRANSITO, CAMBIO_ESTADO, SALIDA_TRANSITO).

---

#### Ãndice 9: Por Tipo de Origen
```
Collection ID: envios_temporales_historial
Fields indexed:
  - tipoOrigen (Ascending)
  - evento (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: AnÃ¡lisis de eventos separados por PROVINCIA vs LIMA.

---

#### Ãndice 10: Por Courier en Historial
```
Collection ID: envios_temporales_historial
Fields indexed:
  - courier (Ascending)
  - timestamp (Descending)

Query scope: Collection
```

**Uso**: Analizar rendimiento histÃ³rico de cada courier.

---

## ðŸš€ CreaciÃ³n AutomÃ¡tica vÃ­a CLI

Si prefieres crear los Ã­ndices vÃ­a lÃ­nea de comandos, puedes usar el Firebase CLI:

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

Crea este archivo en la raÃ­z del proyecto:

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

## ðŸ“Š Queries Que Usan Estos Ãndices

### Query 1: Pedidos Activos
```typescript
const activos = await db.collection('envios_temporales')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .orderBy('ultimaActualizacion', 'desc')
  .get();
```
**Usa Ãndice 1**

---

### Query 2: Pedidos por Tipo de Origen
```typescript
const provincia = await db.collection('envios_temporales')
  .where('tipoOrigen', '==', 'PROVINCIA')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();
```
**Usa Ãndice 2**

---

### Query 3: Por Estado
```typescript
const enTransito = await db.collection('envios_temporales')
  .where('estado', '==', 'EN TRANSITO')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();
```
**Usa Ãndice 3**

---

### Query 4: Por Courier
```typescript
const shalom = await db.collection('envios_temporales')
  .where('courier', '==', 'SHALOM')
  .where('tipoOrigen', '==', 'PROVINCIA')
  .where('enReporteEnviados', '==', false)
  .get();
```
**Usa Ãndice 4**

---

### Query 5: Historial de Pedido
```typescript
const historial = await db.collection('envios_temporales_historial')
  .where('pedidoId', '==', '49268')
  .orderBy('timestamp', 'asc')
  .get();
```
**Usa Ãndice 7**

---

### Query 6: Eventos Recientes
```typescript
const cambiosEstado = await db.collection('envios_temporales_historial')
  .where('evento', '==', 'CAMBIO_ESTADO')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();
```
**Usa Ãndice 8**

---

## âš ï¸ IMPORTANTE

1. **Crear ANTES de usar las queries**: Firestore darÃ¡ error si intentas hacer queries sin los Ã­ndices.

2. **Tiempo de creaciÃ³n**: Los Ã­ndices pueden tardar varios minutos en estar listos.

3. **Verificar estado**: En Firebase Console â†’ Firestore â†’ Indexes, verÃ¡s el estado:
   - ðŸŸ¢ **Enabled**: Listo para usar
   - ðŸŸ¡ **Building**: En proceso
   - ðŸ”´ **Error**: Revisa la configuraciÃ³n

4. **Solo crearlos una vez**: Una vez creados, no necesitas volver a crearlos.

---

## ðŸ”— Enlaces Ãštiles

- [DocumentaciÃ³n de Ãndices de Firestore](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Firebase Console](https://console.firebase.google.com/)
- [Firestore CLI Reference](https://firebase.google.com/docs/cli)

---

## âœ… Checklist de ImplementaciÃ³n

- [ ] Crear Ã­ndices en Firebase Console
- [ ] Verificar que todos estÃ©n en estado "Enabled"
- [ ] Probar queries en la aplicaciÃ³n
- [ ] Verificar performance en Firestore â†’ Usage
- [ ] Documentar cualquier Ã­ndice adicional necesario

---

**Fecha de creaciÃ³n**: 14 de octubre de 2025  
**Autor**: GitHub Copilot  
**Proyecto**: DataWeave-BI - Sistema de EnvÃ­os Temporales

