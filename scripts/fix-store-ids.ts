/**
 * Script para corregir la inconsistencia de los IDs de tienda en Firestore.
 * Migra documentos de 'blumi-peru' y 'blumi-perú' a 'blumi'.
 * 
 * USO:
 * 1. Asegúrate de tener tus credenciales de Firebase Admin en .env (SERVICE_ACCOUNT)
 * 2. Ejecuta en la terminal: npx tsx scripts/fix-store-ids.ts
 */

import 'dotenv/config';
import admin from 'firebase-admin';

// --- Inicialización de Firebase Admin ---
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      throw new Error('La variable de entorno SERVICE_ACCOUNT no está configurada.');
    }
    const serviceAccount = JSON.parse(serviceAccountString);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    
    console.log('✅ Firebase Admin inicializado correctamente\n');
  } catch (error: any) {
    console.error('❌ Error al inicializar Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// --- Función Principal de Migración ---
async function migrateBlumiStoreIds() {
  console.log('🔍 Buscando pedidos con IDs de tienda "blumi-peru" o "blumi-perú"...');
  
  const ordersRef = db.collection('shopify_orders');
  const snapshot = await ordersRef.get();

  if (snapshot.empty) {
    console.log('✅ No se encontraron pedidos para procesar.');
    return;
  }

  const batch = db.batch();
  let migrationCount = 0;

  snapshot.forEach(doc => {
    const docId = doc.id;
    let newDocId = docId;
    let needsMigration = false;

    // Detectar y corregir IDs incorrectos
    if (docId.startsWith('blumi-peru-') || docId.startsWith('blumi-perú-')) {
      newDocId = docId.replace(/blumi-per[uú]-/, 'blumi-');
      needsMigration = true;
    }
    
    if (needsMigration) {
      console.log(`  ➡️  Migrando ${docId} a ${newDocId}`);
      migrationCount++;
      
      const oldDocRef = ordersRef.doc(docId);
      const newDocRef = ordersRef.doc(newDocId);
      const data = doc.data();

      // Corregir el campo 'storeId' dentro del documento también
      if (data.storeId.includes('peru') || data.storeId.includes('perú')) {
        data.storeId = 'blumi';
      }
      
      // Crear el nuevo documento y eliminar el viejo
      batch.set(newDocRef, data, { merge: true }); // Usar merge por si el doc correcto ya existe
      batch.delete(oldDocRef);
    }
  });

  if (migrationCount === 0) {
    console.log('\n✅ ¡Excelente! No se encontraron IDs de tienda incorrectos para "blumi".');
    return;
  }

  console.log(`\n📊 Se migrarán ${migrationCount} documentos.`);
  
  try {
    await batch.commit();
    console.log(`\n🎉 ¡Éxito! Se han migrado y corregido ${migrationCount} documentos.`);
  } catch (error: any) {
    console.error('\n❌ Error al ejecutar el batch de migración:', error.message);
  }
}

// --- Ejecutar el Script ---
migrateBlumiStoreIds()
  .then(() => {
    console.log('\nScript de migración completado.');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error fatal durante la ejecución del script:', error);
    process.exit(1);
  });
