---
Date: 2025-10-14
---

# ðŸš€ IMPLEMENTACIÃ“N COMPLETA: GESTIÃ“N DE ESTADOS DE ENVÃOS TEMPORALES

**Fecha**: 14 de octubre de 2025  
**Objetivo**: Sistema completo de gestiÃ³n y visualizaciÃ³n de pedidos en trÃ¡nsito (PROVINCIA y LIMA)

---

## âœ… LO QUE SE HA IMPLEMENTADO

### **1. Google Apps Script actualizado** âœ…

**Archivo**: `google-apps-script/inventory-sync.js`

#### **Nuevas configuraciones:**
```javascript
ENVIOS_TEMPORALES_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/envios-temporales'
PROVINCIA_ENVIADOS_SHEET_NAME: 'PROVINCIA_ENVIADOS'
LIMA_ENVIADOS_SHEET_NAME: 'LIMA_ENVIADOS'
```

#### **Nuevas funciones:**
- âœ… `triggerProvinciaEnviadosSync()` - Sincroniza pedidos de provincia
- âœ… `triggerLimaEnviadosSync()` - Sincroniza pedidos de Lima
- âœ… `syncSheetTemporal()` - FunciÃ³n especializada para hojas temporales
- âœ… `findRowsToSendTemporal()` - Extrae datos sin sistema de log

#### **MenÃº actualizado:**
```
1. Sincronizar PROVINCIA ENVIADOS (Temporal)
2. Sincronizar LIMA ENVIADOS (Temporal)
3. Sincronizar REPORTE ENVIADOS
4. Sincronizar ENTREGADO
5. Activar SincronizaciÃ³n AutomÃ¡tica
6. Desactivar SincronizaciÃ³n AutomÃ¡tica
```

---

### **2. Webhook Backend Unificado** âœ…

**Archivo**: `src/app/api/webhooks/envios-temporales/route.ts`

#### **Estados soportados** (segÃºn imÃ¡genes proporcionadas):
- `ENVIADO`
- `EN TRANSITO`
- `EN DESTINO`
- `TIENDA`
- `DEVOLUCIÃ“N`
- `PAGADO`
- `ORIGEN`
- `L - EN RUTA` (Lima en ruta)
- `L - PREPARADO` (Lima preparado)
- `L - DEVOLUCIÃ“N` (Lima devoluciÃ³n)
- `L - REPROGRAMAR` (Lima reprogramar)
- `L - NO CONTESTA` (Lima no contesta)
- `L - ENTREGADO` (Lima entregado)

#### **Funcionalidades:**

**POST** `/api/webhooks/envios-temporales`
- Recibe datos de PROVINCIA_ENVIADOS o LIMA_ENVIADOS
- Identifica tipo de origen automÃ¡ticamente
- Detecta nuevos pedidos â†’ `evento: ENTRADA_TRANSITO`
- Detecta cambios de estado â†’ `evento: CAMBIO_ESTADO`
- Detecta pedidos eliminados â†’ `evento: SALIDA_TRANSITO`
- Registra historial completo en Firestore

**GET** `/api/webhooks/envios-temporales`
- EstadÃ­sticas en tiempo real
- Retorna conteos por:
  - Tipo de origen (PROVINCIA vs LIMA)
  - Estado
  - Tienda
  - Provincia
  - Courier

---

## ðŸ—„ï¸ ESTRUCTURA DE BASE DE DATOS

### **ColecciÃ³n: `envios_temporales`**

**DescripciÃ³n**: Tabla temporal con solo pedidos ACTIVOS en trÃ¡nsito

```typescript
{
  pedidoId: "49268",
  tipoOrigen: "PROVINCIA" | "LIMA",
  tienda: "Dearel",
  provincia: "Lima",
  estado: "EN TRANSITO",
  courier: "SHALOM",
  cliente: "Juan PÃ©rez",
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

**Ãndices requeridos:**
```
- tipoOrigen ASC, enReporteEnviados ASC, eliminadoDeTransito ASC
- estado ASC, enReporteEnviados ASC
- courier ASC, tipoOrigen ASC
- ultimaActualizacion DESC
```

---

### **ColecciÃ³n: `envios_temporales_historial`**

**DescripciÃ³n**: Historial COMPLETO de todos los cambios

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
  mensaje: "DescripciÃ³n opcional",
  datosSnapshot: { ... }
}
```

**Ãndices requeridos:**
```
- pedidoId ASC, timestamp ASC
- evento ASC, timestamp DESC
- tipoOrigen ASC, timestamp DESC
```

---

## ðŸ“Š VISUALIZACIONES A IMPLEMENTAR EN `/dashboard/shipments`

### **SecciÃ³n 1: GestiÃ³n RÃ¡pida de Estados**

#### **Card 1: KPIs Principales**
```typescript
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸ“¦ Total en TrÃ¡nsito        ðŸšš En Ruta         â”‚
â”‚ 150 pedidos                 85 pedidos          â”‚
â”‚                                                 â”‚
â”‚ ðŸ“ Provincia                ðŸ™ï¸  Lima            â”‚
â”‚ 90 pedidos                  60 pedidos          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### **Card 2: Tabla de Pedidos PROVINCIA vs LIMA**
```typescript
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Estado           | Provincia | Lima  | Total   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ EN TRANSITO      â”‚    45     â”‚  25   â”‚   70    â”‚
â”‚ EN DESTINO       â”‚    20     â”‚  15   â”‚   35    â”‚
â”‚ L - EN RUTA      â”‚     0     â”‚  12   â”‚   12    â”‚
â”‚ L - PREPARADO    â”‚     0     â”‚   8   â”‚    8    â”‚
â”‚ TIENDA           â”‚    15     â”‚   0   â”‚   15    â”‚
â”‚ DEVOLUCIÃ“N       â”‚     5     â”‚   3   â”‚    8    â”‚
â”‚ PAGADO           â”‚     5     â”‚   2   â”‚    7    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

### **SecciÃ³n 2: GrÃ¡ficos de Rendimiento por Courier**

#### **GrÃ¡fico 1: DistribuciÃ³n de Pedidos por Courier** (Pie Chart)
```typescript
SHALOM: 60% (90 pedidos)
DIN: 25% (38 pedidos)
CLOCK: 12% (18 pedidos)
OTRO: 3% (4 pedidos)
```

#### **GrÃ¡fico 2: Rendimiento por Courier** (Bar Chart Horizontal)
```typescript
Courier    | En TrÃ¡nsito | Entregados | Devoluciones | %Ã‰xito
-----------|-------------|------------|--------------|--------
SHALOM     |     45      |    320     |      8       | 97.6%
DIN        |     20      |    180     |      5       | 97.3%
CLOCK      |     10      |    120     |      3       | 97.6%
```

#### **GrÃ¡fico 3: Tiempo Promedio de Entrega** (Bar Chart)
```typescript
Courier    | Provincia    | Lima
-----------|--------------|-------------
SHALOM     | 2.3 dÃ­as     | 1.2 dÃ­as
DIN        | 2.8 dÃ­as     | 1.5 dÃ­as
CLOCK      | 2.1 dÃ­as     | 1.1 dÃ­as
```

---

### **SecciÃ³n 3: Mapa de Estados en Tiempo Real**

#### **Diagrama de flujo visual:**
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PREPARADO  â”‚ â”€â”€â”€â–º â”‚ EN TRANSITO â”‚ â”€â”€â”€â–º â”‚ EN DESTINO  â”‚
â”‚   8 pedidos â”‚      â”‚  70 pedidos â”‚      â”‚  35 pedidos â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                  â”‚
                                                  â–¼
                                          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                          â”‚  ENTREGADO  â”‚
                                          â”‚  820 total  â”‚
                                          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## ðŸ“‹ QUERIES NECESARIAS PARA LAS VISUALIZACIONES

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
// - % de Ã©xito
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

## ðŸŽ¨ COMPONENTES UI A CREAR

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

## ðŸš€ PLAN DE IMPLEMENTACIÃ“N

### **Fase 1: Backend y Datos** âœ… COMPLETADO
1. âœ… Script Google Sheets actualizado
2. âœ… Webhook unificado creado
3. âœ… Estructura Firestore definida

### **Fase 2: Frontend - Componentes Base** (1-2 horas)
4. â³ Crear hook `useEnviosTemporales()` para fetch data
5. â³ Crear componente `EstadosTemporalesTable`
6. â³ Crear componente `CourierPerformanceChart`

### **Fase 3: Frontend - Visualizaciones** (2-3 horas)
7. â³ Agregar secciÃ³n en `/dashboard/shipments`
8. â³ Implementar KPIs (Total Provincia, Total Lima, etc.)
9. â³ Implementar tabla de estados
10. â³ Implementar grÃ¡ficos de courier

### **Fase 4: Refinamiento** (1 hora)
11. â³ Agregar filtros de fecha
12. â³ Agregar filtros por estado/courier
13. â³ Agregar indicadores de carga
14. â³ Agregar tooltips informativos

---

## ðŸ”¥ SIGUIENTE PASO INMEDIATO

Voy a crear el hook personalizado y los componentes para la pÃ¡gina de shipments:

1. **Hook**: `useEnviosTemporales.ts`
2. **ActualizaciÃ³n**: Agregar secciÃ³n en `shipments/page.tsx`
3. **Componentes**: Tabla y grÃ¡ficos de estados

---

## ðŸ“ REGLAS DE FIRESTORE ACTUALIZADAS

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

## âœ… CHECKLIST FINAL

- [x] Script Google Sheets con PROVINCIA y LIMA
- [x] Webhook unificado `/api/webhooks/envios-temporales`
- [x] Estructura Firestore diseÃ±ada
- [x] Estados completos identificados (14 estados)
- [ ] Hook `useEnviosTemporales` creado
- [ ] Componente tabla de estados
- [ ] Componente grÃ¡ficos de courier
- [ ] SecciÃ³n agregada en `/dashboard/shipments`
- [ ] Ãndices Firestore creados
- [ ] Testing completo

**ðŸŽ¯ OBJETIVO FINAL:**
Dashboard completo en `/dashboard/shipments` con:
- âœ… Tabla de pedidos PROVINCIA vs LIMA por estado
- âœ… GrÃ¡ficos de rendimiento por courier
- âœ… VisualizaciÃ³n rÃ¡pida de gestiÃ³n de estados
- âœ… MÃ©tricas en tiempo real

---

**ðŸ“ž PRÃ“XIMO COMANDO:**
Crear hook y componentes para visualizaciones en shipments/page.tsx

