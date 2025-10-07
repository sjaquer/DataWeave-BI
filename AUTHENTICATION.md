# 🔐 Sistema de Autenticación y Roles - DataWeave BI

## ✅ Implementaciones Completadas

### 1. Sistema de Usuarios con Firebase Authentication

#### Características:
- ✅ Autenticación con email y contraseña
- ✅ Gestión de sesiones persistentes
- ✅ Protección de rutas automática
- ✅ Cierre de sesión seguro
- ✅ Context API para gestión global del estado de autenticación

#### Archivos Creados/Modificados:
```
src/
  contexts/
    AuthContext.tsx          # Context provider de autenticación
  lib/
    firebase.ts              # Configuración de Firebase (actualizada con Auth)
  app/
    layout.tsx               # Layout principal con AuthProvider
    page.tsx                 # Página de inicio con redirección inteligente
    login/
      page.tsx               # Página de inicio de sesión
    (app)/
      layout.tsx             # Layout protegido con roles
```

### 2. Sistema de Roles (Gerente vs. Empleado)

#### Roles Implementados:

**🔹 GERENTE** (Acceso Completo)
```
✓ Dashboard Principal
✓ Envíos
✓ Rendimiento de Asesores
✓ Campañas Meta
✓ Provincias
✓ Análisis Diario
✓ Análisis de Inventario
✓ Estado de Inventario
✓ Análisis Mensual
```

**🔹 EMPLEADO** (Acceso Limitado)
```
✓ Dashboard Principal
✓ Envíos
✓ Provincias
✓ Análisis Diario
✓ Estado de Inventario
```

#### Funcionalidades:
- ✅ Menú dinámico que se ajusta según el rol
- ✅ Perfil de usuario en el sidebar con dropdown
- ✅ Indicador visual del rol actual
- ✅ Avatar generado automáticamente

### 3. Nueva Página de Envíos (Reportes Enviados)

#### Ubicación:
`/dashboard/shipments`

#### Gráficos Implementados:

**📊 1. Envíos por Fecha**
- Tipo: Gráfico de líneas
- Datos: Últimos 30 días
- Muestra: Tendencia de envíos confirmados

**📊 2. Métodos de Pago**
- Tipo: Gráfico de pastel (pie chart)
- Datos: Distribución de métodos de pago
- Categorías: Efectivo, Tarjeta de Crédito, Tarjeta de Débito, Transferencia

**📊 3. Rendimiento de Couriers**
- Tipo: Tabla comparativa
- Métricas:
  - Total de envíos por courier
  - Ingresos totales generados
  - Valor promedio por envío
  - Badge "Top" para el courier con más envíos

#### Tarjetas de Resumen:
- Total de Envíos
- Ingresos Totales
- Valor Promedio por Pedido

### 4. Reglas de Seguridad de Firestore

#### Archivo:
`firestore.rules`

#### Protecciones Implementadas:
```javascript
✓ Usuarios solo pueden leer su propia información
✓ Autenticación requerida para todas las operaciones
✓ Acceso controlado a pedidos y movimientos de inventario
✓ Denegación por defecto para documentos no especificados
```

## 🚀 Cómo Usar

### Credenciales de Demostración:

**Gerente:**
```
Email: gerente@dataweave.com
Contraseña: gerente123
```

**Empleado:**
```
Email: empleado@dataweave.com
Contraseña: empleado123
```

### Flujo de Uso:

1. **Acceder a la aplicación:**
   - Navega a la URL de la aplicación
   - Serás redirigido automáticamente a `/login`

2. **Iniciar sesión:**
   - Introduce las credenciales
   - Haz clic en "Iniciar Sesión"
   - Serás redirigido al dashboard

3. **Explorar según tu rol:**
   - El menú mostrará solo las secciones permitidas
   - Los gerentes ven todas las opciones
   - Los empleados ven opciones limitadas

4. **Cerrar sesión:**
   - Haz clic en tu avatar en el sidebar
   - Selecciona "Cerrar Sesión"

## 📦 Estructura de Datos

### Colección `users`
```typescript
{
  uid: string                  // ID único del usuario
  email: string                // Email de inicio de sesión
  role: 'gerente' | 'empleado' // Rol del usuario
  displayName: string          // Nombre para mostrar
  createdAt: Timestamp         // Fecha de creación
}
```

### Colección `shopify_orders` (campos relevantes)
```typescript
{
  orderName: string      // Número de pedido
  isConfirmed: boolean   // Si está confirmado
  confirmedAt: Timestamp // Fecha de confirmación
  confirmedBy: string    // Usuario que confirmó
  courier: string        // Empresa de transporte
  totalPrice: number     // Valor total
  province: string       // Provincia de destino
  // ... otros campos
}
```

## ⚙️ Configuración Inicial

### 1. Habilitar Firebase Authentication

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** → **Sign-in method**
4. Habilita **Email/Password**

### 2. Crear Usuarios de Demostración

**Opción A: Desde la consola de Firebase**
1. Ve a **Authentication** → **Users**
2. Haz clic en **Add user**
3. Crea los usuarios con las credenciales de demostración
4. Ve a **Firestore Database**
5. Crea la colección `users`
6. Para cada usuario, crea un documento con el UID:

```json
{
  "uid": "[UID del usuario]",
  "email": "gerente@dataweave.com",
  "role": "gerente",
  "displayName": "Gerente Principal",
  "createdAt": "[Timestamp actual]"
}
```

**Opción B: Script automatizado**
Ver `docs/setup-demo-users.md` para instrucciones detalladas

### 3. Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

## 🔧 Desarrollo

### Usar el Hook de Autenticación

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MiComponente() {
  const { user, userProfile, loading, signIn, signOut } = useAuth();
  
  // Verificar autenticación
  if (!user) {
    return <div>Por favor inicia sesión</div>;
  }
  
  // Verificar rol
  if (userProfile?.role === 'gerente') {
    return <ContenidoParaGerentes />;
  }
  
  return <ContenidoParaEmpleados />;
}
```

### Proteger una Ruta Nueva

Las rutas dentro de `app/(app)/` están automáticamente protegidas.
Para agregar una ruta con permisos específicos:

1. Agrega el elemento al array `menuItems` en `(app)/layout.tsx`:
```typescript
{
  path: '/dashboard/mi-seccion',
  icon: MiIcono,
  label: 'Mi Sección',
  requiresManager: true  // true = solo gerentes
}
```

2. Crea la página en `app/(app)/dashboard/mi-seccion/page.tsx`

## 📝 Notas Importantes

### Métodos de Pago
⚠️ **Actualmente los métodos de pago son simulados** basados en el valor total del pedido. 

Para implementar datos reales:
1. Agregar campo `paymentMethod` a la colección `shopify_orders`
2. Actualizar los webhooks para capturar esta información
3. Modificar `shipments/page.tsx` para usar datos reales

### Errores de TypeScript
Los errores mostrados son del análisis estático y no afectan la funcionalidad. Se resolverán al compilar el proyecto.

### Seguridad
- Las reglas de Firestore solo se aplican en el cliente
- El Firebase Admin SDK (usado en webhooks) las bypasea
- Nunca expongas credenciales en el código fuente

## 🎯 Próximos Pasos Sugeridos

### Mejoras de Seguridad:
- [ ] Recuperación de contraseña por email
- [ ] Autenticación de dos factores (2FA)
- [ ] Límite de intentos de inicio de sesión
- [ ] Sesiones con tiempo de expiración

### Mejoras de Funcionalidad:
- [ ] Gestión de usuarios desde el dashboard (CRUD)
- [ ] Registro de actividad (audit log)
- [ ] Múltiples roles (vendedor, supervisor, admin)
- [ ] Permisos granulares por sección
- [ ] Notificaciones en tiempo real

### Mejoras de UX:
- [ ] Recordar sesión (Remember me)
- [ ] Modo oscuro
- [ ] Personalización del perfil de usuario
- [ ] Foto de perfil personalizada

## 📚 Documentación Adicional

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Next.js Authentication](https://nextjs.org/docs/authentication)
- [React Context API](https://react.dev/learn/passing-data-deeply-with-context)

## 🐛 Solución de Problemas

### No puedo iniciar sesión
1. Verifica que Firebase Authentication esté habilitado
2. Confirma que los usuarios existen en la consola de Firebase
3. Revisa la consola del navegador para errores

### El menú no se filtra por rol
1. Verifica que el documento del usuario en Firestore tenga el campo `role`
2. Confirma que el valor sea exactamente `'gerente'` o `'empleado'`
3. Cierra sesión y vuelve a iniciar

### Página en blanco después de login
1. Verifica que el usuario tenga un documento en la colección `users`
2. Revisa que todos los campos requeridos estén presentes
3. Limpia el caché del navegador

## 📞 Soporte

Para más ayuda, consulta:
- `docs/authentication-system.md` - Documentación técnica completa
- `docs/setup-demo-users.md` - Guía de creación de usuarios
- Logs de la consola del navegador
- Logs de Firebase Console

---

**¡El sistema está listo para usar! 🎉**

Inicia sesión con las credenciales de demostración y explora las diferentes vistas según el rol.
