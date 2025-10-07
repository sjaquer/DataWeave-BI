# Reglas de Firestore para DataWeave BI

## 📋 Instrucciones

Copia las reglas de abajo y pégalas **directamente en la consola de Firebase**:

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto **DataWeave-BI**
3. Ve a **Firestore Database** en el menú lateral
4. Haz clic en la pestaña **"Reglas"** (Rules)
5. **Borra todo** el contenido actual
6. **Copia y pega** las reglas de abajo
7. Haz clic en **"Publicar"** (Publish)

---

## 🔒 Reglas de Seguridad

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reglas para la colección de usuarios
    match /users/{userId} {
      // Los usuarios solo pueden leer su propia información
      allow read: if request.auth != null && request.auth.uid == userId;
      // Los usuarios pueden actualizar su propia información
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para pedidos de Shopify
    match /shopify_orders/{orderId} {
      // Usuarios autenticados pueden leer todos los pedidos
      allow read: if request.auth != null;
      // Solo usuarios autenticados pueden escribir
      // (las operaciones del servidor usan Admin SDK y bypassean estas reglas)
      allow write: if request.auth != null;
    }
    
    // Reglas para movimientos de inventario
    match /inventory_movements/{movementId} {
      // Usuarios autenticados pueden leer todos los movimientos
      allow read: if request.auth != null;
      // Solo usuarios autenticados pueden escribir
      allow write: if request.auth != null;
    }

    // Regla de respaldo para cualquier otro documento
    // Por defecto, denegar todo para mayor seguridad
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## ✅ Verificación

Después de publicar las reglas, verifica que funcionan:

1. **Sin errores:** No debe haber errores de sintaxis en la consola
2. **Simulador:** Usa el simulador de reglas en Firebase Console
   - Tipo: `get` (lectura)
   - Ubicación: `/shopify_orders/test-order-1`
   - Autenticación: Simulada (marca el checkbox)
   - Resultado esperado: ✅ **Permitido**

3. **Prueba real:**
   - Inicia sesión en tu aplicación
   - Ve al dashboard
   - Si ves datos, las reglas funcionan correctamente

---

## 📝 Explicación de las Reglas

### Colección `users`:
- **Lectura:** Solo el propio usuario puede leer su información
- **Escritura:** Solo el propio usuario puede modificar su información
- Esto protege la privacidad de los datos de usuario

### Colección `shopify_orders`:
- **Lectura:** Cualquier usuario autenticado puede leer pedidos
- **Escritura:** Cualquier usuario autenticado puede escribir
- Los webhooks usan Firebase Admin SDK (no afectado por estas reglas)

### Colección `inventory_movements`:
- **Lectura:** Cualquier usuario autenticado puede leer movimientos
- **Escritura:** Cualquier usuario autenticado puede escribir

### Regla por defecto:
- **Todo lo demás:** DENEGADO
- Esto asegura que cualquier nueva colección esté protegida por defecto

---

## 🔧 Reglas Más Restrictivas (Opcional)

Si quieres que **solo los gerentes** puedan escribir en pedidos, usa estas reglas en su lugar:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función helper para verificar si el usuario es gerente
    function isManager() {
      return request.auth != null && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'gerente';
    }
    
    // Reglas para la colección de usuarios
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reglas para pedidos de Shopify (solo gerentes escriben)
    match /shopify_orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if isManager();
    }
    
    // Reglas para movimientos de inventario (solo gerentes escriben)
    match /inventory_movements/{movementId} {
      allow read: if request.auth != null;
      allow write: if isManager();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

⚠️ **Nota:** Estas reglas más restrictivas pueden causar problemas si los empleados necesitan actualizar datos. Úsalas solo si estás seguro.

---

## 🐛 Solución de Problemas

### Error: "Missing or insufficient permissions"
**Causa:** Las reglas no están publicadas o el usuario no está autenticado  
**Solución:** 
1. Verifica que las reglas estén publicadas
2. Cierra sesión y vuelve a iniciar en la app
3. Limpia el caché del navegador

### Error: "Firestore rules syntax error"
**Causa:** Error de sintaxis al copiar las reglas  
**Solución:**
1. Copia TODO el bloque de código
2. No modifiques nada
3. Asegúrate de no tener espacios extra o caracteres raros

### Los datos no cargan
**Causa:** El usuario no está autenticado  
**Solución:**
1. Verifica que Firebase Authentication esté habilitado
2. Asegúrate de haber iniciado sesión correctamente
3. Revisa la consola del navegador (F12) para errores

---

## 📞 Ayuda Adicional

Si tienes problemas:
1. Revisa los logs en Firebase Console → Firestore → "Uso"
2. Usa el simulador de reglas en la consola
3. Verifica que el usuario tenga un token de autenticación válido

---

**¡Listo! Copia las reglas de arriba y pégalas en la consola de Firebase.** 🚀
