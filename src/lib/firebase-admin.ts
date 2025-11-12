// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

console.log('[FIREBASE-ADMIN] 🔍 Inicializando Firebase Admin SDK...');
console.log('[FIREBASE-ADMIN] 📊 Apps existentes:', admin.apps.length);

// Evitar la reinicialización en entornos de desarrollo con hot-reload
if (!admin.apps.length) {
  // Soportar múltiples nombres de env vars para flexibilidad
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.SERVICE_ACCOUNT;
  const googleCredsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  console.log('[FIREBASE-ADMIN] 🔑 FIREBASE_SERVICE_ACCOUNT presente:', !!process.env.FIREBASE_SERVICE_ACCOUNT, `(${process.env.FIREBASE_SERVICE_ACCOUNT ? process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 50) + '...' : 'no definido'})`);
  console.log('[FIREBASE-ADMIN] 🔑 SERVICE_ACCOUNT presente:', !!process.env.SERVICE_ACCOUNT, `(${process.env.SERVICE_ACCOUNT ? process.env.SERVICE_ACCOUNT.substring(0, 50) + '...' : 'no definido'})`);
  console.log('[FIREBASE-ADMIN] 🔑 GOOGLE_APPLICATION_CREDENTIALS presente:', !!googleCredsPath, `(${googleCredsPath || 'no definido'})`);
  
  // Solo inicializar si SERVICE_ACCOUNT está disponible
  if (serviceAccountString) {
    try {
      console.log('[FIREBASE-ADMIN] 📝 Intentando parsear SERVICE_ACCOUNT JSON...');
      const serviceAccount = JSON.parse(serviceAccountString);
      
      console.log('[FIREBASE-ADMIN] ✅ JSON parseado correctamente');
      console.log('[FIREBASE-ADMIN] 📧 Project ID:', serviceAccount.project_id);
      console.log('[FIREBASE-ADMIN] 📧 Client Email:', serviceAccount.client_email);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log(`[FIREBASE-ADMIN] ✅ Firebase Admin SDK inicializado con éxito para el cliente: ${serviceAccount.client_email}`);
    } catch (error: any) {
      console.error('[FIREBASE-ADMIN] ❌ Error al inicializar Firebase Admin SDK:', error.message);
      console.error('[FIREBASE-ADMIN] 🔍 Error completo:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      // No lanzar error durante build time
    }
  } else if (googleCredsPath) {
    // Si el path al fichero de credenciales está presente (standard env var), intentar usar applicationDefault
    try {
      console.log('[FIREBASE-ADMIN] 📝 Intentando inicializar con applicationDefault()...');
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('[FIREBASE-ADMIN] ✅ Firebase Admin SDK inicializado usando GOOGLE_APPLICATION_CREDENTIALS (applicationDefault)');
    } catch (error: any) {
      console.error('[FIREBASE-ADMIN] ❌ Error al inicializar Firebase Admin SDK con applicationDefault:', error.message);
      console.error('[FIREBASE-ADMIN] 🔍 Error completo:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
    }
  } else {
    console.warn('[FIREBASE-ADMIN] ⚠️  Firebase Admin SDK NO inicializado - Ninguna credencial encontrada');
    console.warn('[FIREBASE-ADMIN] 💡 Configura SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS en variables de entorno');
  }
} else {
  console.log('[FIREBASE-ADMIN] ♻️  Firebase Admin ya inicializado (hot-reload), reutilizando instancia');
}

// Función helper para obtener db de forma segura
function getDb() {
  if (!admin.apps.length) {
    console.error('[FIREBASE-ADMIN] ❌ getDb() llamado pero Firebase Admin no está inicializado');
    throw new Error('Firebase Admin no está inicializado. Configura SERVICE_ACCOUNT en las variables de entorno.');
  }
  return getFirestore();
}

// Durante build time, db será null. En runtime, se obtendrá correctamente.
const db = admin.apps.length ? getFirestore() : null as any;

console.log('[FIREBASE-ADMIN] 📊 Estado final - db:', db === null ? 'null (no inicializado)' : 'inicializado correctamente');
console.log('[FIREBASE-ADMIN] 📊 Admin apps:', admin.apps.length);

export { db, getDb };


