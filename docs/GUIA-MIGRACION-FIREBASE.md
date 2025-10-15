# 📋 Guía Completa de Migración Firebase
**DataWeave-BI** — Migración de proyecto Firebase entre cuentas

---

## 📑 Índice

1. [Pre-requisitos](#1-pre-requisitos)
2. [Resumen ejecutivo](#2-resumen-ejecutivo)
3. [Exportar Firestore](#3-exportar-firestore)
4. [Importar Firestore](#4-importar-firestore)
5. [Exportar/Importar Firebase Auth](#5-exportarimportar-firebase-auth)
6. [Migrar Cloud Storage](#6-migrar-cloud-storage)
7. [Desplegar reglas e índices](#7-desplegar-reglas-e-índices)
8. [Provisionar service account](#8-provisionar-service-account-y-secrets)
9. [Actualizar código y variables](#9-actualizar-código-y-variables-de-entorno)
10. [Migrar Apps Script](#10-migrar-apps-script-y-triggers)
11. [Validación y smoke tests](#11-validación-y-smoke-tests)
12. [Limpieza post-migración](#12-limpieza-y-post-migración)
13. [Troubleshooting](#13-troubleshooting)

---

## 1) Pre-requisitos

### Software necesario
- ✅ **gcloud CLI** (Google Cloud SDK) instalado y configurado
- ✅ **gsutil** (incluido en gcloud)
- ✅ **firebase-tools** (CLI de Firebase): `npm install -g firebase-tools`
- ✅ **Node.js** y **npm** (para scripts de migración)
- ✅ **PowerShell** (Windows) o bash (Linux/Mac)

### Permisos requeridos
- **Proyecto origen**: Owner o roles de Firestore Admin + Storage Admin + Cloud Functions Admin
- **Proyecto destino**: Owner o permisos para crear recursos, service accounts y desplegar
- Acceso a ambas cuentas Google/Firebase simultáneamente (puedes usar `gcloud config configurations` para cambiar entre ellas)

### Preparación
1. **Crear bucket GCS** para export/import (ej. `gs://dw-bi-migration-backup-2025-10-15`)
2. **Hacer backup local** de archivos críticos: `.env`, service account JSON, `firestore.rules`, `firestore.indexes.json`
3. **Documentar** el estado actual: lista de colecciones, número de documentos, usuarios activos, buckets de Storage

---

## 2) Resumen ejecutivo

### Proyecto actual (origen)
- **Project ID**: `studio-975351465-60992`
- **Colecciones principales**: `orders`, `users`, `envios_temporales`, `envios_temporales_historial`, `inventory_movements`
- **Auth**: usuarios con email/password (hashes SCRYPT)
- **Storage**: bucket por defecto con imágenes/archivos
- **Apps Script**: bound script en Google Sheets con triggers time-based y onEdit

### Proyecto destino (a crear)
- **Project ID**: `YOUR_DEST_PROJECT_ID` (elige uno único)
- **Región**: misma que origen (recomendado) para compatibilidad
- **Billing**: debe estar habilitado

### Duración estimada
- **Preparación**: 30 min
- **Export/Import Firestore**: 1-3 horas (dependiendo del tamaño de BD)
- **Auth/Storage**: 30 min
- **Código y despliegue**: 1-2 horas
- **Validación**: 30 min - 1 hora
- **TOTAL**: ~4-7 horas (puede variar según el tamaño de datos)

---

## 3) Exportar Firestore

### 3.1. Autenticar con cuenta origen

```powershell
# Login con la cuenta origen
gcloud auth login

# Seleccionar proyecto origen
gcloud config set project studio-975351465-60992

# Verificar proyecto activo
gcloud config get-value project
```

### 3.2. Crear/usar bucket para export

```powershell
# Opción A: Usar bucket existente del proyecto origen
gsutil ls gs://studio-975351465-60992.appspot.com

# Opción B: Crear nuevo bucket para migration
gsutil mb -p studio-975351465-60992 -l us-central1 gs://dw-bi-migration-backup-2025-10-15
```

### 3.3. Exportar toda la base de datos

```powershell
# Exportar todas las colecciones
gcloud firestore export gs://dw-bi-migration-backup-2025-10-15/firestore-full-export-2025-10-15 --project=studio-975351465-60992

# Verificar export
gsutil ls -r gs://dw-bi-migration-backup-2025-10-15/firestore-full-export-2025-10-15/
```

**Notas importantes**:
- El export crea snapshots consistentes (no incluye cambios hechos durante la exportación)
- Guarda metadatos, timestamps, tipos de datos
- Tiempo estimado: 15-60 min para BD mediana (~100K docs)

### 3.4. Exportar colecciones específicas (opcional)

Si solo quieres migrar ciertas colecciones:

```powershell
gcloud firestore export gs://dw-bi-migration-backup-2025-10-15/firestore-partial-export --collection-ids=orders,users,envios_temporales --project=studio-975351465-60992
```

---

## 4) Importar Firestore

### 4.1. Crear proyecto destino

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. **Create Project** → `YOUR_DEST_PROJECT_ID`
3. Habilita **Firestore** (modo nativo)
4. Habilita **Billing** (requerido para import/export)

### 4.2. Habilitar APIs necesarias

```powershell
# Cambiar a proyecto destino
gcloud config set project YOUR_DEST_PROJECT_ID

# Habilitar APIs
gcloud services enable firestore.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable cloudfunctions.googleapis.com
gcloud services enable identitytoolkit.googleapis.com
```

### 4.3. Dar acceso al bucket de export

**Opción A**: Si el bucket está en el proyecto origen, concede acceso al service account del proyecto destino:

```powershell
# Obtener service account del proyecto destino
gcloud projects get-iam-policy YOUR_DEST_PROJECT_ID

# Buscar el service account por defecto (formato: <project-number>@cloudbuild.gserviceaccount.com)
# Conceder acceso al bucket origen
gsutil iam ch serviceAccount:YOUR_DEST_SERVICE_ACCOUNT:objectViewer gs://dw-bi-migration-backup-2025-10-15
```

**Opción B**: Copiar export a un bucket del proyecto destino:

```powershell
# Crear bucket en proyecto destino
gsutil mb -p YOUR_DEST_PROJECT_ID -l us-central1 gs://your-dest-migration-bucket

# Copiar export
gsutil -m cp -r gs://dw-bi-migration-backup-2025-10-15/firestore-full-export-2025-10-15 gs://your-dest-migration-bucket/
```

### 4.4. Importar a Firestore

```powershell
# Importar desde bucket accesible
gcloud firestore import gs://dw-bi-migration-backup-2025-10-15/firestore-full-export-2025-10-15 --project=YOUR_DEST_PROJECT_ID
```

**Verificación**:
- Ve a Firebase Console → Firestore → Data
- Confirma que las colecciones aparecen con documentos
- Verifica conteo de documentos (debe coincidir con origen)

---

## 5) Exportar/Importar Firebase Auth

### 5.1. Exportar usuarios desde origen

```powershell
# Autenticar con firebase-tools (si no lo hiciste antes)
firebase login

# Exportar usuarios (incluye hashes de contraseñas)
firebase auth:export users-export.json --project=studio-975351465-60992 --format=json
```

El archivo `users-export.json` contiene:
- UIDs, emails, display names
- Hashes de contraseñas (SCRYPT con salt)
- Metadatos (createdAt, lastSignInTime)
- Custom claims y roles

### 5.2. Importar usuarios en proyecto destino

```powershell
# Importar con hashes SCRYPT (mantiene contraseñas)
firebase auth:import users-export.json --project=YOUR_DEST_PROJECT_ID --hash-algo=SCRYPT --hash-key=<HASH_KEY> --salt-separator=<SEPARATOR> --rounds=<ROUNDS> --mem-cost=<MEM>
```

**⚠️ Problema común**: Si no tienes acceso a los parámetros de hash, Firebase no podrá importar las contraseñas.

**Solución alternativa**:
1. Importar sin contraseñas:
```powershell
firebase auth:import users-export.json --project=YOUR_DEST_PROJECT_ID
```

2. Enviar emails de restablecimiento a todos los usuarios:
```javascript
// Script Node.js para enviar password reset
const admin = require('firebase-admin');
admin.initializeApp();

async function sendPasswordResets() {
  const users = await admin.auth().listUsers();
  for (const user of users.users) {
    if (user.email) {
      await admin.auth().generatePasswordResetLink(user.email);
      console.log(`Reset email sent to ${user.email}`);
    }
  }
}
```

### 5.3. Verificar usuarios importados

```powershell
# Listar usuarios en proyecto destino
firebase auth:export verify-import.json --project=YOUR_DEST_PROJECT_ID
```

Compara conteos:
```powershell
# Contar usuarios origen
jq '. | length' users-export.json

# Contar usuarios destino
jq '. | length' verify-import.json
```

---

## 6) Migrar Cloud Storage

### 6.1. Listar buckets origen

```powershell
gsutil ls -p studio-975351465-60992
```

### 6.2. Copiar objetos entre buckets

```powershell
# Sincronizar bucket completo (recursivo, multithread)
gsutil -m rsync -r gs://source-bucket gs://destination-bucket

# O copiar todo preservando ACLs
gsutil -m cp -r -p gs://source-bucket/** gs://destination-bucket/
```

### 6.3. Configurar CORS si es necesario

Si usas Storage para imágenes públicas:

```json
// cors.json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

```powershell
gsutil cors set cors.json gs://destination-bucket
```

---

## 7) Desplegar reglas e índices

### 7.1. Actualizar `.firebaserc`

```json
{
  "projects": {
    "default": "YOUR_DEST_PROJECT_ID"
  }
}
```

### 7.2. Desplegar reglas de Firestore

```powershell
firebase deploy --only firestore:rules --project=YOUR_DEST_PROJECT_ID
```

### 7.3. Desplegar índices

```powershell
firebase deploy --only firestore:indexes --project=YOUR_DEST_PROJECT_ID
```

**⚠️ Si recibes error 403**:
- Verifica que tengas permisos de Cloud Datastore User
- Usa un service account con rol Firestore Admin
- Espera a que las APIs se habiliten completamente (~5 min)

Los índices compuestos pueden tardar en compilarse (estado "Compiling..." en Console). Espera hasta que estén "Ready" antes de hacer queries complejas.

---

## 8) Provisionar service account y secrets

### 8.1. Crear service account en proyecto destino

```powershell
# Crear service account
gcloud iam service-accounts create dataweave-admin \
  --display-name="DataWeave Admin SDK" \
  --project=YOUR_DEST_PROJECT_ID

# Otorgar roles necesarios
gcloud projects add-iam-policy-binding YOUR_DEST_PROJECT_ID \
  --member="serviceAccount:dataweave-admin@YOUR_DEST_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/datastore.owner"

gcloud projects add-iam-policy-binding YOUR_DEST_PROJECT_ID \
  --member="serviceAccount:dataweave-admin@YOUR_DEST_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Descargar JSON key
gcloud iam service-accounts keys create service-account-dest.json \
  --iam-account=dataweave-admin@YOUR_DEST_PROJECT_ID.iam.gserviceaccount.com
```

### 8.2. Configurar variables de entorno locales

Crea `.env.local` (NO subir a Git):

```bash
# Firebase Client SDK (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DEST_PROJECT_ID.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_DEST_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_DEST_PROJECT_ID.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Admin SDK (backend)
SERVICE_ACCOUNT={"type":"service_account","project_id":"YOUR_DEST_PROJECT_ID",...}

# Zadarma (copiar de origen)
ZADARMA_API_KEY=your_key
ZADARMA_API_SECRET=your_secret

# Meta Ads (copiar de origen)
META_ACCESS_TOKEN=your_token
META_AD_ACCOUNT_ID=act_123456
```

Para obtener las credenciales Firebase Client:
1. Firebase Console → Project Settings → General
2. En "Your apps" → Web app → Config
3. Copia los valores

### 8.3. Configurar secrets en Vercel (o tu hosting)

**En Vercel Dashboard**:
1. Project Settings → Environment Variables
2. Agregar las mismas variables del `.env.local`
3. Scope: Production, Preview, Development (según necesites)
4. **IMPORTANTE**: `SERVICE_ACCOUNT` debe ser el JSON completo (minificado, en una línea)

**Tip**: Para minificar el JSON:
```powershell
(Get-Content service-account-dest.json | ConvertFrom-Json | ConvertTo-Json -Compress) | Set-Clipboard
```

---

## 9) Actualizar código y variables de entorno

### 9.1. Actualizar `.firebaserc`

```json
{
  "projects": {
    "default": "YOUR_DEST_PROJECT_ID"
  }
}
```

### 9.2. Verificar `src/lib/firebase.ts`

Asegúrate de que lee las variables `NEXT_PUBLIC_FIREBASE_*`:

```typescript
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};
```

### 9.3. Verificar `src/lib/firebase-admin.ts`

```typescript
const serviceAccountString = process.env.SERVICE_ACCOUNT;
const serviceAccount = JSON.parse(serviceAccountString);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

### 9.4. Actualizar `google-apps-script/inventory-sync.js`

**Si el dominio del backend cambia**, actualiza las URLs:

```javascript
const CONFIG = {
  SHIPPED_WEBHOOK_URL: 'https://NEW-DOMAIN.vercel.app/api/webhooks/sheets',
  DELIVERED_WEBHOOK_URL: 'https://NEW-DOMAIN.vercel.app/api/webhooks/delivered',
  ENVIOS_TEMPORALES_WEBHOOK_URL: 'https://NEW-DOMAIN.vercel.app/api/webhooks/envios-temporales',
  // ...
};
```

**Mejora recomendada**: Usar Script Properties en vez de hardcodear:

```javascript
// En onOpen, configurar properties
function onOpen() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('WEBHOOK_BASE_URL')) {
    props.setProperty('WEBHOOK_BASE_URL', 'https://dataweave-bi.vercel.app');
  }
  // ... resto del menú
}

// Usar properties
const WEBHOOK_BASE = PropertiesService.getScriptProperties().getProperty('WEBHOOK_BASE_URL');
const CONFIG = {
  SHIPPED_WEBHOOK_URL: `${WEBHOOK_BASE}/api/webhooks/sheets`,
  // ...
};
```

### 9.5. Actualizar `apphosting.yaml` (si usas App Hosting)

```yaml
env:
  - variable: SERVICE_ACCOUNT
    secret: SERVICE_ACCOUNT_DEST  # Crear nuevo secret en Cloud Secret Manager
  
  - variable: ZADARMA_API_KEY
    secret: ZADARMA_API_KEY
  
  - variable: ZADARMA_API_SECRET
    secret: ZADARMA_API_SECRET
```

---

## 10) Migrar Apps Script y triggers

### Opción A: Transferir propiedad del Spreadsheet

1. En Google Sheets → **Compartir** → **Transferir propiedad**
2. Ingresar email de la nueva cuenta
3. La nueva cuenta acepta la transferencia
4. El script bound se transfiere automáticamente
5. Volver a autorizar scopes y recrear triggers

### Opción B: Crear nuevo proyecto Apps Script

1. En la nueva cuenta, abre el Google Sheet
2. **Extensiones** → **Apps Script**
3. Copia todo el código de `inventory-sync.js`
4. Pega en el nuevo proyecto
5. Guarda y ejecuta `onOpen` manualmente para crear el menú
6. Crear triggers:

**Triggers necesarios**:
- **Time-based**: función `runAutoSyncAll`, cada 5 minutos
- **On edit** (opcional, installable): función `onSheetEdit`, evento "On edit"

**Pasos para crear trigger time-based**:
1. Apps Script editor → Triggers (⏰ icono)
2. **+ Add Trigger**
3. Choose function: `runAutoSyncAll`
4. Event source: Time-driven
5. Type: Minutes timer
6. Interval: Every 5 minutes
7. Save (autorizar scopes si es necesario)

**Pasos para crear trigger on edit**:
1. Triggers → + Add Trigger
2. Function: `onSheetEdit`
3. Event source: From spreadsheet
4. Event type: On edit
5. Save

### 10.1. Autorizar scopes requeridos

Apps Script pedirá autorización para:
- `https://www.googleapis.com/auth/spreadsheets` (leer/escribir hojas)
- `https://www.googleapis.com/auth/script.external_request` (llamar webhooks)
- `https://www.googleapis.com/auth/script.scriptapp` (gestionar triggers)

Si tu cuenta es de Google Workspace administrado, puede que el admin deba aprobar los scopes.

### 10.2. Verificar que funciona

1. Ejecuta manualmente "1. Sincronizar PROVINCIA ENVIADOS" desde el menú
2. Revisa **Apps Script Logs** (Ctrl+Enter o View → Logs)
3. Verifica en Vercel logs que llegó el webhook
4. Confirma en Firestore Console que se insertaron/actualizaron documentos

---

## 11) Validación y smoke tests

### 11.1. Desplegar backend/frontend

```powershell
# Asegúrate de tener las env vars en Vercel
vercel env pull .env.vercel

# Deploy a producción
vercel --prod
```

### 11.2. Smoke tests

#### Test 1: Webhook GET (stats temporales)

```powershell
Invoke-WebRequest -Uri "https://YOUR-DOMAIN.vercel.app/api/webhooks/envios-temporales" -Method GET
```

Espera respuesta:
```json
{
  "status": "success",
  "totalActivos": 0,
  "porTipoOrigen": { "PROVINCIA": 0, "LIMA": 0 },
  ...
}
```

#### Test 2: Webhook POST (simular envío desde Apps Script)

```powershell
$payload = @{
  data = @(
    @{
      PEDIDO = "TEST-001"
      ESTADO = "EN_TRANSITO"
      TIENDA = "TEST"
      TIPO_ORIGEN = "PROVINCIA"
    }
  )
  tipoOrigen = "PROVINCIA"
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri "https://YOUR-DOMAIN.vercel.app/api/webhooks/envios-temporales" `
  -Method POST `
  -ContentType "application/json" `
  -Body $payload
```

Verifica:
- Response 200 OK
- En Firestore: colección `envios_temporales` tiene 1 doc con ID `TEST-001`

#### Test 3: Auth (login en UI)

1. Ve a `https://YOUR-DOMAIN.vercel.app/login`
2. Ingresa credenciales de un usuario migrado
3. Si falla: verifica que importaste usuarios con contraseñas o envía password reset

#### Test 4: Dashboard (métricas)

1. Ve a `/dashboard/shipments`
2. Selecciona rango de fechas
3. Verifica que carga datos (puede estar vacío si no hay orders en el rango)
4. Revisa browser console para errors

#### Test 5: Apps Script trigger automático

Espera 5-10 minutos y revisa:
- Apps Script → Executions (historial de ejecuciones)
- Debe aparecer `runAutoSyncAll` ejecutándose cada 5 min
- Vercel logs → debe mostrar POSTs entrantes

---

## 12) Limpieza y post-migración

### 12.1. Eliminar triggers antiguos (proyecto origen)

Si transferiste el script, los triggers del proyecto origen seguirán activos. Elimínalos manualmente:

1. Abre el Apps Script del proyecto origen
2. Triggers → Elimina todos los triggers time-based y on-edit

### 12.2. Revocar acceso a service accounts antiguos (opcional)

```powershell
# Listar service accounts del proyecto origen
gcloud iam service-accounts list --project=studio-975351465-60992

# Deshabilitar (no eliminar) service account antiguo
gcloud iam service-accounts disable OLD_SERVICE_ACCOUNT@studio-975351465-60992.iam.gserviceaccount.com
```

### 12.3. Documentar cambios

Actualiza documentación:
- `README.md` → cambiar referencias al project ID
- `docs/SETUP-AUTH.md` → actualizar instrucciones
- `.env.example` → usar placeholders del nuevo proyecto
- Changelog → añadir entrada de migración

### 12.4. Backup del proyecto origen (antes de desactivar)

```powershell
# Export final completo
gcloud firestore export gs://dw-bi-migration-backup-2025-10-15/final-backup-origen --project=studio-975351465-60992

# Export auth
firebase auth:export users-final-backup.json --project=studio-975351465-60992

# Download bucket
gsutil -m cp -r gs://studio-975351465-60992.appspot.com ./backup-storage/
```

Guarda estos backups por al menos 30 días antes de desmantelar el proyecto origen.

---

## 13) Troubleshooting

### Error: "Permission denied to access Firestore API"

**Causa**: No tienes permisos o las APIs no están habilitadas.

**Solución**:
```powershell
gcloud services enable firestore.googleapis.com --project=YOUR_DEST_PROJECT_ID
gcloud projects add-iam-policy-binding YOUR_DEST_PROJECT_ID --member=user:YOUR_EMAIL --role=roles/datastore.owner
```

### Error: "FUNCTION_PAYLOAD_TOO_LARGE" en Apps Script

**Causa**: Intentando enviar demasiados datos en un solo POST (>10MB aprox).

**Solución**: Usar el sistema de batching (ya implementado). Ajusta `CONFIG.BATCH_SIZE` a un valor menor (ej. 50).

### Error: Auth import falla con "Invalid hash algorithm"

**Causa**: No tienes los parámetros correctos de hash SCRYPT.

**Solución**:
1. Importa sin contraseñas:
```powershell
firebase auth:import users-export.json --project=YOUR_DEST_PROJECT_ID
```
2. Envía password reset a todos:
```javascript
// script-reset-passwords.js
const admin = require('firebase-admin');
const serviceAccount = require('./service-account-dest.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

async function sendResets() {
  const listUsersResult = await admin.auth().listUsers();
  for (const userRecord of listUsersResult.users) {
    if (userRecord.email) {
      const link = await admin.auth().generatePasswordResetLink(userRecord.email);
      console.log(`Reset link for ${userRecord.email}: ${link}`);
      // Aquí puedes enviar el link por email usando SendGrid, etc.
    }
  }
}
sendResets();
```

### Error: Firestore indexes tardan mucho en "Compiling..."

**Causa**: Los índices compuestos pueden tardar 10-30 min en compilarse.

**Solución**: Espera pacientemente. Mientras tanto, queries simples funcionarán. Revisa estado en Console.

### Error: Apps Script triggers no se crean (403 Forbidden)

**Causa**: Falta scope `https://www.googleapis.com/auth/script.scriptapp`.

**Solución**:
1. Abre Apps Script editor
2. Ejecuta manualmente la función `createTriggers` desde el editor (▶️ Run)
3. Acepta los permisos solicitados
4. Si sigue fallando, pide al admin de Workspace que apruebe el scope

### Warnings en logs de Vercel: "Firebase Admin not initialized"

**Causa**: Variable `SERVICE_ACCOUNT` no está configurada o tiene JSON inválido.

**Solución**:
1. Verifica que agregaste `SERVICE_ACCOUNT` en Vercel env vars
2. El valor debe ser el JSON completo en UNA LÍNEA (minificado)
3. Redeploy después de cambiar env vars

---

## 🎉 Checklist final

- [ ] Firestore: todas las colecciones migradas y verificadas
- [ ] Auth: usuarios importados (con o sin contraseñas)
- [ ] Storage: buckets copiados y accesibles
- [ ] Reglas e índices desplegados
- [ ] Service account creado y configurado en secrets
- [ ] Variables de entorno actualizadas en código y hosting
- [ ] Apps Script migrado y triggers recreados
- [ ] Smoke tests pasados (webhooks, auth, UI)
- [ ] Documentación actualizada
- [ ] Backups del proyecto origen guardados
- [ ] Proyecto origen deshabilitado (después de 30 días de validación)

---

## 📚 Referencias

- [Firestore Export/Import](https://cloud.google.com/firestore/docs/manage-data/export-import)
- [Firebase Auth Migration](https://firebase.google.com/docs/cli/auth)
- [Service Accounts Best Practices](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)
- [Apps Script Triggers](https://developers.google.com/apps-script/guides/triggers/installable)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

**Última actualización**: 15 de octubre de 2025  
**Autor**: DataWeave DevOps Team  
**Versión**: 1.0
