# Resumen Completo de Cambios - Envíos Temporales

**Fecha**: 14 de octubre de 2025
**Branch**: REUT_1

---

## 1) Resumen ejecutivo

Se implementó un sistema completo para gestionar envíos temporales provenientes de Google Sheets (hojas `PROVINCIA_ENVIADOS` y `LIMA_ENVIADOS`) y sincronizarlos con Firestore mediante un webhook unificado. También se añadieron componentes frontend para visualizar los envíos en `/dashboard/shipments`.

Estado actual:
- Backend (webhook + sincronización) ✅
- Google Apps Script (sincronización desde Sheets) ✅
- Frontend (componentes y UI) ✅
- Índices Firestore: configurados; deployado parcialmente (requiere permisos/compilando)

---

## 2) Archivos principales añadidos/modificados

### Google Apps Script
- `google-apps-script/inventory-sync.js` (modificado)
  - Añadida configuración central `ENVIOS_TEMPORALES_WEBHOOK_URL`
  - Soporte para `PROVINCIA_ENVIADOS` y `LIMA_ENVIADOS`
  - Nuevas funciones: `syncSheetTemporal`, `triggerProvinciaEnviadosSync`, `triggerLimaEnviadosSync`
  - Triggers automáticos: ahora al activar usan **5 minutos** (`TRIGGER_FREQUENCY_MINUTES: 5`) y se crean con `ScriptApp.newTrigger(...).timeBased().everyMinutes(5)`

### Backend (Next.js API)
- `src/app/api/webhooks/envios-temporales/route.ts` (creado)
  - POST: procesa arrays de envíos temporales (PROVINCIA/LIMA)
  - Lógica: crear/actualizar envíos activos, detectar cambios de estado, detectar eliminaciones, registrar historial
  - GET: endpoint diagnóstico para estadísticas en tiempo real

### Frontend (Componentes React)
- `src/hooks/useEnviosTemporales.ts` (creado)
  - Hook con auto-refresh (30s) para consultar `/api/webhooks/envios-temporales`
- `src/components/dashboard/EnviosTemporalesKPIs.tsx` (creado)
  - 4 KPIs principales
- `src/components/dashboard/EstadosTemporalesTable.tsx` (creado)
  - Tabla PROVINCIA vs LIMA por estado
- `src/components/dashboard/CourierPerformanceChart.tsx` (creado)
  - Pie + Bar charts usando Recharts
- `src/app/(app)/dashboard/shipments/page.tsx` (modificado)
  - Nueva sección "Envíos en Tránsito (Tiempo Real)" integrada

### Índices y deployment
- `firestore.indexes.json` (creado)
  - 10 índices compuestos para `envios_temporales` y `envios_temporales_historial`
- `firebase.json` (creado temporalmente)
- Scripts para gestionar índices:
  - `scripts/create-firestore-indexes.js` (creado) — crea índices via API usando service account
  - `scripts/list-firestore-indexes.js` (creado) — lista índices del proyecto y compara
  - `scripts/README_CREATE_INDEXES.md` (creado)

### Documentación
- `RESUMEN-FINAL-ENVIOS-TEMPORALES.md` (existente, actualizado)
- `FIRESTORE-INDEXES.md` (creado)
- `GUIA-DEPLOYMENT.md` (creado)
- `CHANGELOG-FRONTEND-ENVIOS-TEMPORALES.md` (creado)
- `CHECKLIST-VERIFICACION-VISUAL.md` (creado)
- `RESUMEN-CAMBIO-COMPLETO.md` (este archivo)

---

## 3) Detalle técnico (lo esencial)

### Flujo de datos

Google Sheets (hojas temporales) → Apps Script (triggers 5min/1h) → Webhook `/api/webhooks/envios-temporales` → Firestore (`envios_temporales` + `envios_temporales_historial`) → Frontend (`/dashboard/shipments`) via `useEnviosTemporales` hook

### Estado/Estados soportados
- 14 estados: ENVIADO, EN TRANSITO, EN DESTINO, TIENDA, DEVOLUCIÓN, PAGADO, ORIGEN, L - EN RUTA, L - PREPARADO, L - DEVOLUCIÓN, L - REPROGRAMAR, L - NO CONTESTA, L - ENTREGADO

### Firestore schema resumido
- `envios_temporales`: documentos activos con `pedidoId`, `tipoOrigen`, `estado`, `courier`, `tienda`, `provincia`, `enReporteEnviados`, `eliminadoDeTransito`, timestamps
- `envios_temporales_historial`: eventos con `pedidoId`, `evento`, `timestamp`, `estadoAnterior`, `estadoNuevo`

---

## 4) Acciones realizadas en este sprint

- Implementación completa del webhook y lógica de negocio
- Script Google Apps Script actualizado con triggers cada 5 minutos y funciones para hojas temporales
- Componentes UI de visualización creados y página `shipments` actualizada
- Documentación extensa y checklist de verificación
- Indices preparados y deploy intentado; creado script de creación si CLI falla por permisos

---

## 5) Qué verificar ahora (QA rápido)

1. Google Sheets: activar el menú y pulsar "Activar Sincronización Automática" → revisar que se creen 4 triggers y que su frecuencia sea 5 minutos
2. Firebase: revisar Firestore → Indexes y esperar a que los índices entren en estado `Ready`
3. Frontend: abrir `http://localhost:9002/dashboard/shipments` y verificar sección "Envíos en Tránsito"
4. Logs: revisar Vercel Logs para `/api/webhooks/envios-temporales` y verificar que POST/GET responden OK

---

## 6) Recomendaciones y próximos pasos

- Verificar permisos del proyecto y habilitar API Firestore si es necesario
- Dejar que los índices se compilen totalmente
- Test end-to-end: realizar sincronización manual desde Google Sheets y validar que los envíos aparecen en la UI
- Posible mejora: añadir paginación y filtros en la tabla de envíos temporales

---

## 7) Cambios en `inventory-sync.js` (snippet relevante)

- Configuración de frecuencia por minutos:
```javascript
TRIGGER_FREQUENCY_HOURS: 1,
TRIGGER_FREQUENCY_MINUTES: 5
```
- Creación de triggers con prioridad a minutos:
```javascript
const useMinutes = typeof CONFIG.TRIGGER_FREQUENCY_MINUTES === 'number' && CONFIG.TRIGGER_FREQUENCY_MINUTES > 0;
// ...
if (useMinutes) {
  trig.everyMinutes(CONFIG.TRIGGER_FREQUENCY_MINUTES).create();
} else {
  trig.everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS).create();
}
```

---

## 8) Status del deploy de índices

- Intento con Firebase CLI falló inicialmente por permisos (403). Se creó `firebase.json` y se reintentó; la consola del proyecto muestra índices en estado "Compilando...". Si necesitas, puedo limpiar índices redundantes o esperar a que pasen a `Ready`.

---

## 9) Archivos -> resumen de tamaños

- `firestore.indexes.json`: 3 KB
- `scripts/create-firestore-indexes.js`: 2.6 KB
- `scripts/list-firestore-indexes.js`: 3.2 KB
- `google-apps-script/inventory-sync.js`: modificado (ver historial)

---

Si quieres, ahora:
- Puedo ejecutar el script `scripts/create-firestore-indexes.js` para intentar crear índices usando la service account (si confirmas que la service account tiene permisos).  
- O puedo generar la lista de índices redundantes y borrarlos (si quieres limpiar la consola).  

Dime qué prefieres y lo hago en seguida.
