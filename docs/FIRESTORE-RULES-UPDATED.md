# Reglas de Firestore - DataWeave BI (Actualizado)

Este archivo contiene las reglas de seguridad de Firestore actualizadas con los **4 roles del sistema**.

## 📋 Instrucciones de Despliegue

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto **DataWeave BI**
3. En el menú lateral, ve a **Firestore Database**
4. Haz clic en la pestaña **Reglas** (Rules)
5. **Borra todo** el contenido actual
6. **Copia y pega** el contenido completo de abajo
7. Haz clic en **Publicar** (Publish)

---

## 🔒 Reglas de Seguridad (Firestore Security Rules)

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

## 🎯 Resumen de Permisos por Rol

### 👔 **Gerente** (`gerente`)
**Acceso completo a todas las secciones**

**Usuario Demo:**
- Email: `gerencia@dataweave.com`
- UID: `5Re9sPT47DR6bbjntLL9LpKKjn13`

**Permisos en Firestore:**
- ✅ Leer/escribir todos los pedidos (`shopify_orders`)
- ✅ Leer/escribir movimientos de inventario (`inventory_movements`)
- ✅ Crear nuevos usuarios
- ✅ Leer su propio perfil

**Secciones del Dashboard:**
- ✓ Dashboard General
- ✓ Envíos
- ✓ Rendimiento
- ✓ Campañas Meta
- ✓ Provincias
- ✓ Análisis Diario
- ✓ Análisis Inventario
- ✓ Estado Inventario
- ✓ Análisis Mensual

---

### 📦 **Encargado de Logística** (`encargado`)
**Acceso a logística general**

**Usuario Demo:**
- Email: `encargado@dataweave.com`
- UID: `n3UuVRSz8LaISnEbJLLy7Yk8HNU2`

**Permisos en Firestore:**
- ✅ Leer/escribir todos los pedidos (`shopify_orders`)
- ✅ Leer/escribir movimientos de inventario (`inventory_movements`)
- ✅ Leer su propio perfil

**Secciones del Dashboard:**
- ✓ Dashboard General
- ✓ Envíos
- ✓ Provincias
- ✓ Análisis Inventario
- ✓ Estado Inventario

---

### 📞 **Call Center** (`callcenter`)
**Acceso a datos de clientes general**

**Usuario Demo:**
- Email: `callcenter@dataweave.com`
- UID: `fzQs2Ev1NEReM6YY4JYMZuytumz2`

**Permisos en Firestore:**
- ✅ Leer todos los pedidos (`shopify_orders`)
- ✅ Leer su propio perfil
- ❌ No puede escribir pedidos

**Secciones del Dashboard:**
- ✓ Dashboard General
- ✓ Provincias

---

### 📊 **Marketing** (`marketing`)
**Acceso a datos de productos y campañas**

**Usuario Demo:**
- Email: `marketing@dataweave.com`
- UID: `asA3k52QlMPWr9v6ZjTQON98BB52`

**Permisos en Firestore:**
- ✅ Leer pedidos confirmados (`shopify_orders` donde `isConfirmed == true`)
- ✅ Leer movimientos de inventario (`inventory_movements`)
- ✅ Leer su propio perfil
- ❌ No puede escribir pedidos ni inventario

**Secciones del Dashboard:**
- ✓ Dashboard General
- ✓ Campañas Meta
- ✓ Análisis Diario
- ✓ Estado Inventario

---

## 💰 Moneda del Sistema

**Todos los montos se manejan en Soles Peruanos (S/)**

El sistema muestra automáticamente el símbolo `S/` en:
- Gráficos de ventas
- Tablas de pedidos
- Análisis de rendimiento
- Reportes de campañas

---

## 🔧 Troubleshooting

### Error: "Missing or insufficient permissions"

**Causa:** El usuario no tiene permisos para la operación solicitada

**Solución:**
1. Verifica que el usuario tenga un documento en `users/{uid}` con el campo `role`
2. Revisa que el rol sea uno de: `gerente`, `encargado`, `callcenter`, `marketing`
3. Asegúrate de que las reglas estén publicadas correctamente
4. Limpia el caché del navegador y vuelve a iniciar sesión

### El usuario no puede ver ciertos datos

**Causa:** El rol del usuario no tiene permisos de lectura

**Solución:**
1. **Marketing** solo ve pedidos confirmados (`isConfirmed == true`)
2. **Call Center** no tiene acceso a movimientos de inventario
3. Verifica el rol del usuario en Firestore Console

### Error al intentar escribir datos

**Causa:** Solo gerente y encargado pueden modificar pedidos/inventario

**Solución:**
1. Los roles `callcenter` y `marketing` son de **solo lectura**
2. Si necesitan modificar datos, cambia su rol a `encargado` o `gerente`
3. Actualiza el documento del usuario en Firestore

---

## 📝 Notas Importantes

1. **Jerarquía de permisos:**
   - Gerente: Acceso total
   - Encargado: Logística (lectura/escritura)
   - Marketing: Productos y campañas (solo lectura de confirmados)
   - Call Center: Clientes (solo lectura)

2. **Usuarios no pueden:**
   - Cambiar su propio rol
   - Eliminarse a sí mismos
   - Crear otros usuarios (excepto gerente)

3. **Webhooks:**
   - Las operaciones desde webhooks usan Firebase Admin SDK
   - El Admin SDK **bypasea** estas reglas de seguridad
   - Los webhooks pueden escribir sin restricciones de rol

4. **Seguridad:**
   - Las reglas usan funciones helper para verificar roles dinámicamente
   - Cada lectura verifica el rol en tiempo real desde Firestore
   - La regla por defecto (`match /{document=**}`) niega todo acceso

---

## ✅ Pasos Siguientes

Después de copiar las reglas:

1. **Ejecuta el script de seed** para crear los usuarios:
   ```bash
   npx tsx scripts/seed-users-client.ts
   ```

2. **Prueba cada rol:**
   - Inicia sesión con cada usuario demo
   - Verifica que solo vea las secciones permitidas
   - Intenta modificar datos (solo gerente/encargado deberían poder)

3. **Despliega a producción:**
   - Configura las variables de entorno en Vercel
   - Despliega la aplicación
   - Verifica el funcionamiento end-to-end

---

**Última actualización**: 7 de octubre de 2025  
**Versión**: 2.0 (Sistema de 4 roles)
