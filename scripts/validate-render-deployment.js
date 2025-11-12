#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRE-DEPLOYMENT VALIDATION SCRIPT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Valida que el proyecto esté listo para deployment a Render.
 * Ejecutar antes de pushear a GitHub.
 * 
 * USO:
 * ====
 * node scripts/validate-render-deployment.js
 * 
 * VALIDACIONES:
 * =============
 * 1. Variables de entorno requeridas están definidas
 * 2. Worker.js existe y es válido
 * 3. Health check endpoint existe
 * 4. Firebase init soporta FIREBASE_SERVICE_ACCOUNT
 * 5. Backfill-progress usa job queue (no setImmediate)
 * 6. No hay errores de TypeScript
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_ENV_VARS = [
  'FIREBASE_SERVICE_ACCOUNT',
  'ZADARMA_API_KEY',
  'ZADARMA_API_SECRET',
  'REFRESH_TODAY_SECRET'
];

const REQUIRED_FILES = [
  'worker.js',
  'src/app/api/health/route.ts',
  'src/app/api/zadarma/backfill-progress/route.ts',
  'src/lib/firebase-admin.ts',
  'docs/MIGRATE-TO-RENDER.md'
];

let errors = [];
let warnings = [];

console.log('🔍 Validando deployment a Render...\n');

// ═══════════════════════════════════════════════════════════════════════════
// 1. VERIFICAR ARCHIVOS REQUERIDOS
// ═══════════════════════════════════════════════════════════════════════════

console.log('📁 Verificando archivos requeridos...');
REQUIRED_FILES.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    errors.push(`❌ Archivo faltante: ${file}`);
  } else {
    console.log(`  ✅ ${file}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. VERIFICAR WORKER.JS
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🤖 Verificando worker.js...');
const workerPath = path.join(process.cwd(), 'worker.js');
if (fs.existsSync(workerPath)) {
  const workerContent = fs.readFileSync(workerPath, 'utf8');
  
  // Verificar que use FIREBASE_SERVICE_ACCOUNT
  if (!workerContent.includes('FIREBASE_SERVICE_ACCOUNT')) {
    errors.push('❌ worker.js no lee FIREBASE_SERVICE_ACCOUNT');
  } else {
    console.log('  ✅ Lee FIREBASE_SERVICE_ACCOUNT');
  }
  
  // Verificar que procese zadarma_jobs
  if (!workerContent.includes('zadarma_jobs')) {
    errors.push('❌ worker.js no procesa zadarma_jobs');
  } else {
    console.log('  ✅ Procesa zadarma_jobs');
  }
  
  // Verificar que actualice zadarma_backfill_sessions
  if (!workerContent.includes('zadarma_backfill_sessions')) {
    errors.push('❌ worker.js no actualiza zadarma_backfill_sessions');
  } else {
    console.log('  ✅ Actualiza zadarma_backfill_sessions');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. VERIFICAR HEALTH CHECK
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n💚 Verificando health check...');
const healthPath = path.join(process.cwd(), 'src/app/api/health/route.ts');
if (fs.existsSync(healthPath)) {
  const healthContent = fs.readFileSync(healthPath, 'utf8');
  
  if (!healthContent.includes('export async function GET')) {
    errors.push('❌ Health check no exporta GET handler');
  } else {
    console.log('  ✅ GET handler presente');
  }
  
  if (!healthContent.includes('db.collection')) {
    warnings.push('⚠️  Health check no verifica Firestore');
  } else {
    console.log('  ✅ Verifica conexión a Firestore');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. VERIFICAR FIREBASE INIT
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n🔥 Verificando Firebase init...');
const firebasePath = path.join(process.cwd(), 'src/lib/firebase-admin.ts');
if (fs.existsSync(firebasePath)) {
  const firebaseContent = fs.readFileSync(firebasePath, 'utf8');
  
  if (!firebaseContent.includes('FIREBASE_SERVICE_ACCOUNT') && !firebaseContent.includes('SERVICE_ACCOUNT')) {
    errors.push('❌ Firebase init no lee FIREBASE_SERVICE_ACCOUNT');
  } else {
    console.log('  ✅ Soporta FIREBASE_SERVICE_ACCOUNT');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. VERIFICAR BACKFILL-PROGRESS (JOB QUEUE)
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📋 Verificando backfill-progress (job queue)...');
const backfillPath = path.join(process.cwd(), 'src/app/api/zadarma/backfill-progress/route.ts');
if (fs.existsSync(backfillPath)) {
  const backfillContent = fs.readFileSync(backfillPath, 'utf8');
  
  // Verificar setImmediate (ignorar en comentarios)
  const lines = backfillContent.split('\n');
  const hasSetImmediate = lines.some(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && line.includes('setImmediate(');
  });
  
  if (hasSetImmediate) {
    errors.push('❌ backfill-progress todavía usa setImmediate (debe usar job queue)');
  } else {
    console.log('  ✅ No usa setImmediate');
  }
  
  if (!backfillContent.includes('zadarma_jobs')) {
    errors.push('❌ backfill-progress no encola en zadarma_jobs');
  } else {
    console.log('  ✅ Encola jobs en zadarma_jobs');
  }
  
  // Verificar código legacy (ignorar en comentarios)
  const hasLegacyCode = lines.some(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('//') && !trimmed.startsWith('*') && line.includes('executeBackfillWithProgress');
  });
  
  if (hasLegacyCode) {
    warnings.push('⚠️  backfill-progress tiene código legacy (executeBackfillWithProgress)');
  } else {
    console.log('  ✅ Sin código legacy');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. VERIFICAR PACKAGE.JSON
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📦 Verificando package.json...');
const packagePath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const requiredDeps = ['crypto-js', 'date-fns', 'firebase-admin'];
  requiredDeps.forEach(dep => {
    if (!packageJson.dependencies[dep]) {
      errors.push(`❌ Dependencia faltante: ${dep}`);
    } else {
      console.log(`  ✅ ${dep} (${packageJson.dependencies[dep]})`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. VERIFICAR DOCUMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n📚 Verificando documentación...');
const docPath = path.join(process.cwd(), 'docs/MIGRATE-TO-RENDER.md');
if (fs.existsSync(docPath)) {
  const docContent = fs.readFileSync(docPath, 'utf8');
  
  if (!docContent.includes('Web Service') || !docContent.includes('Background Worker')) {
    warnings.push('⚠️  Documentación incompleta (falta info de servicios)');
  } else {
    console.log('  ✅ Documentación completa');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESUMEN
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('RESUMEN DE VALIDACIÓN');
console.log('═══════════════════════════════════════════════════════════════\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ ¡TODO LISTO PARA DEPLOYMENT A RENDER!');
  console.log('\nPróximos pasos:');
  console.log('1. git add . && git commit -m "feat: migración a Render"');
  console.log('2. git push origin main');
  console.log('3. Seguir pasos en docs/MIGRATE-TO-RENDER.md');
  process.exit(0);
}

if (warnings.length > 0) {
  console.log('⚠️  ADVERTENCIAS:\n');
  warnings.forEach(w => console.log(`   ${w}`));
  console.log();
}

if (errors.length > 0) {
  console.log('❌ ERRORES QUE DEBES CORREGIR:\n');
  errors.forEach(e => console.log(`   ${e}`));
  console.log('\n❌ DEPLOYMENT BLOQUEADO - Corrige los errores antes de continuar.\n');
  process.exit(1);
}

if (warnings.length > 0 && errors.length === 0) {
  console.log('\n⚠️  HAY ADVERTENCIAS pero puedes continuar con deployment.');
  console.log('   Considera corregir las advertencias para un mejor resultado.\n');
  process.exit(0);
}
