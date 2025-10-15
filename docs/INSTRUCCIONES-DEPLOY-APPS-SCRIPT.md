# 🚀 Instrucciones de Deploy - Apps Script Actualizado
**Fecha:** 2025-10-15  
**Versión:** 2.0.0  
**Urgencia:** 🔴 ALTA - Deploy requerido para correcciones críticas

---

## 📋 Cambios en Esta Versión

### ✅ Correcciones Aplicadas
1. **Eliminado mapeo incorrecto de COURIER** para LIMA_ENVIADOS
2. **Agregada normalización** NOMBRE → NOMBRES para consistencia
3. **Sistema de batching** para evitar error 413 (75 filas por lote)

### ⚠️ Impacto
- **Datos más precisos** en Firestore
- **Sin errores** en hojas grandes
- **Consistencia** en campos de cliente

---

## 🔧 Pasos para Deploy

### 1️⃣ Abrir Google Apps Script
```
1. Abrir tu Google Sheet de DataWeave
2. Ir a: Extensiones > Apps Script
3. Se abrirá el editor de Apps Script en una nueva pestaña
```

### 2️⃣ Reemplazar Código Completo
```
1. En el editor de Apps Script, selecciona TODO el código actual
2. Elimínalo completamente (Ctrl+A → Delete)
3. Copia el código actualizado de: google-apps-script/inventory-sync.js
4. Pégalo en el editor
5. Verifica que no haya errores de sintaxis (no debería haber líneas rojas)
```

### 3️⃣ Guardar Cambios
```
1. Click en el ícono de "Guardar" (💾) o presiona Ctrl+S
2. Espera confirmación: "Proyecto guardado"
3. Nombre del proyecto: "inventory-sync" o el que ya tenías
```

### 4️⃣ Verificar Permisos (Solo si es necesario)
```
Si aparece solicitud de autorización:
1. Click en "Revisar permisos"
2. Seleccionar tu cuenta de Google
3. Click en "Avanzado"
4. Click en "Ir a [nombre del proyecto] (no seguro)"
5. Click en "Permitir"

Permisos necesarios:
✅ Ver y administrar hojas de cálculo
✅ Conectarse a un servicio externo (webhooks)
```

### 5️⃣ Probar Sincronización
```
1. Volver a Google Sheets
2. Refrescar la página (F5)
3. Buscar menú: "📊 DataWeave Sync"
4. Click en: "1. Test de Sincronización"
5. Esperar resultado en popup
```

**Resultado esperado:**
```
✅ Éxito: N registros sincronizados
   - PROVINCIA_ENVIADOS: X registros
   - LIMA_ENVIADOS: Y registros
   - REPORTE_ENVIADOS: Z registros
   - ENTREGADO: W registros
```

---

## 🧪 Testing Post-Deploy

### Test 1: Verificar Batching (Hoja Grande)
```bash
Objetivo: Asegurar que no aparezca error 413

1. Ir a una hoja con >100 filas (ej: REPORTE_ENVIADOS)
2. Ejecutar: "📊 DataWeave Sync" → "4. Sincronizar REPORTE_ENVIADOS"
3. Esperar confirmación

✅ Resultado esperado:
   - Mensaje: "Sincronización completada en lotes"
   - Sin errores
   - Logs en Apps Script muestran: "Enviando lote X de Y"

❌ Si hay error:
   - Revisar configuración BATCH_SIZE (línea ~51)
   - Probar reducir a 50 filas por lote
```

### Test 2: Verificar LIMA COURIER
```bash
Objetivo: Asegurar que LIMA envíe COURIER correcto

1. Ir a hoja: LIMA_ENVIADOS
2. Editar celda de COURIER en columna L (fila 2)
3. Cambiar valor (ej: "Courier Test")
4. Esperar ~5-10 segundos
5. Ir a Firestore Console
6. Colección: envios_temporales
7. Buscar documento con PEDIDO de fila editada

✅ Resultado esperado:
   - Campo COURIER = "Courier Test"
   - Campo tipoOrigen = "LIMA"
   - Campo ultimaActualizacion = timestamp reciente

❌ Si COURIER está vacío o incorrecto:
   - Revisar columna L en LIMA_ENVIADOS
   - Verificar header es exactamente "COURIER"
```

### Test 3: Verificar Normalización NOMBRE
```bash
Objetivo: Asegurar que LIMA normaliza NOMBRE → NOMBRES

1. Ir a hoja: LIMA_ENVIADOS
2. Verificar header columna J es "NOMBRE"
3. Editar celda de NOMBRE (fila 2)
4. Cambiar valor (ej: "Juan Pérez")
5. Esperar sincronización
6. Ir a Firestore
7. Colección: envios_temporales

✅ Resultado esperado:
   - Campo NOMBRES = "Juan Pérez" (nota: NOMBRES, no NOMBRE)
   - Campo cliente = "Juan Pérez"

Si campo NOMBRE aparece pero NOMBRES no:
   - Verificar normalización en código (línea ~230, ~690)
```

### Test 4: Verificar FORMA DE PAGO
```bash
Objetivo: Asegurar que ENTREGADO envía método de pago

1. Ir a hoja: ENTREGADO
2. Editar celda de FORMA DE PAGO en columna O (fila 2)
3. Cambiar valor (ej: "YAPE")
4. Esperar sincronización
5. Ir a Firestore
6. Colección: shopify_orders
7. Buscar documento del pedido editado

✅ Resultado esperado:
   - Campo paymentMethod = "YAPE"
   - Campo isDelivered = true
   - Campo deliveredAt = timestamp

Si paymentMethod = "No especificado":
   - Verificar columna O en ENTREGADO
   - Verificar header es "FORMA DE PAGO"
```

---

## 🔍 Verificación de Logs

### Ver Logs en Apps Script
```
1. En el editor de Apps Script
2. Ir a: Ejecuciones (ícono de reloj ⏱️)
3. Seleccionar última ejecución
4. Ver logs de consola

Buscar mensajes:
✅ "Enviando lote X de Y con Z filas"
✅ "Sincronización completada: N registros"
✅ "Respuesta del webhook: {status: 'success'}"

❌ Errores a vigilar:
   - "Error 413 FUNCTION_PAYLOAD_TOO_LARGE" (reducir BATCH_SIZE)
   - "Error 400: Formato de datos inválido" (verificar headers)
   - "Error 500: Error interno" (revisar webhook backend)
```

### Ver Logs en Vercel (Backend)
```
1. Ir a: https://vercel.com/dashboard
2. Seleccionar proyecto: dataweave-bi
3. Ir a pestaña: Logs
4. Filtrar por: /api/webhooks/

Buscar mensajes:
✅ "[ENVIOS TEMPORALES] Recibidos N registros de LIMA"
✅ "[Firestore] X registros de entrega actualizados"
✅ "status: 'success'"

❌ Errores a vigilar:
   - "El payload está vacío" (problema en Apps Script)
   - "campos ID y PEDIDO" (problema en estructura)
   - "Error al procesar" (problema en Firestore)
```

---

## 📊 Configuración Avanzada

### Ajustar Tamaño de Lote
```javascript
// En google-apps-script/inventory-sync.js, línea ~51
const CONFIG = {
  // ...
  BATCH_SIZE: 75, // ← Cambiar aquí si hay problemas
  BATCH_DELAY_MS: 500, // Delay entre lotes (ms)
  // ...
}

Valores recomendados:
- Hojas <50 filas: 100 (sin batching efectivo)
- Hojas 50-200 filas: 75 (configuración actual)
- Hojas 200-500 filas: 50
- Hojas >500 filas: 30
```

### Ajustar Frecuencia de Sincronización Automática
```javascript
// En google-apps-script/inventory-sync.js, línea ~48
const CONFIG = {
  // ...
  TRIGGER_FREQUENCY_MINUTES: 5, // ← Cambiar aquí
  // ...
}

Valores recomendados:
- Testing: 1 minuto
- Producción normal: 5 minutos (configuración actual)
- Producción baja carga: 15 minutos
- Producción alta carga: 3 minutos
```

---

## ⚠️ Troubleshooting

### Problema: Error 413 persiste
```
Síntoma: Sigue apareciendo "FUNCTION_PAYLOAD_TOO_LARGE"
Solución:
1. Reducir BATCH_SIZE a 50
2. Si persiste, reducir a 30
3. Verificar que el código de batching está presente (línea ~340-370)
```

### Problema: COURIER vacío en LIMA
```
Síntoma: Campo COURIER aparece como undefined o vacío
Solución:
1. Verificar que header en columna L es exactamente "COURIER"
2. Verificar que NO hay código especial mapeando columna W
3. Buscar en código: "row[22]" o "values[22]" → NO debería existir
```

### Problema: NOMBRES no aparece
```
Síntoma: Campo NOMBRES vacío en Firestore para LIMA
Solución:
1. Verificar que existe código de normalización:
   if (obj['NOMBRE'] && !obj['NOMBRES']) {
     obj['NOMBRES'] = obj['NOMBRE'];
   }
2. Verificar que el código está en AMBAS funciones:
   - rowToObject() (línea ~230)
   - findRowsToSend() (línea ~690)
```

### Problema: Webhook no recibe datos
```
Síntoma: No hay logs en Vercel, datos no llegan a Firestore
Solución:
1. Verificar URLs en CONFIG (líneas 17-27)
2. Ejecutar test manual: "1. Test de Sincronización"
3. Revisar logs de Apps Script para ver respuesta del webhook
4. Verificar que el proyecto Vercel está deployado
```

---

## 📞 Soporte

### Si Todo Falla
```
1. Revisar documentación completa:
   - docs/ESTRUCTURA-COLUMNAS-SHEETS.md
   - docs/CORRECCIONES-COLUMNAS-2025-10-15.md
   - google-apps-script/README.md

2. Verificar código fuente original:
   - google-apps-script/inventory-sync.js

3. Contactar soporte técnico con:
   - Screenshots de errores
   - Logs de Apps Script
   - Logs de Vercel
   - Estructura de tu hoja (headers)
```

---

## ✅ Checklist Final

Antes de considerar el deploy completado:

- [ ] Código actualizado en Apps Script
- [ ] Guardado sin errores
- [ ] Test de sincronización ejecutado con éxito
- [ ] LIMA COURIER verificado en Firestore
- [ ] NOMBRE → NOMBRES normalizado correctamente
- [ ] FORMA DE PAGO aparece en ENTREGADO
- [ ] Batching funciona sin error 413
- [ ] Sincronización automática activada
- [ ] Logs de Apps Script limpios
- [ ] Logs de Vercel sin errores
- [ ] Documentación revisada

---

**Una vez completada esta checklist, el deploy está finalizado y el sistema debería funcionar correctamente con la estructura real de las hojas.**

**Próximo paso:** Testing E2E en ambiente de producción durante 24-48 horas para validar estabilidad.
