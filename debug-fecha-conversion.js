import { parseISO, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const LIMA_TIME_ZONE = 'America/Lima';
const MADRID_TIME_ZONE = 'Europe/Madrid';

// Usuario pide: 25 de octubre 2025
const userInput = '2025-10-25T00:00:00Z';

console.log('=== DIAGNÓSTICO CONVERSIÓN DE FECHAS ===');
console.log('1. Input usuario:', userInput);

// Lo que estamos haciendo MAL:
const startLima_WRONG = startOfDay(parseISO(userInput)); // UTC 2025-10-25 00:00:00
const startMadrid_WRONG = toZonedTime(startLima_WRONG, MADRID_TIME_ZONE); // WRONG!

console.log('\n❌ MÉTODO INCORRECTO (actual):');
console.log('  startLima (UTC):', startLima_WRONG.toISOString());
console.log('  startMadrid (WRONG):', startMadrid_WRONG.toISOString());
console.log('  Format Madrid (WRONG):', formatInTimeZone(startMadrid_WRONG, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));

// Lo que DEBERÍAMOS hacer:
// El usuario quiere el 25 de octubre EN LIMA
const limaDate = '2025-10-25 00:00:00'; // 25 oct a medianoche EN LIMA
const startLima_CORRECT = fromZonedTime(limaDate, LIMA_TIME_ZONE); // Convertir Lima -> UTC
const endLima_CORRECT = fromZonedTime('2025-10-25 23:59:59', LIMA_TIME_ZONE); // Convertir Lima -> UTC

// Luego convertir UTC -> Madrid para la API
const startMadrid_CORRECT = toZonedTime(startLima_CORRECT, MADRID_TIME_ZONE);
const endMadrid_CORRECT = toZonedTime(endLima_CORRECT, MADRID_TIME_ZONE);

console.log('\n✅ MÉTODO CORRECTO:');
console.log('  Lima input:', limaDate);
console.log('  startLima -> UTC:', startLima_CORRECT.toISOString());
console.log('  endLima -> UTC:', endLima_CORRECT.toISOString());
console.log('  startMadrid:', formatInTimeZone(startMadrid_CORRECT, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));
console.log('  endMadrid:', formatInTimeZone(endMadrid_CORRECT, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));

console.log('\n🎯 PARA LA API DE ZADARMA:');
console.log('  start:', formatInTimeZone(startMadrid_CORRECT, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));
console.log('  end:', formatInTimeZone(endMadrid_CORRECT, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));