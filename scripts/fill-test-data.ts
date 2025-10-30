#!/usr/bin/env tsx

/**
 * Llenar Firestore con Datos de Prueba
 * 
 * USO:
 *   npm run fill:testdata
 * 
 * PROPÓSITO:
 * - Crea llamadas de prueba en Firestore
 * - Útil para testing sin hacer llamadas reales
 * - Genera datos realistas de los últimos 7 días
 */

import * as admin from 'firebase-admin';

// Inicializar Firebase
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

// Datos de prueba realistas
const INTERNOS = ['101', '102', '103', '104', '105'];
const DESTINATIONS = [
  '+51987654321',
  '+51912345678',
  '+51998765432',
  '+51923456789',
  '+51987123456',
];
const DISPOSITIONS: Array<'answered' | 'missed' | 'busy' | 'cancel'> = [
  'answered',
  'answered',
  'answered',
  'missed',
  'busy',
];

/**
 * Genera una llamada aleatoria
 */
function generateRandomCall(date: Date) {
  const hour = Math.floor(Math.random() * 10) + 8; // 8-18hrs
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);

  const callDate = new Date(date);
  callDate.setHours(hour, minute, second, 0);

  const callStart = callDate.toISOString().slice(0, 19).replace('T', ' ');
  const disposition = DISPOSITIONS[Math.floor(Math.random() * DISPOSITIONS.length)];
  const internal = INTERNOS[Math.floor(Math.random() * INTERNOS.length)];
  const destination = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
  const duration = disposition === 'answered' ? Math.floor(Math.random() * 300) + 30 : 0;

  return {
    pbx_call_id: `test-${callDate.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
    call_start: callStart,
    disposition,
    internal,
    destination,
    duration: duration > 0 ? duration : undefined,
    createdAt: admin.firestore.Timestamp.fromDate(callDate),
    updatedAt: admin.firestore.Timestamp.fromDate(callDate),
  };
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   LLENAR FIRESTORE CON DATOS DE PRUEBA        ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const DAYS = 7;
  const CALLS_PER_DAY = 20;
  const totalCalls = DAYS * CALLS_PER_DAY;

  console.log(`📊 Configuración:`);
  console.log(`   - Días: ${DAYS} (últimos ${DAYS} días)`);
  console.log(`   - Llamadas por día: ${CALLS_PER_DAY}`);
  console.log(`   - Total a crear: ${totalCalls}\n`);

  console.log('⚠️  ADVERTENCIA: Esto escribirá datos en Firestore');
  console.log('   Continúa solo si estás seguro\n');

  // Esperar 2 segundos
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('🔄 Generando llamadas...\n');

  const batch = db.batch();
  let count = 0;

  // Generar llamadas para cada día
  for (let day = 0; day < DAYS; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);

    console.log(`📅 Día ${day + 1}/${DAYS}: ${date.toISOString().split('T')[0]}`);

    for (let i = 0; i < CALLS_PER_DAY; i++) {
      const call = generateRandomCall(date);
      const docRef = db.collection('zadarma_calls').doc(call.pbx_call_id);
      batch.set(docRef, call);
      count++;
    }

    console.log(`   ✅ ${CALLS_PER_DAY} llamadas generadas`);
  }

  console.log(`\n💾 Guardando ${count} llamadas en Firestore...`);
  
  try {
    await batch.commit();
    console.log(`✅ ${count} llamadas guardadas exitosamente\n`);

    console.log('╔════════════════════════════════════════════════╗');
    console.log('║   VERIFICACIÓN                                 ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('Ejecuta para verificar:');
    console.log('   npm run check:firestore\n');
  } catch (error) {
    console.error('❌ Error guardando en Firestore:', error);
  }
}

main().catch(console.error).finally(() => process.exit(0));
