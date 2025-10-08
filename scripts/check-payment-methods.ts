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

async function checkPaymentMethods() {
  console.log('🔍 Analizando métodos de pago en Firestore...\n');

  try {
    // Obtener pedidos entregados con método de pago
    const ordersSnapshot = await db
      .collection('shopify_orders')
      .where('isDelivered', '==', true)
      .limit(100)
      .get();

    console.log(`📊 Total de pedidos entregados encontrados: ${ordersSnapshot.size}\n`);

    // Contadores de métodos de pago
    const paymentMethodsCount: Record<string, number> = {};
    const sampleOrders: any[] = [];

    ordersSnapshot.forEach((doc) => {
      const data = doc.data();
      const paymentMethod = data.paymentMethod || 'No especificado';

      // Contar método de pago
      if (!paymentMethodsCount[paymentMethod]) {
        paymentMethodsCount[paymentMethod] = 0;
      }
      paymentMethodsCount[paymentMethod]++;

      // Guardar muestra
      if (sampleOrders.length < 10) {
        sampleOrders.push({
          id: doc.id,
          paymentMethod: paymentMethod,
          pendingAmount: data.pendingAmount || 0,
          deliveredBy: data.deliveredBy || 'N/A',
          deliveredAt: data.deliveredAt?.toDate().toLocaleString('es-PE') || 'N/A',
        });
      }
    });

    // Mostrar estadísticas
    console.log('📈 DISTRIBUCIÓN DE MÉTODOS DE PAGO:\n');
    const sortedPayments = Object.entries(paymentMethodsCount).sort(
      ([, a], [, b]) => b - a
    );

    for (const [method, count] of sortedPayments) {
      const percentage = ((count / ordersSnapshot.size) * 100).toFixed(1);
      console.log(`   ${method}: ${count} pedidos (${percentage}%)`);
    }

    // Mostrar muestra
    console.log('\n📋 MUESTRA DE PEDIDOS:\n');
    sampleOrders.forEach((order, index) => {
      console.log(`${index + 1}. ${order.id}`);
      console.log(`   Método de Pago: ${order.paymentMethod}`);
      console.log(`   Monto Pendiente: S/ ${order.pendingAmount.toFixed(2)}`);
      console.log(`   Entregado Por: ${order.deliveredBy}`);
      console.log(`   Fecha Entrega: ${order.deliveredAt}`);
      console.log('');
    });

    // Recomendaciones
    console.log('💡 RECOMENDACIONES:\n');
    
    const hasYape = paymentMethodsCount['YAPE'] > 0;
    const hasPlin = paymentMethodsCount['PLIN'] > 0;
    const hasAgenteBCP = paymentMethodsCount['AGENTE BCP'] > 0;
    const hasNoEspecificado = paymentMethodsCount['No especificado'] > 0;

    if (hasYape || hasPlin || hasAgenteBCP) {
      console.log('✅ Se están capturando métodos de pago del Google Sheet correctamente.');
      console.log(`   - YAPE: ${paymentMethodsCount['YAPE'] || 0}`);
      console.log(`   - PLIN: ${paymentMethodsCount['PLIN'] || 0}`);
      console.log(`   - AGENTE BCP: ${paymentMethodsCount['AGENTE BCP'] || 0}`);
    }

    if (hasNoEspecificado) {
      console.log(
        `\n⚠️  Hay ${paymentMethodsCount['No especificado']} pedidos sin método de pago especificado.`
      );
      console.log(
        '   Verifica que la columna "FORMA DE PAGO" esté presente en el Google Sheet ENTREGADO.'
      );
    }

    console.log('\n✅ Análisis completado');
  } catch (error) {
    console.error('❌ Error al analizar métodos de pago:', error);
  }
}

checkPaymentMethods();
