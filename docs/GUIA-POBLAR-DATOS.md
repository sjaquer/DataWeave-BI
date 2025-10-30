# 🚀 GUÍA RÁPIDA: Poblar Datos en Firestore

**Problema:** La página de rendimiento está vacía porque no hay datos en Firestore.  
**Solución:** Ejecutar backfill para traer datos históricos de Zadarma.

---

## ✅ **OPCIÓN 1: Desde la Consola del Navegador (MÁS FÁCIL)**

### **Paso 1: Abrir Consola**
1. Ve a: https://dataweave-bi.vercel.app
2. Presiona **F12**
3. Ve a la pestaña **Console**

### **Paso 2: Ejecutar Backfill de 7 Días**

Copia y pega este comando:

```javascript
// BACKFILL DE 7 DÍAS
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=7')
  .then(r => r.json())
  .then(data => {
    console.log('═══════════════════════════════════════════════');
    console.log('✅ BACKFILL COMPLETADO');
    console.log('═══════════════════════════════════════════════');
    console.log(`📊 Días procesados: ${data.data.days}`);
    console.log(`📅 Rango: ${data.data.range.start} → ${data.data.range.end}`);
    console.log(`📞 Llamadas obtenidas de Zadarma: ${data.data.callsProcessed}`);
    console.log(`💾 Guardadas en Firestore: ${data.data.callsSaved}`);
    console.log('═══════════════════════════════════════════════');
    console.log('🎯 SIGUIENTE PASO: Refresca la página de Performance');
    console.log('   https://dataweave-bi.vercel.app/dashboard/performance');
  })
  .catch(err => console.error('❌ Error:', err));
```

**Resultado esperado:**
```
═══════════════════════════════════════════════
✅ BACKFILL COMPLETADO
═══════════════════════════════════════════════
📊 Días procesados: 7
📅 Rango: 2025-10-23 → 2025-10-30
📞 Llamadas obtenidas de Zadarma: 142
💾 Guardadas en Firestore: 142
═══════════════════════════════════════════════
🎯 SIGUIENTE PASO: Refresca la página de Performance
   https://dataweave-bi.vercel.app/dashboard/performance
```

### **Paso 3: Refrescar Página de Performance**

1. Ve a: https://dataweave-bi.vercel.app/dashboard/performance
2. Presiona **F5** (refrescar)
3. Selecciona el rango de fechas de los últimos 7 días
4. **¡Deberías ver los datos!** 🎉

---

## 🎯 **OTRAS OPCIONES DE BACKFILL**

### **Backfill de 1 Día (Rápido)**
```javascript
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=1')
  .then(r => r.json())
  .then(data => console.log('✅ Completado:', data));
```

### **Backfill de 30 Días (Completo)**
```javascript
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=30')
  .then(r => r.json())
  .then(data => {
    console.log('✅ BACKFILL DE 30 DÍAS COMPLETADO');
    console.log(`📞 Llamadas guardadas: ${data.data.callsSaved}`);
  });
```

### **Backfill de 90 Días (Máximo)**
```javascript
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=90')
  .then(r => r.json())
  .then(data => {
    console.log('✅ BACKFILL DE 90 DÍAS COMPLETADO');
    console.log(`📞 Llamadas guardadas: ${data.data.callsSaved}`);
  });
```

---

## ✅ **OPCIÓN 2: Desde PowerShell**

Si prefieres usar la terminal de Windows:

```powershell
# Backfill de 7 días
curl "https://dataweave-bi.vercel.app/api/zadarma/backfill?days=7"

# Backfill de 30 días
curl "https://dataweave-bi.vercel.app/api/zadarma/backfill?days=30"
```

---

## 🔍 **VERIFICAR QUE FUNCIONÓ**

### **Desde la Consola del Navegador:**

```javascript
// Ver llamadas de hoy
const today = new Date().toISOString().split('T')[0];
fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${today}&endDate=${today}`)
  .then(r => r.json())
  .then(data => {
    console.log('📊 Llamadas de HOY:', data.data.length);
    if (data.data.length > 0) {
      console.log('✅ HAY DATOS - La página de Performance debería mostrarlos');
    } else {
      console.log('⚠️ No hay llamadas de HOY, intenta con rango más amplio');
    }
  });
```

### **Desde PowerShell:**

```powershell
curl "https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=2025-10-30&endDate=2025-10-30"
```

---

## 📅 **FLUJO COMPLETO RECOMENDADO**

### **Primera Vez (Ahora):**

1. **Ejecuta backfill de 7 días** (comando de arriba)
2. **Espera 5-10 segundos**
3. **Refresca la página de Performance**
4. **Verifica que aparezcan datos**

### **Después (Opcional - Backfill Completo):**

Si quieres TODO el historial:

1. **Ejecuta backfill de 30 días** (comando de arriba)
2. **Espera 30-60 segundos** (más datos = más tiempo)
3. **Refresca la página de Performance**

---

## 🎯 **POR QUÉ ESTABA VACÍO**

1. ✅ **Webhook activo** → Solo guarda llamadas NUEVAS (desde ahora)
2. ❌ **Sin backfill** → No hay datos históricos
3. ❌ **Firestore vacío** → Página de Performance no tiene qué mostrar

**Solución:**
- Ejecutar backfill UNA VEZ para poblar historial
- De ahí en adelante, webhook guarda automáticamente llamadas nuevas

---

## ⚡ **COMANDO RÁPIDO TODO EN UNO**

Copia y pega esto en la consola del navegador:

```javascript
async function poblarDatos() {
  console.clear();
  console.log('🚀 POBLANDO DATOS EN FIRESTORE...\n');
  
  // 1. Ejecutar backfill
  console.log('📥 [1/3] Ejecutando backfill de 7 días...');
  const backfill = await fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=7')
    .then(r => r.json());
  console.log(`   ✅ ${backfill.data.callsSaved} llamadas guardadas\n`);
  
  // 2. Esperar 3 segundos
  console.log('⏳ [2/3] Esperando 3 segundos...\n');
  await new Promise(r => setTimeout(r, 3000));
  
  // 3. Verificar datos
  console.log('🔍 [3/3] Verificando datos...');
  const today = new Date().toISOString().split('T')[0];
  const stats = await fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${today}&endDate=${today}`)
    .then(r => r.json());
  console.log(`   ✅ Llamadas de hoy: ${stats.data.length}\n`);
  
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   ✅ PROCESO COMPLETADO                        ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('🎯 AHORA: Ve a la página de Performance y refresca (F5)');
  console.log('   https://dataweave-bi.vercel.app/dashboard/performance');
}

poblarDatos();
```

---

**✅ ¡Listo! Ejecuta el comando y en 10 segundos tendrás datos en tu página de Performance!** 🚀
