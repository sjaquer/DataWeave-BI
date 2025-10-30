/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SCRIPT DE LIMPIEZA DE COLECCIONES FIRESTORE - ZADARMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Este script elimina TODAS las colecciones de Zadarma para permitir una
 * repoblación limpia con la arquitectura Webhook + Backfill.
 *
 * ⚠️  ADVERTENCIA: ESTO ELIMINARÁ PERMANENTEMENTE TODOS LOS DATOS
 *
 * COLECCIONES A ELIMINAR:
 * -----------------------
 * 1. zadarma_calls           (llamadas históricas)
 * 2. zadarma_sync_metadata   (metadatos de sincronización antiguo sistema)
 * 3. zadarma_sync_locks      (locks de sincronización antiguo sistema)
 *
 * USO:
 * ----
 * 1. Instalar Firebase Admin SDK en scripts:
 *    npm install firebase-admin --save-dev
 *
 * 2. Ejecutar script:
 *    npx tsx scripts/cleanup-zadarma-collections.ts
 *
 * 3. Repoblar datos:
 *    npm run zadarma:backfill -- --from="2024-01-01" --to="2025-10-30"
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as admin from 'firebase-admin';
import * as readline from 'readline';

// Configuración
const COLLECTIONS_TO_DELETE = [
  'zadarma_calls',
  'zadarma_sync_metadata',
  'zadarma_sync_locks'
];

const BATCH_SIZE = 500; // Firestore batch limit

// Funciones
function initializeFirebase() {
  if (admin.apps.length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Faltan credenciales de Firebase. Configura FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }

  return admin.firestore();
}

async function deleteCollection(
  db: admin.firestore.Firestore,
  collectionPath: string
): Promise<number> {
  const collectionRef = db.collection(collectionPath);
  let totalDeleted = 0;

  console.log(`\n📦 Procesando colección: ${collectionPath}`);

  while (true) {
    const snapshot = await collectionRef.limit(BATCH_SIZE).get();

    if (snapshot.empty) {
      console.log(`✅ Colección ${collectionPath} limpiada. Total eliminado: ${totalDeleted} documentos`);
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    totalDeleted += snapshot.size;

    console.log(`   Eliminados: ${snapshot.size} documentos (Total: ${totalDeleted})`);

    // Pequeña pausa para evitar throttling
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return totalDeleted;
}

async function askConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'y');
    });
  });
}

// Main execution
async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('LIMPIEZA DE COLECCIONES FIRESTORE - ZADARMA');
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('⚠️  ADVERTENCIA: Este script eliminará PERMANENTEMENTE las siguientes colecciones:');
  console.log('');
  COLLECTIONS_TO_DELETE.forEach((col) => console.log(`   • ${col}`));
  console.log('');
  console.log('Esta acción NO SE PUEDE DESHACER.');
  console.log('');
  console.log('Razón: Preparar repoblación limpia con arquitectura Webhook + Backfill');
  console.log('');

  const confirmed = await askConfirmation('¿Estás seguro de que deseas continuar? (s/n): ');

  if (!confirmed) {
    console.log('\n❌ Operación cancelada.');
    process.exit(0);
  }

  try {
    console.log('\n🔄 Inicializando Firebase Admin SDK...');
    const db = initializeFirebase();
    console.log('✅ Conectado a Firestore');

    let totalDeletedAll = 0;

    for (const collection of COLLECTIONS_TO_DELETE) {
      const deleted = await deleteCollection(db, collection);
      totalDeletedAll += deleted;
    }

    console.log('\n═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ LIMPIEZA COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log(`\nTotal de documentos eliminados: ${totalDeletedAll}`);
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('');
    console.log('1. Desplegar código a Vercel:');
    console.log('   git add .');
    console.log('   git commit -m "feat: Arquitectura Webhook + Backfill"');
    console.log('   git push origin main');
    console.log('');
    console.log('2. Configurar webhook en panel de Zadarma:');
    console.log('   URL: https://tu-app.vercel.app/api/zadarma/webhook');
    console.log('   Eventos: NOTIFY_END, NOTIFY_MISSED');
    console.log('');
    console.log('3. Ejecutar backfill para repoblar datos históricos:');
    console.log('   npm run zadarma:backfill -- --from="2024-01-01" --to="2025-10-30"');
    console.log('');
    console.log('4. Verificar datos en Firestore Console');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════════════');

  } catch (error: any) {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
