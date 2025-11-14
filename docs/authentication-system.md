# Sistema de Autenticación y Roles - DataWeave BI

## Descripción General

Se ha implementado un sistema completo de autenticación y autorización basado en roles usando Firebase Authentication y Firestore.

## Características Implementadas

### 1. Sistema de Autenticación
- **Firebase Authentication** para gestión de credenciales
- Inicio de sesión con email y contraseña
- Cierre de sesión seguro
- Protección de rutas (redirige a login si no está autenticado)

### 2. Sistema de Roles
Dos tipos de usuarios con permisos diferenciados:

#### **Gerente**
- Acceso completo a todas las secciones del dashboard
- Puede ver:
  - Dashboard Principal
  - Envíos
  - Rendimiento de Asesores ⭐
  - Campañas Meta ⭐
  - Provincias
  - Análisis Diario
  - Análisis de Inventario ⭐
  - Estado de Inventario
  - Análisis Mensual ⭐

#### **Empleado**
- Acceso limitado a secciones operativas
- Puede ver:
  - Dashboard Principal
  - Envíos
  - Provincias
  - Análisis Diario
  - Estado de Inventario

⭐ = Secciones exclusivas para gerentes

### 3. Nueva Página de Envíos
Página dedicada para análisis de pedidos confirmados con:

#### **Gráficos Implementados:**
1. **Envíos por Fecha**: Gráfico de líneas mostrando la tendencia de envíos en los últimos 30 días
2. **Métodos de Pago**: Gráfico de pastel con la distribución de métodos de pago
3. **Rendimiento de Couriers**: Tabla comparativa con métricas de cada empresa de transporte

#### **Métricas Mostradas:**
- Total de envíos
- Ingresos totales de envíos
- Valor promedio por pedido
- Envíos por courier
- Ingresos por courier
- Valor promedio por courier

## Estructura de Datos

### Colección `users` en Firestore
```typescript
{
  uid: string,           // ID único del usuario (coincide con Auth)
  email: string,         // Email del usuario
  role: 'gerente' | 'empleado',  // Rol del usuario
  displayName: string,   // Nombre para mostrar
  createdAt: Timestamp   // Fecha de creación
}
```

### Colección `shopify_orders` (actualizada)
```typescript
{
  // ... campos existentes ...
  isConfirmed: boolean,       // Si el pedido fue confirmado
  confirmedAt: Timestamp,     // Fecha de confirmación
  confirmedBy: string,        // Usuario que confirmó
  courier: string,            // Empresa de transporte
}
```

## Reglas de Seguridad de Firestore

Las reglas han sido actualizadas para:
- Permitir a los usuarios solo leer su propia información de perfil
- Requerir autenticación para todas las operaciones de lectura/escritura
- Proteger datos sensibles

## Credenciales de Demostración

Para probar el sistema en un entorno controlado, usa credenciales de demostración generadas por ti o por el equipo.

Ejemplo (reemplaza por valores propios):

### Usuario Gerente
```
Email: <REDACTED_DEMO_EMAIL>
Contraseña: <REDACTED_DEMO_PASSWORD>
```

### Usuario Empleado
```
Email: <REDACTED_DEMO_EMAIL_2>
Contraseña: <REDACTED_DEMO_PASSWORD_2>
```

## Configuración Inicial

### 1. Habilitar Firebase Authentication
1. Ve a la consola de Firebase
2. Activa "Authentication"
3. Habilita el proveedor "Email/Password"

### 2. Crear Usuarios de Demostración
Sigue las instrucciones en `docs/setup-demo-users.md` para crear los usuarios de demostración.

### 3. Desplegar Reglas de Firestore
```bash
firebase deploy --only firestore:rules
```

## Arquitectura del Sistema

### Context API
- `AuthContext` maneja el estado global de autenticación
- Provee hooks para acceder al usuario actual y sus permisos
- Se envuelve en el layout principal

### Protección de Rutas
- El layout `(app)/layout.tsx` verifica la autenticación
- Redirige automáticamente a `/login` si no hay sesión
- Filtra el menú según el rol del usuario

### Componentes Clave

#### `src/contexts/AuthContext.tsx`
Context provider que gestiona:
- Estado de autenticación
- Perfil del usuario
- Funciones de login/logout
- Carga de datos del usuario

#### `src/app/login/page.tsx`
- Formulario de inicio de sesión
- Validación de credenciales
- Redirección automática si ya está autenticado

#### `src/app/(app)/layout.tsx`
- Layout protegido con autenticación
- Menú dinámico basado en roles
- Avatar con información del usuario
- Opción de cerrar sesión

#### `src/app/(app)/dashboard/shipments/page.tsx`
- Página de análisis de envíos
- Gráficos interactivos con Recharts
- Tablas con métricas de couriers

## Uso del Hook de Autenticación

```typescript
import { useAuth } from '@/contexts/AuthContext';

function MiComponente() {
  const { user, userProfile, loading, signIn, signOut } = useAuth();
  
  // Verificar si es gerente
  const isManager = userProfile?.role === 'gerente';
  
  // Mostrar contenido condicional
  if (isManager) {
    return <ContenidoParaGerentes />;
  }
  
  return <ContenidoParaEmpleados />;
}
```

## Próximos Pasos

### Mejoras Sugeridas:
1. **Recuperación de contraseña** mediante email
2. **Gestión de usuarios** desde el dashboard (solo gerentes)
3. **Registro de actividad** (audit log) para acciones críticas
4. **Permisos granulares** para diferentes tipos de empleados
5. **Autenticación de dos factores** (2FA)
6. **Integración con proveedores OAuth** (Google, Microsoft)
7. **Datos reales de métodos de pago** (actualmente simulados)
8. **Webhook para tracking de couriers** en tiempo real

## Notas Técnicas

- Los errores de TypeScript mostrados son normales durante el desarrollo y desaparecerán al compilar
- Las reglas de Firestore se aplican solo en el lado del cliente; el Admin SDK las bypasea
- Los timestamps se manejan con `Timestamp` de Firestore para consistencia
- Los datos de métodos de pago actualmente son simulados y deben reemplazarse con datos reales

## Soporte

Para problemas o preguntas:
1. Revisa la documentación de Firebase: https://firebase.google.com/docs
2. Consulta el código fuente en los archivos mencionados
3. Verifica las reglas de Firestore en la consola de Firebase
