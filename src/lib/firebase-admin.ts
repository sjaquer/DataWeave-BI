// src/lib/firebase-admin.ts
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Evitar la reinicialización en entornos de desarrollo con hot-reload
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      throw new Error('La variable de entorno SERVICE_ACCOUNT no está configurada o está vacía.');
    }
    const serviceAccount = JSON.parse(serviceAccountString);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    // Log para confirmar la inicialización y mostrar el email del cliente
    console.log(`Firebase Admin SDK inicializado con éxito para el cliente: ${serviceAccount.client_email}`);

  } catch (error: any) {
    console.error('Error CRÍTICO al inicializar Firebase Admin SDK:', error.message);
    // Es importante detener el proceso si la inicialización falla, 
    // de lo contrario, otras partes de la app fallarán con errores confusos.
  }
}

const db = getFirestore();

export { db };
