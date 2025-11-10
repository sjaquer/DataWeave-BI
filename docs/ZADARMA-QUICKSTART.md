# Zadarma Webhook + Backfill - Quick Start

> ⚡ **NOTA**: Este sistema está optimizado para bajo consumo de CPU. Ver [OPTIMIZACION-CPU-VERCEL-2025-11-09.md](./OPTIMIZACION-CPU-VERCEL-2025-11-09.md) para detalles sobre cache, batching y locks.

## 📦 Instalación

Todos los componentes ya están creados. Solo necesitas configurar variables de entorno.

## ⚙️ Configuración Rápida

### 1. Variables de Entorno

Crea o actualiza `.env.local`:

```env
# Credenciales Zadarma
ZADARMA_API_KEY=tu_api_key_aqui
ZADARMA_API_SECRET=tu_api_secret_aqui

# Secreto para Cron (generar aleatorio)
CRON_SECRET=un_secreto_aleatorio_largo

# Firebase Admin (si no configurado)
FIREBASE_PROJECT_ID=tu_proyecto_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. Probar Localmente

```bash
# Iniciar servidor
npm run dev

# En otra terminal, probar webhook (ejemplo con curl)
curl -X POST http://localhost:9002/api/zadarma/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "NOTIFY_END",
    "call_id_with_rec": "test_call_123",
    "pbx_call_id": "test123",
    "call_start": "2025-10-30 10:00:00",
    "duration": "120",
    "disposition": "answered",
    "caller_id": "+51999999999",
    "called_did": "+51888888888",
    "sip": "105"
  }'

# Verificar en Firestore que se creó el documento en zadarma_calls
```

### 3. Probar Backfill (1 día de prueba)

```bash
# Backfill de prueba (solo 1 día reciente)
npm run zadarma:backfill:test

# O manualmente con fecha específica:
npm run zadarma:backfill -- --from="2025-10-29" --to="2025-10-29" --timezone="America/Lima"
```

**Nota**: El script hace pausa de 21 segundos entre cada hora, así que espera ~8-10 minutos para 24 horas.

## 🚀 Despliegue a Producción

### 1. Commit y Push

```bash
git add .
git commit -m "feat: Webhook + Backfill de Zadarma con rate limiting"
git push origin main
```

### 2. Configurar Variables en Vercel

1. Dashboard de Vercel → Tu Proyecto → **Settings** → **Environment Variables**
2. Añadir las mismas variables de `.env.local`:
   - `ZADARMA_API_KEY`
   - `ZADARMA_API_SECRET`
   - `CRON_SECRET`
   - Variables de Firebase Admin
3. **Redeploy** después de añadir variables

### 3. Activar Webhook en Zadarma

1. Panel de Zadarma → **API** → **Webhooks** (o Notificaciones)
2. URL: `https://tu-app.vercel.app/api/zadarma/webhook`
3. Eventos:
   - ✅ **NOTIFY_END** (llamada terminada)
   - ✅ **NOTIFY_MISSED** (llamada perdida)
4. Método: **POST**
5. **Guardar**

### 4. Verificar que Funciona

```bash
# Hacer una llamada de prueba real
# Verificar en:

# 1. Logs de Vercel
vercel logs --follow

# 2. Firestore Console
# Buscar documento con last_updated_by: 'webhook'
# y webhook_received_at reciente

# 3. Endpoint de health check
curl https://tu-app.vercel.app/api/zadarma/webhook
# Respuesta: { status: 'ok', message: '...', timestamp: '...' }
```

## 📊 Backfill Histórico (Carga Masiva)

Una vez que el webhook funciona, ejecuta el backfill completo **localmente**:

```bash
# ADVERTENCIA: Esto puede tardar DÍAS
# Para 1 año: ~365 días × 24 horas × 21 segundos = ~51 horas

npm run zadarma:backfill -- \
  --from="2024-01-01" \
  --to="2025-10-30" \
  --timezone="America/Lima" \
  > backfill.log 2>&1

# Monitorear progreso:
tail -f backfill.log
```

**Recomendación**: Ejecutar en servidor o computadora que no se apague (usar `screen`, `tmux` o `nohup`).

## 🔄 Cron Automático

El cron diario ya está configurado (`vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/zadarma-backfill",
      "schedule": "0 2 * * *"  // 2 AM UTC diario
    }
  ]
}
```

Esto ejecuta backfill de las últimas 24 horas automáticamente cada noche para rectificar cualquier llamada perdida por webhook.

## 🔍 Verificación y Debugging

### Ver Logs en Vercel

```bash
# Tiempo real
vercel logs --follow

# Filtrar por webhook
vercel logs | grep "\[WEBHOOK\]"

# Filtrar por backfill
vercel logs | grep "\[BACKFILL\]"

# Filtrar por cron
vercel logs | grep "\[CRON\]"
```

### Queries de Firestore (Testing)

```javascript
// Firestore Console o Admin SDK

// Ver últimas 10 llamadas por webhook
db.collection('zadarma_calls')
  .where('last_updated_by', '==', 'webhook')
  .orderBy('webhook_received_at', 'desc')
  .limit(10)

// Ver últimas 10 llamadas por backfill
db.collection('zadarma_calls')
  .where('last_updated_by', '==', 'backfill')
  .orderBy('backfill_processed_at', 'desc')
  .limit(10)

// Verificar documento específico (by call_id)
db.collection('zadarma_calls').doc('CALL_ID').get()
```

### Verificar Deduplicación

```bash
# Si webhook y backfill procesan la misma llamada,
# debe haber UN SOLO documento (no duplicado)

# Buscar por call_id conocido en Firestore
# Verificar que last_updated_by puede ser 'webhook' o 'backfill'
# pero es el mismo documento (merge funcionó correctamente)
```

## 📁 Estructura de Archivos Creados

```
DataWeave-BI/
├── src/
│   └── app/
│       └── api/
│           ├── cron/
│           │   └── zadarma-backfill/
│           │       └── route.ts          # Cron endpoint
│           └── zadarma/
│               └── webhook/
│                   └── route.ts          # Webhook endpoint
├── scripts/
│   └── zadarma-backfill.ts               # Script de backfill
├── docs/
│   └── ZADARMA-WEBHOOK-BACKFILL-MIGRATION.md  # Guía completa
├── vercel.json                           # Config de cron
└── package.json                          # Scripts añadidos
```

## 🎯 Comandos Útiles

```bash
# Desarrollo
npm run dev                              # Servidor local

# Backfill
npm run zadarma:backfill:test            # Prueba 1 día
npm run zadarma:backfill:daily           # Últimas 24h
npm run zadarma:backfill -- --from="..." --to="..." --timezone="..."  # Custom

# Verificación
npm run typecheck                        # Verificar TypeScript
npm run lint                             # Linting

# Vercel
vercel logs --follow                     # Ver logs en tiempo real
vercel env ls                            # Ver variables de entorno
vercel cron ls                           # Ver cron jobs
```

## ⚠️ Consideraciones Importantes

### Rate Limiting
- **Webhook**: No consume rate limit de `/v1/statistics/`
- **Backfill**: Respeta 3 llamadas/min con pausa de 21s

### Timezone
- **Local → UTC**: Usa `fromZonedTime` para convertir correctamente
- **Default**: `America/Lima` (UTC-5)
- Cambiar en script si usas otra zona

### Deduplicación
- **Document ID**: Usa `call_id_with_rec` o `pbx_call_id`
- **Merge Strategy**: `set({ merge: true })` permite webhook + backfill sin duplicar

### Costos
- **Firestore Writes**: Similar a antes (menos duplicados = menos writes)
- **Vercel Functions**: Webhook es gratuito hasta límites de plan
- **Cron**: 1 ejecución diaria (dentro de límites de Hobby/Pro)

## 📚 Documentación Completa

Ver `docs/ZADARMA-WEBHOOK-BACKFILL-MIGRATION.md` para:
- Arquitectura detallada
- Plan de migración paso a paso
- Debugging avanzado
- Mejores prácticas
- Comparación antes/después

## ✅ Checklist de Implementación

- [ ] Variables de entorno configuradas localmente
- [ ] Webhook testeado localmente (curl/Postman)
- [ ] Backfill testeado con 1 día de prueba
- [ ] Código pusheado a repositorio
- [ ] Variables configuradas en Vercel
- [ ] Webhook activado en panel de Zadarma
- [ ] Llamada real de prueba verificada
- [ ] Backfill histórico ejecutándose
- [ ] Cron diario activado y monitoreado
- [ ] Lógica antigua deshabilitada (opcional)

## 🆘 Troubleshooting

### El webhook no recibe datos
1. Verificar URL en panel de Zadarma
2. Verificar que responde 200 OK (health check GET)
3. Ver logs de Vercel para errores
4. Verificar que eventos están seleccionados

### Backfill muy lento
- Normal: 21s por hora = ~8-10 min por día
- Para acelerar: NO cambiar pausa (risk de ban)

### Duplicados en Firestore
- Verificar que usas `set({ merge: true })`
- Verificar que `call_id` es el document ID
- No usar `.add()` (genera IDs aleatorios)

### Errores de timezone
- Verificar que usas `fromZonedTime` (no `zonedTimeToUtc`)
- Verificar zona horaria correcta (`America/Lima`)
- Logs del backfill muestran UTC vs Local

---

**¿Necesitas ayuda?** Revisa logs primero, luego consulta la documentación completa.
