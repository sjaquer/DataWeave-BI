#!/usr/bin/env tsx

/**
 * Verificación Rápida de Llamadas en Firestore
 */

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function checkCalls() {
  console.log('🔍 Verificando llamadas en Firestore...\n');

  // Contar total
  const countSnapshot = await db.collection('zadarma_calls').count().get();
  const total = countSnapshot.data().count;
  console.log(`📊 Total de llamadas: ${total}`);

  if (total === 0) {
    console.log('\n⚠️  No hay llamadas registradas aún.');
    console.log('✅ Esto es NORMAL si acabas de limpiar Firestore.');
    console.log('\n🎯 SIGUIENTE PASO:');
    console.log('   1. Haz una llamada de prueba en Zadarma');
    console.log('   2. Ejecuta este script de nuevo: npx tsx scripts/check-firestore-calls.ts');
    console.log('   3. Deberías ver 1 llamada registrada\n');
    return;
  }

  // Obtener últimas 5 llamadas
  const snapshot = await db
    .collection('zadarma_calls')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();

  console.log(`\n📞 Últimas ${snapshot.size} llamadas:\n`);

  snapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. ID: ${doc.id}`);
    console.log(`   Call Start: ${data.call_start || 'N/A'}`);
    console.log(`   Disposition: ${data.disposition || 'N/A'}`);
    console.log(`   Destination: ${data.destination || 'N/A'}`);
    console.log(`   Internal: ${data.internal || 'N/A'}`);
    console.log(`   Created: ${data.createdAt?.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' }) || 'N/A'}`);
    console.log('');
  });

  console.log('✅ Sistema funcionando correctamente\n');
}

checkCalls().catch(console.error).finally(() => process.exit(0));
