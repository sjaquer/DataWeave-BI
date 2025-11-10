# 🚨 Optimización de Consumo CPU en Vercel - Fluid Active CPU
**Fecha:** 2025-11-09  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** 📋 Plan de acción definido

---

## 📊 Resumen Ejecutivo

### Problema Identificado
El proyecto DataWeave-BI está experimentando **picos críticos de consumo de Fluid Active CPU** en Vercel, alcanzando hasta **13 minutos de CPU activo en un solo día** (Nov 8, 2025), lo que está agotando rápidamente la cuota mensual y poniendo en riesgo la disponibilidad del servicio.

### Impacto
- **Consumo actual:** 11m 57s en últimas 30 días (91.2% del límite free tier)
- **Tendencia:** Picos crecientes desde Oct 13, 2025
- **Riesgo:** Suspensión del servicio al alcanzar límite
- **Costo potencial:** Upgrade a plan Pro ($20/mes) si no se optimiza

### Causa Raíz
Arquitectura serverless con **trabajo intensivo en cada invocación**:
1. Peticiones frecuentes desde frontend (auto-refresh 60s)
2. Operaciones bloqueantes largas (paginación, retries con sleep)
3. Escrituras individuales a Firestore (no batch)
4. Concurrencia duplicada (múltiples clientes haciendo mismo trabajo)
5. Backfills pesados ejecutándose en serverless

---

## 🔍 Análisis Detallado por Endpoint

### Endpoints Más Costosos (Últimos 30 días)

| Endpoint | Invocaciones | Active CPU | P75 Duration | Problema Principal |
|----------|--------------|------------|--------------|-------------------|
| `/api/zadarma/webhook` | 840 | 12s | - | Muchas invocaciones, pero eficiente |
| `/api/zadarma/backfill-progress` | 392 | 4.41s | - | Backfills multi-día, paginación pesada |
| `/api/webhooks/shopify/[storeId]` | 405 | 13s | - | Alto volumen de webhooks |
| `/api/zadarma/stats` | 3 | 442ms | - | BAJO uso pero puede explotar con auto-refresh |
| `/dashboard` | 17 | 53s | - | SSR + fetch de datos |
| `/dashboard/daily` | 10 | 33s | - | SSR + procesamiento |

### Análisis Crítico

#### 1. `/api/zadarma/stats` ⚠️ PUNTO CRÍTICO
**Problema:**
- Actualmente solo 3 invocaciones (bajo uso)
- **PERO**: Frontend hace auto-refresh cada 60s cuando está en "HOY"
- Sin cache ni coalescing → si 10 usuarios abren dashboard = 10 peticiones simultáneas
- Cada petición hace paginación completa a API Zadarma + guarda individualmente en Firestore

**Código problemático:**
```typescript
// src/app/api/zadarma/stats/route.ts (líneas ~230-270)
while (continuePaging) {
  skip += limit;
  
  // ❌ PROBLEMA: Sleep dentro de función serverless
  if (globalRequestCount >= 2) {
    await sleep(60000); // Espera 1 minuto
    globalRequestCount = 0;
  }
  
  // Hace petición a API
  const response = await fetch(apiUrl, ...);
  
  // ❌ PROBLEMA: Guarda uno por uno
  for (const call of accumulatedStats) {
    await saveCallToFirestore(call); // Write individual
  }
}
```

**Medición real:**
- 1 día completo = ~200-500 llamadas
- Con paginación (limit 1000) = 1-2 páginas
- Escrituras individuales = 200-500 writes
- Duración actual: 442ms (bajo porque solo 3 invocaciones)
- **Proyección con auto-refresh activo:** 30s-60s por invocación × 10 usuarios = 5-10 minutos CPU/hora

#### 2. `/api/zadarma/backfill-progress` 🔥 ALTO CONSUMO
**Problema:**
- 392 invocaciones en 30 días
- Backfills multi-día ejecutándose en serverless
- Procesamiento largo dentro de la función

**Código problemático:**
```typescript
// Similar a stats, pero procesa múltiples días
for (const date of dateRange) {
  const calls = await fetchCallsForDay(dateStr);
  for (const call of calls) {
    await saveCallToFirestore(call); // ❌ Individual write
  }
}
```

**Medición:**
- Backfill de 7 días = 7 × (paginación + escrituras)
- ~3-5 minutos de ejecución continua
- Si múltiples usuarios/pestañas lo activan = trabajo duplicado

#### 3. Frontend Auto-refresh 🔄 MULTIPLICADOR
**Problema:**
- `src/app/(app)/dashboard/performance/page.tsx`
- Auto-refresh cada 60s cuando vista = "HOY"
- Sin debounce entre pestañas
- Llama a `/api/zadarma/stats` con rango completo del día

**Código:**
```typescript
// useEffect ejecuta cada 60s
const refreshInterval = setInterval(() => {
  fetchAndProcessData(false); // ❌ Fetch completo
  setCountdown(60);
}, 60000);
```

**Impacto:**
- 1 usuario, 1 pestaña = 1 req/min = 60 req/hora = 1,440 req/día
- 5 usuarios = 7,200 req/día
- Sin cache = cada req hace paginación completa

---

## 💡 Plan de Optimización (Priorizado)

### 🔴 Alta Prioridad - Implementar AHORA (Impacto: -70% CPU)

#### 1. Cache + Lock Cross-Instance en `/api/zadarma/stats`
**Objetivo:** Evitar trabajo duplicado cuando múltiples clientes piden lo mismo

**Implementación:**
```typescript
// Nueva estructura en Firestore
Collection: zadarma_cache
Document: today
Fields:
  - lastFetchedAt: Timestamp
  - data: Array<Call> | null
  - processingUntil: Timestamp | null
  - summary: { totalCalls, lastCallTime }
```

**Algoritmo:**
```typescript
async function getStatsWithCache(startDate, endDate) {
  const cacheDoc = await db.collection('zadarma_cache').doc('today').get();
  const now = new Date();
  const TTL = 30000; // 30 segundos

  // 1. Si cache es fresco, devolver inmediatamente
  if (cacheDoc.exists) {
    const cache = cacheDoc.data();
    const age = now.getTime() - cache.lastFetchedAt.toMillis();
    
    if (age < TTL) {
      console.log('[CACHE] ✅ HIT - devolviendo cache');
      return { stats: cache.data, cached: true };
    }
  }

  // 2. Cache stale o no existe - intentar adquirir lock
  try {
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(cacheDocRef);
      const data = doc.data();
      
      // Si otro proceso está trabajando, usar cache viejo
      if (data?.processingUntil && data.processingUntil.toMillis() > now.getTime()) {
        throw new Error('LOCKED'); // Abortar transacción
      }
      
      // Adquirir lock
      transaction.set(cacheDocRef, {
        processingUntil: Timestamp.fromMillis(now.getTime() + 60000), // Lock por 60s
        lastFetchedAt: data?.lastFetchedAt || null,
        data: data?.data || null
      }, { merge: true });
    });
    
    console.log('[CACHE] 🔒 Lock adquirido - fetching...');
    
    // 3. Este proceso tiene el lock - hacer el trabajo
    const freshData = await fetchFromZadarmaAPI(startDate, endDate);
    
    // 4. Guardar en cache y liberar lock
    await cacheDocRef.set({
      lastFetchedAt: Timestamp.now(),
      data: freshData,
      processingUntil: null, // Liberar lock
      summary: {
        totalCalls: freshData.length,
        lastCallTime: freshData[freshData.length - 1]?.callstart
      }
    });
    
    return { stats: freshData, cached: false };
    
  } catch (error) {
    if (error.message === 'LOCKED') {
      // Otro proceso está trabajando - devolver cache aunque sea viejo
      console.log('[CACHE] ⏳ Locked - devolviendo cache existente');
      return { stats: cacheDoc.data()?.data || [], cached: true, stale: true };
    }
    throw error;
  }
}
```

**Beneficio:**
- 10 usuarios × 60 req/hora → 1 fetch real, 599 cache hits
- Reducción: **~99% de trabajo duplicado**
- CPU saving: **-60% a -80%**

#### 2. Batch Writes a Firestore
**Problema actual:**
```typescript
// ❌ MALO: Write individual
for (const call of calls) {
  await saveCallToFirestore(call);
}
```

**Solución:**
```typescript
// ✅ BUENO: Batch write
async function saveCallsBatch(calls: any[]) {
  const BATCH_SIZE = 500; // Firestore limit
  
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = calls.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(call => {
      const callId = call.pbx_call_id || `call_${Date.now()}_${Math.random()}`;
      const docRef = db.collection('zadarma_calls').doc(callId);
      batch.set(docRef, prepareCallDoc(call), { merge: true });
    });
    
    await batch.commit();
    console.log(`[BATCH] ✅ ${chunk.length} llamadas guardadas`);
  }
}
```

**Beneficio:**
- 500 writes individuales (500 awaits) → 1 batch (1 await)
- Reducción latencia: **-90%**
- CPU saving: **-30% a -50%**

#### 3. Eliminar `sleep()` Dentro de Funciones
**Problema:**
```typescript
// ❌ MALO: Dormir dentro de serverless
await sleep(60000); // 1 minuto bloqueado
```

**Solución A (Recomendada):** Usar cache + rate limit client-side
```typescript
// Cliente hace máximo 1 req/30s
// Servidor devuelve cache si < 30s
// No hay sleeps
```

**Solución B:** Queue + Worker externo
```typescript
// Guardar job en Firestore
await db.collection('zadarma_jobs').add({
  type: 'fetch_range',
  params: { startDate, endDate },
  status: 'pending',
  createdAt: Timestamp.now()
});

// Worker externo (Cloud Run / Render) procesa jobs
// Sin sleeps en Vercel
```

**Beneficio:**
- Eliminar 60s de sleep por retry
- CPU saving: **-20% a -40%**

---

### 🟡 Media Prioridad - Implementar en 1-2 semanas

#### 4. Debounce Frontend + Visibility API
**Objetivo:** Evitar polling redundante en pestañas inactivas

```typescript
// Pausar auto-refresh en pestañas background
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      console.log('[AUTO-REFRESH] ⏸️ Pestaña oculta - pausando');
      clearInterval(refreshInterval);
    } else {
      console.log('[AUTO-REFRESH] ▶️ Pestaña visible - reanudando');
      startAutoRefresh();
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

**Beneficio:**
- 5 pestañas → 1 activa polling
- CPU saving: **-10% a -20%**

#### 5. Mover Backfills a Worker Externo
**Problema:** Backfills largos ejecutándose en Vercel serverless

**Solución:**
```
┌─────────────────┐
│  Vercel (UI)    │
│  /dashboard     │
└────────┬────────┘
         │ HTTP trigger
         ▼
┌─────────────────┐
│  Render Worker  │
│  (Always-on)    │
│  - Procesa      │
│    backfills    │
│  - Sin límite   │
│    de CPU       │
└────────┬────────┘
         │ Escribe a
         ▼
┌─────────────────┐
│   Firestore     │
│   (Shared)      │
└─────────────────┘
```

**Beneficio:**
- Backfills no cuentan en Fluid CPU
- Puede ejecutarse por horas sin problema
- CPU saving en Vercel: **-30% a -50%**

---

### 🟢 Baja Prioridad - Optimizaciones Complementarias

#### 6. Instrumentación y Alertas
```typescript
// Agregar métricas
const metrics = {
  cacheHits: 0,
  cacheMisses: 0,
  lockAcquired: 0,
  lockFailed: 0,
  avgDuration: 0
};

// Log en cada request
console.log('[METRICS]', JSON.stringify(metrics));
```

#### 7. Compresión de Respuestas
```typescript
// Usar gzip para responses grandes
import { gzip } from 'zlib';

const compressed = await gzip(JSON.stringify(data));
return new Response(compressed, {
  headers: { 'Content-Encoding': 'gzip' }
});
```

---

## 📈 Proyección de Mejoras

### Escenario Actual (Sin optimizaciones)
```
10 usuarios × 60 req/hora × 30s/req = 5 horas CPU/día
Backfills: 30 min/día
Total: ~5.5 horas CPU/día
Límite free: 100 horas/mes ≈ 3.3 horas/día
Estado: 🔴 EXCEDIDO
```

### Escenario con Medidas Alta Prioridad (1-3)
```
Cache: 99% hits → 1 req real/min × 30s = 30s CPU/hora
Batch writes: -50% duración → 15s CPU/hora
Sin sleeps: -30% tiempo idle
Total: ~25 min CPU/día
Estado: ✅ DENTRO DEL LÍMITE (75% margen)
```

### Escenario con Todas las Medidas
```
Cache + Batch + Worker externo
Total: ~10 min CPU/día
Estado: ✅ HOLGADO (90% margen)
```

---

## 🛠️ Plan de Implementación

### Fase 1: Urgente (Esta semana)
**Duración:** 2-3 horas  
**Responsable:** Desarrollador principal

- [ ] Implementar cache+lock en `/api/zadarma/stats`
- [ ] Reemplazar writes individuales por batches
- [ ] Desplegar a staging y medir
- [ ] Deploy a producción

**Archivos a modificar:**
- `src/app/api/zadarma/stats/route.ts`
- `src/lib/zadarma-helpers.ts` (agregar `saveCallsBatch`)
- Nuevo: `src/lib/cache-helpers.ts`

### Fase 2: Corto plazo (Próxima semana)
**Duración:** 4-6 horas

- [ ] Eliminar sleeps largos
- [ ] Implementar visibility API en frontend
- [ ] Agregar métricas y logs estructurados
- [ ] Monitoreo continuo (48h)

**Archivos a modificar:**
- `src/app/(app)/dashboard/performance/page.tsx`
- `src/app/api/zadarma/stats/route.ts`

### Fase 3: Mediano plazo (2 semanas)
**Duración:** 1-2 días

- [ ] Configurar worker en Render/Cloud Run
- [ ] Migrar backfills a worker
- [ ] Configurar queue para jobs pesados
- [ ] Testing E2E

**Nuevos archivos:**
- `workers/backfill-worker.ts`
- `Dockerfile` (para Render)
- `render.yaml`

---

## 📊 Métricas de Éxito

### KPIs a Monitorizar
1. **Fluid Active CPU** (Vercel Dashboard)
   - Objetivo: < 50% del límite mensual
   - Actual: 91.2%
   - Meta: < 45%

2. **Cache Hit Rate**
   - Objetivo: > 95%
   - Métrica: `cacheHits / (cacheHits + cacheMisses)`

3. **Duración Promedio por Request**
   - Objetivo: < 500ms para `/stats`
   - Actual: 442ms (bajo volumen)
   - Meta: < 300ms (con cache)

4. **Invocaciones por Día**
   - Objetivo: < 1000/día
   - Actual: ~50/día (bajo uso)
   - Proyección con auto-refresh: > 5000/día

### Dashboard de Monitoreo
```
┌─────────────────────────────────────┐
│ Fluid Active CPU (últimas 24h)     │
│ ████░░░░░░░░░░░░░░░░ 20%           │
│                                     │
│ Cache Performance                   │
│ Hits:   1,234 (98.5%)              │
│ Misses:    19 (1.5%)               │
│                                     │
│ Avg Request Duration                │
│ /stats: 180ms ▼ -260ms             │
│                                     │
│ Requests/min                        │
│ 15 req/min ▼ -45 req/min           │
└─────────────────────────────────────┘
```

---

## ⚠️ Riesgos y Mitigaciones

### Riesgo 1: Cache Stale Data
**Problema:** Usuario ve datos desactualizados  
**Mitigación:**
- TTL corto (30s)
- Invalidar cache on-demand si usuario hace refresh manual
- Mostrar timestamp de última actualización en UI

### Riesgo 2: Lock Deadlock
**Problema:** Lock no se libera (crash durante processing)  
**Mitigación:**
- Lock TTL automático (60s)
- Cleanup job que libera locks viejos cada 5 minutos
- Monitoring de locks activos

### Riesgo 3: Batch Write Failure
**Problema:** Batch falla, se pierden datos  
**Mitigación:**
- Retry con exponential backoff
- Log de items failed para reprocesar
- Validación pre-batch (duplicates, formato)

---

## 🔗 Referencias y Recursos

### Documentación Relacionada
- [ZADARMA-CACHE-SYSTEM.md](./ZADARMA-CACHE-SYSTEM.md) - Sistema de cache anterior
- [AUDITORIA-RENDIMIENTO-ZADARMA-2025-01-17.md](./AUDITORIA-RENDIMIENTO-ZADARMA-2025-01-17.md) - Auditoría previa
- [WEBHOOK-FLOW-DOCUMENTATION.md](./WEBHOOK-FLOW-DOCUMENTATION.md) - Flujo de webhooks

### Guías de Implementación
- [Firestore Batched Writes](https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes)
- [Firestore Transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Vercel Monitoring](https://vercel.com/docs/concepts/observability)

### Scripts Útiles
```powershell
# Monitorear cache hits/misses
curl "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-11-09&endDate=2025-11-09" | jq '.cached'

# Limpiar locks viejos manualmente
npx tsx scripts/cleanup-stale-locks.ts

# Test de carga
npx artillery quick --count 10 --num 100 "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-11-09&endDate=2025-11-09"
```

---

## 📝 Historial de Cambios

### 2025-11-09 - Análisis Inicial
- Identificación de problema crítico de CPU
- Análisis detallado de endpoints costosos
- Definición de plan de optimización priorizado
- Documentación completa creada

### Próximas Actualizaciones
- 2025-11-12: Resultados de Fase 1 (cache+lock)
- 2025-11-15: Métricas post-implementación
- 2025-11-20: Evaluación de necesidad de worker externo

---

## ✅ Checklist de Acciones Inmediatas

### Para Desarrollador
- [ ] Leer este documento completo
- [ ] Revisar código actual de `/api/zadarma/stats`
- [ ] Implementar cache+lock (ver sección Alta Prioridad #1)
- [ ] Implementar batch writes (ver sección Alta Prioridad #2)
- [ ] Crear tests para validar cache
- [ ] Deploy a staging
- [ ] Monitorear 24h
- [ ] Deploy a producción

### Para DevOps/Admin
- [ ] Configurar alertas en Vercel (CPU > 80%)
- [ ] Crear dashboard de métricas custom
- [ ] Backup de Firestore antes de cambios
- [ ] Documentar proceso de rollback
- [ ] Preparar ambiente de staging si no existe

### Para Product Owner
- [ ] Aprobar plan de optimización
- [ ] Decidir sobre plan B (worker externo vs upgrade Vercel)
- [ ] Revisar impacto en UX (cache stale data)
- [ ] Comunicar maintenance window si necesario

---

**Documento creado:** 2025-11-09  
**Última actualización:** 2025-11-09  
**Versión:** 1.0.0  
**Estado:** 📋 Plan definido, pendiente implementación
