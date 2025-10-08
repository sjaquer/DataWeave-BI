// scripts/check-courier-data.ts
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT || '{}');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

const db = admin.firestore();

async function checkCourierData() {
  console.log('\n🔍 Analizando datos de couriers en Firestore...\n');

  try {
    // Obtener todos los pedidos confirmados
    const confirmedOrdersSnapshot = await db
      .collection('shopify_orders')
      .where('isConfirmed', '==', true)
      .limit(100) // Limitamos a 100 para diagnóstico rápido
      .get();

    console.log(`📊 Total de pedidos confirmados encontrados: ${confirmedOrdersSnapshot.size}\n`);

    const courierStats: { [key: string]: number } = {};
    let withCourier = 0;
    let withoutCourier = 0;
    let courierIsUndefined = 0;
    let courierIsNull = 0;
    let courierIsEmpty = 0;

    const sampleOrders: any[] = [];

    confirmedOrdersSnapshot.forEach((doc) => {
      const data = doc.data();
      const courier = data.courier;

      // Estadísticas
      if (courier === undefined) {
        courierIsUndefined++;
      } else if (courier === null) {
        courierIsNull++;
      } else if (courier === '' || courier === 'No especificado') {
        courierIsEmpty++;
      } else {
        withCourier++;
        courierStats[courier] = (courierStats[courier] || 0) + 1;
      }

      if (!courier || courier === 'No especificado') {
        withoutCourier++;
      }

      // Guardar muestra de primeros 5 pedidos
      if (sampleOrders.length < 5) {
        sampleOrders.push({
          id: doc.id,
          orderName: data.orderName || 'N/A',
          storeId: data.storeId || 'N/A',
          courier: courier || 'NO DEFINIDO',
          isConfirmed: data.isConfirmed,
          confirmedBy: data.confirmedBy || 'N/A',
          province: data.province || 'N/A',
        });
      }
    });

    console.log('📈 ESTADÍSTICAS DE COURIERS:\n');
    console.log(`   ✅ Pedidos CON courier válido: ${withCourier}`);
    console.log(`   ❌ Pedidos SIN courier: ${withoutCourier}`);
    console.log(`   🔹 Courier = undefined: ${courierIsUndefined}`);
    console.log(`   🔹 Courier = null: ${courierIsNull}`);
    console.log(`   🔹 Courier = "" o "No especificado": ${courierIsEmpty}\n`);

    if (Object.keys(courierStats).length > 0) {
      console.log('🚚 DISTRIBUCIÓN DE COURIERS:\n');
      Object.entries(courierStats)
        .sort(([, a], [, b]) => b - a)
        .forEach(([courier, count]) => {
          const percentage = ((count / confirmedOrdersSnapshot.size) * 100).toFixed(1);
          console.log(`   ${courier}: ${count} pedidos (${percentage}%)`);
        });
    } else {
      console.log('⚠️  NO SE ENCONTRARON COURIERS VÁLIDOS EN LOS DATOS\n');
    }

    console.log('\n📋 MUESTRA DE 5 PEDIDOS:\n');
    sampleOrders.forEach((order, idx) => {
      console.log(`${idx + 1}. ${order.id}`);
      console.log(`   Order: ${order.orderName}`);
      console.log(`   Store: ${order.storeId}`);
      console.log(`   Courier: ${order.courier}`);
      console.log(`   Confirmed By: ${order.confirmedBy}`);
      console.log(`   Province: ${order.province}\n`);
    });

    console.log('\n💡 RECOMENDACIONES:\n');
    
    if (withoutCourier === confirmedOrdersSnapshot.size) {
      console.log('❌ PROBLEMA CRÍTICO: Ningún pedido tiene campo courier válido.');
      console.log('   Posibles causas:');
      console.log('   1. La columna COURIER no existe en Google Sheets REPORTE_ENVIADOS');
      console.log('   2. La columna COURIER está vacía en todos los registros');
      console.log('   3. El webhook no está enviando el campo COURIER correctamente');
      console.log('\n   SOLUCIÓN:');
      console.log('   1. Verifica que la hoja REPORTE_ENVIADOS tenga una columna llamada COURIER');
      console.log('   2. Verifica que esa columna tenga datos (ej: "Olva", "Shalom", etc.)');
      console.log('   3. Ejecuta el webhook manualmente desde Google Sheets para enviar los datos');
    } else if (withCourier < confirmedOrdersSnapshot.size * 0.5) {
      console.log('⚠️  ADVERTENCIA: Más del 50% de pedidos no tienen courier.');
      console.log('   Verifica que todos los registros en REPORTE_ENVIADOS tengan el campo COURIER completo.');
    } else {
      console.log('✅ Los datos de courier están presentes en la mayoría de pedidos.');
      console.log('   El dashboard debería mostrar la distribución correctamente.');
    }

  } catch (error) {
    console.error('❌ Error al analizar datos:', error);
  }
}

checkCourierData().then(() => {
  console.log('\n✅ Análisis completado\n');
  process.exit(0);
});
