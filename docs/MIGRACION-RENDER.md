# 🚀 Guía de Migración a Render

Esta guía detalla paso a paso cómo migrar DataWeave-BI desde Vercel a Render Premium.

---

## 📋 Tabla de Contenidos

1. [Preparación](#preparación)
2. [Configuración en Render](#configuración-en-render)
3. [Variables de Entorno](#variables-de-entorno)
4. [Deployment](#deployment)
5. [Actualizar Webhooks](#actualizar-webhooks)
6. [Validación](#validación)
7. [Cutover a Producción](#cutover-a-producción)
8. [Rollback Plan](#rollback-plan)

---

## 🛠️ Preparación

### 1. Verificar Cambios Locales

Asegúrate de que todos los cambios estén commiteados y pusheados a GitHub:

```powershell
git status
git add .
git commit -m "feat: migración a Render con worker pattern"
git push origin main
```

### 2. Exportar Variables de Entorno desde Vercel

```powershell
# Listar variables de entorno actuales (copia manualmente)
# Ir a: https://vercel.com/tu-proyecto/settings/environment-variables
```

**Variables críticas a migrar:**

| Variable | Descripción | Notas |
|----------|-------------|-------|
| `ZADARMA_API_KEY` | Clave API Zadarma | Copiar exacto |
| `ZADARMA_API_SECRET` | Secret API Zadarma | Copiar exacto |
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account | Ver formato abajo |
| `REFRESH_TODAY_SECRET` | Secret para endpoint HOY | Copiar exacto |
| `NEXT_PUBLIC_*` | Variables públicas del frontend | Copiar todas |
| `DATABASE_URL` (si aplica) | URL de base de datos externa | Si usas PostgreSQL/MySQL |

### 3. Preparar Service Account de Firebase

El service account de Firebase debe estar en formato **JSON string** (una sola línea):

```json
{"type":"service_account","project_id":"tu-proyecto","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@tu-proyecto.iam.gserviceaccount.com",...}
```

**⚠️ IMPORTANTE:** En Render, pega el JSON completo en una sola línea, sin saltos de línea dentro del valor de `FIREBASE_SERVICE_ACCOUNT`.

---

## 🌐 Configuración en Render

### 1. Crear Cuenta en Render

1. Ve a [https://render.com](https://render.com)
2. Regístrate con tu cuenta GitHub
3. Autoriza acceso a tu repositorio `DataWeave-BI`

### 2. Crear Web Service (Next.js App)

#### Paso 1: New Web Service

1. Click en **"New +"** → **"Web Service"**
2. Conecta tu repositorio GitHub
3. Selecciona el branch: `main`
4. Configuración:

| Campo | Valor |
|-------|-------|
| **Name** | `dataweave-bi` |
| **Environment** | `Node` |
| **Region** | `Oregon (US West)` (elige el más cercano) |
| **Branch** | `main` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm run start` |
| **Plan** | **Starter** ($7/mes) o **Standard** ($25/mes) |

#### Paso 2: Advanced Settings

Expande "Advanced" y configura:

- **Auto-Deploy**: Yes (deploy automático en cada push)
- **Health Check Path**: `/api/health` (crea este endpoint, ver abajo)

### 3. Crear Background Worker (Worker.js)

#### Paso 1: New Background Worker

1. Click en **"New +"** → **"Background Worker"**
2. Conecta el mismo repositorio
3. Configuración:

| Campo | Valor |
|-------|-------|
| **Name** | `dataweave-bi-worker` |
| **Environment** | `Node` |
| **Region** | **Mismo que web service** |
| **Branch** | `main` |
| **Build Command** | `npm install` |
| **Start Command** | `node worker.js` |
| **Plan** | **Starter** ($7/mes) |

**⚠️ IMPORTANTE:** El worker debe estar en la **misma región** que el web service para minimizar latencia con Firestore.

---

## 🔐 Variables de Entorno

### Web Service Environment Variables

En el dashboard de Render → Tu Web Service → Environment:

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Zadarma API
ZADARMA_API_KEY=tu_clave_api
ZADARMA_API_SECRET=tu_secret_api

# Security
REFRESH_TODAY_SECRET=tu_secret_para_refresh_hoy

# Base URL (tu dominio en Render)
BASE_API_URL=https://dataweave-bi.onrender.com

# Next.js (públicas - prefijo NEXT_PUBLIC_)
NEXT_PUBLIC_APP_NAME=DataWeave BI
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
# ... (copia todas las NEXT_PUBLIC_ desde Vercel)

# Node Environment
NODE_ENV=production
```

### Worker Environment Variables

En el dashboard de Render → Tu Worker → Environment:

```env
# Firebase (mismo que web service)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Zadarma API (mismo que web service)
ZADARMA_API_KEY=tu_clave_api
ZADARMA_API_SECRET=tu_secret_api

# Node Environment
NODE_ENV=production
```

**💡 TIP:** Usa "Add from .env file" para pegar múltiples variables de una vez.

---

## 🚢 Deployment

### 1. Crear Health Check Endpoint

Crea `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    // Verificar conexión a Firestore
    await db.collection('_health_check').limit(1).get();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'dataweave-bi',
      database: 'connected'
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
```

Commitea y pushea:

```powershell
git add src/app/api/health/route.ts
git commit -m "feat: health check endpoint para Render"
git push origin main
```

### 2. Verificar Deployment

Render automáticamente:
1. Detectará el push
2. Hará build del proyecto
3. Desplegará web service y worker

**Monitorear logs:**
- Web Service: `Dashboard → dataweave-bi → Logs`
- Worker: `Dashboard → dataweave-bi-worker → Logs`

**Verificar health check:**

```powershell
curl https://dataweave-bi.onrender.com/api/health
```

Debe retornar:

```json
{
  "status": "ok",
  "timestamp": "2025-01-17T...",
  "service": "dataweave-bi",
  "database": "connected"
}
```

---

## 🔗 Actualizar Webhooks

### 1. Shopify Webhooks

Actualiza las URLs de webhooks en Shopify Admin:

**URLs antiguas (Vercel):**
```
https://tu-app.vercel.app/api/shopify/orders
https://tu-app.vercel.app/api/shopify/products
```

**URLs nuevas (Render):**
```
https://dataweave-bi.onrender.com/api/shopify/orders
https://dataweave-bi.onrender.com/api/shopify/products
```

**Comandos PowerShell para actualizar webhooks:**

```powershell
# 1. Listar webhooks existentes
$shop = "tu-tienda.myshopify.com"
$accessToken = "tu_access_token"

$headers = @{
    "X-Shopify-Access-Token" = $accessToken
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "https://$shop/admin/api/2024-01/webhooks.json" -Headers $headers -Method Get

# 2. Actualizar webhook de orders (reemplaza WEBHOOK_ID)
$webhookId = "WEBHOOK_ID_ORDERS"
$newUrl = "https://dataweave-bi.onrender.com/api/shopify/orders"

$body = @{
    webhook = @{
        id = $webhookId
        address = $newUrl
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://$shop/admin/api/2024-01/webhooks/$webhookId.json" -Headers $headers -Method Put -Body $body

# 3. Actualizar webhook de products
$webhookId = "WEBHOOK_ID_PRODUCTS"
$newUrl = "https://dataweave-bi.onrender.com/api/shopify/products"

$body = @{
    webhook = @{
        id = $webhookId
        address = $newUrl
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://$shop/admin/api/2024-01/webhooks/$webhookId.json" -Headers $headers -Method Put -Body $body
```

### 2. Otros Webhooks / Integraciones

Si tienes otras integraciones (Stripe, Twilio, etc.), actualiza también sus webhooks:

1. **Google Apps Script** (si aplica):
   - Actualiza URLs en `google-apps-script/inventory-sync.js`
   - Redeploy el script

2. **Zapier / Make / n8n**:
   - Actualiza URLs en tus workflows

---

## ✅ Validación

### 1. Validación Funcional

**Test endpoints críticos:**

```powershell
# 1. Health check
curl https://dataweave-bi.onrender.com/api/health

# 2. Zadarma calls (requiere auth)
curl https://dataweave-bi.onrender.com/api/zadarma/calls

# 3. Verificar completeness (includeToday)
curl "https://dataweave-bi.onrender.com/api/zadarma/check-missing?includeToday=true"

# 4. Iniciar backfill (test pequeño - 2 días)
curl -X POST https://dataweave-bi.onrender.com/api/zadarma/backfill-progress `
  -H "Content-Type: application/json" `
  -d '{"startDate":"2025-01-10","endDate":"2025-01-11"}'

# Debe retornar: {"status":"queued","sessionId":"backfill_...","jobId":"..."}

# 5. Consultar progreso del backfill
curl "https://dataweave-bi.onrender.com/api/zadarma/backfill-progress?sessionId=PEGAR_SESSION_ID_AQUI"
```

### 2. Validación del Worker

**Verificar logs del worker:**

```
Dashboard → dataweave-bi-worker → Logs
```

Debes ver:

```
[WORKER] 🚀 Worker iniciado: worker_12345_1736123456789
[WORKER] 📊 Configuración:
[WORKER]    - Poll interval: 5000ms
[WORKER]    - Job TTL: 900000ms
[WORKER]    - Max attempts: 3
[WORKER] ✅ Job claimed: abc123xyz
[WORKER] 🚀 Procesando job backfill_...: 2025-01-10 → 2025-01-11
[WORKER] 📅 Procesando 2025-01-10...
[WORKER] 📊 2025-01-10: 147 llamadas obtenidas
[WORKER] ✅ 2025-01-10 completado: 147/147 guardadas
...
[WORKER] 🎉 Job backfill_... completado: 294/294 en 321s
```

### 3. Validación del Frontend

1. Abre el dashboard: `https://dataweave-bi.onrender.com/dashboard/performance`
2. Verifica:
   - ✅ Se cargan datos de HOY
   - ✅ Auto-refresh funciona cada 60s (solo para HOY)
   - ✅ Botón "Forzar HOY" funciona
   - ✅ Días pasados NO auto-refresh
   - ✅ Backfill progress se actualiza en tiempo real

### 4. Validación de Firestore

**Verificar colecciones:**

- `zadarma_calls` - debe tener datos recientes
- `zadarma_sync_metadata` - debe tener `sync_2025-01-17` con lastSyncTimestamp reciente
- `zadarma_backfill_sessions` - debe tener sesión con status `completed`
- `zadarma_jobs` - debe tener job con status `completed`

---

## 🔄 Cutover a Producción

### Fase 1: Dual-Run (Seguro)

**Mantén ambos sistemas activos durante 1-2 días:**

1. **Vercel** → Solo lectura (no actualizar webhooks aún)
2. **Render** → Activo con webhooks actualizados

**Beneficios:**
- Puedes comparar datos entre ambos
- Si Render falla, Vercel sigue funcionando
- Rollback instantáneo si es necesario

### Fase 2: Apagar Vercel

Una vez validado que Render funciona correctamente:

1. Ve a Vercel Dashboard → Tu Proyecto → Settings
2. Click en **"Pause Project"** (no borrar aún)
3. Espera 24 horas más
4. Si todo OK → **"Delete Project"**

---

## 🔙 Rollback Plan

Si algo sale mal en Render, puedes regresar a Vercel:

### Opción A: Reactivar Vercel (Rápido)

1. Vercel Dashboard → Reactivar proyecto
2. Vercel automáticamente redeploy desde GitHub
3. Actualizar webhooks de vuelta a URLs de Vercel
4. Tiempo estimado: **5-10 minutos**

### Opción B: Redeploy Manual

Si borraste el proyecto de Vercel:

```powershell
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy desde local
vercel --prod

# 3. Actualizar webhooks
# (usar comandos PowerShell de sección anterior)
```

---

## 📊 Monitoreo Post-Migración

### Métricas a Vigilar (primeros 7 días)

1. **Uptime:**
   - Render Dashboard → Metrics
   - Objetivo: >99.9%

2. **Response Time:**
   - `/api/zadarma/calls` → <500ms
   - `/api/zadarma/stats` → <2s

3. **Worker Health:**
   - Jobs procesados sin error
   - No hay jobs con status `failed`

4. **Firestore Usage:**
   - Dashboard Firebase → Usage
   - Verificar que no exceda cuotas

### Alertas Recomendadas

Configura alertas en Render:

- **Service Down:** Email inmediato
- **High Memory Usage:** >90%
- **Slow Response Time:** >5s promedio

---

## 🆘 Troubleshooting

### Problema: Worker no procesa jobs

**Diagnóstico:**

```powershell
# Verificar logs del worker
# Render Dashboard → dataweave-bi-worker → Logs
```

**Soluciones:**

1. Verificar que `FIREBASE_SERVICE_ACCOUNT` esté configurado correctamente
2. Reiniciar worker: `Dashboard → Manual Deploy → Deploy Latest Commit`
3. Verificar que worker esté en **misma región** que web service

### Problema: 500 errors en endpoints

**Diagnóstico:**

```powershell
# Verificar logs del web service
# Render Dashboard → dataweave-bi → Logs
```

**Soluciones:**

1. Verificar variables de entorno
2. Verificar health check: `/api/health`
3. Si Firebase falla → verificar service account JSON

### Problema: Webhooks no llegan

**Diagnóstico:**

```powershell
# Verificar en Shopify Admin → Settings → Notifications → Webhooks
# Ver "Recent deliveries"
```

**Soluciones:**

1. Verificar que URLs estén actualizadas
2. Verificar que endpoints respondan 200 OK
3. Re-crear webhook si es necesario

---

## 📚 Recursos Adicionales

- [Render Docs - Deploy Next.js](https://render.com/docs/deploy-nextjs)
- [Render Docs - Background Workers](https://render.com/docs/background-workers)
- [Firebase Admin SDK - Initialize](https://firebase.google.com/docs/admin/setup)
- [Shopify Webhooks API](https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook)

---

## ✅ Checklist Final

Antes de considerar la migración completa:

- [ ] Web service desplegado y health check OK
- [ ] Worker desplegado y procesando jobs
- [ ] Todas las variables de entorno configuradas
- [ ] Webhooks actualizados y probados
- [ ] Backfill test completado exitosamente
- [ ] Frontend funcional (auto-refresh, backfill UI)
- [ ] Datos sincronizando correctamente desde Zadarma
- [ ] Firestore collections actualizándose
- [ ] Logs sin errores críticos (24h)
- [ ] Métricas de rendimiento aceptables
- [ ] Rollback plan documentado y probado

---

**¿Dudas o problemas?** Revisa logs en Render Dashboard o consulta la documentación en `docs/`.

🎉 **¡Migración Completada!**
