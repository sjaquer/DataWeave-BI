---
Date: 2025-10-08
---

# âš ï¸ INSTRUCCIONES: MÃ©todos de Pago

## ðŸ“‹ Problema Identificado

El campo `paymentMethod` **SÃ se estÃ¡ capturando correctamente** del Google Sheet, pero los valores actuales en tu sheet son:
- âœ… Captura actual: `"Pago Parcial"` (visible en Firebase)
- âŒ Esperado: `YAPE`, `PLIN`, `AGENTE BCP`, etc.

## ðŸ” DiagnÃ³stico

### 1. **El cÃ³digo estÃ¡ CORRECTO** âœ…

**UbicaciÃ³n**: `src/lib/firestore.ts` lÃ­nea 302

```typescript
// Obtener forma de pago directamente del sheet
const paymentMethod = item['FORMA DE PAGO'] || 'No especificado';

const deliveryData = {
    isDelivered: true,
    deliveredAt: ...,
    shippedAt: ...,
    paymentMethod: paymentMethod,  // âœ… SE ESTÃ CAPTURANDO
    pendingAmount: pending,
    deliveryTimeInHours: deliveryTimeInHours,
    deliveredBy: item.USUARIO || 'No especificado',
};
```

### 2. **El Google Apps Script estÃ¡ CORRECTO** âœ…

**UbicaciÃ³n**: `google-apps-script/inventory-sync.js`

El script envÃ­a **todos los headers** del sheet, incluyendo `FORMA DE PAGO`.

### 3. **El problema estÃ¡ en el GOOGLE SHEET** âŒ

En tu captura de Firestore veo:
```
paymentMethod: "Pago Parcial"
```

Esto significa que el sheet tiene `"Pago Parcial"` en lugar de los valores especÃ­ficos.

## âœ… SOLUCIÃ“N

### Paso 1: Verificar el Sheet "ENTREGADO"

1. Abre tu Google Sheet
2. Ve a la hoja `ENTREGADO`
3. Busca la columna `FORMA DE PAGO`
4. Verifica los valores actuales

### Paso 2: Actualizar los valores en el Sheet

Los valores **DEBEN SER EXACTOS**:
- âœ… `YAPE`
- âœ… `PLIN`
- âœ… `AGENTE BCP`
- âœ… `EFECTIVO`
- âœ… `TRANSFERENCIA`
- âŒ ~~`Pago Parcial`~~ (este NO es un mÃ©todo de pago)

### Paso 3: Re-sincronizar

DespuÃ©s de corregir el sheet:
1. En Google Sheets â†’ MenÃº `SincronizaciÃ³n DataWeave`
2. Click en `2. Sincronizar ENTREGADO`
3. Los nuevos registros tendrÃ¡n los mÃ©todos correctos

### Paso 4: Corregir datos antiguos (OPCIONAL)

Si quieres corregir los 910 documentos antiguos, necesitarÃ¡s:

**OpciÃ³n A: Script de migraciÃ³n**
```typescript
// scripts/fix-payment-methods.ts
import { db } from '../src/lib/firebase-admin';

async function fixPaymentMethods() {
  const snapshot = await db.collection('shopify_orders')
    .where('paymentMethod', '==', 'Pago Parcial')
    .get();
  
  console.log(`Found ${snapshot.size} documents with "Pago Parcial"`);
  
  // AquÃ­ necesitarÃ­as lÃ³gica para determinar el mÃ©todo correcto
  // basado en otros campos o registros
}
```

**OpciÃ³n B: Actualizar manualmente en Firebase Console**

Solo si son pocos registros.

## ðŸ“Š VisualizaciÃ³n en Dashboard

Una vez que los mÃ©todos de pago sean correctos:

1. **Limpia el cachÃ© del dashboard**: BotÃ³n "Limpiar CachÃ©" en UI
2. **Espera la recarga**: El flow extraerÃ¡ los datos actualizados
3. **VerÃ¡s los grÃ¡ficos**:
   - GrÃ¡fico de pastel: DistribuciÃ³n YAPE vs PLIN vs AGENTE BCP
   - GrÃ¡fico de barras: ComparaciÃ³n de pedidos e ingresos

## ðŸŽ¯ VerificaciÃ³n

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
    console.log(doc.id, 'â†’', data.paymentMethod);
  });
})();
"
```

DeberÃ­as ver valores como:
```
blumi-18315 â†’ YAPE
novi-12345 â†’ PLIN
trazto-67890 â†’ AGENTE BCP
```

## ðŸ“ Resumen

- âœ… **CÃ³digo backend**: CORRECTO (captura `FORMA DE PAGO`)
- âœ… **Google Apps Script**: CORRECTO (envÃ­a todos los campos)
- âŒ **Google Sheet**: Tiene valores incorrectos (`"Pago Parcial"`)
- ðŸ”§ **AcciÃ³n requerida**: Actualizar valores en el sheet a YAPE/PLIN/AGENTE BCP


