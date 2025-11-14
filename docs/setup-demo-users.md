# Script para crear usuarios de demostración en Firebase
# Este script debe ejecutarse manualmente usando el Firebase Admin SDK

## Instrucciones:

1. Ve a la consola de Firebase (https://console.firebase.google.com)
2. Selecciona tu proyecto DataWeave-BI
3. Ve a "Authentication" en el menú lateral
4. Haz clic en "Add user"

### Usuario Gerente:
- Email: <REDACTED_DEMO_EMAIL>
- Password: <REDACTED_DEMO_PASSWORD>
- Después de crear el usuario, ve a Firestore Database
- Crea una colección llamada "users"
- Agrega un documento con el ID del usuario (UID) que acabas de crear
- Campos del documento:
  ```
  uid: [UID del usuario]
  email: "<REDACTED_DEMO_EMAIL>"
  role: "gerente"
  displayName: "Gerente Principal"
  createdAt: [Timestamp actual]
  ```

### Usuario Empleado:
- Email: <REDACTED_DEMO_EMAIL_2>
- Password: <REDACTED_DEMO_PASSWORD_2>
- Después de crear el usuario, ve a Firestore Database
- En la colección "users", agrega otro documento con el ID del nuevo usuario
- Campos del documento:
  ```
  uid: [UID del usuario]
  email: "<REDACTED_DEMO_EMAIL_2>"
  role: "empleado"
  displayName: "Empleado de Ventas"
  createdAt: [Timestamp actual]
  ```

## Alternativa usando Firebase Admin SDK (Node.js):

Puedes ejecutar el siguiente script en Node.js si tienes configurado Firebase Admin:

```javascript
const admin = require('firebase-admin');

// Inicializar Firebase Admin (asegúrate de tener las credenciales)
admin.initializeApp();

async function createDemoUsers() {
  // Crear usuario gerente
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

    console.log('Usuario gerente creado:', gerenteUser.uid);
  } catch (error) {
    console.error('Error al crear gerente:', error);
  }

  // Crear usuario empleado
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

    console.log('Usuario empleado creado:', empleadoUser.uid);
  } catch (error) {
    console.error('Error al crear empleado:', error);
  }
}

createDemoUsers();
```
