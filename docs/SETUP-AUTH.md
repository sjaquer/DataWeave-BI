# Script de Configuración Rápida - Sistema de Autenticación

## Pasos de Configuración

### 1. Variables de Entorno
Asegúrate de tener estas variables en tu archivo `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=tu_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu_proyecto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

### 2. Habilitar Authentication en Firebase

```bash
# En la consola de Firebase:
1. Ve a Authentication
2. Haz clic en "Get Started"
3. Habilita "Email/Password"
4. Guarda los cambios
```

### 3. Crear Usuarios de Demostración

#### Opción A: Consola de Firebase (Recomendado para principiantes)

1. **Crear Usuario Gerente:**
  - Ve a Authentication → Users
  - Click "Add user"
  - Email: `<REDACTED_DEMO_EMAIL>`
  - Password: `<REDACTED_DEMO_PASSWORD>`
  - Copia el UID generado

2. **Crear Documento de Perfil (Gerente):**
   - Ve a Firestore Database
   - Crea colección: `users`
   - ID del documento: [UID copiado del paso anterior]
   - Campos:
     ```
  uid: [mismo UID]
  email: "<REDACTED_DEMO_EMAIL>"
     role: "gerente"
     displayName: "Gerente Principal"
     createdAt: [Click en "Use server timestamp"]
     ```

3. **Repetir para Usuario Empleado:**
  - Email: `<REDACTED_DEMO_EMAIL_2>`
  - Password: `<REDACTED_DEMO_PASSWORD_2>`
  - role: `"empleado"`
  - displayName: `"Empleado de Ventas"`

#### Opción B: Script Node.js (Avanzado)

Crea un archivo `scripts/create-demo-users.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function createDemoUsers() {
  // Usuario Gerente
  try {
    const gerenteUser = await admin.auth().createUser({
      email: '<REDACTED_DEMO_EMAIL>',
      password: '<REDACTED_DEMO_PASSWORD>',
      displayName: 'Gerente Principal',
    });

    await admin.firestore().collection('users').doc(gerenteUser.uid).set({
      uid: gerenteUser.uid,
      email: '<REDACTED_DEMO_EMAIL>',
      role: 'gerente',
      displayName: 'Gerente Principal',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Usuario gerente creado:', gerenteUser.uid);
  } catch (error) {
    console.error('❌ Error al crear gerente:', error.message);
  }

  // Usuario Empleado
  try {
    const empleadoUser = await admin.auth().createUser({
      email: '<REDACTED_DEMO_EMAIL_2>',
      password: '<REDACTED_DEMO_PASSWORD_2>',
      displayName: 'Empleado de Ventas',
    });

    await admin.firestore().collection('users').doc(empleadoUser.uid).set({
      uid: empleadoUser.uid,
      email: '<REDACTED_DEMO_EMAIL_2>',
      role: 'empleado',
      displayName: 'Empleado de Ventas',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Usuario empleado creado:', empleadoUser.uid);
  } catch (error) {
    console.error('❌ Error al crear empleado:', error.message);
  }

  process.exit(0);
}

createDemoUsers();
```

Ejecutar:
```bash
node scripts/create-demo-users.js
```

### 4. Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

### 5. Verificar la Instalación

1. **Iniciar el servidor de desarrollo:**
   ```bash
   npm run dev
   ```

2. **Probar el login:**
   - Navega a `http://localhost:9002`
   - Deberías ser redirigido a `/login`
   - Intenta iniciar sesión con:
    - Email: `<REDACTED_DEMO_EMAIL>`
    - Password: `<REDACTED_DEMO_PASSWORD>`

3. **Verificar el menú:**
   - Como gerente, deberías ver todas las secciones
   - Cierra sesión
   - Inicia sesión como empleado
   - Deberías ver menos secciones en el menú

4. **Probar la página de Envíos:**
   - Ve a `/dashboard/shipments`
   - Deberías ver gráficos y tablas de envíos

## Checklist de Verificación

### Configuración de Firebase:
- [ ] Firebase Authentication habilitado
- [ ] Proveedor Email/Password activado
- [ ] Variables de entorno configuradas

### Usuarios:
- [ ] Usuario gerente creado en Authentication
- [ ] Documento de perfil gerente en Firestore
- [ ] Usuario empleado creado en Authentication
- [ ] Documento de perfil empleado en Firestore

### Reglas de Firestore:
- [ ] Reglas desplegadas correctamente
- [ ] Colección `users` protegida
- [ ] Colección `shopify_orders` accesible para autenticados

### Pruebas:
- [ ] Login como gerente funciona
- [ ] Login como empleado funciona
- [ ] Menú se filtra según el rol
- [ ] Cierre de sesión funciona
- [ ] Redirección automática funciona
- [ ] Página de envíos muestra datos

## Solución de Problemas Comunes

### Error: "Firebase: Error (auth/user-not-found)"
**Solución:** El usuario no existe en Authentication. Créalo desde la consola.

### Error: "Missing or insufficient permissions"
**Solución:** Despliega las reglas de Firestore con `firebase deploy --only firestore:rules`

### El menú no se filtra por rol
**Solución:** Verifica que el documento en Firestore tenga el campo `role` con el valor correcto (`"gerente"` o `"empleado"`)

### Página en blanco después de login
**Solución:** 
1. Abre las DevTools (F12)
2. Revisa la consola para errores
3. Verifica que el documento del usuario exista en Firestore
4. Limpia el localStorage del navegador

### "Auth domain is not configured"
**Solución:** Verifica que `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` esté en `.env.local`

## Comandos Útiles

```bash
# Ver logs de Firebase
firebase functions:log

# Probar reglas de Firestore localmente
firebase emulators:start --only firestore

# Limpiar caché de Next.js
rm -rf .next

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

## Próximos Pasos

Una vez verificado que todo funciona:

1. **Personaliza los usuarios:**
   - Cambia las contraseñas de demostración
   - Agrega más usuarios según necesites

2. **Refina los permisos:**
   - Ajusta las reglas de Firestore según tus necesidades
   - Implementa roles más específicos

3. **Mejora la seguridad:**
   - Implementa recuperación de contraseña
   - Agrega validación de email
   - Considera 2FA para gerentes

4. **Expande funcionalidades:**
   - Agrega gestión de usuarios desde el dashboard
   - Implementa audit logs
   - Crea reportes personalizados por rol

---

**¡Todo listo! 🎉**

Si sigues estos pasos, tendrás un sistema de autenticación completo y funcional.
