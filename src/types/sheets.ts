/**
 * types/sheets.ts
 * ---------------
 * Interfaces TypeScript para la estructura REAL de Google Sheets
 * Verificadas con datos reales: 2025-10-15
 * 
 * ESTRUCTURAS VERIFICADAS:
 * - PROVINCIA_ENVIADOS: 28 columnas (A-AB)
 * - LIMA_ENVIADOS: 28 columnas (A-AB) - IGUAL a PROVINCIA
 * - REPORTE_ENVIADOS: 20 columnas (A-T)
 * - ENTREGADO: 39 columnas (A-AM)
 */

// =====================================
// INTERFACES PARA ENVIOS TEMPORALES
// =====================================

/**
 * PROVINCIA_ENVIADOS & LIMA_ENVIADOS
 * Estructura: 28 columnas (A-AB)
 * ID único: PEDIDO (columna D, index 3)
 * Características: EXACTAMENTE LA MISMA ESTRUCTURA
 */
export interface ProvinciaLimaEnviadoRow {
  // Columnas A-T (20 primeras - compartidas con REPORTE)
  ID: string;                    // A - ID interno del sistema
  'FECHA CREADO': string;        // B - Fecha de creación
  TIENDA: string;                // C - Tienda de origen
  PEDIDO: string;                // D - 🎯 ID único del pedido
  PRODUCTOS: string;             // E - Descripción de productos
  'PRODUCTO 2'?: string;         // F - Producto adicional
  TOTAL: number;                 // G - Total del pedido
  'MONTO PENDIENTE': number;     // H - Monto pendiente
  NOMBRES: string;               // I - Nombre completo del cliente
  DNI?: string;                  // J - DNI del cliente
  CELULAR?: string;              // K - Teléfono
  PROVINCIA?: string;            // L - Provincia de destino
  DIRECCION?: string;            // M - Dirección de entrega
  'AGENCIA SHALOM'?: string;     // N - Agencia courier
  'PDF URL'?: string;            // O - URL del PDF
  COURIER?: string;              // P - 🎯 Courier asignado
  ENVIAR?: boolean | string;     // Q - Flag de envío
  ANULAR?: boolean | string;     // R - Flag de anulación
  ATENDIDO?: string;             // S - Usuario que atendió
  SUBIDO?: string;               // T - Usuario que subió
  
  // Columnas U-AB (8 adicionales - NO en REPORTE)
  'NOTAS DEL PEDIDO'?: string;   // U - Notas del pedido
  OBSERVACIONES?: string;        // V - Observaciones adicionales
  CLAVES?: string;               // W - Código de seguimiento
  'LINK SHALOM'?: string;        // X - URL de rastreo Shalom
  'PDF SHALOM'?: string;         // Y - PDF de comprobante
  'FECHA ENVIADO'?: string;      // Z - Fecha de envío
  ENTREGADO?: string | boolean;  // AA - Flag/fecha de entrega
  ESTADO?: string;               // AB - 🎯 Estado actual
  
  [key: string]: any;
}

// Alias para claridad
export type ProvinciaEnviadoRow = ProvinciaLimaEnviadoRow;
export type LimaEnviadoRow = ProvinciaLimaEnviadoRow;

// =====================================
// INTERFACES PARA REPORTE Y ENTREGADOS
// =====================================

/**
 * REPORTE_ENVIADOS
 * Estructura: 20 columnas (A-T)
 * ID único: PEDIDO (columna D, index 3)
 * Características: Tiene columnas A-T iguales a PROVINCIA/LIMA, pero SIN columnas U-AB
 */
export interface ReporteEnviadoRow {
  // Columnas A-T (20 columnas - compartidas con PROVINCIA/LIMA)
  ID: string;                    // A - ID interno del sistema
  'FECHA CREADO': string;        // B - Fecha de creación
  TIENDA: string;                // C - Tienda de origen
  PEDIDO: string;                // D - 🎯 ID único del pedido
  PRODUCTOS: string;             // E - Descripción de productos
  'PRODUCTO 2'?: string;         // F - Producto adicional
  TOTAL: number;                 // G - Total del pedido
  'MONTO PENDIENTE': number;     // H - Monto pendiente
  NOMBRES: string;               // I - Nombre del cliente
  DNI?: string;                  // J - DNI del cliente
  CELULAR?: string;              // K - Teléfono
  PROVINCIA?: string;            // L - Provincia
  DIRECCION?: string;            // M - Dirección de entrega
  'AGENCIA SHALOM'?: string;     // N - Agencia courier
  'PDF URL'?: string;            // O - URL del PDF
  COURIER?: string;              // P - Courier asignado
  ENVIAR?: boolean | string;     // Q - Flag de envío
  ANULAR?: boolean | string;     // R - Flag de anulación
  ATENDIDO?: string;             // S - Usuario que atendió
  SUBIDO?: string;               // T - Usuario que subió (última columna)
  
  // ⚠️ REPORTE NO tiene columnas U-AB (termina en T)
  
  [key: string]: any;
}

/**
 * ENTREGADO
 * Estructura: 39 columnas (A-AM)
 * ID único: ID (columna A, index 0) ⚠️ Diferente a otras hojas
 * Características: La más completa, incluye REV1-7, FORMA DE PAGO, USUARIO
 */
export interface EntregadoRow {
  // Columnas A-T (20 primeras - compartidas con otras hojas)
  ID: string;                    // A - 🎯 ID único para ENTREGADO
  FECHA?: string;                // B - Fecha (no "FECHA CREADO")
  TIENDA: string;                // C - Tienda de origen
  PEDIDO: string;                // D - Código del pedido
  PRODUCTOS?: string;            // E - Descripción de productos
  'PRODUCTO 2'?: string;         // F - Producto adicional
  TOTAL?: number;                // G - Total del pedido
  'MONTO PENDIENTE'?: number;    // H - Monto pendiente
  NOMBRES?: string;              // I - Nombre del cliente
  DNI?: string;                  // J - DNI
  CELULAR?: string;              // K - Teléfono
  PROVINCIA?: string;            // L - Provincia
  DIRECCION?: string;            // M - Dirección
  'AGENCIA SHALOM'?: string;     // N - Agencia Shalom
  'PDF URL'?: string;            // O - URL del PDF
  COURIER?: string;              // P - Courier asignado
  ENVIAR?: boolean | string;     // Q - Flag envío
  ANULAR?: boolean | string;     // R - Flag anulación
  ATENDIDO?: string;             // S - Usuario que atendió
  SUBIDO?: string;               // T - Usuario que subió
  
  // Columnas U-AB (compartidas con PROVINCIA/LIMA)
  'NOTAS DEL PEDIDO'?: string;   // U - Notas
  OBSERVACIONES?: string;        // V - Observaciones
  CLAVES?: string;               // W - Código seguimiento
  'LINK SHALOM'?: string;        // X - URL rastreo
  'PDF SHALOM'?: string;         // Y - PDF comprobante
  'FECHA ENVIADO'?: string;      // Z - Fecha envío
  ENTREGADO?: string | boolean;  // AA - Flag entrega
  ESTADO?: string;               // AB - Estado
  
  // Columnas AC-AI (REV - específicas de ENTREGADO)
  REV1?: string;                 // AC
  REV2?: string;                 // AD
  REV3?: string;                 // AE
  REV4?: string;                 // AF
  REV5?: string;                 // AG
  REV6?: string;                 // AH
  REV7?: string;                 // AI
  
  // Columnas AJ-AM (campos finales críticos)
  'FECHA ENTREGADO'?: string;    // AJ - Fecha entrega real
  'FECHA Y HORA DE PAGO'?: string; // AK - Fecha/hora pago
  'FORMA DE PAGO'?: string;      // AL - 🎯 Método de pago (YAPE, PLIN, etc.)
  USUARIO?: string;              // AM - 🎯 Quien registró la entrega
  
  [key: string]: any;
}

// =====================================
// TIPOS UNIFICADOS
// =====================================

/**
 * Tipo unificado para envíos temporales
 * PROVINCIA y LIMA tienen la MISMA estructura (28 columnas)
 */
export type EnvioTemporalRow = ProvinciaLimaEnviadoRow;

/**
 * Tipo de origen para envíos temporales
 */
export type TipoOrigen = 'PROVINCIA' | 'LIMA';

/**
 * Payload para webhook de envíos temporales
 */
export interface EnvioTemporalWebhookPayload {
  data: EnvioTemporalRow[];
  tipoOrigen: TipoOrigen;
}

/**
 * Payload para webhook de reporte enviados
 */
export interface ReporteEnviadoWebhookPayload {
  data: ReporteEnviadoRow[];
}

/**
 * Payload para webhook de entregados
 */
export interface EntregadoWebhookPayload {
  data: EntregadoRow[];
}

// =====================================
// VALIDADORES Y HELPERS
// =====================================

/**
 * Valida que una fila tenga los campos mínimos requeridos
 */
export function validarFilaMinima(row: any, tipoHoja: 'PROVINCIA' | 'LIMA' | 'REPORTE' | 'ENTREGADO'): boolean {
  if (!row) return false;

  switch (tipoHoja) {
    case 'PROVINCIA':
    case 'LIMA':
    case 'REPORTE':
      return Boolean(row.PEDIDO && row.TIENDA);
    case 'ENTREGADO':
      return Boolean(row.ID && row.PEDIDO && row.TIENDA);
    default:
      return false;
  }
}

/**
 * Obtiene el ID único según el tipo de hoja
 */
export function obtenerIdUnico(row: any, tipoHoja: 'PROVINCIA' | 'LIMA' | 'REPORTE' | 'ENTREGADO'): string | null {
  if (!row) return null;

  switch (tipoHoja) {
    case 'PROVINCIA':
    case 'LIMA':
    case 'REPORTE':
      return row.PEDIDO || null;
    case 'ENTREGADO':
      return row.ID || null; // ⚠️ ENTREGADO usa ID (columna A)
    default:
      return null;
  }
}

/**
 * Resumen de estructura por hoja
 */
export const ESTRUCTURA_HOJAS = {
  PROVINCIA: {
    columnas: 28,
    rango: 'A-AB',
    idUnico: 'PEDIDO',
    idIndex: 3,
  },
  LIMA: {
    columnas: 28,
    rango: 'A-AB',
    idUnico: 'PEDIDO',
    idIndex: 3,
  },
  REPORTE: {
    columnas: 20,
    rango: 'A-T',
    idUnico: 'PEDIDO',
    idIndex: 3,
  },
  ENTREGADO: {
    columnas: 39,
    rango: 'A-AM',
    idUnico: 'ID', // ⚠️ Diferente
    idIndex: 0,
  },
} as const;

/**
 * Estados conocidos del sistema
 */
export const ESTADOS_CONOCIDOS = {
  // Estados generales
  ENVIADO: 'ENVIADO',
  EN_TRANSITO: 'EN TRANSITO',
  EN_DESTINO: 'EN DESTINO',
  TIENDA: 'TIENDA',
  DEVOLUCION: 'DEVOLUCIÓN',
  PAGADO: 'PAGADO',
  ORIGEN: 'ORIGEN',
  
  // Estados específicos de Lima (prefijo L -)
  LIMA_EN_RUTA: 'L - EN RUTA',
  LIMA_PREPARADO: 'L - PREPARADO',
  LIMA_DEVOLUCION: 'L - DEVOLUCIÓN',
  LIMA_REPROGRAMAR: 'L - REPROGRAMAR',
  LIMA_NO_CONTESTA: 'L - NO CONTESTA',
  LIMA_ENTREGADO: 'L - ENTREGADO',
} as const;

export type EstadoEnvio = typeof ESTADOS_CONOCIDOS[keyof typeof ESTADOS_CONOCIDOS];

/**
 * Métodos de pago conocidos
 */
export const METODOS_PAGO = {
  YAPE: 'YAPE',
  PLIN: 'PLIN',
  AGENTE_BOP: 'AGENTE BOP',
  EFECTIVO: 'EFECTIVO',
  TRANSFERENCIA: 'TRANSFERENCIA',
  NO_ESPECIFICADO: 'No especificado',
} as const;

export type MetodoPago = typeof METODOS_PAGO[keyof typeof METODOS_PAGO];
