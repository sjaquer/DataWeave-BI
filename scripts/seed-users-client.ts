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

// Definir los usuarios con sus roles
const users = [
  {
    uid: '5Re9sPT47DR6bbjntLL9LpKKjn13',
    email: 'gerencia@dataweave.com',
    role: 'gerente',
    displayName: 'Gerente General',
    description: 'Acceso completo a todas las secciones del sistema',
  },
  {
    uid: 'n3UuVRSz8LaISnEbJLLy7Yk8HNU2',
    email: 'encargado@dataweave.com',
    role: 'encargado',
    displayName: 'Encargado de Logística',
    description: 'Acceso a logística general: envíos, inventario, provincias',
  },
  {
    uid: 'fzQs2Ev1NEReM6YY4JYMZuytumz2',
    email: 'callcenter@dataweave.com',
    role: 'callcenter',
    displayName: 'Call Center',
    description: 'Acceso a datos de clientes general: dashboard, provincias',
  },
  {
    uid: 'asA3k52QlMPWr9v6ZjTQON98BB52',
    email: 'marketing@dataweave.com',
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
  console.log('👔 GERENTE (gerencia@dataweave.com)');
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
  console.log('📦 ENCARGADO DE LOGÍSTICA (encargado@dataweave.com)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Envíos');
  console.log('   ✓ Provincias');
  console.log('   ✓ Análisis Inventario');
  console.log('   ✓ Estado Inventario');
  console.log('');
  console.log('📞 CALL CENTER (callcenter@dataweave.com)');
  console.log('   ✓ Dashboard General');
  console.log('   ✓ Provincias');
  console.log('');
  console.log('📊 MARKETING (marketing@dataweave.com)');
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
