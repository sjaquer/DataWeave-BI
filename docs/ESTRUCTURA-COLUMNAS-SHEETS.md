# 📊 Estructura de Columnas - Google Sheets

**Fecha de análisis:** 15 de octubre de 2025  
**Fuente:** Screenshots de hojas reales

---

## 🗂️ PROVINCIA_ENVIADOS

**Screenshot 1 - Estructura identificada:**

| # | Columna | Nombre Header | Tipo | Descripción |
|---|---------|---------------|------|-------------|
| A | 1 | # | number | Número de fila |
| B | 2 | ID | string | ID único del pedido |
| C | 3 | FECHA | datetime | Fecha de creación |
| D | 4 | TIENDA | string | Nombre de tienda (Dearel, Blumi Perú, etc) |
| E | 5 | PEDIDO | string | Número de pedido (ej: #B18905) |
| F | 6 | PRODUCTOS | string | Descripción de productos |
| G | 7 | M | number | Monto? |
| H | 8 | NOMBRES | string | Nombre del cliente |
| I | 9 | DNI | string | DNI del cliente |
| J | 10 | CELULAR | string | Teléfono |
| K | 11 | PROVINCIA | string | Provincia destino |
| L | 12 | DIRECCION | string | Dirección completa |
| M | 13 | AGENCIA SHALOM | string | Agencia de courier |
| N | 14 | COURIER | string | Empresa courier (SHALOM, etc) |
| O | 15 | LINK SHALOM | string | Link de tracking |
| P | 16 | PDF | string | Link a PDF |
| Q | 17 | FECHA ENVIADO | datetime | Fecha de envío |
| R | 18 | ESTADO | string | Estado (PAGADO, EN DESTINO, DEVOLUCION, TIENDA) |

**ID Único:** PEDIDO (columna E)  
**Total columnas:** ~18

---

## 🗂️ LIMA_ENVIADOS

**Screenshot 2 - Estructura identificada:**

| # | Columna | Nombre Header | Tipo | Descripción |
|---|---------|---------------|------|-------------|
| A | 1 | ID | string | ID único del pedido |
| B | 2 | FECHA CREADO | datetime | Fecha de creación |
| C | 3 | TIENDA | string | Nombre de tienda |
| D | 4 | PEDIDO | string | Número de pedido |
| E | 5 | PRODUCTOS | string | Descripción productos |
| F | 6 | M | number | Monto? |
| G | 7 | NOMBRE | string | Nombre cliente (sin S) |
| H | 8 | DNI | string | DNI |
| I | 9 | CELULAR | string | Teléfono |
| J | 10 | PROVINCIA | string | Provincia (Lima) |
| K | 11 | DIRECCION | string | Dirección |
| L | 12 | COURIER | string | Courier asignado |
| M | 13 | CLAVE | string | Clave/código especial |
| N | 14 | FECHA ENVIADO | datetime | Fecha de envío |
| O | 15 | ESTADO | string | Estado (L- EN RUTA) |

**Diferencias con PROVINCIA:**
- No tiene columna "AGENCIA SHALOM"
- No tiene "LINK SHALOM" ni "PDF"
- Tiene columna "CLAVE" (M) en vez de LINK
- "NOMBRE" en singular vs "NOMBRES" en PROVINCIA
- COURIER está en columna L (vs N en PROVINCIA)

**ID Único:** PEDIDO (columna D)  
**Total columnas:** ~15

---

## 🗂️ REPORTE_ENVIADOS

**Screenshot 3 y 4 - Estructura identificada:**

| # | Columna | Nombre Header | Tipo | Descripción |
|---|---------|---------------|------|-------------|
| A | 1 | # | number | Número fila |
| B | 2 | ID | string | ID pedido |
| C | 3 | FECHA CREADO | datetime | Fecha creación |
| D | 4 | TIENDA | string | Tienda |
| E | 5 | PEDIDO | string | Número pedido |
| F | 6 | PRODUCTOS | string | Productos |
| G | 7 | PRECIO | number | Precio |
| H | 8 | TOTAL | number | Total |
| I | 9 | NOMBRES | string | Nombre cliente |
| J | 10 | DNI | string | DNI |
| K | 11 | CELULAR | string | Celular |
| L | 12 | PROVINCIA | string | Provincia |
| M | 13 | DIRECCION | string | Dirección |
| N | 14 | AGENCIA SHALOM | string | Agencia |
| O | 15 | PDF URL | string | Link PDF |
| P | 16 | COURIER | string | Courier |
| Q | 17 | ENVIAR | boolean | Checkbox |
| R | 18 | ANULAR | boolean | Checkbox |
| S | 19 | ATENDIDO | string | Nombre atendedor |
| T | 20 | SUBIDO | string | Nombre quien subió |
| U | 21 | NOTAS DEL USUARIO | string | Notas |
| V | 22 | OBSERVACION | string | Observaciones |
| W | 23 | CLAVE | string | **⚠️ IMPORTANTE para LIMA** |
| X | 24 | TIMESTAMP | datetime | Timestamp |
| Y | 25 | LINK | string | Link tracking |

**Nota crítica:** Screenshot 4 muestra que **columna W es "CLAVE"**, confirmando que para LIMA_ENVIADOS se debe usar esta columna como COURIER.

**ID Único:** PEDIDO (columna E)  
**Total columnas:** ~25

---

## 🗂️ ENTREGADO

**Screenshot 5 - Estructura identificada:**

| # | Columna | Nombre Header | Tipo | Descripción |
|---|---------|---------------|------|-------------|
| A | 1 | ID | string | ID pedido |
| B | 2 | FECHA | datetime | Fecha |
| C | 3 | TIENDA | string | Tienda |
| D | 4 | PEDIDO | string | Número pedido |
| E | 5 | PRODUCTOS | string | Productos |
| F | 6 | PRECIO | number | Precio |
| G | 7 | TOTAL | number | Total |
| H | 8 | NOMBRES | string | Nombre cliente |
| I | 9 | DNI | string | DNI |
| J | 10 | CELULAR | string | Celular |
| K | 11 | CLAVE | string | Clave |
| L | 12 | FECHA ENVIADO | datetime | Fecha envío |
| M | 13 | FECHA ENTREGADO | datetime | Fecha entrega |
| N | 14 | FECHA Y HORA DE PAGO | datetime | Timestamp pago |
| O | 15 | FORMA DE PAGO | string | **⚠️ Método pago (YAPE, PLIN, AGENTE BCP)** |
| P | 16 | USUARIO | string | Usuario que procesó |

**ID Único:** ID (columna A)  
**Total columnas:** ~16

---

## 🔄 Mapeo de Columnas Críticas

### Campos comunes (todas las hojas)
- ✅ ID / PEDIDO - Identificador único
- ✅ FECHA / FECHA CREADO - Timestamp creación
- ✅ TIENDA - Tienda origen
- ✅ PRODUCTOS - Descripción productos
- ✅ NOMBRES / NOMBRE - Cliente
- ✅ DNI - Documento
- ✅ CELULAR - Teléfono

### Campos variables según hoja

| Campo | PROVINCIA | LIMA | REPORTE | ENTREGADO |
|-------|-----------|------|---------|-----------|
| **Precio/Monto** | M (col G) | M (col F) | PRECIO+TOTAL (G+H) | PRECIO+TOTAL (F+G) |
| **Courier** | COURIER (N) | COURIER (L) ⚠️ **pero se llena desde CLAVE (W en REPORTE)** | COURIER (P) | - |
| **Dirección** | DIRECCION (L) | DIRECCION (K) | DIRECCION (M) | - |
| **Provincia** | PROVINCIA (K) | PROVINCIA (J) | PROVINCIA (L) | - |
| **PDF/Links** | LINK SHALOM (O) + PDF (P) | - | PDF URL (O) + LINK (Y) | - |
| **Estado** | ESTADO (R) | ESTADO (O) | - | - |
| **Pago** | - | - | - | FORMA DE PAGO (O) ⚠️ **CRÍTICO** |
| **Fechas** | FECHA ENVIADO (Q) | FECHA ENVIADO (N) | - | FECHA ENVIADO (L) + ENTREGADO (M) + PAGO (N) |

---

## ⚠️ Problemas Identificados y Correcciones Necesarias

### 1. LIMA_ENVIADOS - Columna COURIER
**Problema actual en el script:**
```javascript
// En onSheetEdit y findRowsToSendTemporal
if (sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME) {
  const clavesValue = values[22]; // ❌ INCORRECTO: índice 22 = columna W de REPORTE
  obj['COURIER'] = clavesValue;
}
```

**Corrección necesaria:**
```javascript
// LIMA_ENVIADOS tiene COURIER en columna L (índice 11)
// NO necesita mapeo especial desde CLAVE
if (sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME) {
  // La columna COURIER ya existe en índice 11 (columna L)
  // No hacer nada especial
}
```

### 2. ENTREGADO - Método de Pago
**Campo crítico faltante:** `FORMA DE PAGO` (columna O)

Actualmente el webhook usa `paymentMethod` pero el script podría no estar enviando este campo correctamente.

**Corrección:**
```javascript
// En findRowsToSend para ENTREGADO
// Asegurar que se mapea FORMA DE PAGO → paymentMethod
```

### 3. Headers inconsistentes
- PROVINCIA usa "NOMBRES" (plural)
- LIMA usa "NOMBRE" (singular)
- REPORTE usa "NOMBRES"
- ENTREGADO usa "NOMBRES"

**Solución:** Normalizar en el backend a `clientName` o `nombres`.

---

## 📋 Acciones Requeridas

### Apps Script (`inventory-sync.js`)
1. ✅ Eliminar el mapeo especial de CLAVE → COURIER para LIMA (ya tiene COURIER)
2. ✅ Ajustar índices de columnas según estructura real
3. ✅ Asegurar que ENTREGADO envía `FORMA DE PAGO`
4. ✅ Normalizar headers inconsistentes (NOMBRES vs NOMBRE)

### Webhooks Backend
1. ✅ `/api/webhooks/envios-temporales` - Validar campos PROVINCIA vs LIMA
2. ✅ `/api/webhooks/delivered` - Asegurar que procesa `FORMA DE PAGO`
3. ✅ `/api/webhooks/sheets` - Validar estructura REPORTE

### Base de Datos (Firestore)
1. ✅ Definir schema consistente para `envios_temporales`:
   - Campos comunes: id, pedido, tienda, productos, cliente, dni, celular, fecha
   - Campos opcionales: courier, direccion, provincia, estado, links, etc.
2. ✅ Schema para `orders` (REPORTE + ENTREGADO):
   - Debe incluir: paymentMethod, fechaEntregado, usuario, etc.

---

## 🎯 Plan de Implementación

1. **Fase 1:** Corregir Apps Script
   - Eliminar mapeo incorrecto de CLAVE
   - Ajustar índices de columnas
   - Probar con sync manual

2. **Fase 2:** Actualizar webhooks
   - Agregar validación de campos por tipo
   - Normalizar nombres de campos
   - Agregar logging de estructura recibida

3. **Fase 3:** Validar en Firestore
   - Revisar documentos creados
   - Verificar que todos los campos se guardan
   - Comprobar tipos de datos

4. **Fase 4:** Testing E2E
   - Sync manual de cada hoja
   - Sync automática
   - On-edit trigger
   - Verificar dashboards

---

**Última actualización:** 15 de octubre de 2025  
**Estado:** Análisis completo ✅  
**Siguiente paso:** Implementar correcciones
