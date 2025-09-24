// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Evitar la reinicialización en entornos de desarrollo con hot-reload
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
  } catch (error: any) {
    console.error('Error CRÍTICO al inicializar Firebase Admin SDK:', error.message);
    // Es importante detener el proceso si la inicialización falla, 
    // de lo contrario, otras partes de la app fallarán con errores confusos.
    // En un entorno de producción, esto debería causar que el servidor no se inicie correctamente.
  }
}

const db = getFirestore();

export { db };
