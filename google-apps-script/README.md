# 📦 Google Apps Script - Inventory Sync

## 🎯 Descripción

Script de sincronización automática entre Google Sheets y webhooks de DataWeave BI.

**Funcionalidades:**
- ✅ Sincronización de 4 hojas: REPORTE_ENVIADOS, ENTREGADO, PROVINCIA_ENVIADOS, LIMA_ENVIADOS
- ✅ Triggers automáticos cada 5 minutos (configurable)
- ✅ Trigger manual on-edit para cambios en tiempo real
- ✅ Sistema de batching para hojas grandes (>500 filas)
- ✅ Logging detallado y manejo robusto de errores

---

## 📋 Hojas Soportadas

| Hoja | Webhook | Tipo | ID Único | Batching |
|------|---------|------|----------|----------|
| **PROVINCIA_ENVIADOS** | `/api/webhooks/envios-temporales` | Temporal | PEDIDO | ✅ 75/batch |
| **LIMA_ENVIADOS** | `/api/webhooks/envios-temporales` | Temporal | PEDIDO | ✅ 75/batch |
| **REPORTE_ENVIADOS** | `/api/webhooks/sheets` | Histórico | PEDIDO | ✅ 75/batch |
| **ENTREGADO** | `/api/webhooks/delivered` | Histórico | ID | ✅ 75/batch |

---

## 🚀 Instalación

### 1. Copiar script al proyecto

1. Abre tu Google Sheet
2. Ve a **Extensiones** → **Apps Script**
3. Copia el contenido de `inventory-sync.js`
4. Pega en el editor de Apps Script
5. Guarda con nombre "inventory-sync"

### 2. Configurar URLs de webhooks

Edita las constantes en `CONFIG`:

```javascript
const CONFIG = {
  SHIPPED_WEBHOOK_URL: 'https://tu-dominio.vercel.app/api/webhooks/sheets',
  DELIVERED_WEBHOOK_URL: 'https://tu-dominio.vercel.app/api/webhooks/delivered',
  ENVIOS_TEMPORALES_WEBHOOK_URL: 'https://tu-dominio.vercel.app/api/webhooks/envios-temporales',
  // ...
};
```

### 3. Autorizar permisos

1. Ejecuta la función `onOpen()` manualmente
2. Acepta los permisos solicitados
3. Refresca el Sheet → debería aparecer menú "Sincronización DataWeave"

---

## 📱 Uso del Menú

### Menú: "Sincronización DataWeave"

```
1. Sincronizar PROVINCIA ENVIADOS (Temporal)
2. Sincronizar LIMA ENVIADOS (Temporal)  
3. Sincronizar REPORTE ENVIADOS
4. Sincronizar ENTREGADO
──────────────────────────────
5. Activar Sincronización Automática
6. Desactivar Sincronización Automática
```

### Opciones Manuales (1-4)

- **Uso:** Sincroniza la hoja seleccionada inmediatamente
- **Comportamiento:** 
  - Lee todas las filas
  - Las divide en lotes de 75
  - Envía cada lote con delay de 500ms
  - Muestra alerta de éxito/error
- **Cuándo usar:** Testing, sincronización puntual, verificación

### Sincronización Automática (5)

**Al activar:**
- Crea 1 trigger time-based que ejecuta `runAutoSyncAll()`
- Frecuencia: cada 5 minutos (configurable en `CONFIG.TRIGGER_FREQUENCY_MINUTES`)
- Ejecuta en **background** (sin mostrar alertas UI)
- Sincroniza las 4 hojas automáticamente

**Permisos requeridos:**
- Si aparece error, ve a **Extensiones → Apps Script**
- Ejecuta `createTriggers()` manualmente
- Acepta scope: `https://www.googleapis.com/auth/script.scriptapp`

### Desactivar Automática (6)

- Elimina todos los triggers creados
- La hoja deja de sincronizarse automáticamente
- Puedes seguir usando opciones manuales (1-4)

---

## 🔧 Trigger On-Edit (Opcional)

### Para activar sincronización al editar filas:

1. Ve a **Apps Script** → **Triggers** (icono reloj ⏰)
2. Click **+ Agregar activador**
3. Configuración:
   - **Función:** `onSheetEdit`
   - **Evento:** `Desde hoja de cálculo` → `Al editar`
   - **Fuente del evento:** `Desde hoja de cálculo`
4. Guardar

**Comportamiento:**
- Solo envía las filas editadas (no toda la hoja)
- Usa batching si editas muchas filas a la vez
- Identifica automáticamente la hoja y usa el webhook correcto
- Especial: LIMA_ENVIADOS usa columna CLAVES (W) como COURIER

---

## 📦 Sistema de Batching

### ¿Qué es?

Para evitar error **413 FUNCTION_PAYLOAD_TOO_LARGE**, el script divide hojas grandes en lotes pequeños.

### Configuración

```javascript
const CONFIG = {
  BATCH_SIZE: 75,        // Filas por lote
  BATCH_DELAY_MS: 500    // Delay entre lotes (ms)
};
```

### Funcionamiento

```
Hoja con 300 filas
  ↓
Divide en 4 lotes de 75
  ↓
Lote 1 (filas 1-75)   → POST webhook → wait 500ms
Lote 2 (filas 76-150) → POST webhook → wait 500ms
Lote 3 (filas 151-225) → POST webhook → wait 500ms
Lote 4 (filas 226-300) → POST webhook → Fin
  ↓
Total: 4 requests, ~2 segundos
```

### Logs

Cada lote registra en Logger:

```
[BATCH] Enviando lote 1 de 4 (75 registros)
[BATCH] Lote 1 enviado exitosamente (200)
[BATCH] Enviando lote 2 de 4 (75 registros)
...
```

**Ver logs:** Apps Script → Ejecuciones → Ver detalles

---

## ⚙️ Configuración Avanzada

### Cambiar frecuencia de sync automática

```javascript
const CONFIG = {
  TRIGGER_FREQUENCY_MINUTES: 10  // Cambiar a 10 minutos
  // o
  TRIGGER_FREQUENCY_HOURS: 1     // Cambiar a 1 hora
};
```

### Cambiar tamaño de lotes

```javascript
const CONFIG = {
  BATCH_SIZE: 50,       // Lotes más pequeños (más requests, más seguros)
  BATCH_DELAY_MS: 1000  // Mayor delay (más lento, menos rate limiting)
};
```

### Agregar nueva hoja

1. Agrega constantes en `CONFIG`:
```javascript
const CONFIG = {
  MI_NUEVA_HOJA_WEBHOOK_URL: 'https://...',
  MI_NUEVA_HOJA_SHEET_NAME: 'MI_HOJA',
  MI_NUEVA_HOJA_UNIQUE_ID_COLUMN: 'ID'
};
```

2. Crea función de trigger:
```javascript
function triggerMiNuevaHojaSync() {
  syncSheet(
    CONFIG.MI_NUEVA_HOJA_SHEET_NAME,
    CONFIG.MI_NUEVA_HOJA_UNIQUE_ID_COLUMN,
    CONFIG.MI_NUEVA_HOJA_WEBHOOK_URL,
    'MI_TIPO',
    true // usar log
  );
}
```

3. Agrega al menú en `onOpen()`:
```javascript
.addItem('7. Sincronizar MI_NUEVA_HOJA', 'triggerMiNuevaHojaSync')
```

4. Agrega a `runAutoSyncAll()` si quieres sync automática

---

## 🐛 Troubleshooting

### Error: "FUNCTION_PAYLOAD_TOO_LARGE" (413)

**Causa:** Hoja muy grande, payload excede límite  
**Solución:** ✅ Ya implementado batching automático  
**Verificar:** Revisa logs, debería ver múltiples lotes enviándose

### Error: "No se pudieron crear triggers por permisos insuficientes"

**Causa:** Scope `script.scriptapp` no autorizado  
**Solución:**
1. Ve a **Apps Script** editor
2. Ejecuta `createTriggers()` manualmente
3. Acepta permisos cuando aparezca popup
4. Regresa al Sheet y prueba de nuevo

### Error: "Request Entity Too Large" del webhook

**Causa:** Backend tiene límite menor que 75 filas/batch  
**Solución:** Reduce `BATCH_SIZE` a 50 o 25

### Sincronización automática no funciona

**Verificar:**
1. ¿Aparece trigger en Apps Script → Triggers?
2. ¿El trigger está habilitado (no en gris)?
3. ¿Las ejecuciones aparecen en Apps Script → Ejecuciones?
4. ¿Los logs muestran errores?

**Solución común:**
- Desactiva y reactiva sincronización automática
- Verifica que `runAutoSyncAll` esté en la lista de triggers

### Logs no aparecen

**Apps Script Logger:**
1. Ve a **Apps Script** → **Ejecuciones**
2. Click en la última ejecución
3. Click en "Ver registros"

**Webhook logs (Vercel):**
1. Ve a Vercel Dashboard
2. Functions → Busca tu webhook
3. Revisa logs en tiempo real

---

## 📊 Monitoreo

### Verificar que funciona

1. **Logs de Apps Script:**
   - Busca `[BATCH]` para ver lotes enviados
   - Busca códigos 200 (éxito)
   - Busca errores si hay problemas

2. **Logs de Vercel:**
   - Filtra por `/api/webhooks/envios-temporales`
   - Verifica que lleguen POST requests
   - Revisa payload y response

3. **Firestore Console:**
   - Revisa colección `envios_temporales`
   - Verifica timestamps actualizados
   - Compara cantidad de docs con filas del Sheet

### Métricas esperadas

**Sync manual de hoja con 300 filas:**
- Tiempo: ~2-3 segundos
- Requests: 4 (4 lotes de 75)
- Logs: 4 mensajes `[BATCH] Lote X enviado`

**Sync automática cada 5 minutos:**
- 4 hojas × 4 requests promedio = 16 requests cada 5 min
- ~200 requests/hora (aprox)

---

## 🔒 Seguridad

### Buenas prácticas

- ✅ No hardcodear secrets en el script
- ✅ Usar Script Properties para configuración sensible
- ✅ Limitar acceso al Sheet a usuarios autorizados
- ✅ Webhook debe validar origen (IP, token, etc.)
- ✅ Logs no deben mostrar datos sensibles

### Script Properties (opcional)

Para evitar hardcodear URLs:

```javascript
// En vez de:
const WEBHOOK_URL = 'https://...';

// Usar:
const scriptProperties = PropertiesService.getScriptProperties();
const WEBHOOK_URL = scriptProperties.getProperty('WEBHOOK_URL');
```

**Configurar:**
1. Apps Script → Configuración del proyecto → Script Properties
2. Agregar clave-valor: `WEBHOOK_URL` = `https://...`

---

## 📚 Funciones Principales

### Públicas (callable desde menú/triggers)

| Función | Descripción | Parámetros |
|---------|-------------|------------|
| `onOpen()` | Crea menú en UI | - |
| `createTriggers()` | Activa sync automática | - |
| `deleteTriggers()` | Desactiva sync automática | - |
| `triggerProvinciaEnviadosSync()` | Sync manual PROVINCIA | - |
| `triggerLimaEnviadosSync()` | Sync manual LIMA | - |
| `triggerShippedSync()` | Sync manual REPORTE | - |
| `triggerDeliveredSync()` | Sync manual ENTREGADO | - |
| `onSheetEdit(e)` | Trigger on-edit | event |
| `runAutoSyncAll()` | Sync background (todas) | - |

### Internas (helpers)

| Función | Descripción |
|---------|-------------|
| `syncSheetTemporal()` | Sync hoja temporal con batching |
| `syncSheet()` | Sync hoja histórica con batching |
| `findRowsToSendTemporal()` | Lee filas de hoja temporal |
| `findRowsToSend()` | Lee filas de hoja histórica (con log) |
| `chunkArray()` | Divide array en lotes |
| `sendDataInBatches()` | Envía lotes con delay |
| `sendPayloadToWebhook()` | POST a webhook |
| `isManualExecution()` | Detecta si es manual o trigger |

---

## 🎯 Casos de Uso

### Caso 1: Primera sincronización (hoja vacía en backend)

1. Activa "Sincronizar PROVINCIA ENVIADOS"
2. Script lee TODAS las filas
3. Divide en lotes de 75
4. Envía al webhook
5. Backend crea docs en Firestore

### Caso 2: Sync incremental (solo nuevas filas)

**Hoja histórica (REPORTE_ENVIADOS):**
1. Script revisa hoja LOG_ENVIOS
2. Identifica filas NO enviadas
3. Envía solo nuevas (con batching si >75)

**Hoja temporal (PROVINCIA_ENVIADOS):**
1. Siempre envía TODAS las filas
2. Backend hace diff y detecta cambios
3. Actualiza/crea/elimina según corresponda

### Caso 3: Edición manual en tiempo real

1. Usuario edita fila en Sheet
2. Trigger on-edit captura evento
3. Script envía solo esa fila al webhook
4. Backend actualiza Firestore inmediatamente
5. UI se actualiza en 30 segundos (auto-refresh)

---

## 📝 Changelog

### v2.0 - 15 Oct 2025
- ✅ Implementado batching automático (75 filas/lote)
- ✅ Sistema de reintentos y delays
- ✅ Logging detallado por lote
- ✅ Manejo robusto de errores
- ✅ Soporte para hojas ilimitadas

### v1.5 - 14 Oct 2025
- Agregado soporte LIMA_ENVIADOS
- Mapping especial: CLAVES → COURIER para LIMA

### v1.0 - Initial
- Sincronización básica de 4 hojas
- Triggers manuales y automáticos

---

## 🆘 Soporte

**Problemas comunes:**
- Ver sección [🐛 Troubleshooting](#-troubleshooting)

**Documentación adicional:**
- `docs/RESUMEN-MEJORAS-2025-10-15.md` - Detalles de batching
- `docs/GUIA-MIGRACION-FIREBASE.md` - Setup del backend

**Logs útiles:**
- Apps Script → Ejecuciones
- Vercel → Functions → Logs
- Firebase Console → Firestore

---

**Última actualización:** 15 de octubre de 2025  
**Versión:** 2.0  
**Mantenedor:** DataWeave BI Team
