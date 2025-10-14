/**
 * Webhook UNIFICADO para sincronizar datos TEMPORALES
 * 
 * Hojas manejadas:
 * - PROVINCIA_ENVIADOS: Pedidos de provincia en tránsito
 * - LIMA_ENVIADOS: Pedidos de Lima en tránsito
 * 
 * Estados posibles (según imágenes):
 * - ENVIADO
 * - EN TRANSITO
 * - EN DESTINO
 * - TIENDA
 * - DEVOLUCIÓN
 * - PAGADO
 * - ORIGEN
 * - L - EN RUTA
 * - L - PREPARADO
 * - L - DEVOLUCIÓN
 * - L - REPROGRAMAR
 * - L - NO CONTESTA
 * - L - ENTREGADO
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
  ID: string;
  FECHA_CREADO: string;
  TIENDA: string;
  PEDIDO: string; // ID único del pedido (puede ser PEDID también)
  PRODUCTOS: string;
  M: number;
  NOMBRES: string;
  DNI: string;
  CELULAR: string;
  PROV: string;
  DIRECCION: string;
  COURIER: string;
  CLAVES: string;
  FECHA_ENVIADO?: string;
  ESTADO?: string; // Estado actual del pedido
  TIPO_ORIGEN: 'PROVINCIA' | 'LIMA'; // Agregado por el script
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
      const estadoActual = row.ESTADO || 'SIN_ESTADO';

      // Preparar datos para guardar
      const pedidoData = {
        pedidoId,
        tipoOrigen, // PROVINCIA o LIMA
        tienda: row.TIENDA || 'N/A',
        provincia: row.PROV || (tipoOrigen === 'LIMA' ? 'Lima' : 'N/A'),
        estado: estadoActual,
        courier: row.COURIER || 'N/A',
        cliente: row.NOMBRES || row.NOMB || 'N/A',
        celular: row.CELULAR || 'N/A',
        direccion: row.DIRECCION || 'N/A',
        claves: row.CLAVES || null,
        monto: row.M || 0,
        fechaCreado: row.FECHA_CREADO || null,
        fechaEnviado: row.FECHA_ENVIADO || null,
        productos: row.PRODUCTOS || 'N/A',
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

    activosSnapshot.forEach((doc: any) => {
      const data = doc.data();
      estadosCount[data.estado] = (estadosCount[data.estado] || 0) + 1;
      tiendasCount[data.tienda] = (tiendasCount[data.tienda] || 0) + 1;
      provinciasCount[data.provincia] = (provinciasCount[data.provincia] || 0) + 1;
      couriersCount[data.courier] = (couriersCount[data.courier] || 0) + 1;
      tipoOrigenCount[data.tipoOrigen as 'PROVINCIA' | 'LIMA']++;
    });

    return NextResponse.json({
      status: 'success',
      totalActivos: activosSnapshot.size,
      porTipoOrigen: tipoOrigenCount,
      porEstado: estadosCount,
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
