# 🚀 CHECKLIST PRE-DEPLOYMENT - ARQUITECTURA WEBHOOK + BACKFILL

**Fecha**: 30 de Octubre, 2025  
**Branch**: REUT_3  
**Objetivo**: Migración completa de polling a webhook + backfill

---

## ✅ CAMBIOS COMPLETADOS

### 1. Backend - Nuevos Endpoints

- [x] `/api/zadarma/webhook` - Webhook endpoint (NOTIFY_END, NOTIFY_MISSED)
- [x] `/api/cron/zadarma-backfill` - Vercel Cron para backfill diario
- [x] `/api/zadarma/stats` - **SIMPLIFICADO** (solo lectura desde Firestore)
- [x] `/api/zadarma/sync` - **DEPRECADO** (devuelve 410 Gone)

### 2. Scripts

- [x] `scripts/zadarma-backfill.ts` - Backfill con rate limiting (21s)
- [x] `scripts/cleanup-zadarma-collections.ts` - Limpieza de colecciones Firestore
- [x] `package.json` - Scripts npm añadidos:
  - `zadarma:backfill`
  - `zadarma:backfill:test`
  - `zadarma:backfill:daily`

### 3. Configuración

- [x] `vercel.json` - Cron job configurado (2 AM UTC diario)
- [x] Schemas de validación Zod (NOTIFY_END, NOTIFY_MISSED)
- [x] Conversión timezone correcta (date-fns-tz v3)

### 4. Documentación

- [x] `docs/ZADARMA-WEBHOOK-BACKFILL-MIGRATION.md` - Guía completa
- [x] `docs/ZADARMA-QUICKSTART.md` - Quick start
- [x] `docs/ZADARMA-IMPLEMENTATION-SUMMARY.md` - Resumen ejecutivo

### 5. Frontend

- [x] `dashboard/performance/page.tsx` - Badges actualizados
- [x] Mensajes reflejan arquitectura Webhook + Backfill
- [x] Cache de sesión optimizado

---

## 🔥 PASOS DE DEPLOYMENT

### FASE 1: Limpieza de Datos (Local/Producción)

```bash
# 1. Ejecutar script de limpieza de Firestore
npx tsx scripts/cleanup-zadarma-collections.ts

# Confirmará eliminación de:
# - zadarma_calls
# - zadarma_sync_metadata
# - zadarma_sync_locks
```

**Resultado esperado**: Colecciones vacías, listas para repoblación limpia.

---

### FASE 2: Deployment a Vercel

```bash
# 1. Verificar que todos los cambios estén committed
git status

# 2. Commit final si hay cambios pendientes
git add .
git commit -m "feat: Arquitectura Webhook + Backfill completa"

# 3. Push a repositorio
git push origin REUT_3

# 4. Merge a main (si corresponde)
git checkout main
git merge REUT_3
git push origin main
```

**Vercel automáticamente desplegará los cambios.**

---

### FASE 3: Configuración de Variables de Entorno en Vercel

Ve a: **Vercel Dashboard → Settings → Environment Variables**

Asegúrate de que estén configuradas:

```env
# Zadarma API
ZADARMA_API_KEY=...
ZADARMA_API_SECRET=...

# Firebase Admin
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Cron Security
CRON_SECRET=... (genera uno aleatorio: openssl rand -hex 32)
```

**Después de añadir variables**: **Redeploy** la aplicación desde Vercel.

---

### FASE 4: Activar Webhook en Panel de Zadarma

1. Ir a: **Panel de Zadarma → API → Webhooks**

2. Configurar webhook:
   ```
   URL: https://tu-app.vercel.app/api/zadarma/webhook
   Eventos: 
   - NOTIFY_END
   - NOTIFY_MISSED
   Método: POST
   ```

3. **Guardar configuración**

4. **Hacer llamada de prueba** y verificar logs en Vercel:
   ```bash
   vercel logs --follow
   ```

   Deberías ver:
   ```
   [WEBHOOK] Processing NOTIFY_END event
   [WEBHOOK] Call saved to Firestore: call_id_...
   ```

---

### FASE 5: Backfill Histórico (Local o Vercel)

#### Opción A: Backfill Local (Recomendado para rangos grandes)

```bash
# Ejemplo: 1 año de datos
npm run zadarma:backfill -- \
  --from="2024-01-01" \
  --to="2025-10-30" \
  --timezone="America/Lima" \
  > backfill.log 2>&1

# Monitorear progreso en otra terminal:
tail -f backfill.log
```

**Tiempo estimado**:
- 1 día: ~8-10 minutos
- 1 mes: ~4-5 horas
- 1 año: ~48-51 horas

#### Opción B: Backfill por Rangos (Para distribuir carga)

```bash
# Enero 2024
npm run zadarma:backfill -- --from="2024-01-01" --to="2024-01-31"

# Febrero 2024
npm run zadarma:backfill -- --from="2024-02-01" --to="2024-02-29"

# ... etc
```

---

### FASE 6: Verificación y Monitoreo

#### 1. Verificar Webhook

```bash
# Ver logs en tiempo real
vercel logs --follow

# Filtrar solo webhooks
vercel logs | grep "\[WEBHOOK\]"
```

#### 2. Verificar Firestore

- Ve a: **Firebase Console → Firestore Database**
- Colección: `zadarma_calls`
- Verifica que documentos contengan:
  - `last_updated_by: 'webhook'` (datos en tiempo real)
  - `last_updated_by: 'backfill'` (datos históricos)

#### 3. Verificar Cron Job

- Ve a: **Vercel Dashboard → Cron Jobs**
- Verifica que el cron `/api/cron/zadarma-backfill` esté programado
- Revisa ejecuciones pasadas (debe ejecutarse diariamente a las 2 AM UTC)

#### 4. Verificar Dashboard

- Abre: `https://tu-app.vercel.app/dashboard/performance`
- Selecciona rango de fechas
- Verifica:
  - ✅ Badge muestra "Datos desde Firestore (Webhook + Backfill)"
  - ✅ Datos se cargan rápido (< 1 segundo)
  - ✅ Llamadas completas sin huecos
  - ✅ Datos hasta 22:00 (10 PM) correctos

---

## 🧪 TESTING COMPLETO

### Test 1: Webhook en Tiempo Real

1. Hacer una llamada de prueba desde Zadarma PBX
2. Verificar en Vercel logs:
   ```
   [WEBHOOK] Processing NOTIFY_END event
   [WEBHOOK] Call saved: call_id_XXXXX
   ```
3. Verificar en Firestore que el documento aparece en < 1 segundo
4. Refrescar dashboard y verificar que la llamada aparece

**Resultado esperado**: Llamada visible en dashboard en < 5 segundos.

---

### Test 2: Backfill de 1 Día

```bash
# Test con ayer
npm run zadarma:backfill:test
```

**Resultado esperado**: 
- Sin errores de rate limit
- Pausas de 21 segundos entre llamadas
- Datos guardados en Firestore
- Dashboard muestra datos completos

---

### Test 3: Lectura desde Dashboard

1. Seleccionar rango: **Ayer → Hoy**
2. Verificar badge: "Datos desde Firestore (Webhook + Backfill)"
3. Verificar que se muestra información completa
4. Verificar latencia < 1 segundo

---

### Test 4: Endpoint Deprecado

```bash
curl -X POST https://tu-app.vercel.app/api/zadarma/sync \
  -H "Content-Type: application/json" \
  -d '{"startDate": "2025-10-29"}'
```

**Resultado esperado**:
```json
{
  "status": "error",
  "message": "Este endpoint ha sido deprecado...",
  "deprecated": true,
  "deprecationDate": "2025-10-30"
}
```

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Antes (Polling) | Después (Webhook) |
|---------|-----------------|-------------------|
| Latencia (hoy) | 1-3s | < 1s |
| Latencia (histórico) | 0.2-0.5s | 0.2-0.5s |
| Completitud | 95-98% | 100% |
| Freshness | 1-3 min | < 1s |
| Rate limit issues | Raros | Nunca |
| API calls (dashboard) | 1-3 por vista | 0 por vista |

---

## 🐛 TROUBLESHOOTING

### Problema: Webhook no recibe eventos

**Solución**:
1. Verificar URL en panel de Zadarma (debe ser HTTPS)
2. Verificar que eventos están seleccionados
3. Ver logs de Vercel: `vercel logs --follow`
4. Hacer llamada de prueba manual con curl:
   ```bash
   curl -X POST https://tu-app.vercel.app/api/zadarma/webhook \
     -H "Content-Type: application/json" \
     -d '{"event":"NOTIFY_END","call_id_with_rec":"test123",...}'
   ```

---

### Problema: Backfill da error 429 (Rate Limit)

**Solución**:
1. Verificar que pausa es de 21 segundos (configurada en script)
2. Si persiste, aumentar pausa a 25s en `scripts/zadarma-backfill.ts`:
   ```typescript
   await sleep(25000); // 25 segundos
   ```
3. Reintentar desde última fecha exitosa

---

### Problema: Dashboard muestra datos vacíos

**Solución**:
1. Verificar Firestore tiene documentos en `zadarma_calls`
2. Verificar rango de fechas seleccionado
3. Limpiar cache del navegador (Ctrl+Shift+R)
4. Verificar logs en Vercel: `vercel logs`

---

### Problema: Cron no ejecuta automáticamente

**Solución**:
1. Verificar `vercel.json` tiene configuración cron
2. Verificar que aplicación está en plan Pro/Hobby (crons gratuitos tienen límites)
3. Verificar variable `CRON_SECRET` está configurada
4. Ver ejecuciones en Vercel Dashboard → Cron Jobs

---

## 📝 NOTAS ADICIONALES

### Estructura de Documento en Firestore

```typescript
{
  id: "call_id_with_rec_20251030143000",
  pbx_call_id: "XXXXX",
  call_id_with_rec: "XXXXX_XXXXX",
  callstart: "2025-10-30 14:30:00",
  callDate: "2025-10-30",
  disposition: "answered",
  sip: "101",
  agentName: "Aylen",
  seconds: 120,
  destination: "987654321",
  
  // Metadatos
  last_updated_by: "webhook" | "backfill",
  webhook_received_at: "2025-10-30T14:30:05.123Z", // solo webhook
  backfill_synced_at: "2025-10-30T02:00:00.000Z", // solo backfill
  createdAt: Timestamp,
  syncedAt: "2025-10-30T14:30:05.123Z"
}
```

### Rate Limit de Zadarma

- **Límite**: 3 llamadas/minuto a `/v1/statistics/`
- **Backfill**: 21 segundos entre llamadas = 2.8 calls/min (margen de seguridad)
- **Webhook**: 0 llamadas API (Zadarma push)

### Costos Firestore

- **Writes**: ~1-2 writes por llamada (upsert con merge: true)
- **Reads**: ~1 read por consulta de dashboard
- **Storage**: ~1 KB por llamada

**Estimación mensual** (con 50,000 llamadas/mes):
- Writes: 50,000-100,000 (dentro de cuota gratuita)
- Reads: Depende de uso de dashboard
- Storage: ~50 MB (negligible)

---

## ✅ DEPLOYMENT FINAL CHECKLIST

Antes de considerar completado:

- [ ] Colecciones Firestore limpiadas
- [ ] Código desplegado a Vercel
- [ ] Variables de entorno configuradas
- [ ] Webhook activado en Zadarma
- [ ] Llamada de prueba verificada
- [ ] Backfill histórico ejecutado
- [ ] Dashboard muestra datos correctos
- [ ] Cron job configurado y verificado
- [ ] Documentación actualizada
- [ ] Tests pasando
- [ ] Métricas monitoreadas

---

**Documento creado**: 30 de Octubre, 2025  
**Última actualización**: 30 de Octubre, 2025  
**Próxima revisión**: Después de primera semana en producción
