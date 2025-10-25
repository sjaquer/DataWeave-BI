# 🔧 Configuración de Firebase para Scripts

Este documento explica cómo configurar Firebase Admin SDK para ejecutar los scripts de mantenimiento.

## 📋 Prerequisitos

1. Tener acceso al proyecto de Firebase
2. Tener permisos de administrador
3. Node.js instalado

---

## 🔐 Opción 1: Usar Service Account (Recomendado para scripts)

### Paso 1: Descargar el Service Account Key

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** (⚙️) > **Service Accounts**
4. Click en **Generate New Private Key**
5. Guarda el archivo JSON en un lugar seguro

### Paso 2: Configurar la variable de entorno

**PowerShell:**
```powershell
# Temporal (solo para la sesión actual)
$env:GOOGLE_APPLICATION_CREDENTIALS="I:\ruta\a\tu\service-account-key.json"

# O usa el path absoluto directo
$env:SERVICE_ACCOUNT="I:\ruta\a\tu\service-account-key.json"
```

**CMD:**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=I:\ruta\a\tu\service-account-key.json
```

### Paso 3: Verificar configuración

```powershell
# Verificar que la variable está configurada
echo $env:GOOGLE_APPLICATION_CREDENTIALS

# Verificar que el archivo existe
Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS
```

---

## 🔐 Opción 2: Usar .env.local

### Paso 1: Crear archivo .env.local

Crea un archivo `.env.local` en la raíz del proyecto:

```env
# Firebase Admin SDK
SERVICE_ACCOUNT={"type":"service_account","project_id":"tu-proyecto",...}

# O apuntar a un archivo
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

### Paso 2: Cargar variables en el script

El script ya está configurado para leer `.env.local` automáticamente con `dotenv`.

---

## 🚀 Ejecutar el Script de Limpieza

Una vez configurado Firebase:

### 1. Modo Dry-Run (sin hacer cambios)
```powershell
npx tsx scripts/clean-zadarma-duplicates.ts --dry-run
```

### 2. Limpiar fecha específica (dry-run)
```powershell
npx tsx scripts/clean-zadarma-duplicates.ts --dry-run --date 2025-10-25
```

### 3. Ejecutar limpieza REAL
```powershell
# ⚠️ ADVERTENCIA: Esto hará cambios permanentes
npx tsx scripts/clean-zadarma-duplicates.ts
```

### 4. Limpiar fecha específica (real)
```powershell
npx tsx scripts/clean-zadarma-duplicates.ts --date 2025-10-25
```

---

## 🔍 Solución de Problemas

### Error: "Firebase Admin SDK no inicializado"

**Causa**: No se encontró la configuración de SERVICE_ACCOUNT

**Solución**:
```powershell
# Verifica que la variable esté configurada
echo $env:GOOGLE_APPLICATION_CREDENTIALS

# O intenta con el path completo
$env:GOOGLE_APPLICATION_CREDENTIALS="I:\Documentos\...\service-account.json"
```

### Error: "Cannot read properties of null"

**Causa**: Firebase no pudo inicializarse

**Solución**:
1. Verifica que el JSON del service account sea válido
2. Verifica que el proyecto de Firebase sea correcto
3. Verifica permisos del service account

### Error: "Permission denied"

**Causa**: El service account no tiene permisos suficientes

**Solución**:
1. Ve a Firebase Console > IAM & Admin
2. Asegúrate que el service account tenga rol "Firebase Admin" o "Cloud Datastore User"

---

## 📊 Qué Esperar del Script

El script mostrará:

```
╔════════════════════════════════════════════════════════════╗
║  LIMPIEZA DE DUPLICADOS - ZADARMA CALLS                   ║
╚════════════════════════════════════════════════════════════╝

🧹 Iniciando limpieza de duplicados en Firestore...

⚠️  MODO DRY-RUN: No se realizarán cambios reales

📥 Total de documentos a procesar: 419

🔄 Aplicando consolidación (pbx_call_id + re-intentos)...

✅ Después de consolidar: 382 llamadas
🗑️  Duplicados detectados: 37 (8.8%)

📊 Reporte por fecha:

┌────────────┬─────────┬─────────┬───────────┬──────────┐
│ Fecha      │ Antes   │ Después │ Eliminados│ % Dupl.  │
├────────────┼─────────┼─────────┼───────────┼──────────┤
│ 2025-10-25 │     419 │     382 │        37 │     8.8% │
└────────────┴─────────┴─────────┴───────────┴──────────┘
```

---

## ✅ Checklist de Ejecución

Antes de ejecutar el script sin `--dry-run`:

- [ ] Backup de Firestore realizado (opcional pero recomendado)
- [ ] Script ejecutado en modo `--dry-run` exitosamente
- [ ] Resultados revisados y confirmados
- [ ] Service Account configurado correctamente
- [ ] Variables de entorno verificadas
- [ ] En horario de baja actividad (opcional)

---

## 🔙 Rollback en Caso de Problemas

Si algo sale mal después de la limpieza:

1. **Restaurar desde Backup** (si lo hiciste)
2. **Re-sincronizar desde Zadarma**:
   ```powershell
   # Sincronizar fecha específica
   curl -X POST http://localhost:3000/api/zadarma/sync -H "Content-Type: application/json" -d '{"startDate":"2025-10-25T00:00:00Z","endDate":"2025-10-25T23:59:59Z"}'
   ```

---

## 📞 Soporte

Si encuentras problemas, revisa:
1. Logs de Firebase Console
2. Variables de entorno configuradas
3. Permisos del service account
4. Formato del service account JSON

---

**Última actualización**: 25 de octubre de 2025
