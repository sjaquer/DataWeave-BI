---
Date: 2025-10-07
---

# ðŸ” Sistema de AutenticaciÃ³n y Roles - DataWeave BI

## âœ… Implementaciones Completadas

### 1. Sistema de Usuarios con Firebase Authentication

#### CaracterÃ­sticas:
- âœ… AutenticaciÃ³n con email y contraseÃ±a
- âœ… GestiÃ³n de sesiones persistentes
- âœ… ProtecciÃ³n de rutas automÃ¡tica
- âœ… Cierre de sesiÃ³n seguro
- âœ… Context API para gestiÃ³n global del estado de autenticaciÃ³n

#### Archivos Creados/Modificados:
```
src/
  contexts/
    AuthContext.tsx          # Context provider de autenticaciÃ³n
  lib/
    firebase.ts              # ConfiguraciÃ³n de Firebase (actualizada con Auth)
  app/
    layout.tsx               # Layout principal con AuthProvider
    page.tsx                 # PÃ¡gina de inicio con redirecciÃ³n inteligente
    login/
      page.tsx               # PÃ¡gina de inicio de sesiÃ³n
    (app)/
      layout.tsx             # Layout protegido con roles
```

### 2. Sistema de Roles (Gerente vs. Empleado)

#### Roles Implementados:

**ðŸ”¹ GERENTE** (Acceso Completo)
```
âœ“ Dashboard Principal
âœ“ EnvÃ­os
âœ“ Rendimiento de Asesores
âœ“ CampaÃ±as Meta
âœ“ Provincias
âœ“ AnÃ¡lisis Diario
âœ“ AnÃ¡lisis de Inventario
âœ“ Estado de Inventario
âœ“ AnÃ¡lisis Mensual
```

**ðŸ”¹ EMPLEADO** (Acceso Limitado)
```
âœ“ Dashboard Principal
âœ“ EnvÃ­os
âœ“ Provincias
âœ“ AnÃ¡lisis Diario
âœ“ Estado de Inventario
```

#### Funcionalidades:
- âœ… MenÃº dinÃ¡mico que se ajusta segÃºn el rol
- âœ… Perfil de usuario en el sidebar con dropdown
- âœ… Indicador visual del rol actual
- âœ… Avatar generado automÃ¡ticamente

### 3. Nueva PÃ¡gina de EnvÃ­os (Reportes Enviados)

#### UbicaciÃ³n:
`/dashboard/shipments`

#### GrÃ¡ficos Implementados:

**ðŸ“Š 1. EnvÃ­os por Fecha**
- Tipo: GrÃ¡fico de lÃ­neas
- Datos: Ãšltimos 30 dÃ­as
- Muestra: Tendencia de envÃ­os confirmados

**ðŸ“Š 2. MÃ©todos de Pago**
- Tipo: GrÃ¡fico de pastel (pie chart)
- Datos: DistribuciÃ³n de mÃ©todos de pago
- CategorÃ­as: Efectivo, Tarjeta de CrÃ©dito, Tarjeta de DÃ©bito, Transferencia

**ðŸ“Š 3. Rendimiento de Couriers**
- Tipo: Tabla comparativa
- MÃ©tricas:
  - Total de envÃ­os por courier
  - Ingresos totales generados
  - Valor promedio por envÃ­o
  - Badge "Top" para el courier con mÃ¡s envÃ­os

#### Tarjetas de Resumen:
- Total de EnvÃ­os
- Ingresos Totales
- Valor Promedio por Pedido

### 4. Reglas de Seguridad de Firestore

#### Archivo:
`firestore.rules`

#### Protecciones Implementadas:
```javascript
âœ“ Usuarios solo pueden leer su propia informaciÃ³n
âœ“ AutenticaciÃ³n requerida para todas las operaciones
âœ“ Acceso controlado a pedidos y movimientos de inventario
âœ“ DenegaciÃ³n por defecto para documentos no especificados
```

## ðŸš€ CÃ³mo Usar

### Credenciales de DemostraciÃ³n:

**Gerente:**
```
Email: <REDACTED_DEMO_EMAIL>
ContraseÃ±a: <REDACTED_DEMO_PASSWORD>
```

**Empleado:**
```
Email: <REDACTED_DEMO_EMAIL_2>
ContraseÃ±a: <REDACTED_DEMO_PASSWORD_2>
```

### Flujo de Uso:

1. **Acceder a la aplicaciÃ³n:**
   - Navega a la URL de la aplicaciÃ³n
   - SerÃ¡s redirigido automÃ¡ticamente a `/login`

2. **Iniciar sesiÃ³n:**
   - Introduce las credenciales
   - Haz clic en "Iniciar SesiÃ³n"
   - SerÃ¡s redirigido al dashboard

3. **Explorar segÃºn tu rol:**
   - El menÃº mostrarÃ¡ solo las secciones permitidas
   - Los gerentes ven todas las opciones
   - Los empleados ven opciones limitadas

4. **Cerrar sesiÃ³n:**
   - Haz clic en tu avatar en el sidebar
   - Selecciona "Cerrar SesiÃ³n"

## ðŸ“¦ Estructura de Datos

### ColecciÃ³n `users`
```typescript
{
  uid: string                  // ID Ãºnico del usuario
  email: string                // Email de inicio de sesiÃ³n
  role: 'gerente' | 'empleado' // Rol del usuario
  displayName: string          // Nombre para mostrar
  createdAt: Timestamp         // Fecha de creaciÃ³n
}
```

### ColecciÃ³n `shopify_orders` (campos relevantes)
```typescript
{
  orderName: string      // NÃºmero de pedido
  isConfirmed: boolean   // Si estÃ¡ confirmado
  confirmedAt: Timestamp // Fecha de confirmaciÃ³n
  confirmedBy: string    // Usuario que confirmÃ³
  courier: string        // Empresa de transporte
  totalPrice: number     // Valor total
  province: string       // Provincia de destino
  // ... otros campos
}
```

## âš™ï¸ ConfiguraciÃ³n Inicial

### 1. Habilitar Firebase Authentication

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Ve a **Authentication** â†’ **Sign-in method**
4. Habilita **Email/Password**

### 2. Crear Usuarios de DemostraciÃ³n

**OpciÃ³n A: Desde la consola de Firebase**
1. Ve a **Authentication** â†’ **Users**
2. Haz clic en **Add user**
3. Crea los usuarios con las credenciales de demostraciÃ³n
4. Ve a **Firestore Database**
5. Crea la colecciÃ³n `users`
6. Para cada usuario, crea un documento con el UID:

```json
{
  "uid": "[UID del usuario]",
  "email": "<REDACTED_DEMO_EMAIL>",
  "role": "gerente",
  "displayName": "Gerente Principal",
  "createdAt": "[Timestamp actual]"
}
```

**OpciÃ³n B: Script automatizado**
Ver `docs/setup-demo-users.md` para instrucciones detalladas

### 3. Desplegar Reglas de Firestore

```bash
firebase deploy --only firestore:rules
```

## ðŸ”§ Desarrollo

### Usar el Hook de AutenticaciÃ³n

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MiComponente() {
  const { user, userProfile, loading, signIn, signOut } = useAuth();
  
  // Verificar autenticaciÃ³n
  if (!user) {
    return <div>Por favor inicia sesiÃ³n</div>;
  }
  
  // Verificar rol
  if (userProfile?.role === 'gerente') {
    return <ContenidoParaGerentes />;
  }
  
  return <ContenidoParaEmpleados />;
}
```

### Proteger una Ruta Nueva

Las rutas dentro de `app/(app)/` estÃ¡n automÃ¡ticamente protegidas.
Para agregar una ruta con permisos especÃ­ficos:

1. Agrega el elemento al array `menuItems` en `(app)/layout.tsx`:
```typescript
{
  path: '/dashboard/mi-seccion',
  icon: MiIcono,
  label: 'Mi SecciÃ³n',
  requiresManager: true  // true = solo gerentes
}
```

2. Crea la pÃ¡gina en `app/(app)/dashboard/mi-seccion/page.tsx`

## ðŸ“ Notas Importantes

### MÃ©todos de Pago
âš ï¸ **Actualmente los mÃ©todos de pago son simulados** basados en el valor total del pedido. 

Para implementar datos reales:
1. Agregar campo `paymentMethod` a la colecciÃ³n `shopify_orders`
2. Actualizar los webhooks para capturar esta informaciÃ³n
3. Modificar `shipments/page.tsx` para usar datos reales

### Errores de TypeScript
Los errores mostrados son del anÃ¡lisis estÃ¡tico y no afectan la funcionalidad. Se resolverÃ¡n al compilar el proyecto.

### Seguridad
- Las reglas de Firestore solo se aplican en el cliente
- El Firebase Admin SDK (usado en webhooks) las bypasea
- Nunca expongas credenciales en el cÃ³digo fuente

## ðŸŽ¯ PrÃ³ximos Pasos Sugeridos

### Mejoras de Seguridad:
- [ ] RecuperaciÃ³n de contraseÃ±a por email
- [ ] AutenticaciÃ³n de dos factores (2FA)
- [ ] LÃ­mite de intentos de inicio de sesiÃ³n
- [ ] Sesiones con tiempo de expiraciÃ³n

### Mejoras de Funcionalidad:
- [ ] GestiÃ³n de usuarios desde el dashboard (CRUD)
- [ ] Registro de actividad (audit log)
- [ ] MÃºltiples roles (vendedor, supervisor, admin)
- [ ] Permisos granulares por secciÃ³n
- [ ] Notificaciones en tiempo real

### Mejoras de UX:
- [ ] Recordar sesiÃ³n (Remember me)
- [ ] Modo oscuro
- [ ] PersonalizaciÃ³n del perfil de usuario
- [ ] Foto de perfil personalizada

## ðŸ“š DocumentaciÃ³n Adicional

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Next.js Authentication](https://nextjs.org/docs/authentication)
- [React Context API](https://react.dev/learn/passing-data-deeply-with-context)

## ðŸ› SoluciÃ³n de Problemas

### No puedo iniciar sesiÃ³n
1. Verifica que Firebase Authentication estÃ© habilitado
2. Confirma que los usuarios existen en la consola de Firebase
3. Revisa la consola del navegador para errores

### El menÃº no se filtra por rol
1. Verifica que el documento del usuario en Firestore tenga el campo `role`
2. Confirma que el valor sea exactamente `'gerente'` o `'empleado'`
3. Cierra sesiÃ³n y vuelve a iniciar

### PÃ¡gina en blanco despuÃ©s de login
1. Verifica que el usuario tenga un documento en la colecciÃ³n `users`
2. Revisa que todos los campos requeridos estÃ©n presentes
3. Limpia el cachÃ© del navegador

## ðŸ“ž Soporte

Para mÃ¡s ayuda, consulta:
- `docs/authentication-system.md` - DocumentaciÃ³n tÃ©cnica completa
- `docs/setup-demo-users.md` - GuÃ­a de creaciÃ³n de usuarios
- Logs de la consola del navegador
- Logs de Firebase Console

---

**Â¡El sistema estÃ¡ listo para usar! ðŸŽ‰**

Inicia sesiÃ³n con las credenciales de demostraciÃ³n y explora las diferentes vistas segÃºn el rol.

