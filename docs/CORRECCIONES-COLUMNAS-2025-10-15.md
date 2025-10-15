# Correcciones de Columnas - Apps Script
**Fecha:** 2025-10-15  
**Versión:** 1.0.0  
**Autor:** GitHub Copilot

---

## 📋 Resumen Ejecutivo

Se identificaron y corrigieron errores críticos en el mapeo de columnas del Apps Script basándose en la estructura real de las Google Sheets revelada en 5 screenshots proporcionados por el usuario.

### ✅ Correcciones Aplicadas

1. **Eliminado mapeo incorrecto de COURIER en LIMA_ENVIADOS**
2. **Agregada normalización NOMBRE → NOMBRES para consistencia**

---

## 🔍 Análisis del Problema

### Contexto

El Apps Script (`google-apps-script/inventory-sync.js`) contenía un mapeo especial para la hoja `LIMA_ENVIADOS`:

```javascript
// CÓDIGO INCORRECTO (ANTES):
if (sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME && row[22]) {
  rowObject['COURIER'] = row[22]; // ❌ Mapeo de columna W (CLAVE de REPORTE)
}
```

### Problema Identificado

- **Columna W (index 22)** no existe en `LIMA_ENVIADOS` (solo tiene ~15 columnas)
- La columna W corresponde a `CLAVE` en la hoja `REPORTE_ENVIADOS`
- `LIMA_ENVIADOS` ya tiene el campo `COURIER` **nativamente** en la **columna L** (index 11)
- Este mapeo causaba:
  - Datos incorrectos al intentar leer más allá del rango de columnas
  - Posible sobrescritura del campo correcto con valores `undefined`
  - Inconsistencia en la base de datos

---

## 🛠️ Correcciones Implementadas

### 1. Eliminación de Mapeo Incorrecto

**Archivo:** `google-apps-script/inventory-sync.js`

#### Función: `findRowsToSend()` (línea ~680)

**ANTES:**
```javascript
const rowObject = {};
headers.forEach((header, index) => {
  if (header) {
    rowObject[header] = row[index];
  }
});

// Para LIMA_ENVIADOS: usar columna CLAVES (W, índice 22) como COURIER
if (sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME && row[22]) {
  rowObject['COURIER'] = row[22];
}

if (uniqueId) {
  dataToSend.push(rowObject);
}
```

**DESPUÉS:**
```javascript
const rowObject = {};
headers.forEach((header, index) => {
  if (header) {
    rowObject[header] = row[index];
  }
});

// Normalizar campo NOMBRE → NOMBRES para consistencia
if (rowObject['NOMBRE'] && !rowObject['NOMBRES']) {
  rowObject['NOMBRES'] = rowObject['NOMBRE'];
}

if (uniqueId) {
  dataToSend.push(rowObject);
}
```

#### Función: `onSheetEdit()` - `rowToObject()` (línea ~224)

**ANTES:**
```javascript
function rowToObject(rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h) obj[h] = values[i];
  }
  
  // Para LIMA_ENVIADOS: usar columna CLAVES (W, índice 22) como COURIER
  if (sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME) {
    const clavesValue = values[22]; // Columna W = índice 22 (0-indexed)
    obj['COURIER'] = clavesValue;
  }
  
  return obj;
}
```

**DESPUÉS:**
```javascript
function rowToObject(rowIndex) {
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h) obj[h] = values[i];
  }
  
  // Normalizar campo NOMBRE → NOMBRES para consistencia
  if (obj['NOMBRE'] && !obj['NOMBRES']) {
    obj['NOMBRES'] = obj['NOMBRE'];
  }
  
  return obj;
}
```

---

### 2. Normalización de Headers

Se agregó lógica para normalizar la inconsistencia en los nombres de headers:

- **LIMA_ENVIADOS** usa: `NOMBRE` (columna J)
- **PROVINCIA_ENVIADOS** usa: `NOMBRES` (columna J)
- **REPORTE_ENVIADOS** usa: `NOMBRES` (columna J)

**Solución:** Si existe `NOMBRE` pero no existe `NOMBRES`, se copia automáticamente.

```javascript
// Normalizar campo NOMBRE → NOMBRES para consistencia
if (rowObject['NOMBRE'] && !rowObject['NOMBRES']) {
  rowObject['NOMBRES'] = rowObject['NOMBRE'];
}
```

---

## 📊 Estructura Correcta Verificada

### LIMA_ENVIADOS (Columna L = Index 11)

```
A  B         C        D       E      F          G         H      I      J       K         L        M         N
ID TIENDA    PEDIDO   ESTADO  TIPO   TELEFONO   DISTRITO  DEPAR  MONTO  NOMBRE  DIRECCION COURIER  COMISION  DELIVERY
```

- ✅ **COURIER** está en la columna **L** (index 11)
- ❌ **NO** debe mapearse desde columna W (no existe)

### PROVINCIA_ENVIADOS (Sin COURIER)

```
A  B         C       D        E      F         G         H      I       J        K          L    M         N         O         P      Q
ID TIENDA    PEDIDO  ESTADO   TIPO   TELEFONO  DISTRITO  DEPAR  MONTO   NOMBRES  DIRECCION  DNI  COMISION  DELIVERY  PROVINCIA COD    REFERENCIA
```

- ⚠️ Esta hoja **NO tiene** campo COURIER (correcto, es provincia)

### REPORTE_ENVIADOS (CLAVE en Columna W)

```
A  B      C       D        E      F         ... W      X         Y
ID TIENDA PEDIDO  ESTADO   TIPO   TELEFONO  ... CLAVE  TRACKING  RESPUESTA
```

- ✅ **CLAVE** está en columna **W** (index 22)
- ❌ **NO** debe usarse para LIMA

---

## ✅ Beneficios de las Correcciones

### 1. Integridad de Datos
- ✅ LIMA_ENVIADOS ahora envía el valor correcto de COURIER desde su columna L nativa
- ✅ No se sobrescribe con valores incorrectos de columnas inexistentes
- ✅ Consistencia en Firestore garantizada

### 2. Normalización de Nombres
- ✅ Tanto NOMBRE como NOMBRES se almacenan uniformemente como NOMBRES
- ✅ Los dashboards pueden usar un solo campo sin condicionales
- ✅ Queries de Firestore simplificadas

### 3. Mantenibilidad
- ✅ Código más simple y directo
- ✅ Menos lógica condicional especial
- ✅ Mapeo automático basado en headers reales

---

## 🧪 Testing Recomendado

### Test 1: Verificar COURIER en LIMA
```bash
# 1. Editar una fila en LIMA_ENVIADOS cambiando el campo COURIER (columna L)
# 2. Verificar en Firestore (colección: envios_temporales) que:
#    - El documento se creó/actualizó
#    - El campo COURIER tiene el valor correcto de la columna L
#    - NO tiene valores undefined o de otras columnas
```

### Test 2: Verificar Normalización NOMBRE
```bash
# 1. Editar una fila en LIMA_ENVIADOS (usa NOMBRE)
# 2. Verificar en Firestore que el campo guardado sea NOMBRES
# 3. Comparar con PROVINCIA_ENVIADOS (usa NOMBRES)
# 4. Confirmar consistencia en dashboards
```

### Test 3: Validación E2E
```bash
# 1. Editar filas en las 4 hojas
# 2. Verificar webhooks en logs de Vercel
# 3. Confirmar datos en Firestore
# 4. Visualizar en dashboards
```

---

## 📝 Próximos Pasos

### Pendientes
- [ ] Verificar campo FORMA DE PAGO en ENTREGADO (columna O)
- [ ] Agregar validación de campos en webhooks backend
- [ ] Crear interfaces TypeScript para cada tipo de hoja
- [ ] Testing E2E completo con datos reales
- [ ] Documentar estructura de Firestore actualizada

### Archivos a Revisar
```
src/app/api/webhooks/envios-temporales/route.ts
src/app/api/webhooks/delivered/route.ts
src/app/api/webhooks/sheets/route.ts
```

---

## 📚 Referencias

- [ESTRUCTURA-COLUMNAS-SHEETS.md](./ESTRUCTURA-COLUMNAS-SHEETS.md) - Análisis completo de columnas
- [RESUMEN-MEJORAS-2025-10-15.md](./RESUMEN-MEJORAS-2025-10-15.md) - Mejoras de batching
- [google-apps-script/README.md](../google-apps-script/README.md) - Documentación del script

---

## ⚠️ Notas Importantes

1. **No deshacer estas correcciones:** El mapeo de columna W → COURIER era incorrecto basándose en la estructura real de LIMA_ENVIADOS

2. **Verificar antes de deploy:** Asegurarse de que los webhooks backend manejen correctamente el campo NOMBRES (no NOMBRE)

3. **Comunicación con usuarios:** Informar que LIMA_ENVIADOS debe tener COURIER en columna L siempre

4. **Monitoreo post-deploy:** Vigilar logs de errores en Firestore relacionados con campos faltantes o incorrectos

---

**Estado:** ✅ Correcciones aplicadas y documentadas  
**Requiere Deploy:** Sí (Apps Script debe republicarse en Google)  
**Breaking Changes:** No (mejora la calidad de datos, no rompe funcionalidad existente)
