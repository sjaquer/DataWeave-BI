/**
 * Script para limpiar duplicados en la colección zadarma_calls
 * 
 * Este script:
 * 1. Lee TODOS los documentos de zadarma_calls
 * 2. Aplica la lógica de consolidación (pbx_call_id + re-intentos)
 * 3. Elimina los duplicados detectados
 * 4. Reporta estadísticas detalladas
 * 
 * IMPORTANTE: Este script hace cambios PERMANENTES en Firestore
 * Se recomienda hacer un backup antes de ejecutar
 * 
 * Uso:
 *   npx tsx scripts/clean-zadarma-duplicates.ts
 * 
 * Flags opcionales:
 *   --dry-run   : Solo muestra qué se eliminaría, sin hacer cambios
 *   --date      : Limpiar solo una fecha específica (formato: YYYY-MM-DD)
 */

import { db } from '../src/lib/firebase-admin';
import { consolidateCalls, convertZadarmaCallToUTC } from '../src/lib/zadarma-helpers';
import type { ZadarmaCall } from '../src/types/zadarma';

interface CleanupStats {
  totalDocuments: number;
  afterConsolidation: number;
  duplicatesRemoved: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  byDate: { [date: string]: { before: number; after: number; removed: number } };
}

async function cleanDuplicates(dryRun = false, targetDate?: string): Promise<CleanupStats> {
  console.log('🧹 Iniciando limpieza de duplicados en Firestore...\n');
  
  if (dryRun) {
    console.log('⚠️  MODO DRY-RUN: No se realizarán cambios reales\n');
  }

  // 1. Obtener TODAS las llamadas (o filtrar por fecha si se especifica)
  let query = db.collection('zadarma_calls');
  
  if (targetDate) {
    console.log(`📅 Limpiando solo la fecha: ${targetDate}\n`);
    query = query.where('callDate', '==', targetDate) as any;
  }

  const snapshot = await query.get();
  console.log(`📥 Total de documentos a procesar: ${snapshot.size}\n`);
  
  if (snapshot.size === 0) {
    console.log('✅ No hay documentos para procesar');
    return {
      totalDocuments: 0,
      afterConsolidation: 0,
      duplicatesRemoved: 0,
      dateRange: { earliest: '', latest: '' },
      byDate: {},
    };
  }

  const allCalls: ZadarmaCall[] = [];
  const docIdToCall = new Map<string, any>();
  const callsByDate: { [date: string]: ZadarmaCall[] } = {};

  snapshot.docs.forEach((doc: any) => {
    const data = doc.data();
    const call: ZadarmaCall = {
      pbx_call_id: data.pbx_call_id,
      callstart: data.callstart,
      sip: data.sip,
      clid: data.clid,
      destination: data.destination,
      disposition: data.disposition,
      seconds: data.seconds,
    };
    
    allCalls.push(call);
    docIdToCall.set(doc.id, data);
    
    const date = data.callDate || data.callstart.substring(0, 10);
    if (!callsByDate[date]) {
      callsByDate[date] = [];
    }
    callsByDate[date].push(call);
  });

  // 2. Consolidar usando la lógica mejorada
  console.log('🔄 Aplicando consolidación (pbx_call_id + re-intentos)...\n');
  const consolidated = consolidateCalls(allCalls);
  
  console.log(`✅ Después de consolidar: ${consolidated.length} llamadas`);
  console.log(`🗑️  Duplicados detectados: ${snapshot.size - consolidated.length} (${((snapshot.size - consolidated.length) / snapshot.size * 100).toFixed(1)}%)\n`);

  // 3. Crear un Set de IDs únicos a mantener
  const keepIds = new Set<string>();
  consolidated.forEach(call => {
    const docId = `${call.pbx_call_id}_${call.callstart}`;
    keepIds.add(docId);
  });

  // 4. Estadísticas por fecha
  const statsByDate: { [date: string]: { before: number; after: number; removed: number } } = {};
  
  for (const [date, calls] of Object.entries(callsByDate)) {
    const consolidatedForDate = consolidateCalls(calls);
    statsByDate[date] = {
      before: calls.length,
      after: consolidatedForDate.length,
      removed: calls.length - consolidatedForDate.length,
    };
  }

  // 5. Mostrar reporte por fecha
  console.log('📊 Reporte por fecha:\n');
  console.log('┌────────────┬─────────┬─────────┬───────────┬──────────┐');
  console.log('│ Fecha      │ Antes   │ Después │ Eliminados│ % Dupl.  │');
  console.log('├────────────┼─────────┼─────────┼───────────┼──────────┤');
  
  const sortedDates = Object.keys(statsByDate).sort();
  for (const date of sortedDates) {
    const stats = statsByDate[date];
    const pct = stats.before > 0 ? (stats.removed / stats.before * 100).toFixed(1) : '0.0';
    console.log(
      `│ ${date} │ ${String(stats.before).padStart(7)} │ ${String(stats.after).padStart(7)} │ ${String(stats.removed).padStart(9)} │ ${String(pct).padStart(7)}% │`
    );
  }
  console.log('└────────────┴─────────┴─────────┴───────────┴──────────┘\n');

  // 6. Eliminar documentos que NO están en keepIds
  if (!dryRun) {
    console.log('🔥 Eliminando duplicados...\n');
    
    const batchSize = 500; // Firestore batch limit
    let deleteCount = 0;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      if (!keepIds.has(doc.id)) {
        batch.delete(doc.ref);
        deleteCount++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          console.log(`   Eliminados ${deleteCount} documentos hasta ahora...`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`\n✅ Eliminados ${deleteCount} duplicados exitosamente`);
  } else {
    console.log(`📋 Se eliminarían ${snapshot.size - consolidated.length} documentos\n`);
    
    // Mostrar algunos ejemplos de duplicados
    console.log('🔍 Ejemplos de duplicados detectados (primeros 10):\n');
    let exampleCount = 0;
    for (const doc of snapshot.docs) {
      if (!keepIds.has(doc.id) && exampleCount < 10) {
        const data = doc.data();
        console.log(`   - ${doc.id}`);
        console.log(`     Agente: ${data.sip}, Destino: ${data.destination}, Hora: ${data.callstart}`);
        exampleCount++;
      }
    }
  }

  // Encontrar rango de fechas
  const dates = sortedDates;
  const earliest = dates[0] || '';
  const latest = dates[dates.length - 1] || '';

  const stats: CleanupStats = {
    totalDocuments: snapshot.size,
    afterConsolidation: consolidated.length,
    duplicatesRemoved: snapshot.size - consolidated.length,
    dateRange: { earliest, latest },
    byDate: statsByDate,
  };

  return stats;
}

// Ejecutar script
(async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const dateIndex = args.indexOf('--date');
  const targetDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  LIMPIEZA DE DUPLICADOS - ZADARMA CALLS                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const stats = await cleanDuplicates(dryRun, targetDate);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  RESUMEN FINAL                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log(`📊 Documentos totales:       ${stats.totalDocuments}`);
    console.log(`✅ Después de consolidar:    ${stats.afterConsolidation}`);
    console.log(`🗑️  Duplicados eliminados:    ${stats.duplicatesRemoved} (${((stats.duplicatesRemoved / stats.totalDocuments) * 100).toFixed(1)}%)`);
    console.log(`📅 Rango de fechas:          ${stats.dateRange.earliest} → ${stats.dateRange.latest}`);
    
    if (!dryRun && stats.duplicatesRemoved > 0) {
      console.log('\n🎉 Limpieza completada exitosamente!');
      console.log('\n💡 Recomendaciones:');
      console.log('   1. Verificar el conteo en el dashboard');
      console.log('   2. Comparar con los datos de Zadarma');
      console.log('   3. Monitorear el cron job para evitar nuevos duplicados');
    } else if (dryRun) {
      console.log('\n💡 Para ejecutar la limpieza real, ejecuta:');
      console.log('   npx tsx scripts/clean-zadarma-duplicates.ts');
    }

    console.log('\n✅ Script finalizado\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error durante la limpieza:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
