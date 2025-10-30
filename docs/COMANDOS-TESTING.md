# 🚀 COMANDOS DE TESTING - DataWeave BI Zadarma

**Fecha:** 30 de octubre de 2025  
**Propósito:** Comandos simples para testear y llenar datos en Firestore

---

## 📋 COMANDOS DISPONIBLES

### **1. 🧪 Test de Webhook** - `npm run test:webhook`

**¿Qué hace?**
- Simula 3 llamadas de Zadarma (contestada, perdida, ocupada)
- Envía eventos al webhook de producción
- Guarda automáticamente en Firestore

**Uso:**
```bash
npm run test:webhook
```

**Ejemplo de salida:**
```
╔════════════════════════════════════════════════╗
║   TEST MANUAL DE WEBHOOK - Zadarma             ║
╚════════════════════════════════════════════════╝

🎯 Endpoint: https://dataweave-bi.vercel.app/api/zadarma/webhook

📞 [1/3] Enviando llamada CONTESTADA...
   Call ID: test-1730000000000-abc123
   Duration: 125s
   ✅ Guardado en Firestore con ID: test-1730000000000-abc123

📞 [2/3] Enviando llamada PERDIDA...
   Call ID: test-1730000001000-def456
   ✅ Guardado en Firestore con ID: test-1730000001000-def456

📞 [3/3] Enviando llamada OCUPADA...
   Call ID: test-1730000002000-ghi789
   ✅ Guardado en Firestore con ID: test-1730000002000-ghi789

✅ Eventos enviados exitosamente: 3/3
```

**Cuándo usarlo:**
- ✅ Primera vez que configuras el webhook
- ✅ Después de cambios en el código del webhook
- ✅ Para verificar que Firestore está recibiendo datos
- ✅ Cuando quieres datos de prueba rápidos

---

### **2. 🔍 Verificar Firestore** - `npm run check:firestore`

**¿Qué hace?**
- Muestra las últimas 10 llamadas en Firestore
- Cuenta el total de llamadas
- Verifica que el sistema esté funcionando

**Uso:**
```bash
npm run check:firestore
```

**Ejemplo de salida:**
```
╔════════════════════════════════════════════════╗
║   VERIFICACIÓN FIRESTORE - zadarma_calls       ║
╚════════════════════════════════════════════════╝

📊 Contando llamadas...
   Total: 142 llamadas

📞 Últimas 10 llamadas:

1. test-1730000002000-ghi789
   Inicio: 2025-10-30 14:35:20
   Estado: busy
   Destino: +51987654321
   Interno: 101
   Creado: 30/10/2025 14:35:20

2. test-1730000001000-def456
   Inicio: 2025-10-30 14:35:15
   Estado: missed
   Destino: +51912345678
   Interno: 102
   Creado: 30/10/2025 14:35:15

...

✅ Sistema funcionando correctamente
```

**Cuándo usarlo:**
- ✅ Después de ejecutar `npm run test:webhook`
- ✅ Para ver cuántas llamadas tienes en Firestore
- ✅ Para verificar que los webhooks reales están llegando
- ✅ Debugging general

---

### **3. 🌐 Test de API** - `npm run test:api`

**¿Qué hace?**
- Prueba el endpoint `/api/zadarma/stats`
- Consulta llamadas de HOY, AYER y ÚLTIMA SEMANA
- Verifica que la API lee correctamente desde Firestore

**Uso:**
```bash
npm run test:api
```

**Ejemplo de salida:**
```
╔════════════════════════════════════════════════╗
║   TEST API - /api/zadarma/stats                ║
╚════════════════════════════════════════════════╝

═══════════════════════════════════════════════
TEST 1: Llamadas de HOY
═══════════════════════════════════════════════

🔍 Consultando: 2025-10-30 → 2025-10-30
   URL: https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-10-30&endDate=2025-10-30

   ✅ Respuesta exitosa:
      - Llamadas: 23
      - Fuente: firestore
      - From Cache: true
      - Total en Firestore: 142

   📞 Primeras 3 llamadas:
      1. 2025-10-30 14:35:20 - busy - +51987654321
      2. 2025-10-30 14:35:15 - missed - +51912345678
      3. 2025-10-30 14:10:05 - answered - +51998765432

═══════════════════════════════════════════════
TEST 2: Llamadas de AYER
═══════════════════════════════════════════════
...
```

**Cuándo usarlo:**
- ✅ Para verificar que la API funciona correctamente
- ✅ Después de llenar datos con `test:webhook` o `fill:testdata`
- ✅ Para ver cómo responde la API a diferentes rangos de fechas
- ✅ Debugging del endpoint de estadísticas

---

### **4. 📦 Llenar Datos de Prueba** - `npm run fill:testdata`

**¿Qué hace?**
- Crea 140 llamadas de prueba (7 días × 20 llamadas/día)
- Genera datos realistas con diferentes estados
- Llena Firestore con datos variados para testing

**⚠️ ADVERTENCIA:** Esto crea MUCHOS documentos en Firestore

**Uso:**
```bash
npm run fill:testdata
```

**Ejemplo de salida:**
```
╔════════════════════════════════════════════════╗
║   LLENAR FIRESTORE CON DATOS DE PRUEBA        ║
╚════════════════════════════════════════════════╝

📊 Configuración:
   - Días: 7 (últimos 7 días)
   - Llamadas por día: 20
   - Total a crear: 140

⚠️  ADVERTENCIA: Esto escribirá datos en Firestore
   Continúa solo si estás seguro

🔄 Generando llamadas...

📅 Día 1/7: 2025-10-30
   ✅ 20 llamadas generadas
📅 Día 2/7: 2025-10-29
   ✅ 20 llamadas generadas
...

💾 Guardando 140 llamadas en Firestore...
✅ 140 llamadas guardadas exitosamente

╔════════════════════════════════════════════════╗
║   VERIFICACIÓN                                 ║
╚════════════════════════════════════════════════╝
Ejecuta para verificar:
   npm run check:firestore
```

**Cuándo usarlo:**
- ✅ Primera vez que configuras el sistema
- ✅ Cuando necesitas datos para probar la página de Performance
- ✅ Para testing de carga
- ✅ Cuando Firestore está vacío y quieres datos rápidos

---

### **5. 🔄 Backfill de Prueba** - `npm run zadarma:backfill:test`

**¿Qué hace?**
- Obtiene llamadas REALES de la API de Zadarma (1 día)
- Guarda las llamadas en Firestore
- Usa credenciales reales de Zadarma

**Uso:**
```bash
npm run zadarma:backfill:test
```

**Ejemplo de salida:**
```
🔄 Iniciando backfill de prueba...
📅 Rango: 2025-10-29 → 2025-10-29
📞 Llamadas obtenidas de API: 45
💾 Guardadas en Firestore: 45
✅ Backfill completado exitosamente
```

**Cuándo usarlo:**
- ✅ Para obtener datos reales de Zadarma
- ✅ Después de verificar que el webhook funciona
- ✅ Para poblar datos históricos de 1 día
- ✅ Testing con datos reales vs sintéticos

---

### **6. 🔄 Backfill Completo** - `npm run zadarma:backfill`

**¿Qué hace?**
- Obtiene llamadas REALES de la API de Zadarma (30 días)
- Guarda TODAS las llamadas en Firestore
- Proceso largo (~5 minutos)

**⚠️ ADVERTENCIA:** Hace muchas llamadas a la API de Zadarma

**Uso:**
```bash
npm run zadarma:backfill
```

**Cuándo usarlo:**
- ✅ Cuando quieres poblar Firestore con TODO el historial
- ✅ Después de limpiar Firestore
- ✅ Primera configuración del sistema
- ⚠️ **NO** lo uses frecuentemente (consume cuota de API)

---

## 🎯 FLUJO DE TESTING RECOMENDADO

### **Opción A: Testing Rápido con Datos Sintéticos**

```bash
# 1. Simular webhooks (3 llamadas)
npm run test:webhook

# 2. Verificar que se guardaron
npm run check:firestore

# 3. Probar API
npm run test:api
```

**Tiempo total:** ~10 segundos  
**Ideal para:** Verificación rápida, debugging

---

### **Opción B: Testing Completo con Datos Realistas**

```bash
# 1. Llenar con 140 llamadas de prueba (7 días)
npm run fill:testdata

# 2. Verificar datos
npm run check:firestore

# 3. Probar API
npm run test:api

# 4. Ver en el frontend
# Abrir: https://dataweave-bi.vercel.app/dashboard/performance
```

**Tiempo total:** ~30 segundos  
**Ideal para:** Testing de UI, análisis de datos

---

### **Opción C: Testing con Datos Reales de Zadarma**

```bash
# 1. Backfill de prueba (1 día real)
npm run zadarma:backfill:test

# 2. Verificar datos
npm run check:firestore

# 3. Probar API
npm run test:api

# 4. Backfill completo (30 días) - OPCIONAL
npm run zadarma:backfill
```

**Tiempo total:** ~1-5 minutos (dependiendo de cantidad de llamadas)  
**Ideal para:** Validación con datos reales, producción

---

## 🔍 TROUBLESHOOTING

### ❌ Error: "Unable to detect a Project Id"

**Problema:** Credenciales de Firebase no configuradas localmente

**Solución:**
```bash
# Estos comandos solo funcionan en producción (Vercel)
# Para local, necesitas .env.local con:
FIREBASE_SERVICE_ACCOUNT_KEY="{...}"
```

**Alternativa:** Usa comandos que llaman a la API de producción:
- ✅ `npm run test:webhook` (funciona siempre)
- ✅ `npm run test:api` (funciona siempre)
- ❌ `npm run check:firestore` (necesita credenciales locales)
- ❌ `npm run fill:testdata` (necesita credenciales locales)

---

### ❌ Error: "fetch is not defined"

**Problema:** Node.js antiguo

**Solución:**
```bash
# Asegúrate de usar Node.js 18+
node --version  # Debe ser v18.0.0 o superior
```

---

### ⚠️ Webhook responde pero no guarda en Firestore

**Diagnóstico:**
```bash
# 1. Verificar que el webhook responde
npm run test:webhook

# 2. Ver logs en Vercel
# Ve a: https://vercel.com/sjaquer/dataweave-bi/logs
# Busca: "WEBHOOK ERROR" o errores de Firestore
```

**Posibles causas:**
- Permisos de Firestore incorrectos
- Variable `FIREBASE_SERVICE_ACCOUNT_KEY` no configurada en Vercel
- Índices faltantes en Firestore

---

## 📊 COMPARACIÓN DE COMANDOS

| Comando | Tipo de Datos | Cantidad | Tiempo | Usa API Zadarma | Necesita Firebase Local |
|---------|---------------|----------|--------|-----------------|------------------------|
| `test:webhook` | Sintéticos | 3 | ~5s | ❌ | ❌ |
| `fill:testdata` | Sintéticos | 140 | ~10s | ❌ | ✅ |
| `zadarma:backfill:test` | Reales | ~30-50 | ~30s | ✅ | ✅ |
| `zadarma:backfill` | Reales | ~1000+ | ~5min | ✅ | ✅ |
| `check:firestore` | - | - | ~3s | ❌ | ✅ |
| `test:api` | - | - | ~5s | ❌ | ❌ |

✅ = Requiere / ❌ = No requiere

---

## 🎯 EJEMPLOS DE USO POR ESCENARIO

### **Escenario 1: "Quiero verificar que el webhook funciona"**
```bash
npm run test:webhook
npm run test:api
```

### **Escenario 2: "Necesito datos para probar la UI"**
```bash
npm run fill:testdata
# Luego abre: https://dataweave-bi.vercel.app/dashboard/performance
```

### **Escenario 3: "Quiero poblar Firestore con datos reales"**
```bash
npm run zadarma:backfill:test    # Primero 1 día
npm run check:firestore          # Verificar
npm run zadarma:backfill         # Luego 30 días completos
```

### **Escenario 4: "¿Cuántas llamadas tengo en Firestore?"**
```bash
npm run check:firestore
```

### **Escenario 5: "¿La API está funcionando bien?"**
```bash
npm run test:api
```

---

## 🚀 ACCESOS DIRECTOS

### **Testing Completo (Todo en uno):**
```bash
npm run test:webhook && npm run test:api && echo "✅ Todo funcionando"
```

### **Llenar y Verificar:**
```bash
npm run fill:testdata && npm run check:firestore
```

### **Backfill y Verificar:**
```bash
npm run zadarma:backfill:test && npm run test:api
```

---

## 📝 NOTAS IMPORTANTES

1. **`test:webhook`** siempre funciona (no necesita credenciales locales)
2. **`fill:testdata`** necesita Firebase configurado localmente
3. **`zadarma:backfill`** usa la API real de Zadarma (consume cuota)
4. **`test:api`** prueba el endpoint de producción (siempre funciona)
5. Los datos sintéticos usan IDs como `test-1730000000000-abc123`
6. Los datos reales usan IDs como `123456789.987654321`

---

**✅ ¡Listo para Testing!**  
**🚀 Empieza con: `npm run test:webhook`**
