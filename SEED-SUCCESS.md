# ✅ SEED COMPLETADO - Ahora Restaura las Reglas de Seguridad

## 🎉 ¡Los usuarios fueron creados exitosamente!

Verifica en [Firebase Console](https://console.firebase.google.com/) → Firestore Database → users

Deberías ver 4 documentos:
- `5Re9sPT47DR6bbjntLL9LpKKjn13` - gerencia@dataweave.com (gerente)
- `n3UuVRSz8LaISnEbJLLy7Yk8HNU2` - encargado@dataweave.com (encargado)
- `fzQs2Ev1NEReM6YY4JYMZuytumz2` - callcenter@dataweave.com (callcenter)
- `asA3k52QlMPWr9v6ZjTQON98BB52` - marketing@dataweave.com (marketing)

---

## 🔒 IMPORTANTE: Restaurar Reglas de Producción

**AHORA MISMO** debes restaurar las reglas de seguridad:

1. Ve a Firebase Console → Firestore Database → Reglas
2. **Borra todo** el contenido actual (reglas temporales)
3. **Copia y pega** las reglas de producción de abajo
4. Haz clic en **Publicar**

---

## 📝 Reglas de Producción (COPIAR ESTO)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función helper para obtener el rol del usuario
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Función para verificar si el usuario es gerente
    function isGerente() {
      return request.auth != null && getUserRole() == 'gerente';
    }
    
    // Función para verificar si el usuario es encargado (logística)
    function isEncargado() {
      return request.auth != null && getUserRole() == 'encargado';
    }
    
    // Función para verificar si el usuario es callcenter
    function isCallCenter() {
      return request.auth != null && getUserRole() == 'callcenter';
    }
    
    // Función para verificar si el usuario es marketing
    function isMarketing() {
      return request.auth != null && getUserRole() == 'marketing';
    }
    
    // Reglas para la colección de usuarios
    match /users/{userId} {
      // Los usuarios solo pueden leer su propia información
      allow read: if request.auth != null && request.auth.uid == userId;
      // Los usuarios pueden actualizar su propia información (excepto el rol)
      allow update: if request.auth != null && 
                       request.auth.uid == userId &&
                       request.resource.data.role == resource.data.role;
      // Solo gerentes pueden crear nuevos usuarios
      allow create: if isGerente();
      // Los usuarios no pueden eliminarse a sí mismos
      allow delete: if false;
    }
    
    // Reglas para pedidos de Shopify
    match /shopify_orders/{orderId} {
      // Lectura según rol:
      // - Gerente: todos los pedidos
      // - Encargado: todos los pedidos (logística)
      // - CallCenter: todos los pedidos (atención al cliente)
      // - Marketing: solo pedidos confirmados (análisis de productos)
      allow read: if request.auth != null && 
                     (isGerente() || isEncargado() || isCallCenter() || 
                      (isMarketing() && resource.data.isConfirmed == true));
      
      // Escritura solo para gerente y encargado (logística)
      allow write: if request.auth != null && (isGerente() || isEncargado());
    }
    
    // Reglas para movimientos de inventario
    match /inventory_movements/{movementId} {
      // Lectura para roles con acceso a inventario
      allow read: if request.auth != null && 
                     (isGerente() || isEncargado() || isMarketing());
      
      // Escritura solo para gerente y encargado (gestión de inventario)
      allow write: if request.auth != null && (isGerente() || isEncargado());
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

## ✅ Prueba el Sistema

Ahora inicia sesión con cada usuario para verificar que funcione correctamente:

### Credenciales de Prueba:

1. **Gerente** (acceso total)
   - Email: `gerencia@dataweave.com`
   - Ve 9 secciones del dashboard

2. **Encargado** (logística)
   - Email: `encargado@dataweave.com`
   - Ve 5 secciones: Dashboard, Envíos, Provincias, Análisis Inventario, Estado Inventario

3. **Call Center** (clientes)
   - Email: `callcenter@dataweave.com`
   - Ve 2 secciones: Dashboard, Provincias

4. **Marketing** (productos y campañas)
   - Email: `marketing@dataweave.com`
   - Ve 4 secciones: Dashboard, Campañas Meta, Análisis Diario, Estado Inventario

---

## 🚀 Próximos Pasos

1. ✅ Restaurar reglas de seguridad (hazlo ahora)
2. Iniciar sesión con cada usuario para probar
3. Verificar que solo vean las secciones permitidas
4. Desplegar a Vercel con `npm run build` local y luego push a Git

---

**¡Sistema de autenticación con 4 roles completamente configurado!** 🎉
