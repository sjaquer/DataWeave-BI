# 🚀 Sistema de Zadarma - Cambios Implementados

## 📋 Resumen de Cambios

Se ha implementado un sistema optimizado para gestionar datos de Zadarma con las siguientes mejoras:

### ✅ 1. `/api/zadarma/stats` - Modificado

**Cambios:**
- `source=firestore`: Solo **lectura** desde Firestore (rápido, <500ms)
- `source=api`: **Obtiene Y guarda** automáticamente en Firestore
- **Eliminado** el parámetro `skipSave` - ahora siempre guarda cuando usa API

**Uso:**
```bash
# Lectura rápida desde cache
GET /api/zadarma/stats?startDate=2025-11-01&endDate=2025-11-06

# Obtener de API y guardar
GET /api/zadarma/stats?startDate=2025-11-01&endDate=2025-11-06&source=api
```

---

### 🆕 2. `/api/zadarma/seed` - Nuevo Endpoint

**Funcionalidad:**
- Pobla Firestore con los últimos 30 días de datos
- Respeta rate limit: 2 peticiones/minuto (1 cada 30 segundos)
- Tiempo estimado: ~15 minutos

**Endpoints:**

#### GET - Verificar estado
```bash
GET /api/zadarma/seed

Response:
{
  "status": "success",
  "needsSeed": true,
  "summary": {
    "totalDays": 30,
    "daysWithData": 5,
    "daysMissing": 25,
    "percentage": 16,
    "estimatedTimeMinutes": 12
  }
}
```

#### POST - Iniciar seed
```bash
POST /api/zadarma/seed

Response:
{
  "status": "success",
  "message": "Seed completado: 30 días procesados",
  "summary": {
    "totalDays": 30,
    "completedDays": 30,
    "totalCalls": 4523,
    "estimatedTime": "900 segundos (~15 minutos)"
  }
}
```

---

### 🔄 3. Página Performance - Actualizada

**Nuevas características:**

#### Auto-refresh (60 segundos)
- Se activa **automáticamente** cuando ves el día actual
- Actualiza datos en segundo plano sin spinner
- Indicador visual en el subtítulo: "🔄 Auto-actualización cada 60s"

#### UI de Seed
Cuando Firestore está vacío o incompleto:
```
╔════════════════════════════════════════════╗
║  🌱 Configuración Inicial Requerida        ║
║                                             ║
║  La base de datos necesita ser poblada     ║
║  con los últimos 30 días.                  ║
║                                             ║
║  [🚀 Iniciar Población de 30 Días]         ║
╚════════════════════════════════════════════╝
```

#### Botón "Refrescar Datos" - ELIMINADO ❌
Ya no es necesario, el sistema se actualiza automáticamente.

#### Source por defecto: Firestore
- Lectura ultra-rápida desde cache
- Solo usa API durante el seed inicial

---

## 🎯 Flujo de Trabajo Completo

### Primera Vez (Seed)
1. Usuario abre `/dashboard/performance`
2. Sistema detecta Firestore vacío
3. Muestra card prominente de Seed
4. Usuario hace click en "Iniciar Población"
5. Proceso de 15 minutos comienza
6. Cada día se procesa y guarda en Firestore
7. Al finalizar: datos disponibles inmediatamente

### Uso Normal
1. Usuario abre `/dashboard/performance`
2. Datos se cargan desde Firestore (<500ms)
3. Si es día actual: auto-refresh cada 60s
4. Sin intervención manual necesaria

---

## 📊 Arquitectura de Datos

```
┌─────────────────────────────────────────────────────┐
│                  FUENTES DE DATOS                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Webhook (tiempo real)                           │
│     └─> Guarda automáticamente en Firestore         │
│                                                      │
│  2. Seed Manual (/api/zadarma/seed)                 │
│     └─> Pobla 30 días históricos                    │
│                                                      │
│  3. Auto-refresh (60s para hoy)                     │
│     └─> Lee de Firestore + actualiza si necesario  │
│                                                      │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              FIRESTORE (zadarma_calls)              │
│                                                      │
│  • Datos históricos (30 días)                       │
│  • Datos en tiempo real (webhook)                   │
│  • Índices optimizados por fecha                    │
│                                                      │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│              DASHBOARD PERFORMANCE                   │
│                                                      │
│  • Lectura rápida (<500ms)                          │
│  • Auto-actualización (60s para hoy)                │
│  • Sin rate limits de Zadarma                       │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 🔧 Archivos Modificados

### Creados
- ✅ `src/app/api/zadarma/seed/route.ts` - Endpoint de seed

### Modificados
- ✅ `src/app/api/zadarma/stats/route.ts` - Guardado automático
- ✅ `src/app/(app)/dashboard/performance/page.tsx` - Auto-refresh + UI seed
- ✅ `src/app/zadarma-test/page.tsx` - Cambio a source=firestore

---

## ⚙️ Configuración

### Variables de Entorno Requeridas
```env
ZADARMA_API_KEY=your_key
ZADARMA_API_SECRET=your_secret
```

### Rate Limits
- **Zadarma API:** 2 peticiones/minuto
- **Seed:** 1 día cada 30 segundos
- **Auto-refresh:** 1 vez cada 60 segundos (solo día actual)

---

## 🧪 Testing

### Probar Seed
```bash
# Verificar estado
curl http://localhost:9002/api/zadarma/seed

# Iniciar seed
curl -X POST http://localhost:9002/api/zadarma/seed
```

### Probar Stats
```bash
# Desde Firestore (rápido)
curl "http://localhost:9002/api/zadarma/stats?startDate=2025-11-01&endDate=2025-11-06"

# Desde API (guarda en Firestore)
curl "http://localhost:9002/api/zadarma/stats?startDate=2025-11-01&endDate=2025-11-06&source=api"
```

### Probar Performance Page
1. Abrir http://localhost:9002/dashboard/performance
2. Si Firestore vacío: ver card de seed
3. Click en "Iniciar Población"
4. Esperar ~15 minutos
5. Datos disponibles automáticamente

---

## 📈 Beneficios

✅ **Performance:** Lectura <500ms desde Firestore
✅ **Automatización:** Auto-refresh sin intervención
✅ **Confiabilidad:** Respeta rate limits de Zadarma
✅ **UX:** Feedback visual claro del progreso
✅ **Escalabilidad:** Cache en Firestore para múltiples usuarios
✅ **Mantenimiento:** Sin necesidad de refrescar manualmente

---

## 🚨 Notas Importantes

1. **Seed solo se ejecuta una vez** - Después, el webhook mantiene datos frescos
2. **Auto-refresh solo para hoy** - Días históricos no necesitan actualización
3. **Rate limit crítico** - No modificar los 30 segundos entre peticiones
4. **Firestore es source of truth** - Webhook + Seed + API lo mantienen actualizado

---

## 📞 Soporte

Si encuentras problemas:
1. Verificar logs en consola del navegador
2. Revisar Network tab para errores de API
3. Verificar que Firestore tenga datos (Firebase Console)
4. Confirmar variables de entorno configuradas

---

**Última actualización:** 7 de noviembre de 2025
