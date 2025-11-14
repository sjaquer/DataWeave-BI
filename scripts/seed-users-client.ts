/**
 * Script TypeScript para crear perfiles de usuarios en Firestore (versión cliente)
 * 
 * Este script usa Firebase Client SDK y asume que los usuarios YA EXISTEN
 * en Firebase Authentication con los UIDs especificados.
 * 
 * Uso:
 * npx tsx scripts/seed-users-client.ts
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Configuración de Firebase (usa las variables de entorno)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Validar que las variables estén configuradas
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Error: Variables de entorno de Firebase no configuradas.');
  console.error('   Asegúrate de tener un archivo .env con:');
  console.error('   - NEXT_PUBLIC_FIREBASE_API_KEY');
  console.error('   - NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  console.error('   - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  console.error('   etc.');
  process.exit(1);
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Seguridad: evitar ejecutar este script por accidente en entornos públicos.
if (process.env.ALLOW_RUN_SEED !== 'true') {
  console.error('❌ Ejecución bloqueada: ALLOW_RUN_SEED !== true. Para ejecutar el seed cliente exporta ALLOW_RUN_SEED=true');
  process.exit(1);
}

// Definir los usuarios con sus roles
const users = [
  // Datos de demo eliminados. Sustituye por tus propios usuarios o ejecuta con
  // la variable de entorno ALLOW_RUN_SEED=true y actualiza manualmente los UIDs.
  {
    uid: '<REDACTED_UID_1>',
    email: '<REDACTED_EMAIL_1>',
    role: 'gerente',
    displayName: 'Gerente General',
    description: 'Acceso completo a todas las secciones del sistema',
  },
  {
    uid: '<REDACTED_UID_2>',
    email: '<REDACTED_EMAIL_2>',
    role: 'encargado',
    displayName: 'Encargado de Logística',
    description: 'Acceso a logística general: envíos, inventario, provincias',
  },
  {
    uid: '<REDACTED_UID_3>',
    email: '<REDACTED_EMAIL_3>',
    role: 'callcenter',
    displayName: 'Call Center',
    description: 'Acceso a datos de clientes general: dashboard, provincias',
  },
  {
    uid: '<REDACTED_UID_4>',
    email: '<REDACTED_EMAIL_4>',
    role: 'marketing',
    displayName: 'Marketing',
    description: 'Acceso a datos de productos y campañas: inventario, análisis diario, campañas Meta',
  },
];

async function seedUsers() {
  console.log('🌱 Iniciando seed de usuarios en Firestore...\n');
  console.log(`📍 Proyecto: ${firebaseConfig.projectId}\n`);

  for (const user of users) {
    try {
      console.log(`Creando usuario: ${user.email}...`);
      
      const userRef = doc(db, 'users', user.uid);
      
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true }); // Usar merge para evitar sobrescribir

      console.log(`✅ Usuario creado: ${user.email}`);
      console.log(`   - Rol: ${user.role}`);
      console.log(`   - Nombre: ${user.displayName}`);
      console.log(`   - UID: ${user.uid}\n`);
    } catch (error: any) {
      console.error(`❌ Error al crear usuario ${user.email}:`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Code: ${error.code}`);
      console.error(`   Stack: ${error.stack}\n`);
    }
  }

  console.log('✅ Seed completado!\n');
  console.log('📋 Resumen de permisos por rol:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('👔 GERENTE (<REDACTED_DEMO_EMAIL>)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Envíos');
  console.log('   ✓ Rendimiento');
  console.log('   ✓ Campañas Meta');
  console.log('   ✓ Provincias');
  console.log('   ✓ Análisis Diario');
  console.log('   ✓ Análisis Inventario');
  console.log('   ✓ Estado Inventario');
  console.log('   ✓ Análisis Mensual');
  console.log('');
  console.log('📦 ENCARGADO DE LOGÍSTICA (<REDACTED_DEMO_EMAIL_2>)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Envíos');
  console.log('   ✓ Provincias');
  console.log('   ✓ Análisis Inventario');
  console.log('   ✓ Estado Inventario');
  console.log('');
  console.log('📞 CALL CENTER (<REDACTED_DEMO_EMAIL_3>)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Provincias');
  console.log('');
  console.log('📊 MARKETING (<REDACTED_DEMO_EMAIL_4>)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Campañas Meta');
  console.log('   ✓ Análisis Diario');
  console.log('   ✓ Estado Inventario');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  process.exit(0);
}

// Ejecutar el seed
seedUsers().catch(error => {
  console.error('❌ Error fatal en el seed:', error);
  process.exit(1);
});
