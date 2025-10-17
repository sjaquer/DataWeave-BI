# 📋 Estructura de Columnas: LIMA vs PROVINCIA

## 🎯 Diferencias Críticas

### PROVINCIA_ENVIADOS
```
Columna P (COURIER): Nombre del courier
Columna W (CLAVES): Código de seguimiento
Columna AB (ESTADO): Estado sin prefijo
```

### LIMA_ENVIADOS  
```
Columna P (COURIER): ❌ NO USAR - Puede tener "LIMA" genérico
Columna W (CLAVES): ✅ AQUÍ ESTÁ EL COURIER - "DIN", "CLOCK"
Columna AB (ESTADO): Estado con prefijo "L-"
```

## ⚠️ IMPORTANTE

**Para pedidos de LIMA:**
- El courier NO está en la columna estándar `COURIER`
- El courier SÍ está en la columna `CLAVES`
- Valores típicos: "DIN", "CLOCK"

**Para pedidos de PROVINCIA:**
- El courier SÍ está en la columna `COURIER`
- La columna `CLAVES` tiene el código de seguimiento
- Valores típicos: "SHALOM", "OLVA", "TEPSA"

## 📊 Mapeo Completo de Columnas

| Columna | Provincia | Lima | Notas |
|---------|-----------|------|-------|
| A | ID | ID | ID interno sistema |
| B | FECHA CREADO | FECHA CREADO | Fecha creación |
| C | TIENDA | TIENDA | luzma, jina, etc. |
| D | PEDIDO | PEDIDO | 🔑 ID ÚNICO |
| E | PRODUCTOS | PRODUCTOS | Descripción |
| F | PRODUCTO 2 | PRODUCTO 2 | Adicional |
| G | TOTAL | TOTAL | Monto total |
| H | MONTO PENDIENTE | MONTO PENDIENTE | Por cobrar |
| I | NOMBRES | NOMBRES | Cliente |
| J | DNI | DNI | Documento |
| K | CELULAR | CELULAR | Teléfono |
| L | PROVINCIA | PROVINCIA | Destino |
| M | DIRECCION | DIRECCION | Dirección |
| N | AGENCIA SHALOM | AGENCIA SHALOM | Agencia |
| O | PDF URL | PDF URL | URL PDF |
| **P** | **✅ COURIER** | **❌ NO USAR** | **DIFERENCIA** |
| Q | ENVIAR | ENVIAR | Flag |
| R | ANULAR | ANULAR | Flag |
| S | ATENDIDO | ATENDIDO | Usuario |
| T | SUBIDO | SUBIDO | Usuario |
| U | NOTAS DEL PEDIDO | NOTAS DEL PEDIDO | Notas |
| V | OBSERVACIONES | OBSERVACIONES | Obs |
| **W** | **CLAVES (código)** | **✅ COURIER** | **DIFERENCIA** |
| X | LINK SHALOM | LINK SHALOM | URL tracking |
| Y | PDF SHALOM | PDF SHALOM | PDF |
| Z | FECHA ENVIADO | FECHA ENVIADO | Fecha envío |
| AA | ENTREGADO | ENTREGADO | Flag/fecha |
| AB | ESTADO | L-ESTADO | Estado actual |

## 🔧 Código de Webhook Correcto

```typescript
// Para LIMA, el courier está en CLAVES, NO en COURIER
const courierValue = tipoOrigen === 'LIMA' 
  ? (row.CLAVES || 'N/A')      // ✅ Columna W para Lima
  : (row.COURIER || 'N/A');     // ✅ Columna P para Provincia
```

## 📝 Ejemplos Reales

### Pedido de PROVINCIA
```json
{
  "PEDIDO": "#Z4890",
  "COURIER": "SHALOM",        // ✅ Columna P
  "CLAVES": "SHL-2025-001",   // Código de seguimiento
  "ESTADO": "EN TRANSITO"     // Sin prefijo
}
```

### Pedido de LIMA
```json
{
  "PEDIDO": "N-13128",
  "COURIER": "LIMA",          // ❌ Valor genérico, NO usar
  "CLAVES": "DIN",            // ✅ ESTE ES EL COURIER REAL
  "ESTADO": "L-ENTREGADO"     // Con prefijo L-
}
```

## 🎨 Estados por Tipo

### PROVINCIA (sin prefijo)
- ENVIADO
- EN TRANSITO
- EN DESTINO
- TIENDA
- DEVOLUCIÓN
- PAGADO
- ORIGEN

### LIMA (con prefijo L-)
- L-EN RUTA
- L-PREPARADO
- L-ENTREGADO
- L-DEVOLUCIÓN
- L-REPROGRAMAR
- L-NO CONTESTA
- L-RETORNADO

## 🚨 Errores Comunes

### ❌ Error: Usar COURIER para Lima
```typescript
// MAL - No leerá el courier correcto
const courier = row.COURIER; // "LIMA" genérico
```

### ✅ Correcto: Condicional por tipo
```typescript
// BIEN - Lee la columna correcta según tipo
const courier = tipoOrigen === 'LIMA' 
  ? row.CLAVES 
  : row.COURIER;
```

## 🔍 Verificación

Para verificar si los datos están correctos:

1. **Consola de Firestore**
   - Abrir: https://console.firebase.google.com/
   - Collection: `envios_temporales`
   - Filtrar: `tipoOrigen == "LIMA"`
   - Verificar campo `courier`: debe ser "DIN", "CLOCK", etc.

2. **Dashboard**
   - URL: /dashboard/shipments
   - Sección: "Estados de Pedidos Temporales"
   - Verificar que couriers de Lima sean específicos

3. **Webhook GET**
   - URL: /api/webhooks/envios-temporales
   - Campo: `porCourier`
   - Debe mostrar: `{ "DIN": 55, "CLOCK": 10, "SHALOM": 30 }`

## 📞 Valores de Courier

### PROVINCIA (Columna P)
- SHALOM
- OLVA
- TEPSA
- CRUZ DEL SUR
- MARVISUR
- Otros couriers interprovinciales

### LIMA (Columna W - CLAVES)
- **DIN** - Courier de Lima
- **CLOCK** - Courier de Lima
- Otros valores específicos de Lima

---

**Última actualización:** 17 de Enero de 2025  
**Autor:** GitHub Copilot  
**Status:** ✅ Documentado y Corregido en Webhook
