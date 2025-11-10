# 📚 Índice de Documentación - DataWeave BI
**Última actualización:** 2025-11-09  
**Versión:** 2.1.0

---

## 🚨 CRÍTICO - Acción Requerida

### ⚡ Optimización y Rendimiento
| Documento | Descripción | Prioridad |
|-----------|-------------|-----------|
| [ACCION-INMEDIATA-CPU-2025-11-09.md](./ACCION-INMEDIATA-CPU-2025-11-09.md) | 🚀 **EMPEZAR AQUÍ**: Guía paso a paso para implementar optimizaciones AHORA (2-3 horas) | 🔴 CRÍTICA |
| [OPTIMIZACION-CPU-VERCEL-2025-11-09.md](./OPTIMIZACION-CPU-VERCEL-2025-11-09.md) | 🚨 **ANÁLISIS COMPLETO**: Plan de optimización de consumo CPU en Vercel (91.2% del límite). Análisis detallado, cache+lock, batch writes, plan de implementación | 🔴 CRÍTICA |
| [RESUMEN-ACTUALIZACION-DOCS-2025-11-09.md](./RESUMEN-ACTUALIZACION-DOCS-2025-11-09.md) | 📝 Resumen de cambios en documentación (2025-11-09) | 🟡 MEDIA |

---

## 🎯 Guías Rápidas

| Documento | Descripción | Prioridad |
|-----------|-------------|-----------|
| [INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md](./INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md) | 🚀 Deploy del Apps Script actualizado | 🔴 ALTA |
| [RESUMEN-CORRECCIONES-FINALIZADAS-2025-10-15.md](./RESUMEN-CORRECCIONES-FINALIZADAS-2025-10-15.md) | ✅ Resumen ejecutivo de correcciones | 🔴 ALTA |
| [SETUP-AUTH.md](./SETUP-AUTH.md) | 🔐 Configuración de autenticación Firebase | 🟡 MEDIA |
| [setup-demo-users.md](./setup-demo-users.md) | 👥 Crear usuarios de prueba | 🟢 BAJA |

---

## 📋 Correcciones y Mejoras (2025-10-15)

### Estructura de Datos
| Documento | Descripción |
|-----------|-------------|
| [ESTRUCTURA-COLUMNAS-SHEETS.md](./ESTRUCTURA-COLUMNAS-SHEETS.md) | 🔍 Análisis completo de columnas Google Sheets |
| [CORRECCIONES-COLUMNAS-2025-10-15.md](./CORRECCIONES-COLUMNAS-2025-10-15.md) | 🛠️ Detalle técnico de correcciones aplicadas |
| [RESUMEN-CORRECCIONES-FINALIZADAS-2025-10-15.md](./RESUMEN-CORRECCIONES-FINALIZADAS-2025-10-15.md) | ✅ Resumen ejecutivo de todas las correcciones |

### Apps Script
| Documento | Descripción |
|-----------|-------------|
| [RESUMEN-MEJORAS-2025-10-15.md](./RESUMEN-MEJORAS-2025-10-15.md) | 📊 Sistema de batching y mejoras de rendimiento |
| [APPS-SCRIPT-MEJORAS-BATCHING.md](./APPS-SCRIPT-MEJORAS-BATCHING.md) | 🔧 Implementación técnica del batching |
| [../google-apps-script/README.md](../google-apps-script/README.md) | 📖 Documentación completa del Apps Script |

### Frontend
| Documento | Descripción |
|-----------|-------------|
| [CAMBIOS-CALENDARIOS-2025-10-15.md](./CAMBIOS-CALENDARIOS-2025-10-15.md) | 📅 Mejoras UX en selectores de fecha |
| [RESUMEN-EJECUTIVO-2025-10-15.md](./RESUMEN-EJECUTIVO-2025-10-15.md) | 📈 Resumen ejecutivo general |

---

## 🔥 Firestore y Backend

### Configuración
| Documento | Descripción |
|-----------|-------------|
| [GUIA-MIGRACION-FIREBASE.md](./GUIA-MIGRACION-FIREBASE.md) | 🔄 Migración de servicios Firebase |
| [FIRESTORE-RULES-UPDATED.md](./FIRESTORE-RULES-UPDATED.md) | 🔒 Reglas de seguridad actualizadas |
| [FIRESTORE-RULES.md](./FIRESTORE-RULES.md) | 📜 Reglas de Firestore originales |

### Webhooks
| Documento | Descripción |
|-----------|-------------|
| [WEBHOOK-FLOW-DOCUMENTATION.md](./WEBHOOK-FLOW-DOCUMENTATION.md) | 🔗 Flujo completo de webhooks |

---

## 🏗️ Arquitectura

| Documento | Descripción |
|-----------|-------------|
| [blueprint.md](./blueprint.md) | 🎨 Blueprint general del proyecto |
| [authentication-system.md](./authentication-system.md) | 🔐 Sistema de autenticación detallado |
| [../src/types/sheets.ts](../src/types/sheets.ts) | 📝 Interfaces TypeScript para Google Sheets |

---

## 📊 Estructura de Google Sheets

### Hojas Soportadas

#### 1. PROVINCIA_ENVIADOS
```
Columnas: ~18
ID único: PEDIDO (columna C)
Características: 
  - Sin campo COURIER
  - Usa NOMBRES (columna J)
  - Para envíos de provincia
```

#### 2. LIMA_ENVIADOS
```
Columnas: ~15
ID único: PEDIDO (columna C)
Características:
  - COURIER en columna L (index 11) ✅
  - Usa NOMBRE (columna J) → normalizado a NOMBRES
  - Para envíos de Lima
```

#### 3. REPORTE_ENVIADOS
```
Columnas: ~25
ID único: PEDIDO (columna C)
Características:
  - CLAVE en columna W (index 22)
  - Usa NOMBRES (columna J)
  - Incluye tracking y respuestas
```

#### 4. ENTREGADO
```
Columnas: ~16
ID único: ID (columna A)
Características:
  - FORMA DE PAGO en columna O ✅
  - Fechas de envío y entrega
  - Monto pendiente
```

---

## 🔧 Correcciones Críticas Aplicadas

### ✅ 1. LIMA COURIER Corregido
**Problema:** Mapeo incorrecto de columna W (CLAVE de REPORTE) como COURIER  
**Solución:** Eliminado mapeo especial, LIMA lee COURIER de columna L nativa  
**Archivos:** `google-apps-script/inventory-sync.js`

### ✅ 2. Normalización NOMBRE → NOMBRES
**Problema:** Inconsistencia entre LIMA (NOMBRE) y otras hojas (NOMBRES)  
**Solución:** Normalización automática en Apps Script  
**Beneficio:** Consultas uniformes en Firestore y dashboards

### ✅ 3. Batching para Hojas Grandes
**Problema:** Error 413 FUNCTION_PAYLOAD_TOO_LARGE en hojas >100 filas  
**Solución:** Sistema de lotes de 75 filas con delay de 500ms  
**Beneficio:** Sincronización estable sin errores de payload

### ✅ 4. Interfaces TypeScript
**Archivo:** `src/types/sheets.ts`  
**Contenido:**
- `ProvinciaEnviadoRow`
- `LimaEnviadoRow`
- `ReporteEnviadoRow`
- `EntregadoRow`
- Helpers de validación

---

## 🚀 Quick Start

### Para Deploy Rápido
```bash
1. Leer: INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md
2. Actualizar código en Apps Script
3. Ejecutar test de sincronización
4. Verificar logs en Firestore
```

### Para Testing
```bash
1. Editar fila en Google Sheets
2. Esperar 5-10 segundos
3. Verificar en Firestore Console
4. Validar en dashboards
```

### Para Debugging
```bash
1. Logs de Apps Script: Ejecuciones → Ver logs
2. Logs de Vercel: Dashboard → Logs → /api/webhooks/
3. Firestore Console: Ver colecciones directamente
```

---

## 📁 Estructura de Archivos

```
docs/
├── INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md        🔴 Guía de deploy
├── RESUMEN-CORRECCIONES-FINALIZADAS-2025-10-15.md  🔴 Resumen ejecutivo
├── ESTRUCTURA-COLUMNAS-SHEETS.md              📊 Análisis de columnas
├── CORRECCIONES-COLUMNAS-2025-10-15.md        🛠️ Detalle técnico
├── RESUMEN-MEJORAS-2025-10-15.md              📈 Mejoras de rendimiento
├── CAMBIOS-CALENDARIOS-2025-10-15.md          📅 UX calendarios
├── GUIA-MIGRACION-FIREBASE.md                 🔄 Migración Firebase
├── FIRESTORE-RULES-UPDATED.md                 🔒 Reglas actualizadas
├── WEBHOOK-FLOW-DOCUMENTATION.md              🔗 Flujo de webhooks
└── INDEX.md                                   📚 Este archivo

google-apps-script/
├── inventory-sync.js                          📜 Script principal
└── README.md                                  📖 Documentación del script

src/
└── types/
    └── sheets.ts                              📝 Interfaces TypeScript
```

---

## 🎓 Recursos Adicionales

### Changelogs
- [changelogs/2025-10-15/](../changelogs/2025-10-15/) - Registros detallados de cambios

### Scripts Útiles
- [scripts/check-courier-data.ts](../scripts/check-courier-data.ts) - Verificar datos de courier
- [scripts/check-payment-methods.ts](../scripts/check-payment-methods.ts) - Verificar métodos de pago
- [scripts/seed-users.js](../scripts/seed-users.js) - Crear usuarios de prueba

---

## 🔍 Búsqueda Rápida

### Por Tema
- **Deploy**: INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md
- **Estructura de Datos**: ESTRUCTURA-COLUMNAS-SHEETS.md
- **Correcciones**: CORRECCIONES-COLUMNAS-2025-10-15.md
- **Batching**: RESUMEN-MEJORAS-2025-10-15.md
- **Calendarios**: CAMBIOS-CALENDARIOS-2025-10-15.md
- **Webhooks**: WEBHOOK-FLOW-DOCUMENTATION.md
- **Firestore**: FIRESTORE-RULES-UPDATED.md
- **Autenticación**: SETUP-AUTH.md

### Por Archivo
- **Apps Script**: google-apps-script/README.md
- **TypeScript**: src/types/sheets.ts
- **Frontend**: CAMBIOS-CALENDARIOS-2025-10-15.md
- **Backend**: WEBHOOK-FLOW-DOCUMENTATION.md

---

## ⚠️ Notas Importantes

### 🔴 Acción Requerida - CRÍTICA
- [ ] **IMPLEMENTAR OPTIMIZACIONES DE CPU** (Ver OPTIMIZACION-CPU-VERCEL-2025-11-09.md)
  - [ ] Cache + Lock system en `/api/zadarma/stats`
  - [ ] Batch writes en todos los endpoints
  - [ ] Eliminar sleeps bloqueantes
- [ ] Deploy del Apps Script actualizado (ver INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md)
- [ ] Testing E2E en producción (24-48 horas)

### ✅ Completado
- [x] Análisis de estructura de columnas
- [x] Corrección de mapeo LIMA COURIER
- [x] Normalización NOMBRE/NOMBRES
- [x] Verificación FORMA DE PAGO
- [x] Interfaces TypeScript creadas
- [x] Documentación completa
- [x] **Análisis de optimización de CPU Vercel (2025-11-09)**
- [x] **Plan de acción para reducir consumo 70-90%**

### 🟡 Recomendado
- [ ] Usar interfaces TypeScript en webhooks
- [ ] Implementar validación con `validarFilaMinima()`
- [ ] Monitorear logs durante 48 horas post-deploy
- [ ] **Monitorear métricas de cache (hit rate > 95%)**
- [ ] **Configurar alertas CPU > 80% en Vercel**

---

## 📞 Contacto y Soporte

Para preguntas sobre:
- **Apps Script**: Ver google-apps-script/README.md
- **Estructura de Datos**: Ver ESTRUCTURA-COLUMNAS-SHEETS.md
- **Deploy**: Ver INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md
- **Errores**: Revisar sección Troubleshooting en INSTRUCCIONES-DEPLOY-APPS-SCRIPT.md
- **Optimización CPU**: Ver OPTIMIZACION-CPU-VERCEL-2025-11-09.md

---

**Última verificación:** 2025-11-09  
**Estado:** ✅ Documentación completa y actualizada  
**Versión del sistema:** 2.1.0
