Crear índices de Firestore desde `firestore.indexes.json` usando la service account.

PRECAUCIONES
- El script hace requests directos a la API de Firestore. Asegúrate de que la service account en `.env` tenga permisos suficientes.
- Si la API `firestore.googleapis.com` no está habilitada en el proyecto, el request fallará.

REQUISITOS
- Node.js 18+
- Dependencias: `google-auth-library` y `node-fetch@2`

INSTALACIÓN
```powershell
npm install google-auth-library node-fetch@2
```

USO
Asegúrate de tener en la raíz del repo un `.env` con la variable `SERVICE_ACCOUNT` conteniendo la JSON (como ya tienes). Luego:

```powershell
node scripts/create-firestore-indexes.js
```

Si obtienes errores 403, probablemente la service account no tiene permiso para crear índices o la API no está habilitada. En ese caso pide al administrador que ejecute el deploy desde su cuenta o habilite la API en el proyecto.
