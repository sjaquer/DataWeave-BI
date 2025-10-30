#!/usr/bin/env tsx

/**
 * Test Manual de Webhook - Simula eventos de Zadarma
 * 
 * USO:
 *   npm run test:webhook
 * 
 * PROPÓSITO:
 * - Simula llamadas NOTIFY_END y NOTIFY_MISSED
 * - Envía eventos al webhook de producción
 * - Verifica que se guarden en Firestore
 */

const WEBHOOK_URL = 'https://dataweave-bi.vercel.app/api/zadarma/webhook';

interface WebhookEvent {
  event: 'NOTIFY_END' | 'NOTIFY_MISSED';
  pbx_call_id: string;
  call_start: string;
  disposition: string;
  destination: string;
  internal: string;
  duration?: number;
}

/**
 * Genera evento de prueba
 */
function generateTestEvent(type: 'answered' | 'missed' | 'busy'): WebhookEvent {
  const now = new Date();
  const timeStr = now.toISOString().slice(0, 19).replace('T', ' ');
  const callId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const baseEvent: WebhookEvent = {
    event: type === 'missed' ? 'NOTIFY_MISSED' : 'NOTIFY_END',
    pbx_call_id: callId,
    call_start: timeStr,
    disposition: type,
    destination: '+51987654321',
    internal: '101',
  };

  if (type === 'answered') {
    baseEvent.duration = Math.floor(Math.random() * 300) + 30; // 30-330 segundos
  }

  return baseEvent;
}

/**
 * Envía evento al webhook
 */
async function sendWebhookEvent(event: WebhookEvent): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status}`);
      const text = await response.text();
      console.error(`   Response: ${text}`);
      return false;
    }

    const data = await response.json();
    console.log(`✅ Webhook respondió: ${JSON.stringify(data)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando webhook:`, error);
    return false;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   TEST MANUAL DE WEBHOOK - Zadarma             ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  console.log(`🎯 Endpoint: ${WEBHOOK_URL}\n`);

  // 1. Llamada contestada
  console.log('📞 [1/3] Enviando llamada CONTESTADA...');
  const event1 = generateTestEvent('answered');
  console.log(`   Call ID: ${event1.pbx_call_id}`);
  console.log(`   Duration: ${event1.duration}s`);
  const success1 = await sendWebhookEvent(event1);
  if (success1) {
    console.log(`   ✅ Guardado en Firestore con ID: ${event1.pbx_call_id}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 2. Llamada perdida
  console.log('📞 [2/3] Enviando llamada PERDIDA...');
  const event2 = generateTestEvent('missed');
  console.log(`   Call ID: ${event2.pbx_call_id}`);
  const success2 = await sendWebhookEvent(event2);
  if (success2) {
    console.log(`   ✅ Guardado en Firestore con ID: ${event2.pbx_call_id}\n`);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 3. Llamada ocupada
  console.log('📞 [3/3] Enviando llamada OCUPADA...');
  const event3 = generateTestEvent('busy');
  console.log(`   Call ID: ${event3.pbx_call_id}`);
  const success3 = await sendWebhookEvent(event3);
  if (success3) {
    console.log(`   ✅ Guardado en Firestore con ID: ${event3.pbx_call_id}\n`);
  }

  // Resumen
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   RESUMEN                                      ║');
  console.log('╚════════════════════════════════════════════════╝');
  const total = [success1, success2, success3].filter(Boolean).length;
  console.log(`✅ Eventos enviados exitosamente: ${total}/3\n`);

  console.log('🔍 VERIFICACIÓN:');
  console.log('   1. Ve a Firestore Console:');
  console.log('      https://console.firebase.google.com/project/dataweavebi-3b0ab/firestore');
  console.log('   2. Colección: zadarma_calls');
  console.log(`   3. Busca los IDs:`);
  console.log(`      - ${event1.pbx_call_id}`);
  console.log(`      - ${event2.pbx_call_id}`);
  console.log(`      - ${event3.pbx_call_id}`);
  console.log('\n   O ejecuta: npm run check:firestore\n');
}

main().catch(console.error);
