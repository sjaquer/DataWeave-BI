# 🔧 Troubleshooting - Google Apps Script Sync

## ⚠️ Error: "Excedió el tiempo máximo de ejecución"

### 🔍 Causa
Google Apps Script tiene un límite de **6 minutos** para ejecuciones manuales. Cuando sincronizas hojas con >1000 filas manualmente, puede exceder este tiempo.

### ✅ Soluciones

#### 1. Usar Sincronización Automática (RECOMENDADO)
```
Menú: "5. Activar Sincronización Automática"
```
- ✅ Sin límite de 6 minutos
- ✅ Se ejecuta en background cada 5 minutos
- ✅ No bloquea tu trabajo en Sheets

#### 2. Reducir BATCH_SIZE
En el código, cambiar:
```javascript
BATCH_SIZE: 30,  // Reducido de 50 para hojas muy grandes
```

#### 3. Dividir Datos Manualmente
- Filtrar filas por fecha
- Sincronizar por partes más pequeñas

---

## 📊 Límites de Tiempo por Cantidad de Filas

| Filas | Lotes (50/lote) | Tiempo Estimado | Manual | Automático |
|-------|----------------|-----------------|--------|------------|
| 100   | 2              | ~3s            | ✅      | ✅          |
| 500   | 10             | ~15s           | ✅      | ✅          |
| 1000  | 20             | ~30s           | ✅      | ✅          |
| 2000  | 40             | ~60s           | ✅      | ✅          |
| 5000  | 100            | ~2.5min        | ✅      | ✅          |
| 10000 | 200            | ~5min          | ⚠️      | ✅          |
| 20000 | 400            | ~10min         | ❌      | ✅          |

⚠️ = Puede fallar
❌ = Fallará seguro

---

## 🔄 Optimizaciones Aplicadas (2025-01-17)

### Cambios en CONFIG

```javascript
// ANTES
BATCH_SIZE: 75,
BATCH_DELAY_MS: 500

// AHORA
BATCH_SIZE: 50,         // -33% tamaño = menos carga por request
BATCH_DELAY_MS: 1000    // +100% delay = mejor estabilidad
```

### Nuevas Funciones

1. **Advertencia para Hojas Grandes**
   - Si >500 filas, muestra diálogo YES/NO
   - Recomienda usar sincronización automática

2. **Timeout Management**
   - Límite interno de 5 minutos
   - Mensaje de error específico si excede

3. **Mensajes Mejorados**
   - Muestra tiempo de ejecución en segundos
   - Indica cantidad de lotes procesados

---

## 📝 Ejemplo de Mensaje de Advertencia

Cuando intentas sincronizar >500 filas manualmente:

```
⚠️ Advertencia: Hoja Grande

Esta hoja tiene 1,234 filas. La sincronización manual puede tardar varios minutos.

¿Deseas continuar?

Recomendación: Usa "5. Activar Sincronización Automática" para hojas grandes.

[SÍ] [NO]
```

---

## 🔍 Ver Logs de Ejecución

1. **Extensiones → Apps Script**
2. Menú lateral: **Ejecuciones** (ícono lista)
3. Clic en cualquier ejecución para ver detalles

### Logs Típicos

**✅ Exitoso:**
```
📦 Enviando 1234 filas en 25 lote(s) de hasta 50 filas cada uno
📤 Enviando lote 1/25 (50 filas)...
✅ Lote 1/25 procesado exitosamente
...
📊 Resumen: 1234/1234 filas enviadas en 25 lote(s)
✅ Sincronización exitosa: 1234 filas procesadas en 25 lote(s)
```

**⚠️ Con Errores:**
```
📦 Enviando 1234 filas en 25 lote(s) de hasta 50 filas cada uno
📤 Enviando lote 1/25 (50 filas)...
✅ Lote 1/25 procesado exitosamente
📤 Enviando lote 2/25 (50 filas)...
❌ Error en lote 2: código 500, respuesta: Internal Server Error
...
📊 Resumen: 1184/1234 filas enviadas en 25 lote(s)
⚠️ Sincronización parcial: 1184/1234 filas enviadas. Errores: 1
```

**❌ Timeout:**
```
Error en hoja "LIMA_ENVIADOS": Tiempo de ejecución excedido. Usa sincronización automática para hojas grandes.
```

---

## 🚨 Otros Errores Comunes

### Error: "No se encontró la hoja"

**Causa:** Nombre de hoja incorrecto

**Solución:** Verificar nombres exactos (case-sensitive):
- ✅ `PROVINCIA_ENVIADOS`
- ✅ `LIMA_ENVIADOS`
- ✅ `REPORTE_ENVIADOS`
- ✅ `ENTREGADO`

---

### Error: "413 Payload Too Large"

**Causa:** BATCH_SIZE muy grande para el servidor

**Solución:**
```javascript
CONFIG = {
  BATCH_SIZE: 30,  // Reducir de 50 a 30
}
```

---

### Error: "No se pudieron crear triggers"

**Causa:** Permisos insuficientes

**Solución:**
1. **Extensiones → Apps Script**
2. Ejecutar `createTriggers` manualmente desde el editor
3. Aceptar permisos cuando aparezca el diálogo
4. Scope necesario: `https://www.googleapis.com/auth/script.scriptapp`

---

### Error: "El webhook devolvió código 500"

**Causa:** Error en el servidor de Vercel

**Posibles causas:**
- Firestore sin índices configurados
- Datos mal formateados
- Límite de Firestore excedido

**Solución:**
1. Verificar logs en Vercel Dashboard
2. Verificar estructura de datos en Sheets
3. Desplegar índices de Firestore:
   ```bash
   firebase deploy --only firestore:indexes
   ```

---

## 💡 Tips de Optimización

### 1. Para Hojas Muy Grandes (>5000 filas)

Reducir BATCH_SIZE y aumentar DELAY:

```javascript
CONFIG = {
  BATCH_SIZE: 30,
  BATCH_DELAY_MS: 1500,  // 1.5 segundos entre lotes
}
```

### 2. Monitoreo de Triggers

Verificar triggers activos:
1. **Extensiones → Apps Script**
2. **Activadores** (ícono reloj)
3. Debería ver: `runAutoSyncAll` cada 5 minutos

### 3. Evitar Ediciones Durante Sync Manual

- No editar la hoja mientras se sincroniza manualmente
- Esperar a que termine la sincronización
- Usar sincronización automática para evitar conflictos

---

## 📞 Soporte

Si el problema persiste:

1. ✅ Revisar esta guía
2. ✅ Ver logs en **Apps Script → Ejecuciones**
3. ✅ Verificar estructura de hojas (28 columnas para PROVINCIA/LIMA)
4. ✅ Usar sincronización automática para hojas grandes
5. ✅ Verificar índices de Firestore
