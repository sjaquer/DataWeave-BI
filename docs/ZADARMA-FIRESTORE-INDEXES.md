# Configuración de Índices de Firestore para Zadarma

## 📋 Instrucciones

Este documento contiene los índices necesarios para el sistema de caché de Zadarma.

### Opción 1: Configuración Manual (Firebase Console)

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** → **Índices**
4. Crea los siguientes índices compuestos:

---

## 🔍 Índices Requeridos

### Índice 1: Búsqueda por Fecha

**Colección:** `zadarma_calls`

| Campo | Orden |
|-------|-------|
| `callDate` | Ascending |

**Modo de consulta:** Collection  
**Estado:** Necesario

**Comando gcloud:**
```bash
gcloud firestore indexes composite create \
  --collection-group=zadarma_calls \
  --field-config field-path=callDate,order=ascending
```

---

### Índice 2: Búsqueda por Agente y Fecha

**Colección:** `zadarma_calls`

| Campo | Orden |
|-------|-------|
| `agentId` | Ascending |
| `callDate` | Ascending |

**Modo de consulta:** Collection  
**Estado:** Necesario

**Comando gcloud:**
```bash
gcloud firestore indexes composite create \
  --collection-group=zadarma_calls \
  --field-config field-path=agentId,order=ascending \
  --field-config field-path=callDate,order=ascending
```

---

### Índice 3: Búsqueda por ID de Llamada

**Colección:** `zadarma_calls`

| Campo | Orden |
|-------|-------|
| `pbx_call_id` | Ascending |

**Modo de consulta:** Collection  
**Estado:** Necesario

**Comando gcloud:**
```bash
gcloud firestore indexes composite create \
  --collection-group=zadarma_calls \
  --field-config field-path=pbx_call_id,order=ascending
```

---

## ⚙️ Opción 2: Configuración Automática (firestore.indexes.json)

Agrega estos índices a tu archivo `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "zadarma_calls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "callDate",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "zadarma_calls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "agentId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "callDate",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "zadarma_calls",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "pbx_call_id",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Desplegar índices:**
```bash
firebase deploy --only firestore:indexes
```

---

## ✅ Verificación

Después de crear los índices, verifica que estén en estado **Habilitado**:

1. Ve a Firebase Console → Firestore → Índices
2. Espera a que todos los índices muestren estado **Habilitado** (puede tardar varios minutos)
3. Los índices en estado **Compilando** aún no están disponibles

---

## 🚨 Errores Comunes

### Error: "The query requires an index"

**Causa:** Los índices aún no están creados o están en compilación.

**Solución:** 
1. Verifica que los índices existan en Firebase Console
2. Espera a que terminen de compilar
3. Firebase Console mostrará un enlace directo para crear el índice faltante

---

### Error: "Insufficient permissions"

**Causa:** No tienes permisos para crear índices.

**Solución:**
1. Verifica que tengas rol de **Editor** o **Propietario** en el proyecto
2. Usa `gcloud auth login` para autenticarte
3. Ejecuta `gcloud config set project YOUR_PROJECT_ID`

---

## 📊 Monitoreo de Rendimiento

Después de crear los índices, monitorea el rendimiento:

```bash
# Ver uso de índices
gcloud firestore operations list

# Ver estadísticas de consultas
firebase firestore:stats
```

---

## 🔄 Mantenimiento

**Frecuencia recomendada:** Mensual

1. Revisar índices no utilizados
2. Eliminar índices obsoletos
3. Optimizar consultas lentas
4. Revisar logs de errores de índices

---

## 📝 Notas Adicionales

- Los índices se crean automáticamente cuando Firebase detecta una consulta que los requiere
- Puedes hacer clic en el enlace del error en la consola para crear el índice automáticamente
- Los índices compuestos pueden tardar varios minutos en compilarse para colecciones grandes
- Firebase tiene un límite de 200 índices compuestos por proyecto

---

**Última actualización:** 17 de octubre de 2025
