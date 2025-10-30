#!/usr/bin/env tsx

/**
 * Test de API /api/zadarma/stats
 * 
 * USO:
 *   npm run test:api
 * 
 * PROPÓSITO:
 * - Probar endpoint de estadísticas
 * - Verificar que lee desde Firestore
 * - Ver datos de diferentes rangos de fechas
 */

const API_URL = 'https://dataweave-bi.vercel.app/api/zadarma/stats';

interface ApiResponse {
  data: any[];
  fromCache: boolean;
  metadata: {
    source: string;
    count: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
}

/**
 * Llama a la API con un rango de fechas
 */
async function testApi(startDate: string, endDate: string): Promise<void> {
  const url = `${API_URL}?startDate=${startDate}&endDate=${endDate}`;
  
  console.log(`🔍 Consultando: ${startDate} → ${endDate}`);
  console.log(`   URL: ${url}\n`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`   ❌ Error HTTP: ${response.status}`);
      const text = await response.text();
      console.error(`   Response: ${text}\n`);
      return;
    }

    const data: ApiResponse = await response.json();

    console.log(`   ✅ Respuesta exitosa:`);
    console.log(`      - Llamadas: ${data.data.length}`);
    console.log(`      - Fuente: ${data.metadata.source}`);
    console.log(`      - From Cache: ${data.fromCache}`);
    console.log(`      - Total en Firestore: ${data.metadata.count}`);

    if (data.data.length > 0) {
      console.log(`\n   📞 Primeras 3 llamadas:`);
      data.data.slice(0, 3).forEach((call, index) => {
        console.log(`      ${index + 1}. ${call.callStart || 'N/A'} - ${call.disposition || 'N/A'} - ${call.destination || 'N/A'}`);
      });
    } else {
      console.log(`\n   ⚠️  No hay datos en este rango`);
    }

    console.log('');
  } catch (error) {
    console.error(`   ❌ Error:`, error);
    console.log('');
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   TEST API - /api/zadarma/stats                ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  // Test 1: Hoy
  console.log('═══════════════════════════════════════════════');
  console.log('TEST 1: Llamadas de HOY');
  console.log('═══════════════════════════════════════════════\n');
  await testApi(todayStr, todayStr);

  // Test 2: Ayer
  console.log('═══════════════════════════════════════════════');
  console.log('TEST 2: Llamadas de AYER');
  console.log('═══════════════════════════════════════════════\n');
  await testApi(yesterdayStr, yesterdayStr);

  // Test 3: Última semana
  console.log('═══════════════════════════════════════════════');
  console.log('TEST 3: Llamadas de ÚLTIMA SEMANA');
  console.log('═══════════════════════════════════════════════\n');
  await testApi(weekAgoStr, todayStr);

  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   RESUMEN                                      ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('✅ Tests completados\n');
  console.log('🔍 Si no ves datos:');
  console.log('   1. Ejecuta: npm run test:webhook');
  console.log('   2. O ejecuta: npm run zadarma:backfill:test');
  console.log('   3. Luego vuelve a ejecutar: npm run test:api\n');
}

main().catch(console.error);
