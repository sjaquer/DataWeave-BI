#!/usr/bin/env tsx

/**
 * Verificación Simple de Firestore
 * 
 * USO:
 *   npm run check:firestore
 * 
 * PROPÓSITO:
 * - Ver últimas llamadas en Firestore
 * - Contar total de llamadas
 * - Verificar que el webhook está guardando datos
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

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   VERIFICACIÓN FIRESTORE - zadarma_calls       ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  try {
    // Contar total
    console.log('📊 Contando llamadas...');
    const countSnapshot = await db.collection('zadarma_calls').count().get();
    const total = countSnapshot.data().count;
    console.log(`   Total: ${total} llamadas\n`);

    if (total === 0) {
      console.log('⚠️  No hay llamadas en Firestore');
      console.log('\n🎯 ACCIONES SUGERIDAS:');
      console.log('   1. Ejecutar test de webhook: npm run test:webhook');
      console.log('   2. Hacer llamada real en Zadarma');
      console.log('   3. Ejecutar backfill: npm run zadarma:backfill:test\n');
      return;
    }

    // Obtener últimas 10 llamadas
    console.log('📞 Últimas 10 llamadas:\n');
    const snapshot = await db
      .collection('zadarma_calls')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`${index + 1}. ${doc.id}`);
      console.log(`   Inicio: ${data.call_start || 'N/A'}`);
      console.log(`   Estado: ${data.disposition || 'N/A'}`);
      console.log(`   Destino: ${data.destination || 'N/A'}`);
      console.log(`   Interno: ${data.internal || 'N/A'}`);
      console.log(`   Creado: ${data.createdAt?.toDate().toLocaleString('es-PE', { timeZone: 'America/Lima' }) || 'N/A'}`);
      console.log('');
    });

    console.log('✅ Sistema funcionando correctamente\n');
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n⚠️  POSIBLES CAUSAS:');
    console.log('   1. Credenciales de Firebase no configuradas');
    console.log('   2. Permisos insuficientes en Firestore');
    console.log('   3. Índice faltante en Firestore\n');
  }
}

main().catch(console.error).finally(() => process.exit(0));
