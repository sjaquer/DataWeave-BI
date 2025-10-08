/**
 * Script para arreglar pedidos con doble guion en el ID
 * 
 * PROBLEMA: Los pedidos se guardaron con IDs tipo "blumi--13674" (doble guion)
 * SOLUCIÓN: Migrar a "blumi-13674" (guion simple)
 * 
 * Uso:
 * npx tsx scripts/fix-double-dash-orders.ts
 */

import 'dotenv/config';
import admin from 'firebase-admin';

// Inicializar Firebase Admin
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

async function fixDoubleDashOrders() {
  console.log('🔍 Buscando pedidos con doble guion en el ID...\n');

  try {
    // Obtener todos los pedidos
    const ordersSnapshot = await db.collection('shopify_orders').get();
    
    let foundCount = 0;
    let migratedCount = 0;
    let errorCount = 0;
    
    const batch = db.batch();
    const documentsToDelete: string[] = [];

    for (const doc of ordersSnapshot.docs) {
      const docId = doc.id;
      const data = doc.data();
      
      // Buscar doble guion en el ID
      if (docId.includes('--')) {
        foundCount++;
        console.log(`\n❌ Encontrado: ${docId}`);
        
        // Crear nuevo ID con guion simple
        const newDocId = docId.replace(/--/g, '-');
        console.log(`   ✅ Nuevo ID: ${newDocId}`);
        
        try {
          // Verificar si el nuevo documento ya existe
          const newDocRef = db.collection('shopify_orders').doc(newDocId);
          const newDoc = await newDocRef.get();
          
          if (newDoc.exists) {
            console.log(`   ⚠️  El documento ${newDocId} ya existe. Mergeando datos...`);
            
            // Mergear: mantener datos de Shopify (newDoc) y solo actualizar confirmación si viene del viejo
            const existingData = newDoc.data();
            const updateData: any = {};
            
            // Solo actualizar confirmación si el viejo tiene y el nuevo no
            if (data.isConfirmed && !existingData?.isConfirmed) {
              updateData.isConfirmed = data.isConfirmed;
              updateData.confirmedAt = data.confirmedAt;
              updateData.confirmedBy = data.confirmedBy;
              updateData.courier = data.courier;
            }
            
            if (Object.keys(updateData).length > 0) {
              batch.update(newDocRef, updateData);
              console.log(`   ✅ Actualizando confirmación en ${newDocId}`);
            }
            
          } else {
            // Crear nuevo documento con los datos
            batch.set(newDocRef, data);
            console.log(`   ✅ Creando ${newDocId}`);
          }
          
          // Marcar el documento viejo para eliminación
          documentsToDelete.push(docId);
          migratedCount++;
          
        } catch (error: any) {
          console.error(`   ❌ Error procesando ${docId}:`, error.message);
          errorCount++;
        }
      }
    }

    if (foundCount === 0) {
      console.log('\n✅ No se encontraron pedidos con doble guion.\n');
      return;
    }

    console.log(`\n📊 Resumen:`);
    console.log(`   - Encontrados: ${foundCount}`);
    console.log(`   - A migrar: ${migratedCount}`);
    console.log(`   - Errores: ${errorCount}\n`);

    // Confirmar antes de ejecutar
    console.log('⚠️  Este script va a:');
    console.log('   1. Crear/actualizar documentos con ID correcto (guion simple)');
    console.log('   2. Eliminar documentos viejos (doble guion)\n');
    
    console.log('⏳ Ejecutando migración en 3 segundos...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Commit del batch (crear/actualizar)
    if (migratedCount > 0) {
      await batch.commit();
      console.log(`✅ ${migratedCount} documentos migrados correctamente\n`);
    }

    // Eliminar documentos viejos en lotes de 500
    console.log('🗑️  Eliminando documentos viejos...\n');
    let deletedCount = 0;
    const deleteChunks = [];
    
    for (let i = 0; i < documentsToDelete.length; i += 500) {
      deleteChunks.push(documentsToDelete.slice(i, i + 500));
    }

    for (const chunk of deleteChunks) {
      const deleteBatch = db.batch();
      chunk.forEach(docId => {
        deleteBatch.delete(db.collection('shopify_orders').doc(docId));
      });
      await deleteBatch.commit();
      deletedCount += chunk.length;
      console.log(`   Eliminados: ${deletedCount}/${documentsToDelete.length}`);
    }

    console.log(`\n✅ Migración completada exitosamente!`);
    console.log(`   - Migrados: ${migratedCount}`);
    console.log(`   - Eliminados: ${deletedCount}`);
    console.log(`   - Errores: ${errorCount}\n`);

  } catch (error: any) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

// Ejecutar
fixDoubleDashOrders()
  .then(() => {
    console.log('🎉 Script completado');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
