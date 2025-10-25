# Scripts - DataWeave BI

Este directorio contiene scripts para mantenimiento, seed de datos y operaciones del sistema.

---

## 🗑️ LIMPIEZA COMPLETA DE BASE DE DATOS ZADARMA

### ⚠️ NUEVA OPCIÓN: Limpieza Completa de Zadarma

Para empezar completamente desde cero, elimina TODOS los datos de Zadarma:

**Opción 1: Script PowerShell (Recomendado)**
```powershell
# Simulación (ver qué se eliminaría)
.\scripts\cleanup-zadarma.ps1 -DryRun

# Limpieza real (elimina todo)
.\scripts\cleanup-zadarma.ps1 -Confirm
```

**Opción 2: Script TypeScript directo**
```powershell
# Simulación
npx ts-node scripts/cleanup-zadarma-database.ts --dry-run

# Limpieza real
npx ts-node scripts/cleanup-zadarma-database.ts --confirm
```

### 🧹 LIMPIEZA DE DUPLICADOS (Método anterior)

**Paso 1: Configurar Firebase**
```powershell
.\scripts\setup-firebase.ps1
```

Este script interactivo te guiará para:
- Buscar automáticamente el archivo service-account.json
- Configurar la variable de entorno necesaria
- Verificar que todo esté listo

**Paso 2: Ejecutar limpieza en modo prueba**
```powershell
.\scripts\run-cleanup.ps1 -DryRun
```

**Paso 3: Ejecutar limpieza real**
```powershell
.\scripts\run-cleanup.ps1
```

### Uso Avanzado

**Limpiar solo una fecha específica:**
```powershell
.\scripts\run-cleanup.ps1 -DryRun -Date "2025-10-25"
.\scripts\run-cleanup.ps1 -Date "2025-10-25"
```

**Uso manual directo:**
```powershell
# Dry-run (ver qué se eliminaría)
npx tsx scripts/clean-zadarma-duplicates.ts --dry-run

# Limpieza real
npx tsx scripts/clean-zadarma-duplicates.ts

# Fecha específica
npx tsx scripts/clean-zadarma-duplicates.ts --dry-run --date 2025-10-25
```

📖 **Documentación completa**: Ver `scripts/setup-firebase.md`

---

## 📦 SEED DE USUARIOS DEMO

El sistema incluye 4 roles diferentes:

| Rol | Email | UID |
|-----|-------|-----|
| **Gerente** | gerencia@dataweave.com | `5Re9sPT47DR6bbjntLL9LpKKjn13` |
| **Encargado** | encargado@dataweave.com | `n3UuVRSz8LaISnEbJLLy7Yk8HNU2` |
| **Call Center** | callcenter@dataweave.com | `fzQs2Ev1NEReM6YY4JYMZuytumz2` |
| **Marketing** | marketing@dataweave.com | `asA3k52QlMPWr9v6ZjTQON98BB52` |

---

## 🚀 Ejecución del Seed

### Opción 1: Usando TypeScript (Recomendado)

```bash
npx tsx scripts/seed-users-client.ts
```

**Requisitos:**
- Variables de entorno `NEXT_PUBLIC_FIREBASE_*` configuradas en `.env`
- Los usuarios YA DEBEN existir en Firebase Authentication con los UIDs especificados

**Ventajas:**
- No requiere `SERVICE_ACCOUNT`
- Usa el SDK cliente de Firebase
- Más simple de ejecutar

---

### Opción 2: Usando Node.js (Admin SDK)

```bash
node scripts/seed-users.js
```

**Requisitos:**
- Variable de entorno `SERVICE_ACCOUNT` configurada en `.env`
- Los usuarios YA DEBEN existir en Firebase Authentication con los UIDs especificados

**Ventajas:**
- Usa Firebase Admin SDK (más poderoso)
- Puede ejecutarse en el servidor
- Útil para scripts de automatización

---

## 📋 Pasos Previos

Antes de ejecutar cualquier script de seed:

### 1. Crear usuarios en Firebase Authentication

Ve a [Firebase Console](https://console.firebase.google.com/) y crea los 4 usuarios **manualmente**:

1. Ve a **Authentication** → **Users** → **Add User**

2. **Usuario 1 - Gerente:**
   - Email: `gerencia@dataweave.com`
   - Contraseña: (la que prefieras, ej: `Gerente123!`)
   - **Importante:** Después de crear, copia el UID generado

3. **Usuario 2 - Encargado:**
   - Email: `encargado@dataweave.com`
   - Contraseña: (la que prefieras, ej: `Encargado123!`)
   - **Importante:** Después de crear, copia el UID generado

4. **Usuario 3 - Call Center:**
   - Email: `callcenter@dataweave.com`
   - Contraseña: (la que prefieras, ej: `CallCenter123!`)
   - **Importante:** Después de crear, copia el UID generado

5. **Usuario 4 - Marketing:**
   - Email: `marketing@dataweave.com`
   - Contraseña: (la que prefieras, ej: `Marketing123!`)
   - **Importante:** Después de crear, copia el UID generado

### 2. Actualizar los UIDs en los scripts

Si los UIDs generados por Firebase son diferentes a los especificados, actualiza los archivos:

- `scripts/seed-users-client.ts`
- `scripts/seed-users.js`

Cambia los UIDs en el array `users`:

```typescript
const users = [
  {
    uid: 'TU_UID_REAL_AQUÍ', // ← Copia el UID de Firebase Console
    email: 'gerencia@dataweave.com',
    // ...
  },
  // ...
];
```

### 3. Ejecutar el script

Una vez que los usuarios existan en Firebase Auth:

```bash
npx tsx scripts/seed-users-client.ts
```

---

## ✅ Verificación

Después de ejecutar el seed, verifica que funcionó:

1. **En Firebase Console:**
   - Ve a **Firestore Database**
   - Busca la colección `users`
   - Deberías ver 4 documentos (uno por cada usuario)
   - Cada documento debe tener: `uid`, `email`, `role`, `displayName`, `createdAt`

2. **En la aplicación:**
   - Inicia sesión con cada usuario
   - Verifica que veas las secciones correctas según el rol
   - Ejemplo:
     - **Gerente:** ve las 9 secciones
     - **Encargado:** ve 5 secciones (Dashboard, Envíos, Provincias, Análisis Inventario, Estado Inventario)
     - **Call Center:** ve 2 secciones (Dashboard, Provincias)
     - **Marketing:** ve 4 secciones (Dashboard, Campañas Meta, Análisis Diario, Estado Inventario)

---

## 🎯 Permisos por Rol

### 👔 Gerente
**Acceso completo a todas las secciones**
- Dashboard General
- Envíos
- Rendimiento
- Campañas Meta
- Provincias
- Análisis Diario
- Análisis Inventario
- Estado Inventario
- Análisis Mensual

### 📦 Encargado de Logística
**Acceso a logística general**
- Dashboard General
- Envíos
- Provincias
- Análisis Inventario
- Estado Inventario

### 📞 Call Center
**Acceso a datos de clientes**
- Dashboard General
- Provincias

### 📊 Marketing
**Acceso a productos y campañas**
- Dashboard General
- Campañas Meta
- Análisis Diario
- Estado Inventario

---

## 🔧 Troubleshooting

### Error: "Cannot find module 'tsx'"

**Solución:**
```bash
npm install -g tsx
```

O ejecuta directamente:
```bash
npx tsx scripts/seed-users-client.ts
```

### Error: "NEXT_PUBLIC_FIREBASE_API_KEY is not defined"

**Solución:**
- Verifica que el archivo `.env` exista en la raíz del proyecto
- Asegúrate de que tenga todas las variables `NEXT_PUBLIC_FIREBASE_*`
- Reinicia el terminal

### Error: "The default Firebase app does not exist"

**Solución:**
- Verifica que las variables de entorno estén correctamente configuradas
- Asegúrate de estar usando las credenciales del proyecto correcto

### Los usuarios no aparecen en Firestore

**Causa:** Los usuarios no existen en Firebase Authentication

**Solución:**
1. Primero crea los usuarios en Firebase Console → Authentication
2. Luego ejecuta el script de seed
3. El script **solo crea los perfiles en Firestore**, no los usuarios en Auth

---

## 📝 Notas

1. **Contraseñas:** Define contraseñas seguras para cada usuario demo
2. **UIDs:** Los UIDs deben coincidir exactamente con los de Firebase Authentication
3. **Moneda:** Todos los montos se manejan en Soles Peruanos (S/)
4. **Seguridad:** En producción, cambia las contraseñas de los usuarios demo

---

**¡Listo! Los usuarios están configurados y listos para usar.** 🚀
