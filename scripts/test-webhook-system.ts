#!/usr/bin/env tsx

/**
 * Script de Testing del Sistema Webhook + Firestore
 * 
 * PROPÓSITO:
 * - Verificar que los webhooks están guardando datos en Firestore
 * - Monitorizar nuevas llamadas en tiempo real
 * - Validar estructura de datos
 * 
 * USO:
 * 1. Ejecutar este script: npx tsx scripts/test-webhook-system.ts
 * 2. Hacer una llamada de prueba en Zadarma
 * 3. Este script mostrará la nueva llamada guardada en Firestore
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface ZadarmaCall {
  call_id_with_rec?: string;
  pbx_call_id?: string;
  call_start?: string;
  disposition?: string;
  destination?: string;
  internal?: string;
  createdAt?: admin.firestore.Timestamp;
  updatedAt?: admin.firestore.Timestamp;
}

/**
 * Obtiene la última llamada registrada en Firestore
 */
async function getLatestCall(): Promise<{ id: string; data: ZadarmaCall } | null> {
  try {
    const snapshot = await db
      .collection('zadarma_calls')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      data: doc.data() as ZadarmaCall,
    };
  } catch (error) {
    console.error('❌ Error obteniendo última llamada:', error);
    return null;
  }
}

/**
 * Cuenta el total de llamadas en Firestore
 */
async function countTotalCalls(): Promise<number> {
  try {
    const snapshot = await db.collection('zadarma_calls').count().get();
    return snapshot.data().count;
  } catch (error) {
    console.error('❌ Error contando llamadas:', error);
    return 0;
  }
}

/**
 * Formatea una llamada para mostrar en consola
 */
function formatCall(id: string, call: ZadarmaCall): string {
  const lines = [
    `📞 ID: ${id}`,
    `   Call ID: ${call.call_id_with_rec || call.pbx_call_id || 'N/A'}`,
    `   Inicio: ${call.call_start || 'N/A'}`,
    `   Estado: ${call.disposition || 'N/A'}`,
    `   Destino: ${call.destination || 'N/A'}`,
    `   Interno: ${call.internal || 'N/A'}`,
    `   Creado: ${call.createdAt?.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' }) || 'N/A'}`,
    `   Actualizado: ${call.updatedAt?.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' }) || 'N/A'}`,
  ];
  return lines.join('\n');
}

/**
 * Monitoriza nuevas llamadas en tiempo real
 */
async function monitorCalls(): Promise<void> {
  console.log('🔍 MONITORIZANDO LLAMADAS EN TIEMPO REAL');
  console.log('=========================================\n');

  // Obtener última llamada inicial
  const initialCall = await getLatestCall();
  const initialCount = await countTotalCalls();

  console.log(`📊 Total de llamadas actuales: ${initialCount}`);
  
  if (initialCall) {
    console.log('\n📞 ÚLTIMA LLAMADA REGISTRADA:');
    console.log(formatCall(initialCall.id, initialCall.data));
  } else {
    console.log('\n⚠️  No hay llamadas registradas aún en Firestore');
  }

  console.log('\n\n🎯 INSTRUCCIONES:');
  console.log('1. Haz una llamada de prueba en Zadarma');
  console.log('2. Este script detectará automáticamente la nueva llamada');
  console.log('3. Presiona Ctrl+C para salir\n');
  console.log('⏳ Esperando nuevas llamadas...\n');

  let lastCallId = initialCall?.id || null;
  let lastCount = initialCount;

  // Monitorizar cada 3 segundos
  const intervalId = setInterval(async () => {
    const latestCall = await getLatestCall();
    const currentCount = await countTotalCalls();

    // Verificar si hay nueva llamada
    if (latestCall && latestCall.id !== lastCallId) {
      console.log('🆕 ¡NUEVA LLAMADA DETECTADA!');
      console.log('============================');
      console.log(formatCall(latestCall.id, latestCall.data));
      console.log('\n⏳ Esperando nuevas llamadas...\n');
      lastCallId = latestCall.id;
    }

    // Verificar si cambió el conteo
    if (currentCount !== lastCount) {
      console.log(`📊 Total de llamadas actualizado: ${lastCount} → ${currentCount}`);
      lastCount = currentCount;
    }
  }, 3000);

  // Manejo de Ctrl+C
  process.on('SIGINT', () => {
    clearInterval(intervalId);
    console.log('\n\n✅ Monitorización detenida');
    process.exit(0);
  });
}

/**
 * Función principal
 */
async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   TEST SISTEMA WEBHOOK + FIRESTORE             ║');
  console.log('║   DataWeave BI - Zadarma Integration           ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  await monitorCalls();
}

// Ejecutar
main().catch((error) => {
  console.error('💥 Error fatal:', error);
  process.exit(1);
});
