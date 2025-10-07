// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Evitar la reinicialización en entornos de desarrollo con hot-reload
if (!admin.apps.length) {
  const serviceAccountString = process.env.SERVICE_ACCOUNT;
  
  // Solo inicializar si SERVICE_ACCOUNT está disponible
  if (serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log(`✅ Firebase Admin SDK inicializado con éxito para el cliente: ${serviceAccount.client_email}`);
    } catch (error: any) {
      console.error('❌ Error al inicializar Firebase Admin SDK:', error.message);
      // No lanzar error durante build time
    }
  } else {
    console.warn('⚠️ Firebase Admin SDK no inicializado - SERVICE_ACCOUNT no configurado');
  }
}

// Función helper para obtener db de forma segura
function getDb() {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin no está inicializado. Configura SERVICE_ACCOUNT en las variables de entorno.');
  }
  return getFirestore();
}

// Durante build time, db será null. En runtime, se obtendrá correctamente.
const db = admin.apps.length ? getFirestore() : null as any;

export { db, getDb };


