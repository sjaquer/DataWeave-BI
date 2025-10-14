---
Date: 2025-10-07
---

# âœ… SEED COMPLETADO - Ahora Restaura las Reglas de Seguridad

## ðŸŽ‰ Â¡Los usuarios fueron creados exitosamente!

Verifica en [Firebase Console](https://console.firebase.google.com/) â†’ Firestore Database â†’ users

DeberÃ­as ver 4 documentos:
- `5Re9sPT47DR6bbjntLL9LpKKjn13` - gerencia@dataweave.com (gerente)
- `n3UuVRSz8LaISnEbJLLy7Yk8HNU2` - encargado@dataweave.com (encargado)
- `fzQs2Ev1NEReM6YY4JYMZuytumz2` - callcenter@dataweave.com (callcenter)
- `asA3k52QlMPWr9v6ZjTQON98BB52` - marketing@dataweave.com (marketing)

---

## ðŸ”’ IMPORTANTE: Restaurar Reglas de ProducciÃ³n

**AHORA MISMO** debes restaurar las reglas de seguridad:

1. Ve a Firebase Console â†’ Firestore Database â†’ Reglas
2. **Borra todo** el contenido actual (reglas temporales)
3. **Copia y pega** las reglas de producciÃ³n de abajo
4. Haz clic en **Publicar**

---

## ðŸ“ Reglas de ProducciÃ³n (COPIAR ESTO)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // FunciÃ³n helper para obtener el rol del usuario
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // FunciÃ³n para verificar si el usuario es gerente
    function isGerente() {
      return request.auth != null && getUserRole() == 'gerente';
    }
    
    // FunciÃ³n para verificar si el usuario es encargado (logÃ­stica)
    function isEncargado() {
      return request.auth != null && getUserRole() == 'encargado';
    }
    
    // FunciÃ³n para verificar si el usuario es callcenter
    function isCallCenter() {
      return request.auth != null && getUserRole() == 'callcenter';
    }
    
    // FunciÃ³n para verificar si el usuario es marketing
    function isMarketing() {
      return request.auth != null && getUserRole() == 'marketing';
    }
    
    // Reglas para la colecciÃ³n de usuarios
    match /users/{userId} {
      // Los usuarios solo pueden leer su propia informaciÃ³n
      allow read: if request.auth != null && request.auth.uid == userId;
      // Los usuarios pueden actualizar su propia informaciÃ³n (excepto el rol)
      allow update: if request.auth != null && 
                       request.auth.uid == userId &&
                       request.resource.data.role == resource.data.role;
      // Solo gerentes pueden crear nuevos usuarios
      allow create: if isGerente();
      // Los usuarios no pueden eliminarse a sÃ­ mismos
      allow delete: if false;
    }
    
    // Reglas para pedidos de Shopify
    match /shopify_orders/{orderId} {
      // Lectura segÃºn rol:
      // - Gerente: todos los pedidos
      // - Encargado: todos los pedidos (logÃ­stica)
      // - CallCenter: todos los pedidos (atenciÃ³n al cliente)
      // - Marketing: solo pedidos confirmados (anÃ¡lisis de productos)
      allow read: if request.auth != null && 
                     (isGerente() || isEncargado() || isCallCenter() || 
                      (isMarketing() && resource.data.isConfirmed == true));
      
      // Escritura solo para gerente y encargado (logÃ­stica)
      allow write: if request.auth != null && (isGerente() || isEncargado());
    }
    
    // Reglas para movimientos de inventario
    match /inventory_movements/{movementId} {
      // Lectura para roles con acceso a inventario
      allow read: if request.auth != null && 
                     (isGerente() || isEncargado() || isMarketing());
      
      // Escritura solo para gerente y encargado (gestiÃ³n de inventario)
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

## âœ… Prueba el Sistema

Ahora inicia sesiÃ³n con cada usuario para verificar que funcione correctamente:

### Credenciales de Prueba:

1. **Gerente** (acceso total)
   - Email: `gerencia@dataweave.com`
   - Ve 9 secciones del dashboard

2. **Encargado** (logÃ­stica)
   - Email: `encargado@dataweave.com`
   - Ve 5 secciones: Dashboard, EnvÃ­os, Provincias, AnÃ¡lisis Inventario, Estado Inventario

3. **Call Center** (clientes)
   - Email: `callcenter@dataweave.com`
   - Ve 2 secciones: Dashboard, Provincias

4. **Marketing** (productos y campaÃ±as)
   - Email: `marketing@dataweave.com`
   - Ve 4 secciones: Dashboard, CampaÃ±as Meta, AnÃ¡lisis Diario, Estado Inventario

---

## ðŸš€ PrÃ³ximos Pasos

1. âœ… Restaurar reglas de seguridad (hazlo ahora)
2. Iniciar sesiÃ³n con cada usuario para probar
3. Verificar que solo vean las secciones permitidas
4. Desplegar a Vercel con `npm run build` local y luego push a Git

---

**Â¡Sistema de autenticaciÃ³n con 4 roles completamente configurado!** ðŸŽ‰

