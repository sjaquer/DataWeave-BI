## Explicación de archivos relacionados con Zadarma

Este documento resume, en español, cada archivo del repositorio que toca la integración con la API de Zadarma: qué hace, entradas/salidas esperadas, errores comunes y qué se intentó implementar en cada uno.

---

### 1) `src/app/api/zadarma/webhook/route.ts`

- Propósito
  - Implementar el endpoint webhook que Zadarma usa para enviar eventos en tiempo real.
  - Soporta `GET` para verificación (`?zd_echo=...`) y `POST` para recibir eventos (`NOTIFY_END`, `NOTIFY_MISSED`).

- Flujo / comportamiento
  - `GET`: obtiene `zd_echo` de query params y devuelve exactamente ese valor en texto plano (requisito de Zadarma para verificar el webhook).
  - `POST`: devuelve inmediatamente `200 OK` con `{ status: 'ok' }` para evitar timeouts; procesa el payload en background.
  - Para `NOTIFY_END` y `NOTIFY_MISSED` valida el payload con `zod` y persiste (upsert) en `zadarma_calls` usando `set(..., { merge: true })`.

- Inputs
  - JSON enviado por Zadarma (campos: `event`, `call_start`, `pbx_call_id`, `call_id_with_rec`, `duration`, `disposition`, `caller_id`, `called_did`, `sip`, etc.).

- Outputs
  - Respuesta HTTP 200 inmediata a Zadarma; en Firestore se crea/actualiza un documento por llamada.

- Qué se intentó implementar
  - Idempotencia: docId determinístico (call_id_with_rec o pbx_call_id). Merge para convivencia con backfill.
  - Validación estricta con `zod` para evitar datos inconsistentes.
  - Procesamiento asíncrono (responder 200 antes de procesar) para no bloquear a Zadarma.

- Puntos críticos / fallos comunes
  - Si `call_start` no viene con el formato esperado, la conversión a `Timestamp` puede fallar.
  - Si `SERVICE_ACCOUNT` o `db` no está inicializado en el entorno, el intento de `db.collection(...).set()` fallará en runtime.

---

### 2) `src/app/api/zadarma/backfill/route.ts`

- Propósito
  - Endpoint público (GET) que permite lanzar un backfill desde producción: `/api/zadarma/backfill?days=N`.

- Flujo / comportamiento
  - Valida `days` (1–90). Calcula `startDate` y `endDate` (rango de días solicitados).
  - Llama `fetchZadarmaAdaptive(startDate, endDate, apiKey, apiSecret)` para obtener llamadas desde la API de Zadarma (con división adaptativa si es necesario).
  - Llama `saveZadarmaCalls(calls)` para guardar en Firestore en batch.
  - Devuelve JSON con `status`, `message` y `data: { days, range, callsProcessed, callsSaved }`.

- Inputs
  - Query param `days` (opcional, default 7).
  - Variables de entorno: `ZADARMA_API_KEY`, `ZADARMA_API_SECRET`.

- Outputs
  - JSON con resumen del backfill o error 500 con `message` y `error`.

- Qué se intentó implementar
  - Reutilizar las funciones probadas `fetchZadarmaAdaptive` y `saveZadarmaCalls` para evitar duplicación de lógica y problemas de firma.
  - Proveer una forma sencilla de ejecutar backfill desde el navegador (sin exponer credenciales locales).

- Puntos críticos / fallos comunes
  - Si las env vars `ZADARMA_API_KEY`/`SECRET` no están configuradas en Vercel, el endpoint puede fallar con 500.
  - Si `fetchZadarmaAdaptive` produce un array vacío por error interno, la respuesta aún puede ser success pero con `callsProcessed:0`.

---

### 3) `src/app/api/zadarma/stats/route.ts`

- Propósito
  - Endpoint de lectura para la UI (performance page). Devuelve llamadas desde Firestore para un rango dado.

- Flujo / comportamiento
  - Requiere `startDate` y `endDate` como query params (`YYYY-MM-DD`).
  - Llama `getZadarmaCallsFromFirestore(startDate, endDate)` y calcula metadata (totalCalls, agents, effectiveness, timeRange).
  - Siempre devuelve los datos desde la cache de Firestore (webhook + backfill poblan la colección).

- Qué se intentó implementar
  - Simplificar la lógica: la UI no consulta directamente Zadarma API, lee solo la cache en Firestore.
  - Generar metadata útil para la visualización (agentes únicos, llamadas contestadas, etc.).

- Puntos críticos / fallos comunes
  - Si Firestore está vacío o no hay índices, la respuesta puede venir vacía; la query usa `callDate` para evitar índices compuestos.

---

### 4) `src/lib/zadarma-helpers.ts`

- Funciones principales
  - `fetchZadarmaAdaptive(startDate, endDate, apiKey, apiSecret)`
    - Fetch adaptativo: divide rangos si la API devuelve muchos registros (evita pérdida por límites del endpoint).
    - Ordena y deduplica por `pbx_call_id + callstart`.
  - `fetchZadarmaDirectAdaptive(startStr, endStr, apiKey, apiSecret)`
    - Implementa la firma: MD5(queryString) → concat `method + queryString + md5` → HMAC-SHA1(apiSecret) → Base64 → `Authorization: ${apiKey}:${signature}`.
    - Maneja 429 con `Retry-After` y retry/backoff.
  - `saveZadarmaCalls(calls)`
    - Crea batch de Firestore, genera `docId` determinístico `${pbx_call_id}_${callstart_sin_espacios}`, usa `set(..., { merge: true })`.
  - `getZadarmaCallsFromFirestore(startDate, endDate)`
    - Consulta por `callDate` y ordena en memoria por `callstart` (evita índices compuestos en Firestore).
  - Locks y metadata
    - `setSyncLock`, `removeSyncLock`, `isSyncLocked`, `saveSyncMetadata`, `getMissingDaysFromFirestore`.

- Qué se intentó implementar
  - Centralizar toda la lógica de comunicación con Zadarma (firma, paginación/limites, deduplicación) para que endpoints y scripts la reutilicen.
  - Implementar un fetch robusto que divida rangos grandes y respete límites (tolerancia a 429).

- Puntos críticos / fallos comunes
  - Errores en la generación/signatura provocan rechazo de la API (causa de fallos previos).
  - La conversión de formatos de fecha debe ser exacta (`yyyy-MM-dd HH:mm:ss`).

---

### 5) `src/lib/firebase-admin.ts`

- Propósito
  - Inicializar `firebase-admin` solo si `SERVICE_ACCOUNT` está presente (cadena JSON en env var).
  - Exportar `db` y `getDb`.

- Qué se intentó implementar
  - Evitar que el build/runtime falle en entornos donde no se quiera inicializar admin (p.ej. en desarrollo sin credenciales).

- Puntos críticos
  - Si `SERVICE_ACCOUNT` falta en producción, las funciones que requieren Firestore fallarán.

---

### 6) `scripts/zadarma-backfill.ts`

- Propósito
  - Script local para backfill por horas; pensado para cargas masivas o rectificación.

- Flujo / comportamiento
  - Convierte fechas locale → UTC con `date-fns-tz`.
  - Para cada hora llama la API con la ventana de 1 hora, guarda las llamadas con `saveCallToFirestore` y pausa 21s entre llamadas para respetar límite (~3/min).
  - Imprime logs detallados y resumen final.

- Qué se intentó implementar
  - Un backfill seguro y pausado que no supere el rate limit; usar hora-por-hora para minimizar posibilidad de truncamiento por demasiados resultados.

- Puntos críticos
  - Es costoso en tiempo para rangos largos (horas * 21s). Requiere ejecutar en una máquina estable (no terminar antes).

---

### 7) `scripts/test-webhook-manual.ts`

- Propósito
  - Enviar eventos sintéticos al webhook de producción para verificar guardado en Firestore.

- Qué se intentó implementar
  - Proveer una forma reproducible de verificar el pipeline webhook → Firestore sin llamadas reales.

---

### 8) `scripts/fill-test-data.ts`

- Propósito
  - Generar datos de prueba en `zadarma_calls` para usar en UI y pruebas cuando no hay datos reales.

---

### 9) `package.json` — scripts relevantes

- `zadarma:backfill` — ejecuta `scripts/zadarma-backfill.ts` localmente.
- `zadarma:backfill:test` — backfill de prueba (1 día).
- `test:webhook` — ejecuta `scripts/test-webhook-manual.ts`.

---

## Resumen de lo que se intentó lograr en el conjunto

- Migración de polling → Webhook + Backfill:
  - Objetivo: latencia baja (webhook) sin consumir rate limit constantemente (backfill solo cuando haga falta y con pausas).
  - Deduplicación e idempotencia mediante `docId` determinístico y `set(..., { merge: true })`.
  - Centralizar la lógica de acceso a Zadarma en `zadra-helpers` para evitar errores de firma y comportamiento inconsistente.

- Robustez:
  - Manejo de 429 (reintentos) y segmentación adaptativa para evitar perder registros cuando la API responde grandes volúmenes.
  - Process model: responder 200 a Zadarma y procesar en background.

---

## Ejemplos de comandos rápidos

```powershell
# Probar webhook local
curl -X POST "http://localhost:9002/api/zadarma/webhook" -H "Content-Type: application/json" -d '{"event":"NOTIFY_END","pbx_call_id":"test123","call_start":"2025-10-30 10:00:00","duration":"120","disposition":"answered","caller_id":"+51999999999","called_did":"+51888888888","sip":"101"}'

# Backfill local (1 día)
npx tsx scripts/zadarma-backfill.ts --from="2025-10-29" --to="2025-10-29" --timezone="America/Lima"

# Backfill en producción desde navegador
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=7').then(r=>r.json()).then(console.log)
```

---

Si quieres, puedo:
- Añadir ejemplos concretos de payloads de Zadarma y cómo quedan mapeados en `zadarma_calls`.
- Añadir un script `scripts/check-backfill-response.ts` que valide la forma de la respuesta del endpoint de backfill (y lo añado a `package.json`).

Documento generado automáticamente por la tarea de documentación — si quieres que amplíe secciones concretas (esquema de documento, queries de Firestore, o ejemplos de logs), dime cuáles y los agrego.
