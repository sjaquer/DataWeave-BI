/**
 * Webhook UNIFICADO para sincronizar datos TEMPORALES
 * 
 * Hojas manejadas:
 * - PROVINCIA_ENVIADOS: Pedidos de provincia en tránsito
 * - LIMA_ENVIADOS: Pedidos de Lima en tránsito
 * 
 * IMPORTANTE - DIFERENCIAS CRÍTICAS ENTRE HOJAS:
 * 
 * PROVINCIA_ENVIADOS:
 * - Courier: Columna P (COURIER) - Ej: "SHALOM", "OLVA", "TEPSA"
 * - Estados: Sin prefijo - "ENVIADO", "EN TRANSITO", "EN DESTINO"
 * - Claves: Columna W - Código de seguimiento
 * 
 * LIMA_ENVIADOS:
 * - Courier: Columna W (CLAVES) ⚠️ NO columna P - Ej: "DIN", "CLOCK"
 * - Estados: Con prefijo "L-" - "L-ENTREGADO", "L-EN RUTA"
 * - Claves: Misma columna W pero aquí ES el courier
 * 
 * Estados reconocidos:
 * PROVINCIA: ENVIADO, EN TRANSITO, EN DESTINO, TIENDA, DEVOLUCIÓN, PAGADO, ORIGEN
 * LIMA: L-EN RUTA, L-PREPARADO, L-DEVOLUCIÓN, L-REPROGRAMAR, L-NO CONTESTA, L-ENTREGADO, L-RETORNADO
 * 
 * Estrategia: Tabla Temporal con Timestamps
 * - Solo mantiene pedidos ACTIVOS en tránsito
 * - Registra historial completo de cambios
 * - Detecta cuando un pedido pasa a REPORTE_ENVIADOS
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface EnvioTemporalRow {
  // Estructura REAL verificada 2025-10-15
  // PROVINCIA_ENVIADOS y LIMA_ENVIADOS tienen EXACTAMENTE la misma estructura (28 columnas A-AB)
  
  // Columnas principales (A-H)
  ID: string;                    // A - ID interno sistema
  FECHA_CREADO?: string;         // B - Fecha creación (puede ser "FECHA CREADO")
  'FECHA CREADO'?: string;       // B - Variante del header
  TIENDA: string;                // C - Tienda origen
  PEDIDO: string;                // D - ID único del pedido (ej: "#Z4890", "N-13128")
  PRODUCTOS: string;             // E - Descripción productos
  'PRODUCTO 2'?: string;         // F - Producto adicional
  TOTAL?: number;                // G - Total del pedido
  'MONTO PENDIENTE'?: number;    // H - Monto pendiente
  
  // Datos del cliente (I-K)
  NOMBRES: string;               // I - Nombre del cliente (ambas hojas usan NOMBRES)
  DNI?: string;                  // J - DNI del cliente
  CELULAR?: string;              // K - Teléfono
  
  // Ubicación (L-M)
  PROVINCIA?: string;            // L - Provincia destino
  PROV?: string;                 // Alias de PROVINCIA
  DIRECCION: string;             // M - Dirección entrega
  
  // Courier y seguimiento (N-P)
  'AGENCIA SHALOM'?: string;     // N - Agencia Shalom
  'PDF URL'?: string;            // O - URL del PDF
  COURIER: string;               // P - Courier asignado (SOLO para PROVINCIA)
  
  // Control interno (Q-T)
  ENVIAR?: boolean | string;     // Q - Flag envío
  ANULAR?: boolean | string;     // R - Flag anulación
  ATENDIDO?: string;             // S - Usuario que atendió
  SUBIDO?: string;               // T - Usuario que subió
  
  // Notas y observaciones (U-V)
  'NOTAS DEL PEDIDO'?: string;   // U - Notas
  OBSERVACIONES?: string;        // V - Observaciones
  
  // Seguimiento (W-Y)
  CLAVES?: string;               // W - IMPORTANTE: Para LIMA, esto es el COURIER (DIN, CLOCK, etc.)
  'LINK SHALOM'?: string;        // X - URL rastreo Shalom
  'PDF SHALOM'?: string;         // Y - PDF comprobante
  
  // Fechas y estado (Z-AB)
  'FECHA ENVIADO'?: string;      // Z - Fecha envío
  FECHA_ENVIADO?: string;        // Alias
  ENTREGADO?: string | boolean;  // AA - Flag/fecha entrega
  ESTADO?: string;               // AB - Estado actual (última columna)
  
  // Campos legacy/alternativos
  M?: number;                    // Alias de MONTO
  NOMB?: string;                 // Alias de NOMBRES
  PEDID?: string;                // Alias de PEDIDO
  
  // Metadatos
  TIPO_ORIGEN?: 'PROVINCIA' | 'LIMA'; // Agregado por el script
  [key: string]: any;
}

interface WebhookPayload {
  data: EnvioTemporalRow[];
  tipoOrigen: 'PROVINCIA' | 'LIMA';
}

export async function POST(request: NextRequest) {
  try {
    const { data, tipoOrigen }: WebhookPayload = await request.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { status: 'error', message: 'Formato de datos inválido. Se esperaba un array.' },
        { status: 400 }
      );
    }

    if (!tipoOrigen || !['PROVINCIA', 'LIMA'].includes(tipoOrigen)) {
      return NextResponse.json(
        { status: 'error', message: 'tipoOrigen debe ser PROVINCIA o LIMA.' },
        { status: 400 }
      );
    }

    console.log(`[ENVIOS TEMPORALES] Recibidos ${data.length} registros de ${tipoOrigen}`);

    // 1. Obtener lista actual de pedidos en la hoja
    const pedidosActuales = new Set(
      data.map(row => row.PEDIDO || row.PEDID).filter(Boolean)
    );
    
    // 2. Preparar batch para actualizaciones
    const batch = db.batch();
    let procesados = 0;
    let nuevos = 0;
    let actualizados = 0;
    let cambiosEstado = 0;

    // 3. Procesar cada pedido de la hoja
    for (const row of data) {
      const pedidoId = String(row.PEDIDO || row.PEDID || '').trim();
      
      if (!pedidoId) {
        console.warn(`[ENVIOS TEMPORALES] Fila sin PEDIDO en ${tipoOrigen}, se omite:`, row);
        continue;
      }

      const docRef = db.collection('envios_temporales').doc(pedidoId);
      
      // Verificar si el documento ya existe
      const docSnapshot = await docRef.get();
      const esNuevo = !docSnapshot.exists;
      const estadoAnterior = docSnapshot.exists ? docSnapshot.data()?.estado : null;
      
      // IMPORTANTE: Leer ESTADO con múltiples variantes
      // Puede venir como: ESTADO, Estado, estado, o en datosCompletos
      const estadoActual = row.ESTADO || row.Estado || row.estado || 'SIN_ESTADO';
      
      // DEBUG: Logear si el estado viene vacío para investigar
      if (estadoActual === 'SIN_ESTADO') {
        console.warn(`[ENVIOS TEMPORALES] Pedido ${pedidoId} (${tipoOrigen}) sin estado definido. Headers disponibles:`, Object.keys(row).filter(k => k.toUpperCase().includes('ESTADO')));
      }

      // Preparar datos para guardar
      const pedidoData = {
        pedidoId,
        tipoOrigen, // PROVINCIA o LIMA
        tienda: row.TIENDA || 'N/A',
        provincia: row.PROVINCIA || row.PROV || (tipoOrigen === 'LIMA' ? 'Lima' : 'N/A'),
        estado: estadoActual,
        courier: row.COURIER || 'N/A',
        cliente: row.NOMBRES || row.NOMB || 'N/A',
        celular: row.CELULAR || 'N/A',
        direccion: row.DIRECCION || 'N/A',
        claves: row.CLAVES || null,
        monto: row.TOTAL || row.M || 0,
        montoPendiente: row['MONTO PENDIENTE'] || 0,
        fechaCreado: row['FECHA CREADO'] || row.FECHA_CREADO || null,
        fechaEnviado: row['FECHA ENVIADO'] || row.FECHA_ENVIADO || null,
        productos: row.PRODUCTOS || 'N/A',
        producto2: row['PRODUCTO 2'] || null,
        agenciaShalom: row['AGENCIA SHALOM'] || null,
        linkShalom: row['LINK SHALOM'] || null,
        pdfShalom: row['PDF SHALOM'] || null,
        atendidoPor: row.ATENDIDO || null,
        subidoPor: row.SUBIDO || null,
        notas: row['NOTAS DEL PEDIDO'] || null,
        observaciones: row.OBSERVACIONES || null,
        datosCompletos: row,
        ultimaActualizacion: FieldValue.serverTimestamp(),
        enReporteEnviados: false,
        eliminadoDeTransito: false,
        fechaCreacion: esNuevo ? FieldValue.serverTimestamp() : docSnapshot.data()?.fechaCreacion
      };

      // Actualizar o crear documento
      batch.set(docRef, pedidoData, { merge: true });

      // Registrar en historial
      if (esNuevo) {
        // Pedido nuevo que entra en tránsito
        const historialRef = db.collection('envios_temporales_historial').doc();
        batch.set(historialRef, {
          pedidoId,
          tipoOrigen,
          evento: 'ENTRADA_TRANSITO',
          timestamp: FieldValue.serverTimestamp(),
          estadoAnterior: null,
          estadoNuevo: estadoActual,
          tienda: pedidoData.tienda,
          provincia: pedidoData.provincia,
          courier: pedidoData.courier,
          datosSnapshot: row
        });
        nuevos++;
      } else if (estadoAnterior !== estadoActual) {
        // Cambió el estado
        const historialRef = db.collection('envios_temporales_historial').doc();
        batch.set(historialRef, {
          pedidoId,
          tipoOrigen,
          evento: 'CAMBIO_ESTADO',
          timestamp: FieldValue.serverTimestamp(),
          estadoAnterior,
          estadoNuevo: estadoActual,
          tienda: pedidoData.tienda,
          datosSnapshot: row
        });
        cambiosEstado++;
        actualizados++;
      } else {
        // Actualización sin cambio de estado (puede ser cambio de datos)
        actualizados++;
      }

      procesados++;
    }

    // 4. Detectar pedidos que ya NO están en la hoja (del mismo tipo de origen)
    const snapshot = await db.collection('envios_temporales')
      .where('tipoOrigen', '==', tipoOrigen)
      .where('enReporteEnviados', '==', false)
      .where('eliminadoDeTransito', '==', false)
      .get();

    let eliminados = 0;
    
    for (const doc of snapshot.docs) {
      const pedidoId = doc.data().pedidoId;
      
      if (!pedidosActuales.has(pedidoId)) {
        // Este pedido ya no está en la hoja
        // Probablemente pasó a REPORTE_ENVIADOS
        batch.update(doc.ref, {
          eliminadoDeTransito: true,
          fechaEliminacion: FieldValue.serverTimestamp()
        });

        // Registrar en historial
        const historialRef = db.collection('envios_temporales_historial').doc();
        batch.set(historialRef, {
          pedidoId,
          tipoOrigen,
          evento: 'SALIDA_TRANSITO',
          timestamp: FieldValue.serverTimestamp(),
          mensaje: `Pedido eliminado de ${tipoOrigen}_ENVIADOS (probablemente pasó a REPORTE_ENVIADOS)`
        });

        eliminados++;
      }
    }

    // 5. Ejecutar todas las operaciones
    await batch.commit();

    const mensaje = `${tipoOrigen}: ${procesados} procesados (${nuevos} nuevos, ${actualizados} actualizados, ${cambiosEstado} cambios de estado, ${eliminados} eliminados)`;
    
    console.log(`[ENVIOS TEMPORALES] ${mensaje}`);

    return NextResponse.json({
      status: 'success',
      message: mensaje,
      stats: {
        tipoOrigen,
        recibidos: data.length,
        procesados,
        nuevos,
        actualizados,
        cambiosEstado,
        eliminados
      }
    });

  } catch (error: any) {
    console.error('[ENVIOS TEMPORALES ERROR]:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'Error al procesar la sincronización temporal',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Endpoint de diagnóstico para ver estado actual de envíos temporales
    const activosSnapshot = await db.collection('envios_temporales')
      .where('enReporteEnviados', '==', false)
      .where('eliminadoDeTransito', '==', false)
      .get();

    const estadosCount: { [estado: string]: number } = {};
    const tiendasCount: { [tienda: string]: number } = {};
    const provinciasCount: { [provincia: string]: number } = {};
    const couriersCount: { [courier: string]: number } = {};
    const tipoOrigenCount = { PROVINCIA: 0, LIMA: 0 };

    // Contadores por tipo de origen y estado
    const estadosPorOrigen: {
      PROVINCIA: { [estado: string]: number };
      LIMA: { [estado: string]: number };
    } = {
      PROVINCIA: {},
      LIMA: {}
    };

    activosSnapshot.forEach((doc: any) => {
      const data = doc.data();
      const tipoOrigen = data.tipoOrigen as 'PROVINCIA' | 'LIMA';
      const estado = data.estado || 'SIN_ESTADO';
      
      // Contadores globales
      estadosCount[estado] = (estadosCount[estado] || 0) + 1;
      tiendasCount[data.tienda] = (tiendasCount[data.tienda] || 0) + 1;
      provinciasCount[data.provincia] = (provinciasCount[data.provincia] || 0) + 1;
      couriersCount[data.courier] = (couriersCount[data.courier] || 0) + 1;
      tipoOrigenCount[tipoOrigen]++;
      
      // Contadores por origen
      if (!estadosPorOrigen[tipoOrigen][estado]) {
        estadosPorOrigen[tipoOrigen][estado] = 0;
      }
      estadosPorOrigen[tipoOrigen][estado]++;
    });

    return NextResponse.json({
      status: 'success',
      totalActivos: activosSnapshot.size,
      porTipoOrigen: tipoOrigenCount,
      porEstado: estadosCount,
      estadosPorOrigen, // Nuevo: estados separados por PROVINCIA y LIMA
      porTienda: tiendasCount,
      porProvincia: provinciasCount,
      porCourier: couriersCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[ENVIOS TEMPORALES GET ERROR]:', error);
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
