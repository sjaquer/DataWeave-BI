import { formatInTimeZone } from 'date-fns-tz';

const LIMA_TIME_ZONE = 'America/Lima';

const primerLlamada = '2025-10-25T05:04:18.000Z';
const ultimaLlamada = '2025-10-25T09:48:12.000Z';

console.log('=== VERIFICACIÓN HORARIOS EN LIMA ===');
console.log('Primera llamada UTC:', primerLlamada);
console.log('Primera llamada Lima:', formatInTimeZone(primerLlamada, LIMA_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));

console.log('Última llamada UTC:', ultimaLlamada);
console.log('Última llamada Lima:', formatInTimeZone(ultimaLlamada, LIMA_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'));

console.log('\n🎯 HORARIOS DE TRABAJO:');
console.log('Primera: ' + formatInTimeZone(primerLlamada, LIMA_TIME_ZONE, 'HH:mm:ss'));
console.log('Última: ' + formatInTimeZone(ultimaLlamada, LIMA_TIME_ZONE, 'HH:mm:ss'));