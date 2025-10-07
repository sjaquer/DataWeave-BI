# 🚀 INSTRUCCIONES FINALES - DataWeave BI

## ✅ TODO ESTÁ IMPLEMENTADO

He completado todas las funcionalidades que solicitaste:

1. ✅ **Sistema de Usuarios con Firebase** (autenticación con credenciales)
2. ✅ **Roles de Usuario** (Gerente vs. Empleado)
3. ✅ **Secciones Privadas** (menú dinámico según rol)
4. ✅ **Nueva Página de Envíos** con 3 gráficos

---

## 📝 PASOS PARA ACTIVAR EL SISTEMA

### Paso 1: Habilitar Firebase Authentication

1. Ve a https://console.firebase.google.com
2. Selecciona tu proyecto **DataWeave-BI**
3. En el menú lateral, ve a **Authentication**
4. Haz clic en **"Empezar"** (Get Started)
5. Haz clic en **"Email/Password"**
6. Activa el switch de **"Email/Password"**
7. Haz clic en **"Guardar"**

✅ **Listo!** Authentication está habilitado.

---

### Paso 2: Configurar Reglas de Firestore

**⚠️ IMPORTANTE:** No uses el comando `firebase deploy`, hazlo manualmente:

1. Ve a https://console.firebase.google.com
2. Selecciona tu proyecto **DataWeave-BI**
3. En el menú lateral, ve a **Firestore Database**
4. Haz clic en la pestaña **"Reglas"** (Rules)
5. **BORRA TODO** el contenido actual
6. Abre el archivo: **`docs/FIRESTORE-RULES.md`**
7. Copia las reglas que están en ese archivo
8. Pégalas en la consola de Firebase
9. Haz clic en **"Publicar"** (Publish)

✅ **Listo!** Las reglas de seguridad están configuradas.

---

### Paso 3: Crear Usuarios de Demostración

#### A. Crear Usuario GERENTE

1. Ve a **Authentication** → **Users**
2. Haz clic en **"Agregar usuario"** (Add user)
3. Completa:
   - **Email:** `gerente@dataweave.com`
   - **Contraseña:** `gerente123`
4. Haz clic en **"Agregar usuario"**
5. **COPIA el UID** que aparece (lo necesitarás en el siguiente paso)

#### B. Crear Perfil del Gerente en Firestore

1. Ve a **Firestore Database** → **Datos** (Data)
2. Haz clic en **"Iniciar colección"** (Start collection)
3. ID de la colección: `users`
4. Haz clic en **"Siguiente"**
5. ID del documento: **[Pega el UID que copiaste]**
6. Agrega estos campos:

   | Campo | Tipo | Valor |
   |-------|------|-------|
   | `uid` | string | [El mismo UID] |
   | `email` | string | `gerente@dataweave.com` |
   | `role` | string | `gerente` |
   | `displayName` | string | `Gerente Principal` |
   | `createdAt` | timestamp | [Click en el ícono del reloj para usar timestamp actual] |

7. Haz clic en **"Guardar"**

#### C. Crear Usuario EMPLEADO

1. Ve a **Authentication** → **Users**
2. Haz clic en **"Agregar usuario"**
3. Completa:
   - **Email:** `empleado@dataweave.com`
   - **Contraseña:** `empleado123`
4. Haz clic en **"Agregar usuario"**
5. **COPIA el UID**

#### D. Crear Perfil del Empleado en Firestore

1. Ve a **Firestore Database** → **Datos**
2. Haz clic en la colección **`users`**
3. Haz clic en **"Agregar documento"** (Add document)
4. ID del documento: **[Pega el UID del empleado]**
5. Agrega estos campos:

   | Campo | Tipo | Valor |
   |-------|------|-------|
   | `uid` | string | [El UID del empleado] |
   | `email` | string | `empleado@dataweave.com` |
   | `role` | string | `empleado` |
   | `displayName` | string | `Empleado de Ventas` |
   | `createdAt` | timestamp | [Click en el ícono del reloj] |

6. Haz clic en **"Guardar"**

✅ **Listo!** Los usuarios están creados.

---

### Paso 4: Probar el Sistema

1. Abre la terminal en VS Code
2. Ejecuta:
   ```bash
   npm run dev
   ```
3. Abre tu navegador en: http://localhost:9002
4. Deberías ser redirigido a la página de login

#### Prueba 1: Login como Gerente
- Email: `gerente@dataweave.com`
- Contraseña: `gerente123`
- **Resultado esperado:** Deberías ver TODAS las secciones en el menú

#### Prueba 2: Cerrar Sesión
- Haz clic en tu avatar en el sidebar (abajo)
- Haz clic en **"Cerrar Sesión"**
- **Resultado esperado:** Deberías volver a la página de login

#### Prueba 3: Login como Empleado
- Email: `empleado@dataweave.com`
- Contraseña: `empleado123`
- **Resultado esperado:** Deberías ver SOLO las secciones permitidas

#### Prueba 4: Página de Envíos
- Navega a **"Envíos"** en el menú
- **Resultado esperado:** Deberías ver:
  - 3 tarjetas con métricas
  - Gráfico de líneas (Envíos por Fecha)
  - Gráfico de pastel (Métodos de Pago)
  - Tabla de rendimiento de couriers

---

## 📊 COMPARACIÓN DE ACCESOS

### 👨‍💼 GERENTE ve:
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

### 👤 EMPLEADO ve:
```
✓ Dashboard Principal
✓ Envíos
✗ Rendimiento de Asesores      (OCULTO)
✗ Campañas Meta                (OCULTO)
✓ Provincias
✓ Análisis Diario
✗ Análisis de Inventario       (OCULTO)
✓ Estado de Inventario
✗ Análisis Mensual             (OCULTO)
```

---

## 📁 ARCHIVOS IMPORTANTES

### Para configurar:
- 📄 `docs/FIRESTORE-RULES.md` - Reglas de Firestore para copiar manualmente
- 📄 `docs/SETUP-AUTH.md` - Guía detallada de configuración
- 📄 `AUTHENTICATION.md` - Documentación completa del sistema

### Para entender el código:
- 📄 `src/contexts/AuthContext.tsx` - Sistema de autenticación
- 📄 `src/app/login/page.tsx` - Página de login
- 📄 `src/app/(app)/layout.tsx` - Menú con filtrado por roles
- 📄 `src/app/(app)/dashboard/shipments/page.tsx` - Página de envíos

---

## ✅ CHECKLIST DE VERIFICACIÓN

Marca cada paso cuando lo completes:

**Configuración en Firebase:**
- [ ] Authentication habilitado
- [ ] Proveedor Email/Password activado
- [ ] Reglas de Firestore publicadas (manualmente desde la consola)

**Usuarios:**
- [ ] Usuario gerente creado en Authentication
- [ ] Perfil del gerente en Firestore (colección `users`)
- [ ] Usuario empleado creado en Authentication
- [ ] Perfil del empleado en Firestore (colección `users`)

**Pruebas:**
- [ ] `npm run dev` corre sin errores
- [ ] Login como gerente funciona
- [ ] Menú muestra todas las secciones para gerente
- [ ] Cerrar sesión funciona
- [ ] Login como empleado funciona
- [ ] Menú oculta secciones para empleado
- [ ] Página de Envíos muestra gráficos

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### ❌ "Error al iniciar sesión"
**Solución:**
1. Verifica que el usuario exista en Authentication
2. Confirma que la contraseña sea correcta
3. Revisa que Authentication esté habilitado

### ❌ "Missing or insufficient permissions"
**Solución:**
1. Ve a Firestore → Reglas
2. Verifica que las reglas estén publicadas
3. Copia nuevamente desde `docs/FIRESTORE-RULES.md`

### ❌ "El menú no se filtra"
**Solución:**
1. Ve a Firestore → `users` → [UID del usuario]
2. Verifica que el campo `role` exista
3. Confirma que el valor sea exactamente `"gerente"` o `"empleado"` (en minúsculas)

### ❌ "Página en blanco después de login"
**Solución:**
1. Presiona F12 para abrir DevTools
2. Ve a la pestaña Console
3. Busca errores en rojo
4. Verifica que el documento del usuario exista en Firestore

---

## 🎉 ¡TODO LISTO!

Si seguiste todos los pasos, ya tienes:
- ✅ Sistema de login funcional
- ✅ Roles de gerente y empleado
- ✅ Menú que se adapta según el rol
- ✅ Nueva página de Envíos con 3 gráficos
- ✅ Seguridad configurada en Firestore

**¡Disfruta tu nuevo sistema de autenticación y análisis de envíos!** 🚀

---

## 📞 Documentación Adicional

Si necesitas más información, consulta:
- `AUTHENTICATION.md` - Guía completa del usuario
- `docs/authentication-system.md` - Documentación técnica
- `docs/FIRESTORE-RULES.md` - Reglas de Firestore
- `IMPLEMENTATION-SUMMARY.md` - Resumen de implementación
