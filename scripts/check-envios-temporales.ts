/**
 * Script de diagnóstico para verificar datos de envíos temporales
 * Ejecutar con: npx tsx scripts/check-envios-temporales.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Inicializar Firebase Admin desde variable de entorno
const serviceAccountString = process.env.SERVICE_ACCOUNT;

if (!serviceAccountString) {
  throw new Error('SERVICE_ACCOUNT no está configurado en .env');
}

const serviceAccount = JSON.parse(serviceAccountString);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkEnviosTemporales() {
  console.log('\n🔍 DIAGNÓSTICO DE ENVÍOS TEMPORALES\n');
  console.log('='.repeat(80));

  try {
    // 1. Obtener todos los pedidos activos
    const activosSnapshot = await db.collection('envios_temporales')
      .where('enReporteEnviados', '==', false)
      .where('eliminadoDeTransito', '==', false)
      .get();

    console.log(`\n📦 Total pedidos activos: ${activosSnapshot.size}\n`);

    // 2. Agrupar por tipo de origen
    const porTipoOrigen: { [key: string]: number } = {};
    const porEstado: { [key: string]: number } = {};
    const porEstadoYOrigen: { [key: string]: { [key: string]: number } } = {
      PROVINCIA: {},
      LIMA: {}
    };
    const sinEstado: any[] = [];

    activosSnapshot.forEach((doc) => {
      const data = doc.data();
      const tipoOrigen = data.tipoOrigen || 'DESCONOCIDO';
      const estado = data.estado || 'SIN_ESTADO';

      // Contadores globales
      porTipoOrigen[tipoOrigen] = (porTipoOrigen[tipoOrigen] || 0) + 1;
      porEstado[estado] = (porEstado[estado] || 0) + 1;

      // Contadores por origen
      if (!porEstadoYOrigen[tipoOrigen]) {
        porEstadoYOrigen[tipoOrigen] = {};
      }
      porEstadoYOrigen[tipoOrigen][estado] = (porEstadoYOrigen[tipoOrigen][estado] || 0) + 1;

      // Recolectar pedidos sin estado
      if (estado === 'SIN_ESTADO' || !estado) {
        sinEstado.push({
          pedidoId: data.pedidoId,
          tipoOrigen,
          tienda: data.tienda,
          courier: data.courier,
          ultimaActualizacion: data.ultimaActualizacion?.toDate?.()
        });
      }
    });

    // 3. Mostrar resumen por tipo de origen
    console.log('📊 POR TIPO DE ORIGEN:');
    console.log('-'.repeat(80));
    Object.entries(porTipoOrigen).forEach(([tipo, cantidad]) => {
      console.log(`  ${tipo.padEnd(15)} : ${cantidad} pedidos`);
    });

    // 4. Mostrar estados globales
    console.log('\n📋 ESTADOS GLOBALES:');
    console.log('-'.repeat(80));
    const estadosOrdenados = Object.entries(porEstado).sort((a, b) => b[1] - a[1]);
    estadosOrdenados.forEach(([estado, cantidad]) => {
      const porcentaje = ((cantidad / activosSnapshot.size) * 100).toFixed(1);
      console.log(`  ${estado.padEnd(25)} : ${String(cantidad).padStart(4)} pedidos (${porcentaje}%)`);
    });

    // 5. Mostrar estados por origen
    console.log('\n📍 ESTADOS POR ORIGEN:');
    console.log('-'.repeat(80));
    
    console.log('\n  🏔️ PROVINCIA:');
    const provinciaEstados = Object.entries(porEstadoYOrigen.PROVINCIA || {})
      .sort((a, b) => b[1] - a[1]);
    if (provinciaEstados.length === 0) {
      console.log('     (Sin datos)');
    } else {
      provinciaEstados.forEach(([estado, cantidad]) => {
        console.log(`     ${estado.padEnd(25)} : ${cantidad} pedidos`);
      });
    }

    console.log('\n  🏙️ LIMA:');
    const limaEstados = Object.entries(porEstadoYOrigen.LIMA || {})
      .sort((a, b) => b[1] - a[1]);
    if (limaEstados.length === 0) {
      console.log('     (Sin datos)');
    } else {
      limaEstados.forEach(([estado, cantidad]) => {
        console.log(`     ${estado.padEnd(25)} : ${cantidad} pedidos`);
      });
    }

    // 6. Mostrar pedidos sin estado
    if (sinEstado.length > 0) {
      console.log('\n⚠️ PEDIDOS SIN ESTADO:');
      console.log('-'.repeat(80));
      console.log(`  Total: ${sinEstado.length} pedidos`);
      console.log('\n  Primeros 10:');
      sinEstado.slice(0, 10).forEach((pedido, index) => {
        console.log(`    ${index + 1}. ${pedido.pedidoId} (${pedido.tipoOrigen}) - ${pedido.tienda} - ${pedido.courier}`);
        if (pedido.ultimaActualizacion) {
          console.log(`       Última actualización: ${pedido.ultimaActualizacion.toLocaleString('es-PE')}`);
        }
      });
    }

    // 7. Verificar estados que empiezan con "L-"
    const estadosConL = estadosOrdenados.filter(([estado]) => estado.startsWith('L-') || estado.startsWith('L '));
    if (estadosConL.length > 0) {
      console.log('\n🔤 ESTADOS CON PREFIJO "L-":');
      console.log('-'.repeat(80));
      estadosConL.forEach(([estado, cantidad]) => {
        const estadoLimpio = estado.replace(/^L\s*-\s*/i, '').trim();
        console.log(`  "${estado}" → "${estadoLimpio}" : ${cantidad} pedidos`);
      });
    }

    // 8. Comparación con Google Sheets
    console.log('\n📊 COMPARACIÓN CON GOOGLE SHEETS:');
    console.log('-'.repeat(80));
    console.log('  Según imagen adjunta:');
    console.log('    - PROVINCIA: ~70+ pedidos en "EN TRANSITO"');
    console.log(`    - En Firestore: ${porEstadoYOrigen.PROVINCIA?.['EN TRANSITO'] || 0} pedidos en "EN TRANSITO"`);
    console.log(`    - En Firestore: ${porEstadoYOrigen.PROVINCIA?.['EN TRÁNSITO'] || 0} pedidos en "EN TRÁNSITO" (con tilde)`);
    console.log(`    - En Firestore: ${porEstadoYOrigen.PROVINCIA?.['TRANSITO'] || 0} pedidos en "TRANSITO" (sin prefijo)`);
    console.log(`    - En Firestore: ${porEstadoYOrigen.PROVINCIA?.['SIN_ESTADO'] || 0} pedidos en "SIN_ESTADO"`);

    // 9. Sugerencias
    console.log('\n💡 SUGERENCIAS:');
    console.log('-'.repeat(80));
    if (sinEstado.length > 0) {
      console.log('  ⚠️  Hay pedidos sin estado definido');
      console.log('      → Verificar que la columna AB (ESTADO) tenga datos en Google Sheets');
      console.log('      → Ejecutar sincronización manual desde Google Sheets');
    }
    
    const totalProvincia = porTipoOrigen.PROVINCIA || 0;
    if (totalProvincia < 70) {
      console.log('  ⚠️  El total de pedidos de PROVINCIA es menor a lo esperado');
      console.log('      → Verificar que la sincronización desde Google Sheets esté funcionando');
      console.log('      → Revisar logs del webhook en Vercel');
    }

    console.log('\n='.repeat(80));
    console.log('✅ Diagnóstico completado\n');

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    throw error;
  }
}

// Ejecutar diagnóstico
checkEnviosTemporales()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
