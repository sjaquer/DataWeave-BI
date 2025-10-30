# 🧪 GUÍA DE TESTING COMPLETA - Sistema Webhook + Backfill

**Fecha:** 30 de enero de 2025  
**Sistema:** DataWeave BI - Zadarma Integration  
**Estado:** ✅ Desplegado | ✅ Webhook Activo | 🧪 Testing en Curso

---

## 📋 CHECKLIST DE ESTADO ACTUAL

- ✅ Código desplegado en Vercel (`dataweave-bi.vercel.app`)
- ✅ Webhook verificado por Zadarma (GET `/api/zadarma/webhook?zd_echo=test123` ✓)
- ✅ Webhook activado en panel Zadarma
- ✅ Conectado a Zadarma API
- 🧪 **AHORA:** Probar flujo end-to-end

---

## 🎯 PLAN DE TESTING (5 Fases)

### **FASE 1: Verificar Webhook Está Respondiendo** ✅

**Objetivo:** Confirmar que el endpoint responde correctamente a verificación

```powershell
# Debe devolver exactamente "test123"
curl "https://dataweave-bi.vercel.app/api/zadarma/webhook?zd_echo=test123"
```

**✅ Resultado Esperado:**
```
StatusCode: 200
Content: test123
```

**✅ COMPLETADO** - Verificación exitosa

---

### **FASE 2: Probar Webhook en Tiempo Real**

**Objetivo:** Hacer una llamada real y verificar que llegue a Firestore

#### **Paso 2.1: Hacer Llamada de Prueba en Zadarma**

1. **Opción A - Llamada Saliente (Recomendado):**
   - Llama desde tu línea Zadarma a cualquier número
   - Habla al menos 5 segundos
   - Cuelga

2. **Opción B - Llamada Perdida:**
   - Llama a tu número Zadarma desde tu celular
   - Deja que suene sin contestar
   - Cuelga después de 10-15 segundos

#### **Paso 2.2: Verificar en Firestore Console**

1. Ve a: [Firebase Console - Firestore](https://console.firebase.google.com/u/0/project/dataweavebi-3b0ab/firestore)
2. Selecciona colección: `zadarma_calls`
3. Deberías ver un nuevo documento con:
   - **ID**: `call_id_with_rec` o `pbx_call_id`
   - **Campos**: `call_start`, `disposition`, `destination`, `internal`, `createdAt`, `updatedAt`

**✅ Resultado Esperado:**
```
Documento nuevo en zadarma_calls/
├─ call_id_with_rec: "123456789.987654321"
├─ call_start: "2025-01-30 10:30:00"
├─ disposition: "answered" o "missed"
├─ destination: "+51987654321"
├─ internal: "101"
├─ createdAt: Timestamp
└─ updatedAt: Timestamp
```

#### **Paso 2.3: Verificar Logs en Vercel (Opcional)**

Si tienes Vercel CLI instalado:

```powershell
vercel logs --follow
```

Busca líneas como:
```
[WEBHOOK] Processing NOTIFY_END event
[WEBHOOK] Saving to Firestore: call_id_with_rec=123456789.987654321
[WEBHOOK] Successfully saved call to Firestore
```

**Sin Vercel CLI:** Ve a [Vercel Dashboard → Functions](https://vercel.com/sjaquer/dataweave-bi/logs) y revisa logs de `/api/zadarma/webhook`

---

### **FASE 3: Verificar API `/api/zadarma/stats`**

**Objetivo:** Confirmar que el endpoint lee correctamente desde Firestore

```powershell
# Obtener llamadas de hoy
curl "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-01-30&endDate=2025-01-30"
```

**✅ Resultado Esperado:**
```json
{
  "data": [
    {
      "callId": "123456789.987654321",
      "callStart": "2025-01-30T15:30:00.000Z",
      "disposition": "answered",
      "destination": "+51987654321",
      "internal": "101",
      ...
    }
  ],
  "fromCache": true,
  "metadata": {
    "source": "firestore",
    ...
  }
}
```

**❌ Si `data` está vacío:**
- Verifica que hiciste la llamada de prueba
- Revisa Firestore Console manualmente
- Ve a Fase 4 (Troubleshooting)

---

### **FASE 4: Verificar Frontend de Performance**

**Objetivo:** Confirmar que la página de Performance muestra los datos

1. **Abre:** https://dataweave-bi.vercel.app/dashboard/performance
2. **Selecciona:** Fecha de hoy (30 de enero)
3. **Verifica:**
   - ✅ Badge: "Datos desde Firestore (Webhook + Backfill)"
   - ✅ Tabla muestra la llamada de prueba
   - ✅ Métricas calculadas correctamente

**✅ Resultado Esperado:**
- Tabla con al menos 1 fila (tu llamada de prueba)
- Columnas: Fecha/Hora, Destino, Asesor, Duración, Estado

**❌ Si no aparece:**
- Verifica que la llamada esté en Firestore (Fase 2.2)
- Verifica API directamente (Fase 3)
- Revisa console de navegador (F12 → Console)

---

### **FASE 5: Testing Backfill Histórico**

**Objetivo:** Poblar Firestore con llamadas históricas

#### **Paso 5.1: Ejecutar Backfill de Prueba (1 día)**

```powershell
# Test con 1 día atrás
npm run zadarma:backfill:test
```

**✅ Resultado Esperado:**
```
🔄 Iniciando backfill de prueba...
📅 Rango: 2025-01-29 → 2025-01-30
📞 Llamadas obtenidas de API: 45
💾 Guardadas en Firestore: 45
✅ Backfill completado exitosamente
```

#### **Paso 5.2: Ejecutar Backfill Completo (30 días)**

**⚠️ ADVERTENCIA:** Esto hará muchas llamadas a la API de Zadarma

```powershell
# Backfill completo (30 días)
npm run zadarma:backfill
```

**✅ Resultado Esperado:**
```
🔄 Iniciando backfill completo (30 días)...
📅 Rango: 2025-01-01 → 2025-01-30
📞 Total de llamadas: ~1500
💾 Guardadas en Firestore: ~1500
⏱️  Tiempo total: ~5 minutos
✅ Backfill completado exitosamente
```

#### **Paso 5.3: Verificar en Performance Page**

1. Abre: https://dataweave-bi.vercel.app/dashboard/performance
2. Selecciona rango: 1 de enero - 30 de enero
3. Deberías ver **todas las llamadas históricas**

---

## 🔍 TROUBLESHOOTING

### ❌ **Problema: Webhook no guarda en Firestore**

**Síntomas:**
- Llamada de prueba realizada
- No aparece en Firestore Console
- API devuelve `data: []`

**Soluciones:**

1. **Verificar logs en Vercel:**
   - Ve a: https://vercel.com/sjaquer/dataweave-bi/logs
   - Busca errores en `/api/zadarma/webhook`
   - Busca: "WEBHOOK ERROR" o "Firestore error"

2. **Verificar configuración de Zadarma:**
   - Panel Zadarma → Webhooks
   - URL correcta: `https://dataweave-bi.vercel.app/api/zadarma/webhook`
   - Eventos seleccionados: `NOTIFY_END`, `NOTIFY_MISSED`
   - Estado: ✅ Verificado

3. **Probar manualmente con curl:**
   ```powershell
   # Simular webhook NOTIFY_END
   curl -X POST "https://dataweave-bi.vercel.app/api/zadarma/webhook" `
     -H "Content-Type: application/json" `
     -d '{
       "event": "NOTIFY_END",
       "pbx_call_id": "test-123456",
       "call_start": "2025-01-30 10:30:00",
       "disposition": "answered",
       "destination": "+51987654321",
       "internal": "101"
     }'
   ```

   **✅ Esperado:** `{"status":"ok"}`
   
   Luego verifica Firestore Console para documento `test-123456`

---

### ❌ **Problema: API devuelve datos vacíos**

**Síntomas:**
- Firestore tiene documentos
- API `/api/zadarma/stats` devuelve `data: []`

**Soluciones:**

1. **Verificar rango de fechas:**
   ```powershell
   # Usar fecha exacta de tu llamada de prueba
   curl "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-01-30&endDate=2025-01-30"
   ```

2. **Verificar formato de `call_start` en Firestore:**
   - Debe ser: `"2025-01-30 10:30:00"` (YYYY-MM-DD HH:mm:ss)
   - **NO** debe ser: ISO 8601 (`2025-01-30T10:30:00Z`)

3. **Verificar logs de API:**
   - Ve a Vercel logs
   - Busca: `/api/zadarma/stats`
   - Revisa filtros aplicados

---

### ❌ **Problema: Backfill falla**

**Síntomas:**
- `npm run zadarma:backfill:test` da error
- Error: "No se puede conectar a Zadarma API"

**Soluciones:**

1. **Verificar variables de entorno en Vercel:**
   - `ZADARMA_API_KEY=49851b9485b4ea2c5f35`
   - `ZADARMA_API_SECRET=7b5e973d0f777370ee5d`

2. **Ejecutar backfill localmente (si tienes `.env.local`):**
   ```powershell
   # Asegúrate de tener .env.local con credenciales
   npx tsx scripts/backfill-zadarma-calls.ts --days 1
   ```

3. **Verificar credenciales de Zadarma:**
   - Panel Zadarma → API
   - Confirma que API_KEY y API_SECRET son correctos

---

## 📊 MÉTRICAS DE ÉXITO

Después de completar todas las fases, deberías ver:

### **Firestore:**
- ✅ Colección `zadarma_calls` con documentos
- ✅ Cada documento tiene `createdAt` y `updatedAt`
- ✅ Campos completos: `call_start`, `disposition`, `destination`, `internal`

### **API `/api/zadarma/stats`:**
- ✅ `fromCache: true`
- ✅ `metadata.source: "firestore"`
- ✅ `data` con llamadas del rango solicitado

### **Performance Page:**
- ✅ Badge: "Datos desde Firestore (Webhook + Backfill)"
- ✅ Tabla con llamadas en tiempo real
- ✅ Métricas calculadas correctamente

### **Logs de Vercel:**
- ✅ `[WEBHOOK] Processing NOTIFY_END event`
- ✅ `[WEBHOOK] Successfully saved call to Firestore`
- ✅ Sin errores `[WEBHOOK ERROR]`

---

## 🎯 COMANDOS RÁPIDOS DE TESTING

```powershell
# 1. Verificar webhook está activo
curl "https://dataweave-bi.vercel.app/api/zadarma/webhook?zd_echo=test"

# 2. Simular webhook manualmente
curl -X POST "https://dataweave-bi.vercel.app/api/zadarma/webhook" `
  -H "Content-Type: application/json" `
  -d '{"event":"NOTIFY_END","pbx_call_id":"test-123","call_start":"2025-01-30 10:30:00","disposition":"answered","destination":"+51987654321","internal":"101"}'

# 3. Verificar API stats
curl "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-01-30&endDate=2025-01-30"

# 4. Backfill de prueba (1 día)
npm run zadarma:backfill:test

# 5. Backfill completo (30 días)
npm run zadarma:backfill
```

---

## 📅 PRÓXIMOS PASOS

1. ✅ **Completar Fase 2:** Hacer llamada de prueba y verificar en Firestore
2. 🔄 **Monitorizar:** Durante 24 horas para ver webhooks en tiempo real
3. 🔄 **Ejecutar Backfill:** Poblar datos históricos (30 días)
4. ✅ **Configurar Cron:** Para backfill diario automático (en Vercel o Cloud Scheduler)

---

## 🆘 AYUDA

Si algo falla, contacta con estos detalles:

1. **Fase en la que fallaste** (1-5)
2. **Logs de Vercel** (screenshot o texto)
3. **Screenshot de Firestore Console** (colección zadarma_calls)
4. **Resultado de comandos curl** (copiar/pegar output completo)

---

**✅ Sistema Listo para Producción**  
**🚀 ¡Adelante con el Testing!**
