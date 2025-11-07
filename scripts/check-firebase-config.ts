/**
 * Script de diagnóstico para verificar configuración de Firebase Admin
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function runDiagnostic() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔍 DIAGNÓSTICO DE CONFIGURACIÓN FIREBASE ADMIN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  // Verificar variables de entorno
  const serviceAccount = process.env.SERVICE_ACCOUNT;
  const googleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  console.log('📋 VARIABLES DE ENTORNO:');
  console.log('------------------------');
  console.log('SERVICE_ACCOUNT presente:', !!serviceAccount);
  if (serviceAccount) {
    console.log('  - Longitud:', serviceAccount.length, 'caracteres');
    console.log('  - Primeros 100 caracteres:', serviceAccount.substring(0, 100));
    
    try {
      const parsed = JSON.parse(serviceAccount);
      console.log('  - ✅ JSON válido');
      console.log('  - Project ID:', parsed.project_id || 'NO PRESENTE');
      console.log('  - Client Email:', parsed.client_email || 'NO PRESENTE');
      console.log('  - Private Key presente:', !!parsed.private_key);
      console.log('  - Type:', parsed.type || 'NO PRESENTE');
    } catch (e: any) {
      console.error('  - ❌ JSON INVÁLIDO:', e.message);
    }
  } else {
    console.log('  - ❌ NO CONFIGURADO');
  }

  console.log('');
  console.log('GOOGLE_APPLICATION_CREDENTIALS presente:', !!googleCreds);
  if (googleCreds) {
    console.log('  - Path:', googleCreds);
    
    // Intentar leer el archivo
    try {
      const fs = require('fs');
      if (fs.existsSync(googleCreds)) {
        console.log('  - ✅ Archivo existe');
        const content = fs.readFileSync(googleCreds, 'utf8');
        const parsed = JSON.parse(content);
        console.log('  - Project ID:', parsed.project_id || 'NO PRESENTE');
        console.log('  - Client Email:', parsed.client_email || 'NO PRESENTE');
      } else {
        console.log('  - ❌ Archivo NO existe en esa ruta');
      }
    } catch (e: any) {
      console.error('  - ❌ Error al leer archivo:', e.message);
    }
  } else {
    console.log('  - ❌ NO CONFIGURADO');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 INTENTANDO INICIALIZAR FIREBASE ADMIN');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');

  try {
    const admin = require('firebase-admin');
    
    if (!admin.apps.length) {
      if (serviceAccount) {
        console.log('📝 Intentando con SERVICE_ACCOUNT...');
        const parsed = JSON.parse(serviceAccount);
        admin.initializeApp({
          credential: admin.credential.cert(parsed)
        });
        console.log('✅ Inicialización EXITOSA con SERVICE_ACCOUNT');
      } else if (googleCreds) {
        console.log('📝 Intentando con GOOGLE_APPLICATION_CREDENTIALS...');
        admin.initializeApp({
          credential: admin.credential.applicationDefault()
        });
        console.log('✅ Inicialización EXITOSA con GOOGLE_APPLICATION_CREDENTIALS');
      } else {
        console.error('❌ No hay credenciales disponibles');
      }
    } else {
      console.log('✅ Firebase Admin ya estaba inicializado');
    }
    
    console.log('');
    console.log('📊 Apps inicializadas:', admin.apps.length);
    
    if (admin.apps.length > 0) {
      const { getFirestore } = require('firebase-admin/firestore');
      const db = getFirestore();
      console.log('✅ Firestore disponible:', !!db);
      
      // Intentar una operación de prueba
      console.log('');
      console.log('🧪 Probando escritura en Firestore...');
      const testDoc = {
        test: true,
        timestamp: new Date().toISOString(),
        message: 'Prueba de diagnóstico'
      };
      
      await db.collection('_diagnostico_test').doc('test').set(testDoc, { merge: true });
      console.log('✅ Escritura EXITOSA en colección _diagnostico_test');
      
      // Leer de vuelta
      const snapshot = await db.collection('_diagnostico_test').doc('test').get();
      if (snapshot.exists) {
        console.log('✅ Lectura EXITOSA:', snapshot.data());
      } else {
        console.warn('⚠️  Documento no encontrado después de escritura');
      }
    }
    
  } catch (error: any) {
    console.error('❌ ERROR al inicializar Firebase Admin:', error.message);
    console.error('🔍 Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ DIAGNÓSTICO COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════════');
}

// Ejecutar
runDiagnostic().catch(error => {
  console.error('💥 Error fatal en diagnóstico:', error);
  process.exit(1);
});
