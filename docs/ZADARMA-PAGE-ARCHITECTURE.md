# Página "Zadarma Test" — Arquitectura y funcionamiento interno

Este documento describe cómo está diseñada y cómo funciona la página o vista utilizada para visualizar y probar los datos de Zadarma (la "Zadarma Test" o página de Performance relacionada). Incluye el flujo de datos, componentes principales, contrato API esperado, manejo de estados, opciones de prueba y pasos de debugging.

---

## 1. Visión general

La página de Zadarma Test es una vista de la aplicación que muestra métricas y una tabla de llamadas extraídas desde Firestore (caché poblada por webhook + backfill). No consulta la API de Zadarma directamente: la UI llama al endpoint server `GET /api/zadarma/stats` que a su vez lee `zadarma_calls` en Firestore.

Objetivos de la página:
- Mostrar métricas agregadas (número de llamadas, efectividad, agentes activos).
- Permitir inspección de llamadas individuales (tabla con columnas: fecha/hora, destino, asesor, duración, estado).
- Ofrecer acciones de soporte: forzar backfill (llamar `/api/zadarma/backfill`), refrescar datos y ejecutar scripts de prueba.

---

## 2. Flujo de datos (end-to-end)

1. Origen de datos
   - Nuevo dato en tiempo real: Zadarma envía `NOTIFY_END` / `NOTIFY_MISSED` a `/api/zadarma/webhook` → servicio responde 200 y procesa en background → guarda/merge en `zadarma_calls`.
   - Histórico/rectificación: backfill lee la API de Zadarma (`/v1/statistics/pbx/`) via `fetchZadarmaAdaptive` y guarda con `saveZadarmaCalls` en Firestore.

2. Lectura para la UI
   - La página solicita datos a `GET /api/zadarma/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`.
   - `stats/route.ts` llama `getZadarmaCallsFromFirestore(startDate, endDate)` y devuelve `{ status: 'success', stats, fromCache: true, metadata }`.

3. Renderizado
   - El cliente recibe `stats` (array) y `metadata` y actualiza UI: badges, tablas, y gráficos.

---

## 3. Componentes UI (comportamiento esperado)

Nota: los nombres de componentes pueden variar según la implementación; aquí se describen las responsabilidades.

- DatePicker / Rangos
  - Permite seleccionar `startDate` y `endDate`. Al cambiar el rango la página hace fetch a `/api/zadarma/stats`.

- Badges / Indicadores
  - Badge que indica `fromCache: true` y `metadata.dataSource` (p. ej. "Datos desde Firestore (Webhook + Backfill)").

- Resumen / KPIs
  - Tarjetas con: totalCalls, answeredCalls, agentsActive, effectiveness (%). Calculadas desde `metadata` o derivados de `stats`.

- Tabla de llamadas
  - Columnas típicas: `callstart`, `destination`, `sip`/`agentName`, `duration`/`seconds`, `disposition`, `last_updated_by`.
  - Paginación o lazy-loading si el rango es grande.

- Botones de acción
  - "Refrescar" — vuelve a solicitar `/api/zadarma/stats`.
  - "Forzar Backfill" — llama `/api/zadarma/backfill?days=N` (normalmente mediante fetch desde el navegador; devuelve resumen con callsSaved).
  - "Simular Webhook" — abre una caja o usa `scripts/test-webhook-manual.ts` para enviar eventos de prueba.

---

## 4. Contrato API (qué espera la UI)

Endpoint principal: `GET /api/zadarma/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Respuesta esperada (ejemplo):

```json
{
  "status": "success",
  "stats": [ /* array de objetos tipo ZadarmaCall */ ],
  "fromCache": true,
  "metadata": {
    "totalCalls": 142,
    "dateRange": { "start": "2025-10-23", "end": "2025-10-30" },
    "agents": 12,
    "callTypes": { "outbound": 120, "answered": 90, "effectiveness": "75.0%" },
    "timeRange": { "first": "2025-10-23 08:01:00", "last": "2025-10-30 20:34:00" }
  }
}
```

Fields clave que la UI usa de cada `stat`:
- `callstart` (string "YYYY-MM-DD HH:MM:SS")
- `callDate` ("YYYY-MM-DD")
- `pbx_call_id`, `call_id_with_rec` (ids)
- `sip` / `agentName`
- `seconds` / `duration`
- `disposition`
- `last_updated_by` ("webhook" o "backfill")

Si la respuesta viene con `status: 'error'` o es 500, la UI debe mostrar un mensaje de error y permitir reintento.

---

## 5. Manejo de estados y UX

- Loading: mostrar spinner en la tabla y deshabilitar botones de acción mientras se carga.
- Empty state: mensaje informando que no hay llamadas en el rango seleccionado y sugerir ejecutar backfill o ampliar rango.
- Error state: mostrar error legible (message) y botón "Reintentar".
- Indicador de frescura: mostrar `metadata.processed` o `lastSyncTimestamp` si existe para saber cuándo se actualizó la cache.

---

## 6. Acciones de soporte / botones (cómo funcionan internamente)

- Forzar Backfill (desde navegador)
  - Ejecuta:
    ```js
    fetch('/api/zadarma/backfill?days=7')
      .then(r => r.json())
      .then(data => console.log('Backfill:', data))
    ```
  - Resultado esperado: JSON con `data.callsSaved`. Si 500 → ver logs en Vercel.

- Simular Webhook
  - Opción 1: usar el script `scripts/test-webhook-manual.ts` local/remote.
  - Opción 2: herramienta interna que hace POST al endpoint `/api/zadarma/webhook` con payload sintético.

---

## 7. Debugging y verificación rápida

1. Si la página no muestra datos:
   - Ejecutar directamente en el navegador:
     ```js
     fetch('/api/zadarma/stats?startDate=2025-10-30&endDate=2025-10-30').then(r=>r.json()).then(console.log)
     ```
   - Verificar que `stats` no esté vacío.

2. Si `/api/zadarma/stats` devuelve vacío pero Firestore tiene docs:
   - Revisar que `callDate` en documentos esté en formato `YYYY-MM-DD` y caiga dentro del rango.
   - Ejecutar la consulta en consola de Firestore.

3. Si el backfill da 500 o la UI muestra TypeError (p. ej. `data.callsSaved` indefinido):
   - Comprobar despliegue en Vercel y env vars (`ZADARMA_API_KEY`, `ZADARMA_API_SECRET`, `SERVICE_ACCOUNT`).
   - Revisar logs de la función `/api/zadarma/backfill` en Vercel (stack trace). Copiar payload del error.

4. Si webhook no está grabando llamadas:
   - Probar verificación `GET /api/zadarma/webhook?zd_echo=test123` (debe devolver `test123`).
   - Simular POST con `scripts/test-webhook-manual.ts` y comprobar Firestore.

---

## 8. Desarrollo local y mocking

- Si no tienes credenciales de Zadarma o Firestore disponibles en local:
  - Usa `scripts/fill-test-data.ts` para poblar `zadarma_calls` con ejemplos.
  - Mockear `fetch('/api/zadarma/stats')` en el cliente o usar un proxy que devuelva un JSON estático.

---

## 9. Recomendaciones de mejora (rápidas)

- Añadir un pequeño endpoint interno `/api/debug/zadarma/stats-sample` que devuelva un set de datos mock para desarrollo.
- Integrar un spinner y mensajes claros en la UI para cada estado (loading/empty/error).
- Añadir métricas de telemetría (Sentry / logs) para capturar errores 500 en backfill y webhook.

---

Si quieres, puedo:
- Añadir diagramas pequeños (ASCII) del flujo.
- Generar un archivo `scripts/check-backfill-response.ts` que haga la llamada al backfill y verifique la forma de la respuesta, y añadirlo a `package.json`.

¿Quieres que lo agregue ahora? 
