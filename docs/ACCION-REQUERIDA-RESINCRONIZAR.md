# ⚠️ ACCIÓN REQUERIDA: Re-sincronizar Datos desde Google Sheets

## 🎯 Problema Identificado

Los couriers de pedidos de **LIMA** estaban siendo leídos incorrectamente.

### ❌ Antes (Incorrecto)
```typescript
// Leía columna P (COURIER) para ambos tipos
courier: row.COURIER // "LIMA" genérico ❌
```

### ✅ Ahora (Corregido)
```typescript
// Lógica condicional según tipo de origen
const courierValue = tipoOrigen === 'LIMA' 
  ? (row.CLAVES || 'N/A')  // ✅ Columna W para Lima (DIN, CLOCK)
  : (row.COURIER || 'N/A'); // ✅ Columna P para Provincia (SHALOM, OLVA)
```

---

## 📝 Cambios Realizados

### 1. Webhook Corregido
**Archivo:** `src/app/api/webhooks/envios-temporales/route.ts`

**Cambios:**
- ✅ Para LIMA: Lee courier de columna `CLAVES` (W)
- ✅ Para PROVINCIA: Lee courier de columna `COURIER` (P)
- ✅ Documentación actualizada con diferencias críticas

### 2. Tipos Actualizados
**Cambio en interfaz:**
```typescript
CLAVES?: string; // W - IMPORTANTE: Para LIMA, esto es el COURIER (DIN, CLOCK, etc.)
COURIER: string; // P - Courier asignado (SOLO para PROVINCIA)
```

### 3. Documentación Creada
**Archivos nuevos:**
- `docs/ESTRUCTURA-COLUMNAS-LIMA-PROVINCIA.md` - Guía completa de diferencias

---

## 🚀 Pasos para Aplicar Corrección

### Paso 1: Sincronizar LIMA_ENVIADOS

1. **Abrir Google Sheets** con las hojas LIMA_ENVIADOS y PROVINCIA_ENVIADOS

2. **Ejecutar sincronización manual:**
   ```
   Menú: Sincronización DataWeave
   → 2. Sincronizar LIMA ENVIADOS (Temporal)
   ```

3. **Esperar confirmación:**
   - Mensaje: "✅ Sincronización exitosa: X filas procesadas en Y lote(s)"
   - Si hay >500 filas: Considerar sincronización automática

4. **Verificar en logs:**
   - Los couriers ahora deben ser "DIN", "CLOCK", etc.
   - NO "LIMA" genérico

### Paso 2: Sincronizar PROVINCIA_ENVIADOS (Opcional)

Si hay discrepancia de datos (70 vs 57):

1. **Ejecutar sincronización manual:**
   ```
   Menú: Sincronización DataWeave
   → 1. Sincronizar PROVINCIA ENVIADOS (Temporal)
   ```

2. **Esto actualizará:**
   - Estados faltantes
   - Pedidos nuevos no sincronizados
   - Datos modificados

### Paso 3: Verificar en Dashboard

1. **Ir a:** `https://dataweave-bi.vercel.app/dashboard/shipments`

2. **Verificar sección "Estados de Pedidos Temporales":**
   - Columna Lima debe tener valores específicos
   - Estados sin prefijo "L-"
   - Totales correctos

3. **Verificar sección "Rendimiento por Courier":**
   - Debe aparecer "DIN", "CLOCK" (no solo "LIMA")
   - Gráficos actualizados

### Paso 4: Verificar API (Opcional)

Para confirmar que los datos están correctos:

```bash
# Abrir en navegador:
https://dataweave-bi.vercel.app/api/webhooks/envios-temporales

# Buscar en la respuesta:
"porCourier": {
  "SHALOM": 57,
  "DIN": 55,      // ✅ Específico de Lima
  "CLOCK": 10,    // ✅ Específico de Lima
  "OLVA": 15
}
```

---

## 📊 Resultados Esperados

### Antes de Re-sincronizar
```json
{
  "porCourier": {
    "SHALOM": 57,
    "LIMA": 74,     // ❌ Genérico
    "OLVA": 3
  }
}
```

### Después de Re-sincronizar
```json
{
  "porCourier": {
    "SHALOM": 57,
    "DIN": 55,      // ✅ Courier específico de Lima
    "CLOCK": 13,    // ✅ Courier específico de Lima
    "OLVA": 3,
    "OTROS": 6
  }
}
```

### Tabla de Estados
```
Estado      | Provincia | Lima | Total
------------|-----------|------|------
ENTREGADO   |     0     |  55  |  55   ✅ Sin L-
RETORNADO   |     0     |  13  |  13   ✅ Sin L-
EN TRANSITO |    57     |   0  |  57
ENVIADO     |     3     |   0  |   3
...
```

---

## ⚠️ Problemas Conocidos

### Problema 1: Discrepancia de Datos (70 vs 57)

**Síntoma:**
- Google Sheets: ~70 pedidos de provincia
- Firestore: 57 pedidos de provincia

**Causas posibles:**
1. Pedidos sin campo PEDIDO (ID único vacío)
2. Pedidos agregados después de última sincronización
3. Errores en sincronización previa

**Solución:**
- Ejecutar sincronización manual de PROVINCIA_ENVIADOS
- Verificar en logs cuántos pedidos se procesaron
- Si persiste: Revisar que todos los pedidos tengan columna D (PEDIDO) llena

### Problema 2: Estados no aparecen en Tabla

**Síntoma:**
- Estados existen en Sheets pero no en tabla

**Causa:**
- Columna AB (ESTADO) vacía
- Estado guardado como "SIN_ESTADO"

**Solución:**
- Llenar columna ESTADO en Google Sheets
- Re-sincronizar
- Tabla mostrará estados correctamente

---

## 🔍 Verificación Post-Sincronización

### Checklist

- [ ] Sincronizar LIMA_ENVIADOS
- [ ] Sincronizar PROVINCIA_ENVIADOS (si hay discrepancia)
- [ ] Verificar Dashboard: Sección "Estados de Pedidos Temporales"
- [ ] Verificar Dashboard: Gráfico "Rendimiento por Courier"
- [ ] Verificar API GET: `/api/webhooks/envios-temporales`
- [ ] Confirmar: Couriers de Lima son "DIN", "CLOCK" (no "LIMA")
- [ ] Confirmar: Estados sin prefijo "L-" en tabla
- [ ] Confirmar: Totales coinciden (Provincia + Lima = Total)

---

## 📞 Troubleshooting

### Error: "Excedió el tiempo máximo de ejecución"

Si hay >1000 filas en LIMA_ENVIADOS:

**Solución:**
1. Usar "5. Activar Sincronización Automática"
2. O reducir `BATCH_SIZE` a 30 en Apps Script
3. Esperar 5 minutos a que se ejecute automáticamente

### Error: "No se pudieron crear triggers"

**Solución:**
1. Ver mensaje de error con instrucciones paso a paso
2. Extensiones → Apps Script
3. Ejecutar función `createTriggers` manualmente
4. Aceptar permisos

### Couriers siguen apareciendo como "LIMA"

**Causa:** No se ha re-sincronizado después de la corrección

**Solución:**
1. ⚠️ **IMPORTANTE:** Debes ejecutar sincronización manual
2. El webhook no actualiza datos automáticamente
3. Solo sincronización manual o automática aplica cambios

---

## 📅 Próximos Pasos

### Inmediato (Hoy)
1. ✅ Ejecutar sincronización manual de LIMA_ENVIADOS
2. ✅ Verificar couriers en dashboard
3. ✅ Ejecutar sincronización de PROVINCIA_ENVIADOS si hay discrepancia

### Corto Plazo (Esta Semana)
1. ⏳ Activar sincronización automática (cada 5 minutos)
2. ⏳ Monitorear que datos se actualicen correctamente
3. ⏳ Verificar que estados se muestren completos

### Medio Plazo (Este Mes)
1. ⏳ Crear alertas si hay discrepancias de datos
2. ⏳ Implementar validación de columnas en Sheets
3. ⏳ Agregar gráficos de tendencia de estados

---

## 🎯 Resumen

**Problema:** Couriers de Lima leídos incorrectamente (columna P en vez de W)

**Solución:** Webhook corregido para leer columna CLAVES (W) para Lima

**Acción Requerida:** **SINCRONIZAR MANUALMENTE** desde Google Sheets

**Tiempo Estimado:** 1-2 minutos por hoja

**Resultado Esperado:** 
- Couriers específicos ("DIN", "CLOCK")
- Estados sin prefijo "L-"
- Datos completos y actualizados

---

**Fecha:** 17 de Enero de 2025  
**Urgencia:** 🔴 Alta - Requiere acción manual  
**Autor:** GitHub Copilot  
**Status:** ⏳ Pendiente de Sincronización
