/**
 * Script para crear usuarios en Firestore
 * 
 * IMPORTANTE: Primero crea los usuarios en Firebase Authentication desde la consola
 * con los UIDs especificados, luego ejecuta este script para agregar sus perfiles.
 * 
 * Usuarios a crear en Firebase Auth:
 * 1. gerencia@dataweave.com - UID: 5Re9sPT47DR6bbjntLL9LpKKjn13
 * 2. encargado@dataweave.com - UID: n3UuVRSz8LaISnEbJLLy7Yk8HNU2
 * 3. callcenter@dataweave.com - UID: fzQs2Ev1NEReM6YY4JYMZuytumz2
 * 4. marketing@dataweave.com - UID: asA3k52QlMPWr9v6ZjTQON98BB52
 * 
 * Uso:
 * node scripts/seed-users.js
 */

const admin = require('firebase-admin');

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
    
    console.log('✅ Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar Firebase Admin:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

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

  for (const user of users) {
    try {
      const userRef = db.collection('users').doc(user.uid);
      
      await userRef.set({
        uid: user.uid,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Usuario creado: ${user.email}`);
      console.log(`   - Rol: ${user.role}`);
      console.log(`   - Nombre: ${user.displayName}`);
      console.log(`   - UID: ${user.uid}`);
      console.log(`   - Permisos: ${user.description}\n`);
    } catch (error) {
      console.error(`❌ Error al crear usuario ${user.email}:`, error.message);
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
