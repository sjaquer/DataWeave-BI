import { parseISO } from 'date-fns';
import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

const LIMA_TIME_ZONE = 'America/Lima';
const MADRID_TIME_ZONE = 'Europe/Madrid';

// Test con la fecha exacta que está fallando
const startDateQuery = '2025-10-25T00:00:00Z';
const inputDate = parseISO(startDateQuery);

console.log('=== DIAGNÓSTICO DE LA CORRECCIÓN ===');
console.log('1. Input original:', startDateQuery);
console.log('2. parseISO result:', inputDate.toISOString());

// Lo que hace nuestra corrección
const limaDateStr = formatInTimeZone(inputDate, LIMA_TIME_ZONE, 'yyyy-MM-dd');
console.log('3. Lima date string:', limaDateStr);

const startLima = fromZonedTime(`${limaDateStr} 00:00:00`, LIMA_TIME_ZONE);
const endLima = fromZonedTime(`${limaDateStr} 23:59:59`, LIMA_TIME_ZONE);

console.log('4. startLima (UTC):', startLima.toISOString());
console.log('5. endLima (UTC):', endLima.toISOString());

// Conversión a Madrid
const startMadrid = toZonedTime(startLima, MADRID_TIME_ZONE);
const endMadrid = toZonedTime(endLima, MADRID_TIME_ZONE);

console.log('6. startMadrid (UTC):', startMadrid.toISOString());
console.log('7. endMadrid (UTC):', endMadrid.toISOString());

// Lo que se va a la API
console.log('8. Para API Zadarma:');
console.log('   start:', formatInTimeZone(startMadrid, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));
console.log('   end:', formatInTimeZone(endMadrid, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));

// Verificar qué día debe ser
console.log('\n🎯 VERIFICACIÓN:');
console.log('El usuario pidió el 25 Oct en Lima');
console.log('Deberíamos buscar en Zadarma desde 25 Oct 07:00 Madrid hasta 26 Oct 07:00 Madrid aproximadamente');