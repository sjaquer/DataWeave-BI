# 🚨 Hallazgos Críticos - Estructura Real vs Documentada
**Fecha:** 15 de octubre de 2025  
**Urgencia:** 🔴 CRÍTICA  
**Impacto:** Alto - Requiere re-verificación completa

---

## ⚠️ Resumen Ejecutivo

La estructura **REAL** de `PROVINCIA_ENVIADOS` es **significativamente diferente** a lo documentado inicialmente. Esto invalida parte de las correcciones previas y requiere re-verificación de todas las hojas.

---

## 🔍 Hallazgos en PROVINCIA_ENVIADOS

### ❌ Errores en Documentación Anterior

| Aspecto | Documentado | Real | Impacto |
|---------|-------------|------|---------|
| **Total columnas** | ~18 | **28 (A-AB)** | 🔴 CRÍTICO |
| **Tiene COURIER** | ❌ NO | **✅ SÍ (columna P)** | 🔴 CRÍTICO |
| **ID único** | Columna C | **Columna D** | 🟡 MEDIO |
| **Posición NOMBRES** | Columna J | **Columna I (index 8)** | 🟡 MEDIO |
| **Posición ESTADO** | Columna D | **Columna AB (index 27)** | 🟡 MEDIO |

### ✅ Estructura Real Verificada

```
28 COLUMNAS (A hasta AB):

A:  ID                  (ID interno sistema)
B:  FECHA CREADO        (Datetime creación)
C:  TIENDA              (Tienda origen)
D:  PEDIDO              🎯 ID ÚNICO - ej: "#Z4890"
E:  PRODUCTOS           (Descripción productos)
F:  PRODUCTO 2          (Producto adicional)
G:  TOTAL               (Total pedido)
H:  MONTO PENDIENTE     (Monto pendiente)
I:  NOMBRES             (Nombre cliente)
J:  DNI                 (DNI cliente)
K:  CELULAR             (Teléfono)
L:  PROVINCIA           (Provincia destino)
M:  DIRECCION           (Dirección entrega)
N:  AGENCIA SHALOM      (Agencia courier)
O:  PDF URL             (URL PDF)
P:  COURIER             🎯 COURIER ASIGNADO - ej: "SHALOM"
Q:  ENVIAR              (Flag envío)
R:  ANULAR              (Flag anulación)
S:  ATENDIDO            (Usuario atendió)
T:  SUBIDO              (Usuario subió)
U:  NOTAS DEL PEDIDO    (Notas)
V:  OBSERVACIONES       (Observaciones)
W:  CLAVES              (Código seguimiento)
X:  LINK SHALOM         (URL rastreo)
Y:  PDF SHALOM          (PDF comprobante)
Z:  FECHA ENVIADO       (Fecha envío)
AA: ENTREGADO           (Flag/fecha entrega)
AB: ESTADO              🎯 ESTADO ACTUAL - ej: "PAGADO"
```

### 📊 Ejemplo Real

```
ID: 14324900
FECHA CREADO: 12/9/2025 8:56:00
TIENDA: Trazto
PEDIDO: #Z4890
PRODUCTOS: 1 x Trazto | Pantalon táctico IX7 Algodón -beige / 36
PRODUCTO 2: [vacío]
TOTAL: 169
MONTO PENDIENTE: 149
NOMBRES: Jose Arapa apaza
DNI: 23936191
CELULAR: +51984303652
PROVINCIA: san jeronimo
DIRECCION: Cuzco
AGENCIA SHALOM: SAN JERONIMO Cusco / Cusco / San Jeronimo...
PDF URL: [vacío]
COURIER: SHALOM
ENVIAR: FALSE
ANULAR: FALSE
ATENDIDO: MARITE
SUBIDO: MARITE
NOTAS DEL PEDIDO: [vacío]
OBSERVACIONES: [vacío]
CLAVES: 1291
LINK SHALOM: https://rastrea.shalom.pe/59852777/39T3
PDF SHALOM: https://drive.google.com/file/d/1Yj6l5RzMPXYrJRAgFA0kqJLb4MlMp15O/view
FECHA ENVIADO: 12/9/2025 15:05:45
ENTREGADO: [vacío]
ESTADO: PAGADO
```

---

## 🚨 Impacto en Apps Script

### 1. Índices de Columnas Incorrectos

**Si el Apps Script usa índices hardcodeados, están TODOS INCORRECTOS:**

```javascript
// ❌ DOCUMENTACIÓN ANTERIOR (INCORRECTA):
PEDIDO: index 2   // Era columna C
NOMBRES: index 9  // Era columna J
COURIER: NO EXISTE

// ✅ ESTRUCTURA REAL (CORRECTA):
PEDIDO: index 3   // Columna D
NOMBRES: index 8  // Columna I
COURIER: index 15 // Columna P - ¡SÍ EXISTE!
PROVINCIA: index 11  // Columna L
CLAVES: index 22  // Columna W
ESTADO: index 27  // Columna AB
```

### 2. Lógica de Negocio Incorrecta

**Asumimos que PROVINCIA no tenía COURIER:**
- ❌ Posiblemente omitimos el campo en el mapeo
- ❌ Posiblemente no lo enviamos al webhook
- ❌ Posiblemente no lo guardamos en Firestore

**Realidad:**
- ✅ PROVINCIA **SÍ tiene COURIER** en columna P
- ✅ Debe mapearse y enviarse como LIMA

---

## 🔄 Comparación PROVINCIA vs LIMA

### Antes (Documentación Incorrecta)

```
PROVINCIA:
- ~18 columnas
- NO tiene COURIER ❌
- Usa NOMBRES
- Envíos de provincia sin courier específico

LIMA:
- ~15 columnas
- SÍ tiene COURIER ✅
- Usa NOMBRE
- Envíos de Lima con courier
```

### Después (Estructura Real)

```
PROVINCIA:
- 28 columnas ✅
- SÍ tiene COURIER (columna P, index 15) ✅
- Usa NOMBRES
- ¡MÁS COMPLETA QUE LIMA!

LIMA:
- ~15 columnas (PENDIENTE CONFIRMACIÓN)
- SÍ tiene COURIER (columna L, index 11)
- Usa NOMBRE
- ESPERANDO ESTRUCTURA REAL
```

---

## ⚠️ Acciones Requeridas URGENTES

### 🔴 PRIORIDAD MÁXIMA

1. **Solicitar estructura completa de LIMA_ENVIADOS**
   - Headers completos (columna A hasta la última)
   - Una fila de ejemplo completa
   - Confirmar total de columnas

2. **Solicitar estructura completa de REPORTE_ENVIADOS**
   - Headers completos
   - Una fila de ejemplo completa
   - Confirmar total de columnas

3. **Solicitar estructura completa de ENTREGADO**
   - Headers completos
   - Una fila de ejemplo completa
   - Confirmar total de columnas

### 🟡 DESPUÉS DE VERIFICACIÓN

4. **Revisar Apps Script completamente**
   - Verificar si usa índices hardcodeados
   - Actualizar con índices correctos
   - Asegurar que PROVINCIA envía COURIER

5. **Actualizar interfaces TypeScript**
   - `ProvinciaEnviadoRow` con 28 campos
   - Confirmar estructura de otras hojas

6. **Verificar webhooks**
   - Asegurar que procesan campo COURIER de PROVINCIA
   - Validar guardado en Firestore

---

## 🧪 Testing Crítico Necesario

### Test 1: PROVINCIA COURIER
```bash
Objetivo: Verificar que PROVINCIA envía COURIER correctamente

1. Editar PROVINCIA_ENVIADOS, fila con COURIER "SHALOM"
2. Cambiar COURIER a "TEST COURIER"
3. Verificar en Firestore (colección: envios_temporales)
   ✅ Campo courier debe ser "TEST COURIER"
   ✅ Campo tipoOrigen debe ser "PROVINCIA"

Si COURIER está vacío o incorrecto:
   🚨 Apps Script NO está leyendo columna P correctamente
```

### Test 2: Mapeo Completo PROVINCIA
```bash
Objetivo: Verificar que todos los campos se mapean correctamente

1. Editar fila en PROVINCIA_ENVIADOS
2. Verificar en Firestore que los campos coinciden:
   - PEDIDO (columna D) → pedidoId
   - NOMBRES (columna I) → cliente
   - COURIER (columna P) → courier
   - PROVINCIA (columna L) → provincia
   - ESTADO (columna AB) → estado
   - CLAVES (columna W) → claves
```

---

## 📋 Checklist de Verificación

- [x] PROVINCIA_ENVIADOS estructura verificada (28 columnas)
- [ ] LIMA_ENVIADOS estructura verificada
- [ ] REPORTE_ENVIADOS estructura verificada
- [ ] ENTREGADO estructura verificada
- [ ] Apps Script actualizado con índices correctos
- [ ] Interfaces TypeScript actualizadas
- [ ] Webhooks verificados
- [ ] Testing E2E completado

---

## 📚 Documentos Actualizados

- ✅ [ESTRUCTURA-REAL-COLUMNAS-SHEETS.md](./ESTRUCTURA-REAL-COLUMNAS-SHEETS.md) - Nueva estructura verificada
- ⏳ Pendiente actualizar: CORRECCIONES-COLUMNAS-2025-10-15.md
- ⏳ Pendiente actualizar: src/types/sheets.ts
- ⏳ Pendiente actualizar: google-apps-script/inventory-sync.js

---

## 💡 Lecciones Aprendidas

1. **No asumir estructuras basándose en screenshots parciales**
   - Los screenshots pueden no mostrar todas las columnas
   - Siempre solicitar estructura completa con ejemplo

2. **Verificar columna por columna con datos reales**
   - Una fila de ejemplo completa es invaluable
   - Headers + datos revelan el tipo de cada campo

3. **PROVINCIA es más completa de lo esperado**
   - 28 columnas vs 15 de LIMA
   - Incluye campos específicos de Shalom
   - SÍ tiene COURIER (contrario a lo asumido)

---

**Estado Actual:** 🟡 ESPERANDO ESTRUCTURAS DE LIMA, REPORTE Y ENTREGADO  
**Próximo Paso:** Usuario debe proporcionar estructura completa de las 3 hojas restantes  
**Urgencia:** 🔴 ALTA - No podemos actualizar Apps Script hasta tener todas las estructuras
