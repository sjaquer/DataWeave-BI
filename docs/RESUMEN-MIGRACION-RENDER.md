# ✅ Migración a Render - Completada

## 📦 Archivos Creados/Modificados

### Nuevos Archivos

1. **`worker.js`** (Raíz del proyecto)
   - Worker durable para procesar backfills
   - Consume jobs desde `zadarma_jobs` collection
   - Actualiza progreso en `zadarma_backfill_sessions`
   - Requeue automático de jobs fallidos
   - Recovery de jobs estancados (TTL 15 minutos)

2. **`src/app/api/health/route.ts`**
   - Health check endpoint para Render
   - Verifica Firebase Admin SDK inicializado
   - Prueba conexión a Firestore
   - Endpoint: `GET /api/health`

3. **`docs/MIGRATE-TO-RENDER.md`**
   - Guía completa paso a paso (500+ líneas)
   - Configuración de Web Service + Background Worker
   - Mapeo de variables de entorno
   - Comandos PowerShell para actualizar webhooks
   - Checklist de validación
   - Plan de rollback
   - Troubleshooting

4. **`scripts/validate-render-deployment.js`**
   - Script de validación pre-deployment
   - Verifica archivos requeridos
   - Valida worker.js, health check, Firebase init
   - Confirma job queue pattern (no setImmediate)
   - Comando: `npm run validate:render`

### Archivos Modificados

1. **`src/app/api/zadarma/backfill-progress/route.ts`**
   - **ANTES:** Usaba `setImmediate()` para ejecutar backfill in-process (muere en serverless)
   - **AHORA:** Encola jobs en `zadarma_jobs` collection
   - Retorna inmediatamente con `sessionId` y `jobId`
   - Worker procesa el job de forma durable
   - Removidas funciones: `executeBackfillWithProgress`, `fetchCallsForDayWithProgress`, `makeZadarmaRequest`, `saveCallToFirestore`

2. **`src/lib/firebase-admin.ts`**
   - **ANTES:** Solo soportaba `SERVICE_ACCOUNT`
   - **AHORA:** Soporta `FIREBASE_SERVICE_ACCOUNT` (preferido) o `SERVICE_ACCOUNT`
   - Compatibilidad con ambos nombres de env var

3. **`README.md`**
   - Agregada sección "🚀 Migración a Render"
   - Actualizada lista de variables de entorno
   - Enlace a documentación completa

4. **`package.json`**
   - Agregado script: `"validate:render": "node scripts/validate-render-deployment.js"`

---

## 🔄 Cambios en la Arquitectura

### ANTES (Vercel Serverless)

```
┌──────────────────────────────────────────┐
│  POST /api/zadarma/backfill-progress     │
│                                          │
│  1. Recibe request                       │
│  2. setImmediate(executeBackfill)        │
│  3. Retorna sessionId                    │
│                                          │
│  Problema: setImmediate muere cuando     │
│  la instancia serverless se recicla      │
└──────────────────────────────────────────┘
```

### AHORA (Render Always-On + Worker)

```
┌─────────────────────────────────────────────────────────────┐
│  POST /api/zadarma/backfill-progress                        │
│                                                             │
│  1. Recibe request                                          │
│  2. Crea job en zadarma_jobs (status: queued)               │
│  3. Inicializa zadarma_backfill_sessions (status: queued)   │
│  4. Retorna sessionId + jobId INMEDIATAMENTE                │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker.js (Background Service)                             │
│                                                             │
│  1. Poll zadarma_jobs cada 5 segundos                       │
│  2. Claim job (transacción: status = in_progress)           │
│  3. Ejecutar backfill día por día                           │
│  4. Actualizar zadarma_backfill_sessions con progreso       │
│  5. Completar job (status = completed)                      │
│                                                             │
│  Recovery: Jobs con status in_progress > 15min → requeue    │
│  Retry: Max 3 intentos, luego status = failed              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Nuevas Firestore Collections

### `zadarma_jobs`

Schema:
```javascript
{
  sessionId: "backfill_1736123456789_abc123",
  startDate: "2025-01-10",
  endDate: "2025-01-15",
  status: "queued" | "in_progress" | "completed" | "failed",
  attempts: 0,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  totalDays: 5,
  estimatedTime: 900,
  owner: "worker_12345_..." (cuando status = in_progress),
  lastError: "..." (si falló),
  requeueCount: 0
}
```

**Índices necesarios:**
- `status` (asc) + `createdAt` (asc)

### `zadarma_backfill_sessions` (ya existía, ahora mejorada)

Schema actualizado:
```javascript
{
  sessionId: "backfill_1736123456789_abc123",
  jobId: "abc123xyz", // NEW - referencia al job
  status: "queued" | "in_progress" | "completed" | "error",
  totalDays: 5,
  processedDays: 2,
  progress: 40,
  callsSaved: 234,
  totalCalls: 234,
  failed: 0,
  currentDay: "2025-01-12",
  estimatedTimeRemaining: 540,
  startTime: 1736123456789,
  updatedAtMillis: 1736123789012,
  message: "Procesando 2025-01-12...",
  last_updated_by: "worker_12345_...",
  totalTime: 321 // al completar (segundos)
}
```

---

## 📊 Flujo Completo de Backfill

### 1. Usuario Inicia Backfill

**Frontend:** `BackfillProgress.tsx` component

```javascript
// Usuario hace click en "Iniciar Backfill"
const response = await fetch('/api/zadarma/backfill-progress', {
  method: 'POST',
  body: JSON.stringify({ startDate: '2025-01-10', endDate: '2025-01-15' })
});

// Respuesta inmediata (< 500ms):
{
  status: "queued",
  sessionId: "backfill_1736123456789_abc123",
  jobId: "abc123xyz",
  totalDays: 5,
  estimatedTime: 900,
  message: "Backfill encolado. El worker lo procesará pronto."
}
```

### 2. Worker Procesa Job

**Worker.js** main loop:

```javascript
// 1. Poll cada 5 segundos
const querySnapshot = await db.collection('zadarma_jobs')
  .where('status', '==', 'queued')
  .orderBy('createdAt')
  .limit(1)
  .get();

// 2. Claim job (transacción)
await jobRef.update({
  status: 'in_progress',
  owner: WORKER_ID,
  updatedAt: admin.firestore.Timestamp.now()
});

// 3. Procesar día por día
for (const date of dateRange) {
  const calls = await fetchCallsForDay(date, apiKey, apiSecret);
  
  for (const call of calls) {
    await saveCallToFirestore(call);
  }
  
  await saveSyncMetadata(date, calls.length, 'success');
  
  // Actualizar progreso
  await updateProgress(sessionId, {
    processedDays: ++processedDays,
    progress: (processedDays / totalDays) * 100,
    callsSaved: savedCalls,
    message: `✅ ${date} completado: ${calls.length} llamadas`
  });
}

// 4. Completar job
await jobRef.update({
  status: 'completed',
  completedAt: admin.firestore.Timestamp.now()
});
```

### 3. Frontend Consulta Progreso

**Polling cada 2 segundos:**

```javascript
const response = await fetch(`/api/zadarma/backfill-progress?sessionId=${sessionId}`);

// Respuesta actualizada por worker:
{
  status: "in_progress",
  currentDay: "2025-01-12",
  processedDays: 2,
  totalDays: 5,
  progress: 40,
  callsSaved: 234,
  estimatedTimeRemaining: 540,
  message: "✅ 2025-01-12 completado: 117 llamadas"
}
```

---

## 🚀 Deployment Steps (Resumen)

### 1. Commit y Push

```powershell
git add .
git commit -m "feat: migración a Render con worker durable"
git push origin main
```

### 2. Crear Servicios en Render

**Web Service:**
- Name: `dataweave-bi`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- Plan: Starter ($7/mo)

**Background Worker:**
- Name: `dataweave-bi-worker`
- Build Command: `npm install`
- Start Command: `node worker.js`
- Plan: Starter ($7/mo)

### 3. Configurar Variables de Entorno

**Ambos servicios necesitan:**
- `FIREBASE_SERVICE_ACCOUNT` (JSON string, una línea)
- `ZADARMA_API_KEY`
- `ZADARMA_API_SECRET`
- `NODE_ENV=production`

**Solo Web Service:**
- `REFRESH_TODAY_SECRET`
- `BASE_API_URL=https://dataweave-bi.onrender.com`
- `NEXT_PUBLIC_*` (todas las públicas)

### 4. Validar Deployment

```powershell
# Health check
curl https://dataweave-bi.onrender.com/api/health

# Iniciar backfill test
curl -X POST https://dataweave-bi.onrender.com/api/zadarma/backfill-progress `
  -H "Content-Type: application/json" `
  -d '{"startDate":"2025-01-10","endDate":"2025-01-11"}'

# Consultar progreso
curl "https://dataweave-bi.onrender.com/api/zadarma/backfill-progress?sessionId=..."
```

### 5. Actualizar Webhooks Shopify

Ver comandos PowerShell completos en [MIGRATE-TO-RENDER.md](./MIGRATE-TO-RENDER.md#actualizar-webhooks)

---

## ✅ Ventajas de la Nueva Arquitectura

| Aspecto | Vercel (Antes) | Render (Ahora) |
|---------|----------------|----------------|
| **Backfill durabilidad** | ❌ Muere al reciclar instancia | ✅ Durable, sobrevive reinicios |
| **Progreso perdido** | ❌ 404 si proceso muere | ✅ Siempre en Firestore |
| **CPU limits** | ❌ 10s timeout por función | ✅ Sin límites en worker |
| **Concurrencia** | ⚠️ Múltiples instancias compiten | ✅ 1 worker, 1 job a la vez |
| **Recovery** | ❌ Manual | ✅ Automático (requeue) |
| **Costos** | 💰 $20/mo (hobby) | 💰 $14/mo (2 servicios starter) |
| **Monitoreo** | ⚠️ Logs dispersos | ✅ Worker logs centralizados |

---

## 🔍 Validación Pre-Deployment

```powershell
npm run validate:render
```

**Verifica:**
- ✅ worker.js existe y es válido
- ✅ Health check implementado
- ✅ Firebase init soporta FIREBASE_SERVICE_ACCOUNT
- ✅ Backfill usa job queue (no setImmediate)
- ✅ Todas las dependencias instaladas
- ✅ Documentación completa

---

## 📚 Documentación Relacionada

- **Guía completa:** [docs/MIGRATE-TO-RENDER.md](./MIGRATE-TO-RENDER.md)
- **Troubleshooting:** Ver sección en guía de migración
- **Worker architecture:** Comentarios en `worker.js`
- **Job schema:** Ver `zadarma_jobs` collection schema arriba

---

## 🆘 Troubleshooting Rápido

### Worker no procesa jobs

```powershell
# Ver logs del worker
# Render Dashboard → dataweave-bi-worker → Logs

# Verificar que FIREBASE_SERVICE_ACCOUNT esté configurado
# Render Dashboard → dataweave-bi-worker → Environment

# Reiniciar worker
# Dashboard → Manual Deploy → Deploy Latest Commit
```

### Jobs quedan en "in_progress"

El worker automáticamente requeue jobs estancados > 15 minutos. Si persiste:

```powershell
# Ver logs del worker para errores
# Verificar que worker esté corriendo (no "Sleeping")
```

### 500 errors en endpoints

```powershell
# Verificar health check
curl https://dataweave-bi.onrender.com/api/health

# Debe retornar: {"status":"ok",...}
# Si falla → verificar FIREBASE_SERVICE_ACCOUNT en env vars
```

---

**🎉 ¡Migración Completada con Éxito!**

Para cualquier duda, consulta [MIGRATE-TO-RENDER.md](./MIGRATE-TO-RENDER.md) o revisa los logs en Render Dashboard.
