# 🚀 IMPLEMENTACIÓN COMPLETA: GESTIÓN DE ESTADOS DE ENVÍOS TEMPORALES

**Fecha**: 14 de octubre de 2025  
**Objetivo**: Sistema completo de gestión y visualización de pedidos en tránsito (PROVINCIA y LIMA)

---

## ✅ LO QUE SE HA IMPLEMENTADO

### **1. Google Apps Script actualizado** ✅

**Archivo**: `google-apps-script/inventory-sync.js`

#### **Nuevas configuraciones:**
```javascript
ENVIOS_TEMPORALES_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/envios-temporales'
PROVINCIA_ENVIADOS_SHEET_NAME: 'PROVINCIA_ENVIADOS'
LIMA_ENVIADOS_SHEET_NAME: 'LIMA_ENVIADOS'
```

#### **Nuevas funciones:**
- ✅ `triggerProvinciaEnviadosSync()` - Sincroniza pedidos de provincia
- ✅ `triggerLimaEnviadosSync()` - Sincroniza pedidos de Lima
- ✅ `syncSheetTemporal()` - Función especializada para hojas temporales
- ✅ `findRowsToSendTemporal()` - Extrae datos sin sistema de log

#### **Menú actualizado:**
```
1. Sincronizar PROVINCIA ENVIADOS (Temporal)
2. Sincronizar LIMA ENVIADOS (Temporal)
3. Sincronizar REPORTE ENVIADOS
4. Sincronizar ENTREGADO
5. Activar Sincronización Automática
6. Desactivar Sincronización Automática
```

---

### **2. Webhook Backend Unificado** ✅

**Archivo**: `src/app/api/webhooks/envios-temporales/route.ts`

#### **Estados soportados** (según imágenes proporcionadas):
- `ENVIADO`
- `EN TRANSITO`
- `EN DESTINO`
- `TIENDA`
- `DEVOLUCIÓN`
- `PAGADO`
- `ORIGEN`
- `L - EN RUTA` (Lima en ruta)
- `L - PREPARADO` (Lima preparado)
- `L - DEVOLUCIÓN` (Lima devolución)
- `L - REPROGRAMAR` (Lima reprogramar)
- `L - NO CONTESTA` (Lima no contesta)
- `L - ENTREGADO` (Lima entregado)

#### **Funcionalidades:**

**POST** `/api/webhooks/envios-temporales`
- Recibe datos de PROVINCIA_ENVIADOS o LIMA_ENVIADOS
- Identifica tipo de origen automáticamente
- Detecta nuevos pedidos → `evento: ENTRADA_TRANSITO`
- Detecta cambios de estado → `evento: CAMBIO_ESTADO`
- Detecta pedidos eliminados → `evento: SALIDA_TRANSITO`
- Registra historial completo en Firestore

**GET** `/api/webhooks/envios-temporales`
- Estadísticas en tiempo real
- Retorna conteos por:
  - Tipo de origen (PROVINCIA vs LIMA)
  - Estado
  - Tienda
  - Provincia
  - Courier

---

## 🗄️ ESTRUCTURA DE BASE DE DATOS

### **Colección: `envios_temporales`**

**Descripción**: Tabla temporal con solo pedidos ACTIVOS en tránsito

```typescript
{
  pedidoId: "49268",
  tipoOrigen: "PROVINCIA" | "LIMA",
  tienda: "Dearel",
  provincia: "Lima",
  estado: "EN TRANSITO",
  courier: "SHALOM",
  cliente: "Juan Pérez",
  celular: "+51987654321",
  direccion: "Av. Principal 123",
  claves: "DIN",
  monto: 159,
  fechaCreado: "2025-10-14T10:30:00Z",
  fechaEnviado: "2025-10-14T15:00:00Z",
  productos: "1x Gafas de sol...",
  datosCompletos: { ... },
  ultimaActualizacion: Timestamp,
  fechaCreacion: Timestamp,
  enReporteEnviados: false,
  eliminadoDeTransito: false,
  fechaEliminacion: null
}
```

**Índices requeridos:**
```
- tipoOrigen ASC, enReporteEnviados ASC, eliminadoDeTransito ASC
- estado ASC, enReporteEnviados ASC
- courier ASC, tipoOrigen ASC
- ultimaActualizacion DESC
```

---

### **Colección: `envios_temporales_historial`**

**Descripción**: Historial COMPLETO de todos los cambios

```typescript
{
  pedidoId: "49268",
  tipoOrigen: "PROVINCIA" | "LIMA",
  evento: "ENTRADA_TRANSITO" | "CAMBIO_ESTADO" | "SALIDA_TRANSITO",
  timestamp: Timestamp,
  estadoAnterior: "PREPARANDO" | null,
  estadoNuevo: "EN TRANSITO",
  tienda: "Dearel",
  provincia: "Lima",
  courier: "SHALOM",
  mensaje: "Descripción opcional",
  datosSnapshot: { ... }
}
```

**Índices requeridos:**
```
- pedidoId ASC, timestamp ASC
- evento ASC, timestamp DESC
- tipoOrigen ASC, timestamp DESC
```

---

## 📊 VISUALIZACIONES A IMPLEMENTAR EN `/dashboard/shipments`

### **Sección 1: Gestión Rápida de Estados**

#### **Card 1: KPIs Principales**
```typescript
┌─────────────────────────────────────────────────┐
│ 📦 Total en Tránsito        🚚 En Ruta         │
│ 150 pedidos                 85 pedidos          │
│                                                 │
│ 📍 Provincia                🏙️  Lima            │
│ 90 pedidos                  60 pedidos          │
└─────────────────────────────────────────────────┘
```

#### **Card 2: Tabla de Pedidos PROVINCIA vs LIMA**
```typescript
┌─────────────────────────────────────────────────┐
│ Estado           | Provincia | Lima  | Total   │
├─────────────────────────────────────────────────┤
│ EN TRANSITO      │    45     │  25   │   70    │
│ EN DESTINO       │    20     │  15   │   35    │
│ L - EN RUTA      │     0     │  12   │   12    │
│ L - PREPARADO    │     0     │   8   │    8    │
│ TIENDA           │    15     │   0   │   15    │
│ DEVOLUCIÓN       │     5     │   3   │    8    │
│ PAGADO           │     5     │   2   │    7    │
└─────────────────────────────────────────────────┘
```

---

### **Sección 2: Gráficos de Rendimiento por Courier**

#### **Gráfico 1: Distribución de Pedidos por Courier** (Pie Chart)
```typescript
SHALOM: 60% (90 pedidos)
DIN: 25% (38 pedidos)
CLOCK: 12% (18 pedidos)
OTRO: 3% (4 pedidos)
```

#### **Gráfico 2: Rendimiento por Courier** (Bar Chart Horizontal)
```typescript
Courier    | En Tránsito | Entregados | Devoluciones | %Éxito
-----------|-------------|------------|--------------|--------
SHALOM     |     45      |    320     |      8       | 97.6%
DIN        |     20      |    180     |      5       | 97.3%
CLOCK      |     10      |    120     |      3       | 97.6%
```

#### **Gráfico 3: Tiempo Promedio de Entrega** (Bar Chart)
```typescript
Courier    | Provincia    | Lima
-----------|--------------|-------------
SHALOM     | 2.3 días     | 1.2 días
DIN        | 2.8 días     | 1.5 días
CLOCK      | 2.1 días     | 1.1 días
```

---

### **Sección 3: Mapa de Estados en Tiempo Real**

#### **Diagrama de flujo visual:**
```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  PREPARADO  │ ───► │ EN TRANSITO │ ───► │ EN DESTINO  │
│   8 pedidos │      │  70 pedidos │      │  35 pedidos │
└─────────────┘      └─────────────┘      └─────────────┘
                                                  │
                                                  ▼
                                          ┌─────────────┐
                                          │  ENTREGADO  │
                                          │  820 total  │
                                          └─────────────┘
```

---

## 📋 QUERIES NECESARIAS PARA LAS VISUALIZACIONES

### **1. Total de pedidos activos por tipo de origen**
```typescript
const totalProvinciaLima = await db.collection('envios_temporales')
  .where('enReporteEnviados', '==', false)
  .where('eliminadoDeTransito', '==', false)
  .get();

const provincia = totalProvinciaLima.docs.filter(d => d.data().tipoOrigen === 'PROVINCIA').length;
const lima = totalProvinciaLima.docs.filter(d => d.data().tipoOrigen === 'LIMA').length;
```

### **2. Tabla de estados por origen**
```typescript
const estadosPorOrigen = {};
totalProvinciaLima.forEach(doc => {
  const { estado, tipoOrigen } = doc.data();
  if (!estadosPorOrigen[estado]) {
    estadosPorOrigen[estado] = { PROVINCIA: 0, LIMA: 0 };
  }
  estadosPorOrigen[estado][tipoOrigen]++;
});
```

### **3. Rendimiento por courier**
```typescript
const courierStats = await db.collection('envios_temporales_historial')
  .where('evento', '==', 'SALIDA_TRANSITO')
  .get();

// Agrupar por courier y calcular:
// - Total procesados
// - Entregados exitosos
// - Devoluciones
// - % de éxito
```

### **4. Tiempo promedio de entrega por courier**
```typescript
const tiemposEntrega = await db.collection('envios_temporales_historial')
  .orderBy('timestamp', 'desc')
  .limit(1000)
  .get();

// Para cada pedido:
// 1. Buscar evento ENTRADA_TRANSITO
// 2. Buscar evento SALIDA_TRANSITO
// 3. Calcular diferencia
// 4. Agrupar por courier y tipoOrigen
// 5. Sacar promedio
```

---

## 🎨 COMPONENTES UI A CREAR

### **1. EstadosTemporalesCard.tsx**
```typescript
interface EstadoRow {
  estado: string;
  provincia: number;
  lima: number;
  total: number;
  color: string;
}

const EstadosTemporalesCard: React.FC = () => {
  // Fetch data from Firestore
  // Display table with estados
};
```

### **2. CourierRendimientoCard.tsx**
```typescript
interface CourierMetric {
  courier: string;
  enTransito: number;
  entregados: number;
  devoluciones: number;
  porcentajeExito: number;
}

const CourierRendimientoCard: React.FC = () => {
  // Fetch courier metrics
  // Display bar chart + table
};
```

### **3. FlujoDiagramaCard.tsx**
```typescript
const FlujoDiagramaCard: React.FC = () => {
  // Visual flowchart of states
  // Interactive boxes with counts
};
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### **Fase 1: Backend y Datos** ✅ COMPLETADO
1. ✅ Script Google Sheets actualizado
2. ✅ Webhook unificado creado
3. ✅ Estructura Firestore definida

### **Fase 2: Frontend - Componentes Base** (1-2 horas)
4. ⏳ Crear hook `useEnviosTemporales()` para fetch data
5. ⏳ Crear componente `EstadosTemporalesTable`
6. ⏳ Crear componente `CourierPerformanceChart`

### **Fase 3: Frontend - Visualizaciones** (2-3 horas)
7. ⏳ Agregar sección en `/dashboard/shipments`
8. ⏳ Implementar KPIs (Total Provincia, Total Lima, etc.)
9. ⏳ Implementar tabla de estados
10. ⏳ Implementar gráficos de courier

### **Fase 4: Refinamiento** (1 hora)
11. ⏳ Agregar filtros de fecha
12. ⏳ Agregar filtros por estado/courier
13. ⏳ Agregar indicadores de carga
14. ⏳ Agregar tooltips informativos

---

## 🔥 SIGUIENTE PASO INMEDIATO

Voy a crear el hook personalizado y los componentes para la página de shipments:

1. **Hook**: `useEnviosTemporales.ts`
2. **Actualización**: Agregar sección en `shipments/page.tsx`
3. **Componentes**: Tabla y gráficos de estados

---

## 📝 REGLAS DE FIRESTORE ACTUALIZADAS

```javascript
// firestore.rules
match /envios_temporales/{pedidoId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo escritura desde backend
}

match /envios_temporales_historial/{historialId} {
  allow read: if request.auth != null;
  allow write: if false; // Solo escritura desde backend
}
```

---

## ✅ CHECKLIST FINAL

- [x] Script Google Sheets con PROVINCIA y LIMA
- [x] Webhook unificado `/api/webhooks/envios-temporales`
- [x] Estructura Firestore diseñada
- [x] Estados completos identificados (14 estados)
- [ ] Hook `useEnviosTemporales` creado
- [ ] Componente tabla de estados
- [ ] Componente gráficos de courier
- [ ] Sección agregada en `/dashboard/shipments`
- [ ] Índices Firestore creados
- [ ] Testing completo

**🎯 OBJETIVO FINAL:**
Dashboard completo en `/dashboard/shipments` con:
- ✅ Tabla de pedidos PROVINCIA vs LIMA por estado
- ✅ Gráficos de rendimiento por courier
- ✅ Visualización rápida de gestión de estados
- ✅ Métricas en tiempo real

---

**📞 PRÓXIMO COMANDO:**
Crear hook y componentes para visualizaciones en shipments/page.tsx
