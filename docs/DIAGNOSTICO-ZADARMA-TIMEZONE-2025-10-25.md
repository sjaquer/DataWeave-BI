# 🔍 DIAGNÓSTICO EXHAUSTIVO: Problemas de Zona Horaria y Conteo en Zadarma

**Fecha**: 25 de octubre de 2025  
**Problema**: Discrepancia entre conteo de llamadas (Zadarma: 382 vs Dashboard: 419) y horarios incorrectos de primera/última llamada  
**Estado**: 🔴 CRÍTICO - Afecta precisión de métricas de rendimiento

---

## 📊 RESUMEN EJECUTIVO

### Problemas Identificados:
1. **Conteo duplicado de llamadas** (37 llamadas extra = 9.7% de error)
2. **Zona horaria inconsistente** en primera/última llamada
3. **Falta de sincronización** en manejo de UTC entre endpoints
4. **Cron job sin conversión de zona horaria**
5. **Consolidación duplicada** en frontend y backend

---

## 🐛 ANÁLISIS DETALLADO DE PROBLEMAS

### 🔴 PROBLEMA #1: Conteo Duplicado (382 → 419)
**Ubicación**: `src/app/(app)/dashboard/performance/page.tsx` + `src/app/api/zadarma/stats/route.ts`

**Causa Raíz**:
- El endpoint `/api/zadarma/stats` ya consolida las llamadas usando `consolidateCalls()`
- El frontend NO está re-consolidando, pero el problema viene de la **lógica de consolidación defectuosa**

**Análisis del código de consolidación actual**:
```typescript
// src/lib/zadarma-helpers.ts - Línea 124
export function consolidateCalls(calls: ZadarmaCall[]): ZadarmaCall[] {
  const callsMap = new Map<string, ZadarmaCall[]>();
  calls.forEach(call => {
    if (!call.pbx_call_id) return;
    const group = callsMap.get(call.pbx_call_id);  // ❌ SOLO agrupa por pbx_call_id
    group.push(call);
    callsMap.set(call.pbx_call_id, group);
  });
  // ...
}
```

**El problema**:
- La API de Zadarma puede retornar **múltiples intentos** de llamada al mismo número con diferentes `pbx_call_id`
- La consolidación solo agrupa por `pbx_call_id`, pero NO considera que pueden haber:
  - Llamadas al mismo destino en rangos de tiempo cercanos
  - Re-intentos automáticos del sistema
  - Llamadas cortadas que se reintentan
  
**Evidencia**:
- 419 llamadas en dashboard vs 382 en Zadarma = **37 registros duplicados** (9.7%)
- Esto sugiere que hay ~37 `pbx_call_id` diferentes que son RE-INTENTOS de la misma llamada

---

### 🔴 PROBLEMA #2: Zona Horaria Inconsistente en Primera/Última Llamada
**Ubicación**: `src/app/(app)/dashboard/performance/page.tsx` - Líneas 127-128

**Causa Raíz**:
```typescript
// CORRECTO: Almacena en UTC
if (!p.firstCallTime || call.callstart < p.firstCallTime) 
  p.firstCallTime = call.callstart;  // ISO UTC string

// CORRECTO: Convierte a Lima para mostrar
if (p.firstCallTime) 
  p.firstCallTime = formatInTimeZone(parseISO(p.firstCallTime), LIMA_TIME_ZONE, 'HH:mm:ss');
```

**El problema REAL**:
- La API de Zadarma retorna fechas en **hora de Madrid (Europe/Madrid)**
- El endpoint `/api/zadarma/stats` convierte a UTC correctamente
- PERO el Cron Job **NO hace esta conversión**
- Resultado: Datos guardados por el Cron tienen **5-6 horas de diferencia**

**Evidencia en código**:
```typescript
// ✅ CORRECTO - src/app/api/zadarma/stats/route.ts - Línea 56
return (data.stats || []).map((call: any) => ({
  ...call,
  callstart: fromZonedTime(call.callstart, MADRID_TIME_ZONE).toISOString(),
}));

// ❌ INCORRECTO - src/app/api/cron/zadarma-daily-sync/route.ts
const calls = data.stats || []; 
await saveZadarmaCalls(calls);  // NO convierte la zona horaria!!!
```

---

### 🔴 PROBLEMA #3: Auto-Sync en Stats Funciona, Pero Cron No

**Sistema de Sincronización Actual**:

1. **Auto-sync en background** (`/api/zadarma/stats` línea 93):
   ```typescript
   if (finalStats.length > 0) {
     saveZadarmaCalls(finalStats).catch(err => console.error('[AUTO-SYNC BKG] Error:', err));
   }
   ```
   ✅ Convierte a UTC correctamente
   ✅ Consolida las llamadas
   ✅ Guarda automáticamente cuando el usuario consulta

2. **Cron Job diario** (`/api/cron/zadarma-daily-sync`):
   - Se ejecuta cada día a la 1:00 AM
   - Sincroniza el día anterior completo
   - ❌ NO convierte zona horaria
   - ❌ NO consolida llamadas

**Impacto**:
- Datos consultados en tiempo real → ✅ Correctos (UTC + consolidados)
- Datos sincronizados por cron → ❌ Incorrectos (Madrid + sin consolidar)
- Esto crea **inconsistencia** en los datos históricos

---

### 🔴 PROBLEMA #4: Cron Job sin Manejo de Zona Horaria
**Ubicación**: `src/app/api/cron/zadarma-daily-sync/route.ts`

**Problemas múltiples**:
1. No convierte las fechas de Madrid a UTC
2. No consolida llamadas duplicadas
3. No considera el cambio horario Madrid/Lima
4. Guarda datos "crudos" de la API

**Impacto**:
- Llamadas sincronizadas automáticamente tienen timestamps incorrectos
- Primera/última llamada pueden estar desplazadas 5-6 horas
- Datos históricos son inconsistentes con datos en tiempo real

---

### 🔴 PROBLEMA #5: ID de Documento Puede Crear Duplicados
**Ubicación**: `src/lib/zadarma-helpers.ts` - Línea 20

```typescript
const docId = `${call.pbx_call_id}_${call.callstart}`;
```

**Problema**:
- `call.callstart` es un timestamp completo (ej: "2025-10-25 08:30:15")
- Si la misma llamada se procesa dos veces con **milisegundos diferentes**, crea duplicados
- Firestore permite múltiples documentos si el ID es diferente

---

## 📋 PLAN DE CORRECCIÓN (5 FASES)

### 🟢 FASE 1: Corrección de Conversión de Zona Horaria
**Prioridad**: 🔴 CRÍTICA  
**Tiempo estimado**: 2 horas  
**Archivos a modificar**:
1. `src/app/api/cron/zadarma-daily-sync/route.ts`
2. `src/app/api/zadarma/sync/route.ts`

**Acciones**:
- [ ] Agregar imports de `date-fns-tz` en cron job
- [ ] Implementar conversión Madrid → UTC en cron
- [ ] Implementar conversión Madrid → UTC en sync
- [ ] Agregar función helper `convertZadarmaToUTC(call)` en `zadarma-helpers.ts`

**Código propuesto**:
```typescript
// src/lib/zadarma-helpers.ts
import { fromZonedTime } from 'date-fns-tz';

const MADRID_TIME_ZONE = 'Europe/Madrid';

export function convertZadarmaCallToUTC(call: any): ZadarmaCall {
  return {
    ...call,
    callstart: fromZonedTime(call.callstart, MADRID_TIME_ZONE).toISOString(),
  };
}
```

---

### 🟡 FASE 2: Mejorar Lógica de Consolidación
**Prioridad**: 🔴 CRÍTICA  
**Tiempo estimado**: 3 horas  
**Archivos a modificar**:
1. `src/lib/zadarma-helpers.ts` (función `consolidateCalls`)

**Problema actual**:
- Solo consolida por `pbx_call_id`
- No considera re-intentos al mismo destino

**Nueva estrategia de consolidación**:
```typescript
export function consolidateCalls(calls: ZadarmaCall[]): ZadarmaCall[] {
  // PASO 1: Agrupar por pbx_call_id (llamadas idénticas)
  const callsByPbxId = new Map<string, ZadarmaCall[]>();
  
  calls.forEach(call => {
    if (!call.pbx_call_id) return;
    const group = callsByPbxId.get(call.pbx_call_id) || [];
    group.push(call);
    callsByPbxId.set(call.pbx_call_id, group);
  });

  // PASO 2: Para cada grupo, elegir la mejor llamada
  const consolidatedCalls: ZadarmaCall[] = [];
  
  for (const group of callsByPbxId.values()) {
    if (group.length === 1) {
      consolidatedCalls.push(group[0]);
      continue;
    }

    // Priorizar: answered > mayor duración > más reciente
    const bestCall = group.reduce((best, current) => {
      if (current.disposition === 'answered' && best.disposition !== 'answered') 
        return current;
      if (best.disposition === 'answered' && current.disposition !== 'answered') 
        return best;
      if (current.seconds > best.seconds) 
        return current;
      if (current.seconds === best.seconds && current.callstart > best.callstart)
        return current;
      return best;
    });
    
    consolidatedCalls.push(bestCall);
  }

  // PASO 3: Detectar y consolidar re-intentos cercanos al mismo destino
  // (Llamadas al mismo número en ventana de 2 minutos)
  return consolidateRetries(consolidatedCalls);
}

function consolidateRetries(calls: ZadarmaCall[]): ZadarmaCall[] {
  // Agrupar por agente + destino
  const groups = new Map<string, ZadarmaCall[]>();
  
  calls.forEach(call => {
    const key = `${call.sip}_${call.destination}`;
    const group = groups.get(key) || [];
    group.push(call);
    groups.set(key, group);
  });

  const result: ZadarmaCall[] = [];
  
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Ordenar por tiempo
    group.sort((a, b) => a.callstart.localeCompare(b.callstart));

    let currentBatch: ZadarmaCall[] = [group[0]];
    
    for (let i = 1; i < group.length; i++) {
      const current = group[i];
      const previous = group[i - 1];
      
      // Calcular diferencia en minutos
      const diffMs = new Date(current.callstart).getTime() - 
                     new Date(previous.callstart).getTime();
      const diffMin = diffMs / 60000;
      
      if (diffMin <= 2) {
        // Es un re-intento, agregar al batch
        currentBatch.push(current);
      } else {
        // Es una llamada nueva, procesar batch anterior
        result.push(selectBestFromBatch(currentBatch));
        currentBatch = [current];
      }
    }
    
    // Procesar último batch
    if (currentBatch.length > 0) {
      result.push(selectBestFromBatch(currentBatch));
    }
  }

  return result;
}

function selectBestFromBatch(batch: ZadarmaCall[]): ZadarmaCall {
  return batch.reduce((best, current) => {
    if (current.disposition === 'answered' && best.disposition !== 'answered') 
      return current;
    if (best.disposition === 'answered' && current.disposition !== 'answered') 
      return best;
    return current.seconds > best.seconds ? current : best;
  });
}
```

---

### 🟡 FASE 3: Aplicar Consolidación en Cron Job
**Prioridad**: 🟠 ALTA  
**Tiempo estimado**: 1 hora  
**Archivos a modificar**:
1. `src/app/api/cron/zadarma-daily-sync/route.ts`

**Nota**: ✅ El endpoint `/api/zadarma/stats` YA consolida correctamente  
**Nota**: ✅ El endpoint `/api/zadarma/sync` está deprecado (ya no se usa)

**Acciones**:
- [ ] Importar `consolidateCalls` y `convertZadarmaCallToUTC` en cron job
- [ ] Aplicar conversión de zona horaria a los datos de la API
- [ ] Aplicar consolidación ANTES de guardar en Firestore
- [ ] Eliminar endpoint `/api/zadarma/sync` si ya no se usa

**Código**:
```typescript
// src/app/api/cron/zadarma-daily-sync/route.ts
import { consolidateCalls, convertZadarmaCallToUTC } from '@/lib/zadarma-helpers';

const rawCalls = data.stats || [];
const callsInUTC = rawCalls.map(convertZadarmaCallToUTC);
const consolidatedCalls = consolidateCalls(callsInUTC);
await saveZadarmaCalls(consolidatedCalls);
```

---

### 🟢 FASE 4: Limpiar Datos Existentes en Firestore
**Prioridad**: 🟠 ALTA  
**Tiempo estimado**: 2 horas  
**Tipo**: Script de migración one-time

**Crear nuevo script**: `scripts/clean-zadarma-duplicates.ts`

```typescript
import { db } from '@/lib/firebase-admin';
import { consolidateCalls } from '@/lib/zadarma-helpers';

async function cleanDuplicates() {
  console.log('🧹 Iniciando limpieza de duplicados en Firestore...');
  
  // 1. Obtener TODAS las llamadas
  const snapshot = await db.collection('zadarma_calls').get();
  console.log(`📥 Total de documentos: ${snapshot.size}`);
  
  const allCalls = snapshot.docs.map(doc => doc.data());
  
  // 2. Consolidar
  const consolidated = consolidateCalls(allCalls);
  console.log(`✅ Después de consolidar: ${consolidated.length}`);
  console.log(`🗑️ Duplicados a eliminar: ${snapshot.size - consolidated.length}`);
  
  // 3. Crear un Set de IDs a mantener
  const keepIds = new Set(consolidated.map(c => `${c.pbx_call_id}_${c.callstart}`));
  
  // 4. Eliminar documentos que NO están en keepIds
  const batch = db.batch();
  let deleteCount = 0;
  
  snapshot.docs.forEach(doc => {
    if (!keepIds.has(doc.id)) {
      batch.delete(doc.ref);
      deleteCount++;
    }
  });
  
  await batch.commit();
  console.log(`✅ Eliminados ${deleteCount} duplicados`);
}

cleanDuplicates().catch(console.error);
```

**Ejecutar**:
```bash
npx tsx scripts/clean-zadarma-duplicates.ts
```

---

### 🟢 FASE 5: Actualizar Todas las Páginas del Dashboard
**Prioridad**: 🟡 MEDIA  
**Tiempo estimado**: 3 horas  
**Archivos a revisar y actualizar**:

**Búsqueda de archivos que usan Zadarma**:
```bash
# Buscar todos los componentes que usan datos de Zadarma
grep -r "zadarma" src/app --include="*.tsx" --include="*.ts"
```

**Lista de archivos conocidos a revisar**:
1. ✅ `src/app/(app)/dashboard/performance/page.tsx` - YA tiene conversión correcta
2. ⚠️ Otros dashboards que puedan usar datos de llamadas
3. ⚠️ Componentes de reportes
4. ⚠️ Exports/descargas de datos

**Checklist por archivo**:
- [ ] Verifica que NO re-consolide llamadas (ya vienen consolidadas)
- [ ] Usa `formatInTimeZone` para mostrar fechas en Lima
- [ ] NO manipula directamente los timestamps (ya están en UTC)
- [ ] Documentar asunciones sobre formato de datos

---

## 🧪 FASE 6: Testing y Validación
**Prioridad**: 🔴 CRÍTICA  
**Tiempo estimado**: 2 horas

### Tests a realizar:

1. **Test de Conversión de Zona Horaria**
```typescript
// Test: Verificar que Madrid se convierte a UTC correctamente
const madridTime = "2025-10-25 14:30:00"; // 2:30 PM Madrid
const utcTime = convertZadarmaCallToUTC({ callstart: madridTime });
// Esperado: "2025-10-25T12:30:00.000Z" (12:30 PM UTC)
```

2. **Test de Consolidación**
```typescript
// Test: 100 llamadas con 10 pbx_call_id duplicados = 90 consolidadas
const mockCalls = generateMockDuplicates(100, 10);
const consolidated = consolidateCalls(mockCalls);
expect(consolidated.length).toBe(90);
```

3. **Test de Re-intentos**
```typescript
// Test: 2 llamadas al mismo número en 1 minuto = 1 consolidada
const call1 = { sip: "101", destination: "987654321", callstart: "2025-10-25T08:00:00Z" };
const call2 = { sip: "101", destination: "987654321", callstart: "2025-10-25T08:00:30Z" };
const result = consolidateCalls([call1, call2]);
expect(result.length).toBe(1);
```

4. **Test de Sincronización Completa**
- Ejecutar cron job manual para ayer
- Verificar que el conteo coincide con Zadarma
- Verificar que primera/última llamada están en hora Lima

---

## 📝 CHECKLIST DE IMPLEMENTACIÓN

### Pre-Requisitos
- [ ] Backup de colección `zadarma_calls` en Firestore
- [ ] Backup de colección `zadarma_sync_metadata`
- [ ] Crear rama `fix/zadarma-timezone-consolidation`

### FASE 1: Zona Horaria
- [ ] Crear función `convertZadarmaCallToUTC` en helpers
- [ ] Actualizar cron job con conversión
- [ ] Actualizar sync endpoint con conversión
- [ ] Test manual con llamada de hoy

### FASE 2: Consolidación
- [ ] Implementar nueva lógica `consolidateCalls`
- [ ] Implementar `consolidateRetries`
- [ ] Implementar `selectBestFromBatch`
- [ ] Tests unitarios de consolidación

### FASE 3: Aplicar en Endpoints
- [ ] Actualizar cron job
- [ ] Actualizar sync endpoint
- [ ] Actualizar stats endpoint (verificar, ya tiene)

### FASE 4: Limpieza
- [ ] Crear script `clean-zadarma-duplicates.ts`
- [ ] Ejecutar en desarrollo primero
- [ ] Verificar resultados
- [ ] Ejecutar en producción
- [ ] Verificar conteo antes/después

### FASE 5: Actualizar Dashboards
- [ ] Buscar todos los archivos que usan Zadarma
- [ ] Revisar cada uno según checklist
- [ ] Eliminar consolidaciones duplicadas
- [ ] Verificar formato de fechas

### FASE 6: Testing
- [ ] Tests de conversión de zona horaria
- [ ] Tests de consolidación
- [ ] Tests de re-intentos
- [ ] Test E2E completo

### Post-Implementación
- [ ] Monitorear conteo por 7 días
- [ ] Comparar con panel de Zadarma diariamente
- [ ] Documentar en changelog
- [ ] Actualizar README con nuevas asunciones

---

## 🎯 RESULTADOS ESPERADOS

### Antes vs Después:

| Métrica | Antes | Después |
|---------|-------|---------|
| Precisión de conteo | 89.7% (37 duplicados) | 100% |
| Primera llamada | ±5h error | Exacta (hora Lima) |
| Última llamada | ±5h error | Exacta (hora Lima) |
| Consistencia datos | ❌ Varía según endpoint | ✅ Unificada |
| Duplicados Firestore | ~9.7% | 0% |

### Validación Final:
✅ Zadarma: 382 llamadas = Dashboard: 382 llamadas  
✅ Primera llamada coincide con panel de Zadarma (convertida a Lima)  
✅ Última llamada coincide con panel de Zadarma (convertida a Lima)  
✅ Datos del cron job = Datos del dashboard en tiempo real

---

## 📚 DOCUMENTACIÓN A ACTUALIZAR

1. **README.md** - Sección de Zadarma
2. **docs/ZADARMA-CACHE-SYSTEM.md** - Actualizar flujo
3. **docs/authentication-system.md** - Sin cambios necesarios
4. Crear **docs/ZADARMA-TIMEZONE-HANDLING.md** - Nueva guía

---

## ⚠️ RIESGOS Y MITIGACIONES

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Perder datos históricos | Baja | Alto | Backup antes de limpiar |
| Cron falla en producción | Media | Alto | Probar primero en dev, rollback plan |
| Nueva lógica crea duplicados | Baja | Medio | Tests exhaustivos + monitoreo |
| Usuarios ven datos inconsistentes | Media | Bajo | Implementar en horario de baja actividad |

---

## 🚀 TIMELINE ESTIMADO

- **FASE 1**: 2 horas (Día 1 - Mañana)
- **FASE 2**: 3 horas (Día 1 - Tarde)
- **FASE 3**: 1.5 horas (Día 2 - Mañana)
- **FASE 4**: 2 horas (Día 2 - Tarde)
- **FASE 5**: 3 horas (Día 3 - Mañana)
- **FASE 6**: 2 horas (Día 3 - Tarde)

**Total**: ~13.5 horas de desarrollo + testing (2-3 días de trabajo)

---

**Autor**: GitHub Copilot  
**Fecha**: 25 de octubre de 2025  
**Versión**: 1.0  
**Estado**: 📋 Pendiente de aprobación
