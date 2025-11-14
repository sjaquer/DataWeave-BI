/**
 * Script para crear usuarios en Firestore
 *
 * NOTA: Los datos de demostración han sido retirados de este archivo por
 * razones de seguridad. Para ejecutar el seed manualmente, proporciona tus
 * propios UIDs/emails o habilita la variable de entorno ALLOW_RUN_SEED=true.
 *
 * Uso:
 * ALLOW_RUN_SEED=true node scripts/seed-users.js
 */

// Seguridad: proteger ejecución accidental del script de seed.
// Para ejecutar, exporta la variable de entorno ALLOW_RUN_SEED=true
if (process.env.ALLOW_RUN_SEED !== 'true') {
  console.error('❌ Ejecución bloqueada: ALLOW_RUN_SEED !== true. Para ejecutar el seed exporta ALLOW_RUN_SEED=true');
  process.exit(1);
}

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
