/**
 * Webhook para sincronizar datos TEMPORALES de la hoja PROVINCIA_ENVIADOS
 * 
 * Esta hoja contiene pedidos que están en tránsito o por entrar en tránsito.
 * Los datos son temporales y se actualizan constantemente.
 * 
 * Estrategia:
 * 1. Recibe TODOS los pedidos actuales de PROVINCIA_ENVIADOS
 * 2. Actualiza/crea documentos en colección temporal
 * 3. Detecta pedidos que ya no están (probablemente pasaron a REPORTE_ENVIADOS)
 * 4. Registra historial de cambios para analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

interface ProvinciaEnviadosRow {
  '#': number;
  ID: string;
  FECHA_CREADO: string;
  TIENE: string; // Tienda
  PEDIDO: string; // ID único del pedido
  PRODUCTOS: string;
  TOTAL: number;
  MONTO_PEND: number;
  NOMBRES: string;
  DNI: string;
  CELULAR: string;
  PROV: string; // Provincia
  DIR: string; // Dirección
  AGENCIA_SHALOM: string;
  COURIER: string;
  LINK_SHALOM: string;
  PDF: string;
  FECHA_ENVIADO?: string;
  ESTADO?: string; // EN_TRANSITO, PREPARANDO, etc.
  [key: string]: any;
}

interface WebhookPayload {
  data: ProvinciaEnviadosRow[];
}

export async function POST(request: NextRequest) {
  try {
    const { data }: WebhookPayload = await request.json();

    if (!data || !Array.isArray(data)) {
      return NextResponse.json(
        { status: 'error', message: 'Formato de datos inválido. Se esperaba un array.' },
        { status: 400 }
      );
    }

    console.log(`[PROVINCIA_ENVIADOS SYNC] Recibidos ${data.length} registros temporales`);

    // 1. Obtener lista actual de pedidos en la hoja
    const pedidosActuales = new Set(data.map(row => row.PEDIDO).filter(Boolean));
    
    // 2. Preparar batch para actualizaciones
    const batch = db.batch();
    let procesados = 0;
    let nuevos = 0;
    let actualizados = 0;

    // 3. Procesar cada pedido de la hoja
    for (const row of data) {
      if (!row.PEDIDO) {
        console.warn('[PROVINCIA_ENVIADOS] Fila sin PEDIDO, se omite:', row);
        continue;
      }

      const pedidoId = String(row.PEDIDO);
      const docRef = db.collection('pedidos_temporal_activos').doc(pedidoId);
      
      // Verificar si el documento ya existe
      const docSnapshot = await docRef.get();
      const esNuevo = !docSnapshot.exists;

      // Preparar datos para guardar
      const pedidoData = {
        pedidoId,
        tienda: row.TIENE || 'N/A',
        provincia: row.PROV || 'N/A',
        estado: row.ESTADO || 'EN_TRANSITO',
        courier: row.COURIER || 'N/A',
        cliente: row.NOMBRES || 'N/A',
        celular: row.CELULAR || 'N/A',
        direccion: row.DIR || 'N/A',
        agenciaShalom: row.AGENCIA_SHALOM || null,
        total: row.TOTAL || 0,
        montoPendiente: row.MONTO_PEND || 0,
        fechaCreado: row.FECHA_CREADO || null,
        fechaEnviado: row.FECHA_ENVIADO || null,
        datosCompletos: row,
        ultimaActualizacion: FieldValue.serverTimestamp(),
        enReporteEnviados: false,
        eliminadoDeTransito: false
      };

      // Actualizar o crear documento
      batch.set(docRef, pedidoData, { merge: true });

      // Registrar en historial solo si es nuevo o si cambió el estado
      if (esNuevo) {
        const historialRef = db.collection('pedidos_transito_historial').doc();
        batch.set(historialRef, {
          pedidoId,
          evento: 'ENTRADA_TRANSITO',
          timestamp: FieldValue.serverTimestamp(),
          estadoAnterior: null,
          estadoNuevo: pedidoData.estado,
          tienda: pedidoData.tienda,
          provincia: pedidoData.provincia,
          datosSnapshot: row
        });
        nuevos++;
      } else {
        // Verificar si cambió el estado
        const estadoAnterior = docSnapshot.data()?.estado;
        if (estadoAnterior !== pedidoData.estado) {
          const historialRef = db.collection('pedidos_transito_historial').doc();
          batch.set(historialRef, {
            pedidoId,
            evento: 'CAMBIO_ESTADO',
            timestamp: FieldValue.serverTimestamp(),
            estadoAnterior,
            estadoNuevo: pedidoData.estado,
            tienda: pedidoData.tienda,
            datosSnapshot: row
          });
        }
        actualizados++;
      }

      procesados++;
    }

    // 4. Detectar pedidos que ya NO están en PROVINCIA_ENVIADOS
    const snapshot = await db.collection('pedidos_temporal_activos')
      .where('enReporteEnviados', '==', false)
      .where('eliminadoDeTransito', '==', false)
      .get();

    let eliminados = 0;
    
    for (const doc of snapshot.docs) {
      const pedidoId = doc.data().pedidoId;
      
      if (!pedidosActuales.has(pedidoId)) {
        // Este pedido ya no está en PROVINCIA_ENVIADOS
        // Probablemente pasó a REPORTE_ENVIADOS
        batch.update(doc.ref, {
          eliminadoDeTransito: true,
          fechaEliminacion: FieldValue.serverTimestamp()
        });

        // Registrar en historial
        const historialRef = db.collection('pedidos_transito_historial').doc();
        batch.set(historialRef, {
          pedidoId,
          evento: 'SALIDA_TRANSITO',
          timestamp: FieldValue.serverTimestamp(),
          mensaje: 'Pedido eliminado de PROVINCIA_ENVIADOS (probablemente pasó a REPORTE_ENVIADOS)'
        });

        eliminados++;
      }
    }

    // 5. Ejecutar todas las operaciones
    await batch.commit();

    const mensaje = `Sincronización temporal completada: ${procesados} procesados (${nuevos} nuevos, ${actualizados} actualizados, ${eliminados} eliminados)`;
    
    console.log(`[PROVINCIA_ENVIADOS SYNC] ${mensaje}`);

    return NextResponse.json({
      status: 'success',
      message: mensaje,
      stats: {
        recibidos: data.length,
        procesados,
        nuevos,
        actualizados,
        eliminados
      }
    });

  } catch (error: any) {
    console.error('[PROVINCIA_ENVIADOS SYNC ERROR]:', error);
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
    // Endpoint de diagnóstico para ver estado actual de pedidos temporales
    const activosSnapshot = await db.collection('pedidos_temporal_activos')
      .where('enReporteEnviados', '==', false)
      .where('eliminadoDeTransito', '==', false)
      .get();

    const estadosCount: { [estado: string]: number } = {};
    const tiendasCount: { [tienda: string]: number } = {};
    const provinciasCount: { [provincia: string]: number } = {};

    activosSnapshot.forEach(doc => {
      const data = doc.data();
      estadosCount[data.estado] = (estadosCount[data.estado] || 0) + 1;
      tiendasCount[data.tienda] = (tiendasCount[data.tienda] || 0) + 1;
      provinciasCount[data.provincia] = (provinciasCount[data.provincia] || 0) + 1;
    });

    return NextResponse.json({
      status: 'success',
      totalActivos: activosSnapshot.size,
      porEstado: estadosCount,
      porTienda: tiendasCount,
      porProvincia: provinciasCount,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[PROVINCIA_ENVIADOS GET ERROR]:', error);
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
