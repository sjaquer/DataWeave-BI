# ⚠️ INSTRUCCIONES: Métodos de Pago

## 📋 Problema Identificado

El campo `paymentMethod` **SÍ se está capturando correctamente** del Google Sheet, pero los valores actuales en tu sheet son:
- ✅ Captura actual: `"Pago Parcial"` (visible en Firebase)
- ❌ Esperado: `YAPE`, `PLIN`, `AGENTE BCP`, etc.

## 🔍 Diagnóstico

### 1. **El código está CORRECTO** ✅

**Ubicación**: `src/lib/firestore.ts` línea 302

```typescript
// Obtener forma de pago directamente del sheet
const paymentMethod = item['FORMA DE PAGO'] || 'No especificado';

const deliveryData = {
    isDelivered: true,
    deliveredAt: ...,
    shippedAt: ...,
    paymentMethod: paymentMethod,  // ✅ SE ESTÁ CAPTURANDO
    pendingAmount: pending,
    deliveryTimeInHours: deliveryTimeInHours,
    deliveredBy: item.USUARIO || 'No especificado',
};
```

### 2. **El Google Apps Script está CORRECTO** ✅

**Ubicación**: `google-apps-script/inventory-sync.js`

El script envía **todos los headers** del sheet, incluyendo `FORMA DE PAGO`.

### 3. **El problema está en el GOOGLE SHEET** ❌

En tu captura de Firestore veo:
```
paymentMethod: "Pago Parcial"
```

Esto significa que el sheet tiene `"Pago Parcial"` en lugar de los valores específicos.

## ✅ SOLUCIÓN

### Paso 1: Verificar el Sheet "ENTREGADO"

1. Abre tu Google Sheet
2. Ve a la hoja `ENTREGADO`
3. Busca la columna `FORMA DE PAGO`
4. Verifica los valores actuales

### Paso 2: Actualizar los valores en el Sheet

Los valores **DEBEN SER EXACTOS**:
- ✅ `YAPE`
- ✅ `PLIN`
- ✅ `AGENTE BCP`
- ✅ `EFECTIVO`
- ✅ `TRANSFERENCIA`
- ❌ ~~`Pago Parcial`~~ (este NO es un método de pago)

### Paso 3: Re-sincronizar

Después de corregir el sheet:
1. En Google Sheets → Menú `Sincronización DataWeave`
2. Click en `2. Sincronizar ENTREGADO`
3. Los nuevos registros tendrán los métodos correctos

### Paso 4: Corregir datos antiguos (OPCIONAL)

Si quieres corregir los 910 documentos antiguos, necesitarás:

**Opción A: Script de migración**
```typescript
// scripts/fix-payment-methods.ts
import { db } from '../src/lib/firebase-admin';

async function fixPaymentMethods() {
  const snapshot = await db.collection('shopify_orders')
    .where('paymentMethod', '==', 'Pago Parcial')
    .get();
  
  console.log(`Found ${snapshot.size} documents with "Pago Parcial"`);
  
  // Aquí necesitarías lógica para determinar el método correcto
  // basado en otros campos o registros
}
```

**Opción B: Actualizar manualmente en Firebase Console**

Solo si son pocos registros.

## 📊 Visualización en Dashboard

Una vez que los métodos de pago sean correctos:

1. **Limpia el caché del dashboard**: Botón "Limpiar Caché" en UI
2. **Espera la recarga**: El flow extraerá los datos actualizados
3. **Verás los gráficos**:
   - Gráfico de pastel: Distribución YAPE vs PLIN vs AGENTE BCP
   - Gráfico de barras: Comparación de pedidos e ingresos

## 🎯 Verificación

Para verificar que funciona:

```bash
# En terminal de VS Code
npx tsx -e "
import { db } from './src/lib/firebase-admin';
(async () => {
  const snapshot = await db.collection('shopify_orders')
    .where('isDelivered', '==', true)
    .limit(10)
    .get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, '→', data.paymentMethod);
  });
})();
"
```

Deberías ver valores como:
```
blumi-18315 → YAPE
novi-12345 → PLIN
trazto-67890 → AGENTE BCP
```

## 📝 Resumen

- ✅ **Código backend**: CORRECTO (captura `FORMA DE PAGO`)
- ✅ **Google Apps Script**: CORRECTO (envía todos los campos)
- ❌ **Google Sheet**: Tiene valores incorrectos (`"Pago Parcial"`)
- 🔧 **Acción requerida**: Actualizar valores en el sheet a YAPE/PLIN/AGENTE BCP

