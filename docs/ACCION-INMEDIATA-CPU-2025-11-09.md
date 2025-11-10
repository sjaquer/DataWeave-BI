# 🚀 ACCIÓN INMEDIATA REQUERIDA - Optimización CPU Vercel

**Fecha:** 2025-11-09  
**Prioridad:** 🔴 CRÍTICA  
**Estado:** ⏳ PENDIENTE IMPLEMENTACIÓN  
**Tiempo estimado:** 2-3 horas

---

## ⚠️ SITUACIÓN ACTUAL

```
┌─────────────────────────────────────────┐
│  CONSUMO CRÍTICO DE CPU EN VERCEL      │
│  ═══════════════════════════════════   │
│                                         │
│  Fluid Active CPU: 11m 57s / 30 días   │
│  Utilización: 91.2%                     │
│  Estado: 🔴 CRÍTICO                     │
│                                         │
│  ⚠️  RIESGO DE SUSPENSIÓN DEL SERVICIO │
└─────────────────────────────────────────┘
```

---

## 📋 QUÉ HACER AHORA (Orden de Prioridad)

### Paso 1: LEER Documentación (10 minutos)
```powershell
# Abrir y leer completo:
code docs/OPTIMIZACION-CPU-VERCEL-2025-11-09.md
```

**Leer específicamente:**
- ✅ Resumen Ejecutivo (página 1)
- ✅ Análisis Detallado por Endpoint (páginas 2-3)
- ✅ Plan de Optimización - Alta Prioridad (páginas 4-7)
- ✅ Plan de Implementación - Fase 1 (página 9)

### Paso 2: IMPLEMENTAR Cache + Lock (1-1.5 horas)

**Archivo a modificar:** `src/app/api/zadarma/stats/route.ts`

**Qué hacer:**
1. Crear nuevo archivo `src/lib/cache-helpers.ts`
2. Implementar función `getStatsWithCache()` (código completo en docs)
3. Reemplazar llamada directa a API por llamada con cache
4. Agregar colección `zadarma_cache` en Firestore

**Código a usar:** Ver sección "Alta Prioridad #1" en OPTIMIZACION-CPU-VERCEL-2025-11-09.md (líneas ~129-195)

**Beneficio esperado:** -60% a -80% CPU

### Paso 3: IMPLEMENTAR Batch Writes (30-45 minutos)

**Archivo a modificar:** `src/lib/zadarma-helpers.ts`

**Qué hacer:**
1. Crear función `saveCallsBatch(calls: any[])`
2. Reemplazar todos los loops de `await set()` por `batch.commit()`
3. Usar BATCH_SIZE = 500 (límite de Firestore)

**Código a usar:** Ver sección "Alta Prioridad #2" en OPTIMIZACION-CPU-VERCEL-2025-11-09.md (líneas ~197-220)

**Beneficio esperado:** -30% a -50% duración de requests

### Paso 4: ELIMINAR Sleeps (15 minutos)

**Archivo a modificar:** `src/app/api/zadarma/stats/route.ts`

**Qué hacer:**
1. Buscar todas las instancias de `await sleep(`
2. Eliminar o mover a job queue externo
3. Confiar en cache + rate limiting client-side

**Beneficio esperado:** -20% a -40% CPU

### Paso 5: TESTING en Staging (30 minutos)

```powershell
# Build y deploy a staging
npm run build
vercel --env staging

# Test cache hits
Invoke-WebRequest -Uri "https://staging.dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-11-09&endDate=2025-11-09" | ConvertFrom-Json

# Verificar logs en Vercel Dashboard
# Buscar: "[CACHE] ✅ HIT" y "[CACHE] 🔒 Lock adquirido"
```

**Validar:**
- ✅ Cache funciona (primer request = miss, siguientes = hits)
- ✅ Locks previenen trabajo duplicado
- ✅ Batch writes completan exitosamente
- ✅ No hay errores en Firestore

### Paso 6: DEPLOY a Producción (10 minutos)

```powershell
# Deploy final
vercel --prod

# Monitorear durante 2 horas
# Vercel Dashboard → Analytics → Fluid Active CPU
```

**Esperar ver:**
- 📉 Reducción inmediata de CPU usage
- 📊 Cache hit rate > 90%
- ⚡ Duración de requests < 500ms

---

## 🛠️ COMANDOS ÚTILES

### Ver estado de cache en Firestore
```powershell
# Usar Firebase Console
# Navegar a: Firestore → zadarma_cache → today
# Verificar campos: lastFetchedAt, processingUntil, data
```

### Limpiar cache manualmente (si es necesario)
```powershell
# Crear script: scripts/clear-cache.ts
npx tsx scripts/clear-cache.ts
```

### Monitorear logs en tiempo real
```powershell
# Desde Vercel CLI
vercel logs --follow

# Buscar:
# "[CACHE]" → Operaciones de cache
# "[BATCH]" → Batch writes
# "[LOCK]" → Lock operations
```

### Test de carga (opcional)
```powershell
# Instalar artillery
npm install -g artillery

# Test simple
artillery quick --count 10 --num 50 "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-11-09&endDate=2025-11-09"

# Debe mostrar: 90%+ cache hits después de primer request
```

---

## 📊 MÉTRICAS A MONITOREAR

### Vercel Dashboard

**Antes de implementación:**
```
Fluid Active CPU: ~400ms/request × 5000 req/día = ~33 min/día
Estado: 🔴 Excede límite
```

**Después de implementación (esperado):**
```
Fluid Active CPU: ~50ms/request × 5000 req/día = ~4 min/día
Estado: ✅ Dentro del límite (80% margen)
```

### Firestore Console

**Monitorear:**
- Operaciones de lectura (deben estabilizarse)
- Operaciones de escritura (deben reducirse por batching)
- Tamaño de colección `zadarma_cache` (debe ser ~1 documento)

---

## ❌ QUÉ NO HACER

1. ❌ **NO** migrar a Render sin implementar optimizaciones primero
2. ❌ **NO** hacer upgrade a Vercel Pro hasta probar las optimizaciones
3. ❌ **NO** cambiar el TTL del cache a más de 60s (datos quedarían muy stale)
4. ❌ **NO** hacer deploy directo a producción sin testing en staging
5. ❌ **NO** modificar otros archivos innecesarios (riesgo de romper funcionalidad)

---

## 🔥 SI ALGO SALE MAL

### Rollback rápido
```powershell
# Volver a deployment anterior
vercel rollback
```

### Cache causando problemas
```powershell
# Eliminar documento de cache
# Firebase Console → zadarma_cache → today → Delete
# O temporalmente aumentar TTL a 5s para testing
```

### Locks quedando trabados
```powershell
# Crear script de cleanup: scripts/cleanup-locks.ts
# Ejecutar cada 5 minutos como cron job
```

### CPU sigue alto después de 24h
```powershell
# Revisar logs de Vercel
# Identificar qué endpoint sigue siendo costoso
# Actualizar documento con hallazgos
# Considerar Fase 2 del plan (Frontend optimizations)
```

---

## 📞 CONTACTO SI NECESITAS AYUDA

**Documentación completa:** `docs/OPTIMIZACION-CPU-VERCEL-2025-11-09.md`  
**Resumen de cambios:** `docs/RESUMEN-ACTUALIZACION-DOCS-2025-11-09.md`  
**Index general:** `docs/INDEX.md`

**Para debugging:**
1. Copiar logs de Vercel
2. Copiar stack trace completo
3. Compartir métricas de CPU antes/después
4. Incluir screenshots de Vercel Dashboard

---

## ✅ CHECKLIST FINAL

Antes de considerar el trabajo completo:

- [ ] ✅ Cache + Lock implementado y funcionando
- [ ] ✅ Batch writes reemplazando writes individuales
- [ ] ✅ Sleeps bloqueantes eliminados
- [ ] ✅ Tests pasando en staging
- [ ] ✅ Deploy a producción exitoso
- [ ] ✅ Monitoreo 24h muestra reducción de CPU
- [ ] ✅ Cache hit rate > 90%
- [ ] ✅ No hay errors en Firestore
- [ ] ✅ Performance de la UI sin cambios negativos
- [ ] ✅ Documentación actualizada con resultados reales

---

## 🎯 OBJETIVO DE ÉXITO

```
┌─────────────────────────────────────────┐
│  DESPUÉS DE IMPLEMENTACIÓN (Meta)       │
│  ═══════════════════════════════════   │
│                                         │
│  Fluid Active CPU: ~12-15 min / 30 días│
│  Utilización: ~15-20%                   │
│  Estado: ✅ SALUDABLE                   │
│                                         │
│  ✅  MARGEN DE 80% - USO SOSTENIBLE    │
└─────────────────────────────────────────┘
```

---

**TIEMPO TOTAL ESTIMADO:** 2-3 horas  
**PRIORIDAD:** 🔴 CRÍTICA - Hacer esta semana  
**PRÓXIMO PASO:** Abrir `docs/OPTIMIZACION-CPU-VERCEL-2025-11-09.md` y empezar Fase 1

---

## 🚀 EMPEZAR AHORA

```powershell
# Abrir documentación principal
code docs/OPTIMIZACION-CPU-VERCEL-2025-11-09.md

# Crear branch para implementación
git checkout -b feature/optimize-cpu-usage

# Empezar con cache-helpers.ts
code src/lib/cache-helpers.ts
```

**¡ADELANTE! 💪**

---

**Documento creado:** 2025-11-09  
**Última actualización:** 2025-11-09  
**Versión:** 1.0.0  
**Estado:** 📋 Guía lista para usar
