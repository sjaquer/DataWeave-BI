// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Evitar la reinicialización en entornos de desarrollo con hot-reload
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT as string);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    console.error('Error al inicializar Firebase Admin SDK:', error.message);
    // Podrías lanzar el error o manejarlo de otra manera si la inicialización es absolutamente crítica
    // throw new Error('No se pudo inicializar Firebase Admin. Revisa la variable de entorno SERVICE_ACCOUNT.');
  }
}

const db = getFirestore();

export { db };
