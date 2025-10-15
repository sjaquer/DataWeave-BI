# 📊 Estructura REAL de Columnas - Google Sheets
**Fecha de corrección:** 15 de octubre de 2025  
**Fuente:** Datos reales proporcionados por el usuario  
**Estado:** ✅ VERIFICADO CON DATOS REALES

---

## 🚨 CORRECCIONES CRÍTICAS

### Errores en Documentación Anterior
1. ❌ **PROVINCIA_ENVIADOS tenía 18 columnas** → ✅ **Tiene 28 columnas** (A-AB)
2. ❌ **PROVINCIA NO tenía COURIER** → ✅ **SÍ tiene COURIER** (columna P)
3. ❌ **ID único era columna C** → ✅ **ID único es columna D** (PEDIDO)

---

## 🗂️ PROVINCIA_ENVIADOS (ESTRUCTURA REAL)

### Headers Completos (28 columnas: A-AB)

```
A   B             C       D       E          F           G      H                 I        J    K        L          M          N               O        P        Q       R       S         T       U                  V               W       X            Y           Z             AA         AB
ID  FECHA CREADO  TIENDA  PEDIDO  PRODUCTOS  PRODUCTO 2  TOTAL  MONTO PENDIENTE  NOMBRES  DNI  CELULAR  PROVINCIA  DIRECCION  AGENCIA SHALOM  PDF URL  COURIER  ENVIAR  ANULAR  ATENDIDO  SUBIDO  NOTAS DEL PEDIDO  OBSERVACIONES  CLAVES  LINK SHALOM  PDF SHALOM  FECHA ENVIADO  ENTREGADO  ESTADO
```

### Mapeo Detallado

| Col | Index | Header | Tipo | Ejemplo | Descripción |
|-----|-------|--------|------|---------|-------------|
| A | 0 | ID | string/number | "14324900" | ID interno del sistema |
| B | 1 | FECHA CREADO | datetime | "12/9/2025 8:56:00" | Fecha de creación del pedido |
| C | 2 | TIENDA | string | "Trazto" | Tienda de origen |
| **D** | **3** | **PEDIDO** | **string** | **"#Z4890"** | **🎯 ID ÚNICO DEL PEDIDO** |
| E | 4 | PRODUCTOS | string | "1 x Trazto \| Pantalon..." | Descripción de productos |
| F | 5 | PRODUCTO 2 | string | "" | Producto adicional (opcional) |
| G | 6 | TOTAL | number | 169 | Total del pedido |
| H | 7 | MONTO PENDIENTE | number | 149 | Monto pendiente de pago |
| I | 8 | NOMBRES | string | "Jose Arapa apaza" | Nombre completo del cliente |
| J | 9 | DNI | string | "23936191" | DNI del cliente |
| K | 10 | CELULAR | string | "+51984303652" | Teléfono del cliente |
| L | 11 | PROVINCIA | string | "san jeronimo" | Provincia de destino |
| M | 12 | DIRECCION | string | "Cuzco" | Dirección de entrega |
| N | 13 | AGENCIA SHALOM | string | "SAN JERONIMO Cusco..." | Agencia específica de Shalom |
| O | 14 | PDF URL | string | "" | URL del PDF (opcional) |
| **P** | **15** | **COURIER** | **string** | **"SHALOM"** | **🎯 COURIER ASIGNADO** |
| Q | 16 | ENVIAR | boolean | "FALSE" | Flag de envío |
| R | 17 | ANULAR | boolean | "FALSE" | Flag de anulación |
| S | 18 | ATENDIDO | string | "MARITE" | Usuario que atendió |
| T | 19 | SUBIDO | string | "MARITE" | Usuario que subió |
| U | 20 | NOTAS DEL PEDIDO | string | "" | Notas del pedido |
| V | 21 | OBSERVACIONES | string | "" | Observaciones adicionales |
| W | 22 | CLAVES | string | "1291" | Código/clave de seguimiento |
| X | 23 | LINK SHALOM | string | "https://rastrea.shalom.pe/..." | URL de rastreo Shalom |
| Y | 24 | PDF SHALOM | string | "https://drive.google.com/..." | PDF de comprobante Shalom |
| Z | 25 | FECHA ENVIADO | datetime | "12/9/2025 15:05:45" | Fecha de envío |
| AA | 26 | ENTREGADO | string/boolean | "" | Flag/fecha de entrega |
| AB | 27 | ESTADO | string | "PAGADO" | Estado actual del pedido |

### Información Clave

- **Total de columnas:** 28 (A hasta AB)
- **ID único para DB:** `PEDIDO` (columna D, index 3)
- **ID interno sistema:** `ID` (columna A, index 0)
- **Nombre cliente:** `NOMBRES` (columna I, index 8) ✅ Usa NOMBRES (con S)
- **🎯 SÍ TIENE COURIER:** Columna P (index 15)

### Estados Conocidos (columna AB)
- `PAGADO`
- `EN TRANSITO`
- `EN DESTINO`
- `DEVOLUCION`
- `TIENDA`
- `ENVIADO`

---

## 🗂️ LIMA_ENVIADOS (ESTRUCTURA REAL)

### Headers Completos (28 columnas: A-AB) ✅ VERIFICADO

**⚠️ ESTRUCTURA IDÉNTICA A PROVINCIA_ENVIADOS**

```
A   B             C       D       E          F           G      H                 I        J    K        L          M          N               O        P        Q       R       S         T       U                  V               W       X            Y           Z             AA         AB
ID  FECHA CREADO  TIENDA  PEDIDO  PRODUCTOS  PRODUCTO 2  TOTAL  MONTO PENDIENTE  NOMBRES  DNI  CELULAR  PROVINCIA  DIRECCION  AGENCIA SHALOM  PDF URL  COURIER  ENVIAR  ANULAR  ATENDIDO  SUBIDO  NOTAS DEL PEDIDO  OBSERVACIONES  CLAVES  LINK SHALOM  PDF SHALOM  FECHA ENVIADO  ENTREGADO  ESTADO
```

### Ejemplo Real

```
ID: 13214104
FECHA CREADO: 25/7/2025 17:25:00
TIENDA: Novi Perú
PEDIDO: N-13128
PRODUCTOS: 1x DermaVital™️ - Cepillo de ducha exfoliante - Pack 2 unds + 1x Afilador de Cuchillos de 3 Ranuras
PRODUCTO 2: [vacío]
TOTAL: 49
MONTO PENDIENTE: 49
NOMBRES: Carlos López
DNI: LIMA
CELULAR: +51996887848
PROVINCIA: Lima (provincia)
DIRECCION: Jr. Vizcardo y Guzmán 486, Distrito Comas
AGENCIA SHALOM: LIMA
PDF URL: https://drive.google.com/file/d/1UOr04mC2_nLQP7KuVC1J1ElefsZ36Ch_/view
COURIER: LIMA
ENVIAR: FALSE
ANULAR: FALSE
ATENDIDO: XIOMARA
SUBIDO: XIOMARA
NOTAS DEL PEDIDO: SABADO 26, 10AM A 3PM, DIN, dice que recibe todo el día
OBSERVACIONES: [vacío]
CLAVES: DIN
LINK SHALOM: DIN 08/08 (AZUL Y VERDE) CON REGALO - KELLY
PDF SHALOM: [vacío]
FECHA ENVIADO: 7/8/2025 21:32:57
ENTREGADO: [vacío]
ESTADO: L - EN RUTA
```

### Información Clave

- **Total de columnas:** 28 (A hasta AB) - ¡IGUAL QUE PROVINCIA!
- **ID único para DB:** `PEDIDO` (columna D, index 3) - ej: "N-13128"
- **ID interno sistema:** `ID` (columna A, index 0) - ej: "13214104"
- **Nombre cliente:** `NOMBRES` (columna I, index 8) ✅ Usa NOMBRES (con S)
- **🎯 SÍ TIENE COURIER:** Columna P (index 15) - ej: "LIMA"

### Estados Conocidos (columna AB)
- `L - EN RUTA`
- `L - PREPARADO`
- `L - DEVOLUCIÓN`
- `L - REPROGRAMAR`
- `L - NO CONTESTA`
- `L - ENTREGADO`

---

## 🗂️ REPORTE_ENVIADOS (ESTRUCTURA REAL)

### Headers Completos (20 columnas: A-T) ✅ VERIFICADO

```
A   B             C       D       E          F           G      H                 I        J    K        L          M          N               O        P        Q       R       S         T
ID  FECHA CREADO  TIENDA  PEDIDO  PRODUCTOS  PRODUCTO 2  TOTAL  MONTO PENDIENTE  NOMBRES  DNI  CELULAR  PROVINCIA  DIRECCION  AGENCIA SHALOM  PDF URL  COURIER  ENVIAR  ANULAR  ATENDIDO  SUBIDO
```

### Ejemplo Real

```
ID: 14969692
FECHA CREADO: 12/10/2025 6:11:00
TIENDA: Dearel
PEDIDO: #53382
PRODUCTOS: 1x Gafas de soldar con protección UV, IR y antirreflejo
PRODUCTO 2: [vacío]
TOTAL: 79
MONTO PENDIENTE: 59
NOMBRES: Luis Alberto Villon Angeles
DNI: 18064790
CELULAR: 51968589382
PROVINCIA: La Libertad
DIRECCION: 18064790
AGENCIA SHALOM: AV LARCO La Libertad / Trujillo / Victor Larco Herrera...
PDF URL: [vacío]
COURIER: SHALOM
ENVIAR: FALSE
ANULAR: FALSE
ATENDIDO: MARITE
SUBIDO: MARITE
```

### Información Clave

- **Total de columnas:** 20 (A hasta T)
- **ID único para DB:** `PEDIDO` (columna D, index 3) - ej: "#53382"
- **ID interno sistema:** `ID` (columna A, index 0) - ej: "14969692"
- **Nombre cliente:** `NOMBRES` (columna I, index 8) ✅ Usa NOMBRES
- **🎯 SÍ TIENE COURIER:** Columna P (index 15) - ej: "SHALOM"

### Diferencias con PROVINCIA/LIMA (que tienen 28 columnas)

**REPORTE NO tiene (20 cols vs 28):**
- ❌ NOTAS DEL PEDIDO (U)
- ❌ OBSERVACIONES (V)
- ❌ CLAVES (W)
- ❌ LINK SHALOM (X)
- ❌ PDF SHALOM (Y)
- ❌ FECHA ENVIADO (Z)
- ❌ ENTREGADO (AA)
- ❌ ESTADO (AB)

**REPORTE termina en columna T (SUBIDO)**

---

## 🗂️ ENTREGADO (ESTRUCTURA REAL)

### Headers Completos (39 columnas: A-AM) ✅ VERIFICADO

```
A   B      C       D       E          F           G      H                 I        J    K        L          M          N               O        P        Q       R       S         T       U                  V               W       X            Y           Z             AA         AB      AC    AD    AE    AF    AG    AH    AI    AJ               AK                    AL             AM
ID  FECHA  TIENDA  PEDIDO  PRODUCTOS  PRODUCTO 2  TOTAL  MONTO PENDIENTE  NOMBRES  DNI  CELULAR  PROVINCIA  DIRECCION  AGENCIA SHALOM  PDF URL  COURIER  ENVIAR  ANULAR  ATENDIDO  SUBIDO  NOTAS DEL PEDIDO  OBSERVACIONES  CLAVES  LINK SHALOM  PDF SHALOM  FECHA ENVIADO  ENTREGADO  ESTADO  REV1  REV2  REV3  REV4  REV5  REV6  REV7  FECHA ENTREGADO  FECHA Y HORA DE PAGO  FORMA DE PAGO  USUARIO
```

### Ejemplo Real

```
ID: 15001016
FECHA: 13/10/2025 19:20:00
TIENDA: Novi Perú
PEDIDO: N-17640
PRODUCTOS: 1x TIJERA DE INJERTO Y PODAR TM + 1x Afilador de Cuchillos de 3 Ranuras
PRODUCTO 2: [vacío]
TOTAL: 89
MONTO PENDIENTE: 69
NOMBRES: Jose Nelson Rodriguez Martinez
DNI: 42636411
CELULAR: 51927052719
PROVINCIA: La Libertad
DIRECCION: MZ A19 lt 01C Urb Manuel Arévalo tercera etapa
AGENCIA SHALOM: WICHANZAO La Libertad / Trujillo / La Esperanza...
PDF URL: [vacío]
COURIER: SHALOM
ENVIAR: FALSE
ANULAR: FALSE
ATENDIDO: AYELEN
SUBIDO: MARITE
NOTAS DEL PEDIDO: [vacío]
OBSERVACIONES: [vacío]
CLAVES: 1411
LINK SHALOM: https://rastrea.shalom.pe/62638275/NDHJ
PDF SHALOM: https://drive.google.com/file/d/1jW6aBhV-r-gWqej37yLQm6WM0T7yf145/view
FECHA ENVIADO: 14/10/2025 13:07:46
ENTREGADO: TRUE
ESTADO: EN DESTINO
REV1: 59161975
REV2: NDHJ
REV3: 62638275
REV4: [vacío]
REV5: [vacío]
REV6: [vacío]
REV7: [vacío]
FECHA ENTREGADO: 15/10/2025 17:07:52
FECHA Y HORA DE PAGO: 15/10/2025 05:03 PM
FORMA DE PAGO: YAPE
USUARIO: FIORELLA
```

### Información Clave

- **Total de columnas:** 39 (A hasta AM) - ¡LA MÁS COMPLETA!
- **ID único para DB:** `ID` (columna A, index 0) - ej: "15001016" ⚠️ Diferente a otras hojas
- **También tiene PEDIDO:** (columna D, index 3) - ej: "N-17640"
- **Nombre cliente:** `NOMBRES` (columna I, index 8)
- **🎯 SÍ TIENE COURIER:** Columna P (index 15)
- **🎯 FORMA DE PAGO:** Columna AL (index 37)
- **🎯 USUARIO:** Columna AM (index 38) - último campo

### Estructura Especial

**Columnas A-AB (28 primeras):**
- ✅ IGUAL a PROVINCIA/LIMA (columnas A-AB)
- Solo columna B es "FECHA" en vez de "FECHA CREADO"

**Columnas AC-AI (7 columnas REV):**
- AC: REV1
- AD: REV2
- AE: REV3
- AF: REV4
- AG: REV5
- AH: REV6
- AI: REV7

**Columnas AJ-AM (4 columnas finales):**
- AJ: FECHA ENTREGADO (index 35)
- AK: FECHA Y HORA DE PAGO (index 36)
- AL: FORMA DE PAGO (index 37) - ¡CRÍTICO!
- AM: USUARIO (index 38) - quien registró la entrega

---

## 🔧 Correcciones Necesarias en Apps Script

### 1. ✅ PROVINCIA SÍ Tiene COURIER
**Problema anterior:** Documentación decía que PROVINCIA no tenía COURIER  
**Realidad:** PROVINCIA tiene COURIER en columna P (index 15)  
**Acción:** Verificar que el Apps Script lee correctamente este campo

### 2. ✅ Índices Actualizados
**Campos críticos en PROVINCIA_ENVIADOS:**
```javascript
// Índices correctos (0-based):
PEDIDO: index 3   // Columna D - ID único
NOMBRES: index 8  // Columna I - Nombre cliente
COURIER: index 15 // Columna P - Courier asignado
PROVINCIA: index 11 // Columna L - Provincia destino
CLAVES: index 22  // Columna W - Código seguimiento
ESTADO: index 27  // Columna AB - Estado actual
```

### 3. ⚠️ LIMA vs PROVINCIA
**Diferencias clave:**
- LIMA: ~15 columnas, NOMBRE (sin S) en index 6
- PROVINCIA: 28 columnas, NOMBRES (con S) en index 8
- Ambas tienen COURIER pero en diferentes posiciones

---

## 📊 Comparación de Estructuras

| Campo | PROVINCIA | LIMA | REPORTE | ENTREGADO |
|-------|-----------|------|---------|-----------|
| **Total Columnas** | 28 (A-AB) | 28 (A-AB) | 20 (A-T) | **39 (A-AM)** ✅ |
| **ID Único** | PEDIDO (D/3) | PEDIDO (D/3) | PEDIDO (D/3) | **ID (A/0)** ⚠️ |
| **Tiene PEDIDO** | ✅ D (3) | ✅ D (3) | ✅ D (3) | **✅ D (3)** |
| **Nombre Cliente** | NOMBRES (I/8) | NOMBRES (I/8) | NOMBRES (I/8) | **NOMBRES (I/8)** ✅ |
| **COURIER** | ✅ P (15) | ✅ P (15) | ✅ P (15) | **✅ P (15)** |
| **ESTADO** | AB (27) | AB (27) | ❌ No | **AB (27)** ✅ |
| **CLAVES** | W (22) | W (22) | ❌ No | **W (22)** ✅ |
| **FECHA ENVIADO** | Z (25) | Z (25) | ❌ No | **Z (25)** ✅ |
| **ENTREGADO** | AA (26) | AA (26) | ❌ No | **AA (26)** ✅ |
| **FORMA DE PAGO** | ❌ No | ❌ No | ❌ No | **✅ AL (37)** 🎯 |
| **USUARIO** | ❌ No | ❌ No | ❌ No | **✅ AM (38)** 🎯 |
| **REV1-REV7** | ❌ No | ❌ No | ❌ No | **✅ AC-AI** |
| **Última Columna** | AB (ESTADO) | AB (ESTADO) | T (SUBIDO) | **AM (USUARIO)** |

### 🎯 Hallazgos Finales

**Columnas A-T (20 primeras):**
- ✅ Las 4 hojas tienen EXACTAMENTE las mismas columnas A-T
- ⚠️ Excepción: ENTREGADO usa "FECHA" (B) en vez de "FECHA CREADO"

**Columnas U-AB (8 adicionales):**
- ✅ PROVINCIA, LIMA y ENTREGADO tienen U-AB
- ❌ REPORTE NO tiene U-AB (termina en T)

**Columnas AC-AM (12 adicionales):**
- ✅ Solo ENTREGADO tiene AC-AM
- Incluye: REV1-REV7, FECHA ENTREGADO, FECHA Y HORA DE PAGO, FORMA DE PAGO, USUARIO

### ⚠️ ID Único Diferente

- **PROVINCIA, LIMA, REPORTE:** Usan `PEDIDO` (columna D) como ID único
- **ENTREGADO:** Usa `ID` (columna A) como ID único ⚠️

---

## ✅ Próximos Pasos

1. **Esperar estructura real de:**
   - [ ] LIMA_ENVIADOS
   - [ ] REPORTE_ENVIADOS
   - [ ] ENTREGADO

2. **Actualizar Apps Script con índices correctos**

3. **Actualizar interfaces TypeScript** en `src/types/sheets.ts`

4. **Testing E2E completo**

---

**Estado:** 🟡 EN PROGRESO - 1/4 hojas verificadas  
**Última actualización:** 15 oct 2025 - PROVINCIA_ENVIADOS verificada
