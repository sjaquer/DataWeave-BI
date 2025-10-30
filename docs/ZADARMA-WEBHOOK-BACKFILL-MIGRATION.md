# Guía de Migración: Arquitectura Webhook + Backfill de Zadarma

## 📋 Resumen

Esta guía documenta la migración de un sistema de **polling** (sondeo periódico) a una arquitectura de **doble componente** optimizada para Vercel y Firestore:

1. **Webhook en Tiempo Real**: Recibe notificaciones de Zadarma instantáneamente
2. **Script de Backfill**: Carga histórica y rectificación con manejo correcto de rate limit y timezone

---

## 🎯 Problemas Resueltos

### ❌ Problemas Anteriores
- **Rate Limiting**: Bloqueos por exceder 3 llamadas/min al endpoint `/v1/statistics/`
- **Timezone**: Pérdida de datos después de las 8 PM por diferencia UTC vs local
- **Duplicados**: Falta de estrategia de deduplicación
- **Latencia**: Datos disponibles solo después del próximo polling

### ✅ Soluciones Implementadas
- **Webhook**: Datos en tiempo real sin consumir rate limit de statistics
- **Pausa Preventiva**: 21s entre llamadas (2.8/min) en backfill
- **Conversión UTC**: Uso correcto de `date-fns-tz` para conversión local ↔ UTC
- **Upsert Strategy**: `set({ merge: true })` permite convivencia webhook + backfill
- **ID Determinístico**: Uso de `call_id_with_rec` o `pbx_call_id` como document ID

---

## 🏗️ Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────────┐
│                         ZADARMA API                             │
│  (Notificaciones Webhook + Endpoint /v1/statistics/)            │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                │ NOTIFY_END/NOTIFY_MISSED    │ GET /v1/statistics/
                │ (Tiempo Real)               │ (Backfill/Rectificación)
                ▼                             ▼
    ┌──────────────────────┐      ┌──────────────────────────┐
    │  Vercel Serverless   │      │   Script de Backfill     │
    │ /api/zadarma/webhook │      │ zadarma-backfill.ts      │
    │                      │      │                          │
    │ • Responde 200 OK    │      │ • Pausa 21s/llamada      │
    │ • Procesa en bg      │      │ • Conversión UTC         │
    │ • Upsert a Firestore │      │ • Upsert a Firestore     │
    └───────┬──────────────┘      └────────┬─────────────────┘
            │                              │
            │    set(doc, { merge: true }) │
            ▼                              ▼
    ┌──────────────────────────────────────────────────────┐
    │           FIRESTORE: Collection "zadarma_calls"      │
    │                                                       │
    │  Document ID: call_id_with_rec o pbx_call_id         │
    │  • Deduplicación automática (mismo ID = mismo doc)   │
    │  • Campos: last_updated_by = 'webhook' | 'backfill'  │
    └──────────────────────────────────────────────────────┘
```

---

## 📁 Archivos Creados

### 1. Webhook Endpoint
**Archivo**: `src/app/api/zadarma/webhook/route.ts`

**Funcionalidad**:
- Recibe eventos `NOTIFY_END` y `NOTIFY_MISSED` de Zadarma
- Responde inmediatamente `200 OK` (crítico para evitar timeouts)
- Procesa datos en segundo plano
- Guarda en Firestore con `set({ merge: true })`
- Validación con Zod schemas

**Campos Guardados**:
```typescript
{
  call_id: string,                    // ID del documento
  pbx_call_id: string,
  call_id_with_rec: string,
  callstart: string,                  // "2025-10-29 14:30:00"
  start_time_utc: Timestamp,          // Timestamp de Firestore
  callDate: string,                   // "2025-10-29" (para queries)
  duration: number,
  disposition: string,
  sip: string,
  agentId: string,
  agentName: string,
  last_updated_by: 'webhook',
  webhook_received_at: Timestamp,
  // ... otros campos
}
```

### 2. Script de Backfill
**Archivo**: `scripts/zadarma-backfill.ts`

**Funcionalidad**:
- Carga histórica o rectificación diaria
- Divide rangos en ventanas de 1 hora
- Pausa preventiva de 21 segundos entre llamadas
- Conversión correcta timezone local → UTC
- Misma estructura de datos que webhook
- `last_updated_by: 'backfill'`

**Uso**:
```bash
# Carga masiva (local)
npx tsx scripts/zadarma-backfill.ts \
  --from="2024-01-01" \
  --to="2025-10-30" \
  --timezone="America/Lima"

# Últimas 24 horas (para cron)
npx tsx scripts/zadarma-backfill.ts \
  --days=1 \
  --timezone="America/Lima"
```

### 3. Vercel Cron (Backfill Automático)
**Archivo**: `src/app/api/cron/zadarma-backfill/route.ts`

**Configuración** (`vercel.json`):
```json
{
  "crons": [
    {
      "path": "/api/cron/zadarma-backfill",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Ejecuta backfill diario a las 2 AM (UTC) para rectificar cualquier llamada perdida.

---

## 🚀 Plan de Migración (Paso a Paso)

### Fase 1: Preparación (Local)

#### 1.1 Auditar Firestore
```bash
# Verificar estructura actual de zadarma_calls
# Asegurar que usamos call_id como document ID
```

**Acción**: Si usas otro ID, considera migración o ajustar lógica de webhook/backfill.

#### 1.2 Configurar Variables de Entorno
```bash
# .env.local (desarrollo)
ZADARMA_API_KEY=tu_api_key
ZADARMA_API_SECRET=tu_api_secret
CRON_SECRET=un_secreto_aleatorio_para_cron

# Firebase Admin (si aún no configurado)
FIREBASE_PROJECT_ID=tu_proyecto
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
```

#### 1.3 Probar Webhook Localmente
```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Simular webhook (con curl o Postman)
curl -X POST http://localhost:9002/api/zadarma/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "NOTIFY_END",
    "call_id_with_rec": "test123",
    "pbx_call_id": "test123",
    "call_start": "2025-10-30 10:00:00",
    "duration": "120",
    "disposition": "answered",
    "caller_id": "+51999999999",
    "called_did": "+51888888888",
    "sip": "105"
  }'

# Verificar en Firestore que el documento se creó
```

#### 1.4 Probar Backfill Localmente (Muestra Pequeña)
```bash
# Probar con 1 día reciente
npx tsx scripts/zadarma-backfill.ts \
  --from="2025-10-29" \
  --to="2025-10-29" \
  --timezone="America/Lima"

# Verificar:
# - ¿Se respeta la pausa de 21s?
# - ¿Se guardan los datos correctamente?
# - ¿La conversión UTC es correcta?
```

---

### Fase 2: Despliegue en Vercel

#### 2.1 Commit y Push
```bash
git add .
git commit -m "feat: Implementar webhook + backfill de Zadarma"
git push origin main
```

#### 2.2 Configurar Variables de Entorno en Vercel
```bash
# Dashboard de Vercel → Settings → Environment Variables
ZADARMA_API_KEY=...
ZADARMA_API_SECRET=...
CRON_SECRET=...
# (+ variables de Firebase Admin si aplica)
```

**Importante**: Redeploy después de añadir variables.

#### 2.3 Activar Webhook en Zadarma

1. **Panel de Zadarma** → **Configuración** → **Notificaciones** → **Configurar webhook**
2. **URL del webhook**: `https://tu-app.vercel.app/api/zadarma/webhook`
3. **Eventos a suscribir**:
   - ✅ `NOTIFY_END` (llamada terminada)
   - ✅ `NOTIFY_MISSED` (llamada perdida)
4. **Método**: `POST`
5. **Guardar**

#### 2.4 Monitorear (Tiempo Real)

```bash
# Vercel Dashboard → Logs
# O usando CLI:
vercel logs --follow

# Hacer una llamada de prueba y verificar:
# - ¿El webhook se recibe?
# - ¿Aparece en logs de Vercel?
# - ¿Se crea el documento en Firestore instantáneamente?
```

**Verificación en Firestore**:
- Buscar documento con `last_updated_by: 'webhook'`
- Verificar que `webhook_received_at` es reciente

---

### Fase 3: Backfill Histórico (Carga Masiva)

#### 3.1 Ejecutar Backfill Completo (Local)

**⚠️ ADVERTENCIA**: Esto puede tardar **días** dependiendo del rango.

**Ejemplo**: Para 1 año de datos (365 días × 24 horas × 21 segundos):
- **Total**: ~8,760 llamadas API
- **Tiempo estimado**: ~51 horas (2.1 días)

```bash
# Recomendación: Ejecutar en una máquina que no se apague
# Usar screen/tmux en Linux o nohup

npx tsx scripts/zadarma-backfill.ts \
  --from="2024-01-01" \
  --to="2025-10-30" \
  --timezone="America/Lima" \
  > backfill.log 2>&1 &

# Monitorear progreso:
tail -f backfill.log
```

#### 3.2 Verificar Datos Cargados

```bash
# Firestore Console o usando script de verificación
# - ¿Hay documentos con last_updated_by: 'backfill'?
# - ¿Los rangos de fechas son correctos?
# - ¿Los timestamps UTC están bien?
```

---

### Fase 4: Activar Cron Diario

El cron ya está configurado en `vercel.json` y se ejecutará automáticamente.

**Verificación**:
1. Vercel Dashboard → Cron Jobs
2. Ver ejecuciones pasadas y logs
3. Asegurar que se ejecuta diariamente a las 2 AM UTC

**Opcional**: Ajustar horario en `vercel.json` si es necesario:
```json
{
  "crons": [
    {
      "path": "/api/cron/zadarma-backfill",
      "schedule": "0 2 * * *"  // Cambiar hora aquí (formato cron)
    }
  ]
}
```

---

### Fase 5: Deshabilitar Lógica Antigua

Una vez que:
- ✅ El webhook está funcionando (verificado con llamadas reales)
- ✅ El backfill histórico completó la carga
- ✅ El cron diario se ejecuta correctamente

**Puedes**:
1. Deshabilitar/eliminar el antiguo endpoint de polling
2. Remover lógica de `/api/zadarma/stats` relacionada con polling activo
3. Mantener `/api/zadarma/stats` solo para **lectura** desde Firestore

---

## 🔍 Debugging y Monitoreo

### Verificar Webhook

```bash
# Ver logs en tiempo real
vercel logs --follow

# Buscar errores específicos
vercel logs | grep "\[WEBHOOK ERROR\]"

# Probar endpoint GET (health check)
curl https://tu-app.vercel.app/api/zadarma/webhook
# Respuesta esperada: { status: 'ok', message: '...', timestamp: '...' }
```

### Verificar Backfill

```bash
# Ver logs del cron
vercel logs | grep "\[CRON\]"

# Ejecutar manualmente (testing)
curl https://tu-app.vercel.app/api/cron/zadarma-backfill \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

### Queries de Firestore (Ejemplos)

```javascript
// Ver últimas llamadas por webhook
db.collection('zadarma_calls')
  .where('last_updated_by', '==', 'webhook')
  .orderBy('webhook_received_at', 'desc')
  .limit(10)
  .get()

// Ver últimas llamadas por backfill
db.collection('zadarma_calls')
  .where('last_updated_by', '==', 'backfill')
  .orderBy('backfill_processed_at', 'desc')
  .limit(10)
  .get()

// Verificar duplicados (ambos deben actualizar el mismo documento)
// Buscar un call_id que existe en ambos:
db.collection('zadarma_calls')
  .doc('CALL_ID_CONOCIDO')
  .get()
  .then(doc => console.log(doc.data()))
```

---

## 📊 Comparación: Antes vs Después

| Aspecto | Antes (Polling) | Después (Webhook + Backfill) |
|---------|----------------|------------------------------|
| **Latencia de datos** | 1-5 minutos (intervalo de polling) | < 1 segundo (tiempo real) |
| **Rate limit** | Constante (riesgo de bloqueo) | Webhook: 0 / Backfill: respetado |
| **Timezone** | ❌ Pérdida de datos post-8PM | ✅ Conversión correcta UTC |
| **Duplicados** | ❌ Posibles duplicados | ✅ Dedup automático por doc ID |
| **Carga histórica** | ⚠️ Lenta y riesgosa | ✅ Segura con pausas |
| **Confiabilidad** | ⚠️ Depende de polling constante | ✅ Webhook + rectificación diaria |
| **Costo Firestore** | Similar | Similar (menos writes duplicados) |

---

## 🛡️ Mejores Prácticas

### 1. Seguridad del Webhook
```typescript
// Opcional: Validar firma de Zadarma
// Zadarma puede enviar un header de validación
const signature = req.headers.get('x-zadarma-signature');
// Implementar verificación según docs de Zadarma
```

### 2. Manejo de Errores
```typescript
// El webhook ya responde 200 OK antes de procesar
// Los errores solo se loggean, no afectan la respuesta a Zadarma
// Esto evita que Zadarma reintente indefinidamente
```

### 3. Idempotencia
```typescript
// set({ merge: true }) asegura idempotencia
// Si Zadarma reenvía el mismo evento, no hay duplicados
```

### 4. Monitoreo Proactivo
```bash
# Configurar alertas en Vercel para:
# - Errores 500 en webhook
# - Fallos en cron diario
# - Rate limit errors en backfill
```

---

## 🎓 Conceptos Clave

### UTC vs Local Time
```typescript
// ❌ INCORRECTO (pérdida de datos)
const start = "2025-10-29 00:00:00"; // ¿Local o UTC?
const end = "2025-10-29 23:59:59";

// ✅ CORRECTO
import { fromZonedTime } from 'date-fns-tz';
const localStart = new Date('2025-10-29 00:00:00');
const utcStart = fromZonedTime(localStart, 'America/Lima');
// Ahora utcStart es 2025-10-29 05:00:00 UTC (Lima = UTC-5)
```

### Upsert Strategy
```typescript
// ❌ INCORRECTO (puede duplicar o fallar)
await db.collection('calls').add(data);

// ✅ CORRECTO (dedup automático)
await db.collection('calls')
  .doc(deterministic_id)
  .set(data, { merge: true });
```

### Rate Limiting
```typescript
// ❌ INCORRECTO (bloqueo seguro)
for (let i = 0; i < 100; i++) {
  await fetchAPI();
}

// ✅ CORRECTO (3 llamadas/min → 1 cada 21s)
for (let i = 0; i < 100; i++) {
  await fetchAPI();
  await sleep(21000); // Pausa preventiva
}
```

---

## 📞 Soporte

Si encuentras problemas:

1. **Verificar logs** de Vercel primero
2. **Revisar Firestore** para inconsistencias
3. **Ejecutar backfill** manualmente con `--days=1` para debugging
4. **Consultar docs** de Zadarma sobre webhooks

---

## ✅ Checklist de Migración

- [ ] Variables de entorno configuradas (local y Vercel)
- [ ] Webhook testeado localmente
- [ ] Backfill testeado localmente (muestra pequeña)
- [ ] Código pusheado a Vercel
- [ ] Variables configuradas en Vercel
- [ ] Webhook activado en panel de Zadarma
- [ ] Llamada de prueba realizada y verificada
- [ ] Backfill histórico ejecutándose
- [ ] Cron diario activado y verificado
- [ ] Lógica antigua deshabilitada
- [ ] Monitoreo configurado

---

**Fecha de creación**: 30 de Octubre, 2025  
**Última actualización**: 30 de Octubre, 2025  
**Versión**: 1.0
