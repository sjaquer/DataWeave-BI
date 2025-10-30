# 🌐 COMANDOS PARA CONSOLA DEL NAVEGADOR

**Propósito:** Snippets JavaScript para testear desde la consola del navegador (F12 → Console)  
**Ubicación:** Cualquier página de `dataweave-bi.vercel.app`

---

## 🚀 CÓMO USAR

1. Abre tu sitio: https://dataweave-bi.vercel.app
2. Presiona **F12** (o clic derecho → Inspeccionar)
3. Ve a la pestaña **Console**
4. Copia y pega cualquiera de estos comandos
5. Presiona **Enter**

---

## 📋 COMANDOS DISPONIBLES

### **1. 🧪 Simular Webhook - Llamada Contestada**

Simula una llamada contestada de 2 minutos.

```javascript
// Llamada CONTESTADA (answered)
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'NOTIFY_END',
    pbx_call_id: `test-${Date.now()}-answered`,
    call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
    disposition: 'answered',
    destination: '+51987654321',
    internal: '101',
    duration: 120
  })
})
.then(r => r.json())
.then(data => console.log('✅ Webhook enviado:', data))
.catch(err => console.error('❌ Error:', err));
```

**Resultado esperado:**
```
✅ Webhook enviado: { status: 'ok' }
```

---

### **2. 📞 Simular Webhook - Llamada Perdida**

Simula una llamada perdida (no contestada).

```javascript
// Llamada PERDIDA (missed)
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'NOTIFY_MISSED',
    pbx_call_id: `test-${Date.now()}-missed`,
    call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
    disposition: 'missed',
    destination: '+51912345678',
    internal: '102'
  })
})
.then(r => r.json())
.then(data => console.log('✅ Webhook enviado:', data))
.catch(err => console.error('❌ Error:', err));
```

---

### **3. 🚫 Simular Webhook - Llamada Ocupada**

Simula una llamada que dio ocupado.

```javascript
// Llamada OCUPADA (busy)
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'NOTIFY_END',
    pbx_call_id: `test-${Date.now()}-busy`,
    call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
    disposition: 'busy',
    destination: '+51998765432',
    internal: '103'
  })
})
.then(r => r.json())
.then(data => console.log('✅ Webhook enviado:', data))
.catch(err => console.error('❌ Error:', err));
```

---

### **4. 🔥 Simular 10 Llamadas Aleatorias**

Crea 10 llamadas de prueba con estados aleatorios (answered, missed, busy).

```javascript
// Generar 10 llamadas aleatorias
const dispositions = ['answered', 'missed', 'busy', 'answered', 'answered'];
const internals = ['101', '102', '103', '104', '105'];
const destinations = ['+51987654321', '+51912345678', '+51998765432'];

for (let i = 0; i < 10; i++) {
  const disposition = dispositions[Math.floor(Math.random() * dispositions.length)];
  const internal = internals[Math.floor(Math.random() * internals.length)];
  const destination = destinations[Math.floor(Math.random() * destinations.length)];
  
  setTimeout(() => {
    fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: disposition === 'missed' ? 'NOTIFY_MISSED' : 'NOTIFY_END',
        pbx_call_id: `test-${Date.now()}-${i}`,
        call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
        disposition: disposition,
        destination: destination,
        internal: internal,
        duration: disposition === 'answered' ? Math.floor(Math.random() * 300) + 30 : undefined
      })
    })
    .then(r => r.json())
    .then(data => console.log(`✅ [${i + 1}/10] Llamada enviada:`, disposition))
    .catch(err => console.error(`❌ [${i + 1}/10] Error:`, err));
  }, i * 500); // 500ms entre cada llamada
}

console.log('🔄 Enviando 10 llamadas... (tarda ~5 segundos)');
```

**Resultado esperado:**
```
🔄 Enviando 10 llamadas... (tarda ~5 segundos)
✅ [1/10] Llamada enviada: answered
✅ [2/10] Llamada enviada: missed
✅ [3/10] Llamada enviada: answered
...
✅ [10/10] Llamada enviada: busy
```

---

### **5. 📊 Verificar API - Llamadas de Hoy**

Consulta las llamadas del día actual.

```javascript
// Obtener llamadas de HOY
const today = new Date().toISOString().split('T')[0];
fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${today}&endDate=${today}`)
  .then(r => r.json())
  .then(data => {
    console.log('📊 ESTADÍSTICAS DE HOY:');
    console.log('   Total llamadas:', data.data.length);
    console.log('   Fuente:', data.metadata.source);
    console.log('   From Cache:', data.fromCache);
    console.log('\n📞 Últimas 5 llamadas:');
    data.data.slice(0, 5).forEach((call, i) => {
      console.log(`   ${i + 1}. ${call.callStart} - ${call.disposition} - ${call.destination}`);
    });
  })
  .catch(err => console.error('❌ Error:', err));
```

**Resultado esperado:**
```
📊 ESTADÍSTICAS DE HOY:
   Total llamadas: 23
   Fuente: firestore
   From Cache: true

📞 Últimas 5 llamadas:
   1. 2025-10-30 14:35:20 - answered - +51987654321
   2. 2025-10-30 14:30:15 - missed - +51912345678
   ...
```

---

### **6. 📅 Verificar API - Rango Personalizado**

Consulta llamadas en un rango de fechas específico.

```javascript
// PERSONALIZA ESTAS FECHAS
const startDate = '2025-10-28';  // Fecha inicio
const endDate = '2025-10-30';    // Fecha fin

fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${startDate}&endDate=${endDate}`)
  .then(r => r.json())
  .then(data => {
    console.log(`📊 ESTADÍSTICAS ${startDate} → ${endDate}:`);
    console.log('   Total llamadas:', data.data.length);
    console.log('   Fuente:', data.metadata.source);
    console.log('\n📈 Resumen por estado:');
    
    const summary = data.data.reduce((acc, call) => {
      acc[call.disposition] = (acc[call.disposition] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(summary).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
  })
  .catch(err => console.error('❌ Error:', err));
```

**Resultado esperado:**
```
📊 ESTADÍSTICAS 2025-10-28 → 2025-10-30:
   Total llamadas: 87
   Fuente: firestore

📈 Resumen por estado:
   answered: 65
   missed: 15
   busy: 7
```

---

### **7. 🔍 Verificar Webhook Está Activo**

Verifica que el webhook responde correctamente.

```javascript
// Verificar webhook está activo
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook?zd_echo=test123')
  .then(r => r.text())
  .then(data => {
    if (data === 'test123') {
      console.log('✅ Webhook ACTIVO y funcionando correctamente');
    } else {
      console.warn('⚠️ Respuesta inesperada:', data);
    }
  })
  .catch(err => console.error('❌ Webhook no responde:', err));
```

**Resultado esperado:**
```
✅ Webhook ACTIVO y funcionando correctamente
```

---

### **8. 🎯 Test Completo - Todo en Uno**

Ejecuta todos los tests en secuencia.

```javascript
// TEST COMPLETO - TODO EN UNO
async function testCompleto() {
  console.clear();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   TEST COMPLETO - Sistema Zadarma              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  // 1. Verificar webhook
  console.log('🔍 [1/4] Verificando webhook...');
  const webhookCheck = await fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook?zd_echo=test123')
    .then(r => r.text());
  console.log(webhookCheck === 'test123' ? '   ✅ Webhook activo\n' : '   ❌ Webhook no responde\n');

  // 2. Enviar llamada de prueba
  console.log('📞 [2/4] Enviando llamada de prueba...');
  const webhookResponse = await fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'NOTIFY_END',
      pbx_call_id: `test-${Date.now()}-complete`,
      call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
      disposition: 'answered',
      destination: '+51987654321',
      internal: '101',
      duration: 120
    })
  }).then(r => r.json());
  console.log('   ✅ Llamada enviada:', webhookResponse, '\n');

  // 3. Esperar 2 segundos
  console.log('⏳ [3/4] Esperando 2 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Verificar API
  console.log('📊 [4/4] Verificando API stats...');
  const today = new Date().toISOString().split('T')[0];
  const stats = await fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${today}&endDate=${today}`)
    .then(r => r.json());
  console.log('   ✅ Total llamadas hoy:', stats.data.length);
  console.log('   ✅ Fuente:', stats.metadata.source);
  console.log('   ✅ From Cache:', stats.fromCache, '\n');

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   ✅ TEST COMPLETO EXITOSO                     ║');
  console.log('╚════════════════════════════════════════════════╝');
}

testCompleto();
```

**Resultado esperado:**
```
╔════════════════════════════════════════════════╗
║   TEST COMPLETO - Sistema Zadarma              ║
╚════════════════════════════════════════════════╝

🔍 [1/4] Verificando webhook...
   ✅ Webhook activo

📞 [2/4] Enviando llamada de prueba...
   ✅ Llamada enviada: { status: 'ok' }

⏳ [3/4] Esperando 2 segundos...

📊 [4/4] Verificando API stats...
   ✅ Total llamadas hoy: 23
   ✅ Fuente: firestore
   ✅ From Cache: true

╔════════════════════════════════════════════════╗
║   ✅ TEST COMPLETO EXITOSO                     ║
╚════════════════════════════════════════════════╝
```

---

## 🎨 SNIPPETS ÚTILES

### **Generar Timestamp Actual (Formato Zadarma)**

```javascript
new Date().toISOString().slice(0, 19).replace('T', ' ')
// Output: "2025-10-30 14:35:20"
```

### **Ver Fecha de Hoy (YYYY-MM-DD)**

```javascript
new Date().toISOString().split('T')[0]
// Output: "2025-10-30"
```

### **ID Único para Llamada de Prueba**

```javascript
`test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
// Output: "test-1730000000000-abc123xyz"
```

---

## 🔧 DEBUGGING

### **Ver Respuesta Completa del Webhook**

```javascript
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event: 'NOTIFY_END',
    pbx_call_id: `debug-${Date.now()}`,
    call_start: new Date().toISOString().slice(0, 19).replace('T', ' '),
    disposition: 'answered',
    destination: '+51987654321',
    internal: '101',
    duration: 60
  })
})
.then(async response => {
  console.log('Status:', response.status);
  console.log('OK:', response.ok);
  const data = await response.json();
  console.log('Body:', data);
  return data;
});
```

### **Ver Respuesta Completa de la API**

```javascript
const today = new Date().toISOString().split('T')[0];
fetch(`https://dataweave-bi.vercel.app/api/zadarma/stats?startDate=${today}&endDate=${today}`)
  .then(async response => {
    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    const data = await response.json();
    console.log('Body:', data);
    return data;
  });
```

---

## 📊 EJEMPLOS AVANZADOS

### **Llenar 50 Llamadas con Fechas Aleatorias (Últimos 7 Días)**

```javascript
// Llenar 50 llamadas de los últimos 7 días
const dispositions = ['answered', 'missed', 'busy', 'answered', 'answered'];
const internals = ['101', '102', '103', '104', '105'];
const destinations = ['+51987654321', '+51912345678', '+51998765432', '+51923456789'];

for (let i = 0; i < 50; i++) {
  setTimeout(() => {
    // Fecha aleatoria de los últimos 7 días
    const daysAgo = Math.floor(Math.random() * 7);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(Math.floor(Math.random() * 10) + 8); // 8am-6pm
    date.setMinutes(Math.floor(Math.random() * 60));
    date.setSeconds(Math.floor(Math.random() * 60));
    
    const callStart = date.toISOString().slice(0, 19).replace('T', ' ');
    const disposition = dispositions[Math.floor(Math.random() * dispositions.length)];
    
    fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: disposition === 'missed' ? 'NOTIFY_MISSED' : 'NOTIFY_END',
        pbx_call_id: `test-${date.getTime()}-${i}`,
        call_start: callStart,
        disposition: disposition,
        destination: destinations[Math.floor(Math.random() * destinations.length)],
        internal: internals[Math.floor(Math.random() * internals.length)],
        duration: disposition === 'answered' ? Math.floor(Math.random() * 300) + 30 : undefined
      })
    })
    .then(r => r.json())
    .then(() => console.log(`✅ [${i + 1}/50] ${callStart} - ${disposition}`))
    .catch(err => console.error(`❌ [${i + 1}/50]`, err));
  }, i * 200); // 200ms entre llamadas
}

console.log('🔄 Llenando 50 llamadas de últimos 7 días... (tarda ~10 segundos)');
```

---

## 🎯 FLUJO RECOMENDADO

### **Primera Vez - Test Rápido:**

```javascript
// Copiar y pegar en la consola:

// 1. Verificar webhook
fetch('https://dataweave-bi.vercel.app/api/zadarma/webhook?zd_echo=test').then(r => r.text()).then(console.log);

// 2. Enviar 1 llamada de prueba (comando #1 de arriba)

// 3. Verificar en API (comando #5 de arriba)
```

### **Llenar Datos para Testing UI:**

```javascript
// Ejecutar comando #4 (10 llamadas) o el avanzado (50 llamadas)
// Luego refrescar la página de Performance
```

---

## 💡 TIPS

1. **Abre la consola en la página correcta:** `https://dataweave-bi.vercel.app`
2. **Usa `console.clear()`** antes de ejecutar tests para limpiar la consola
3. **Los IDs de prueba empiezan con `test-`** para identificarlos fácilmente
4. **Espera 2-3 segundos** después de enviar webhooks antes de verificar en API
5. **Refresca la página de Performance** después de llenar datos
6. **Usa el Test Completo (#8)** para verificar todo el flujo end-to-end

---

## ⚠️ IMPORTANTE

- Estos comandos funcionan **solo en producción** (`dataweave-bi.vercel.app`)
- Los datos se guardan **realmente en Firestore** (no son simulaciones)
- Los IDs empiezan con `test-` para distinguirlos de llamadas reales
- Puedes ejecutar estos comandos **cuantas veces quieras**

---

**✅ ¡Listo para Testing desde el Navegador!**  
**🚀 Empieza con el comando #8 (Test Completo)**
