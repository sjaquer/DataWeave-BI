/**
 * SCRIPT DE LIMPIEZA COMPLETA DE BASE DE DATOS ZADARMA
 * 
 * ⚠️  ADVERTENCIA: Este script elimina TODOS los datos de Zadarma en Firestore
 * 
 * Uso:
 * 1. Modo prueba (DRY RUN): npx ts-node scripts/cleanup-zadarma-database.ts --dry-run
 * 2. Limpieza real: npx ts-node scripts/cleanup-zadarma-database.ts --confirm
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config();

class ZadarmaCleanupManager {
  private db: FirebaseFirestore.Firestore;
  private isDryRun: boolean;

  constructor(isDryRun: boolean = true) {
    this.isDryRun = isDryRun;
    this.initializeFirebase();
    this.db = getFirestore();
  }

  private initializeFirebase() {
    if (getApps().length === 0) {
      const serviceAccountPath = process.env.SERVICE_ACCOUNT || 
        path.join(process.cwd(), 'service-account.json');
      
      console.log('🔧 Inicializando Firebase Admin SDK...');
      console.log('📁 Ruta del service account:', serviceAccountPath);
      
      try {
        initializeApp({
          credential: cert(serviceAccountPath),
          projectId: process.env.FIREBASE_PROJECT_ID,
        });
        console.log('✅ Firebase Admin SDK inicializado correctamente');
      } catch (error) {
        console.error('❌ Error inicializando Firebase:', error);
        process.exit(1);
      }
    }
  }

  /**
   * Elimina todas las llamadas de Zadarma
   */
  async cleanZadarmaCalls(): Promise<number> {
    console.log('\n📞 Limpiando colección "zadarma_calls"...');
    
    const collection = this.db.collection('zadarma_calls');
    const snapshot = await collection.get();
    
    console.log(`   📊 Encontrados ${snapshot.size} documentos de llamadas`);
    
    if (snapshot.empty) {
      console.log('   ✨ Colección ya está vacía');
      return 0;
    }

    if (this.isDryRun) {
      console.log('   🔍 [DRY RUN] Se eliminarían', snapshot.size, 'documentos');
      return snapshot.size;
    }

    // Eliminar en lotes de 500 (límite de Firestore)
    let deletedCount = 0;
    const batchSize = 500;
    
    while (true) {
      const batch = this.db.batch();
      const docs = await collection.limit(batchSize).get();
      
      if (docs.empty) break;
      
      docs.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deletedCount += docs.size;
      
      console.log(`   🗑️  Eliminados ${deletedCount} documentos...`);
    }
    
    console.log(`   ✅ Eliminados ${deletedCount} documentos de llamadas`);
    return deletedCount;
  }

  /**
   * Elimina todos los metadatos de sincronización
   */
  async cleanSyncMetadata(): Promise<number> {
    console.log('\n📋 Limpiando colección "zadarma_sync_metadata"...');
    
    const collection = this.db.collection('zadarma_sync_metadata');
    const snapshot = await collection.get();
    
    console.log(`   📊 Encontrados ${snapshot.size} documentos de metadata`);
    
    if (snapshot.empty) {
      console.log('   ✨ Colección ya está vacía');
      return 0;
    }

    if (this.isDryRun) {
      console.log('   🔍 [DRY RUN] Se eliminarían', snapshot.size, 'documentos');
      return snapshot.size;
    }

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`   ✅ Eliminados ${snapshot.size} documentos de metadata`);
    return snapshot.size;
  }

  /**
   * Elimina todos los locks de sincronización
   */
  async cleanSyncLocks(): Promise<number> {
    console.log('\n🔒 Limpiando colección "zadarma_sync_locks"...');
    
    const collection = this.db.collection('zadarma_sync_locks');
    const snapshot = await collection.get();
    
    console.log(`   📊 Encontrados ${snapshot.size} documentos de locks`);
    
    if (snapshot.empty) {
      console.log('   ✨ Colección ya está vacía');
      return 0;
    }

    if (this.isDryRun) {
      console.log('   🔍 [DRY RUN] Se eliminarían', snapshot.size, 'documentos');
      return snapshot.size;
    }

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`   ✅ Eliminados ${snapshot.size} documentos de locks`);
    return snapshot.size;
  }

  /**
   * Muestra estadísticas de la base de datos
   */
  async showStats(): Promise<void> {
    console.log('\n📊 ESTADÍSTICAS ACTUALES DE LA BASE DE DATOS:');
    
    const collections = [
      'zadarma_calls',
      'zadarma_sync_metadata', 
      'zadarma_sync_locks'
    ];
    
    for (const collectionName of collections) {
      const snapshot = await this.db.collection(collectionName).get();
      console.log(`   ${collectionName}: ${snapshot.size} documentos`);
    }
  }

  /**
   * Ejecuta la limpieza completa
   */
  async executeCleanup(): Promise<void> {
    const startTime = Date.now();
    
    console.log('🧹 INICIANDO LIMPIEZA COMPLETA DE BASE DE DATOS ZADARMA');
    console.log('=' .repeat(60));
    
    if (this.isDryRun) {
      console.log('🔍 MODO: DRY RUN (no se realizarán cambios reales)');
    } else {
      console.log('⚠️  MODO: LIMPIEZA REAL (se eliminarán datos permanentemente)');
    }
    
    // Mostrar estado inicial
    await this.showStats();
    
    // Realizar limpieza
    const callsDeleted = await this.cleanZadarmaCalls();
    const metadataDeleted = await this.cleanSyncMetadata();
    const locksDeleted = await this.cleanSyncLocks();
    
    // Mostrar estado final
    if (!this.isDryRun) {
      console.log('\n📊 ESTADÍSTICAS FINALES:');
      await this.showStats();
    }
    
    // Resumen
    const duration = (Date.now() - startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE LIMPIEZA:');
    console.log(`   📞 Llamadas: ${callsDeleted}`);
    console.log(`   📋 Metadata: ${metadataDeleted}`);
    console.log(`   🔒 Locks: ${locksDeleted}`);
    console.log(`   ⏱️  Tiempo: ${duration}s`);
    console.log('=' .repeat(60));
    
    if (this.isDryRun) {
      console.log('🔍 Esto fue una simulación. Para ejecutar la limpieza real:');
      console.log('   npx ts-node scripts/cleanup-zadarma-database.ts --confirm');
    } else {
      console.log('✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
      console.log('💡 La base de datos Zadarma está ahora completamente limpia');
      console.log('🔄 Los nuevos datos se cargarán automáticamente en la próxima consulta');
    }
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--confirm');
  
  // Validación de argumentos
  if (!isDryRun && !args.includes('--confirm')) {
    console.log('❌ Argumento inválido');
    console.log('Uso:');
    console.log('  Simulación: npx ts-node scripts/cleanup-zadarma-database.ts --dry-run');
    console.log('  Limpieza real: npx ts-node scripts/cleanup-zadarma-database.ts --confirm');
    process.exit(1);
  }
  
  // Confirmación adicional para limpieza real
  if (!isDryRun) {
    console.log('⚠️  ADVERTENCIA: VAS A ELIMINAR TODOS LOS DATOS DE ZADARMA');
    console.log('⚠️  ESTA ACCIÓN NO SE PUEDE DESHACER');
    console.log('');
    console.log('Si estás seguro, presiona CTRL+C para cancelar o ENTER para continuar...');
    
    // Esperar confirmación del usuario
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve(null));
    });
  }
  
  try {
    const cleaner = new ZadarmaCleanupManager(isDryRun);
    await cleaner.executeCleanup();
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
    process.exit(1);
  }
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}