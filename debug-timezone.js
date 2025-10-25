import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const MADRID_TIME_ZONE = 'Europe/Madrid';
const LIMA_TIME_ZONE = 'America/Lima';

// Simular datos de Zadarma (hora Madrid)
const zadarmaTime = '2025-10-25 21:30:00'; // 9:30 PM Madrid

console.log('=== DIAGNÓSTICO TIMEZONE ===');
console.log('1. Hora original de Zadarma (Madrid):', zadarmaTime);

// Paso 1: Convertir Madrid a UTC (backend)
const utcDate = fromZonedTime(zadarmaTime, MADRID_TIME_ZONE);
const isoString = utcDate.toISOString();
console.log('2. Convertido a UTC (backend):', isoString);

// Paso 2: Parse ISO y convertir a Lima (frontend)  
const parsedDate = parseISO(isoString);
const limaTime = formatInTimeZone(parsedDate, LIMA_TIME_ZONE, 'HH:mm:ss');
console.log('3. Mostrado en Lima (frontend):', limaTime);

// Paso 3: Verificar que Lima sea correcto
const limaTimeFull = formatInTimeZone(parsedDate, LIMA_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
console.log('4. Hora completa Lima:', limaTimeFull);

// Comparar diferencias
const madridTimeFull = formatInTimeZone(parsedDate, MADRID_TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
console.log('5. Hora original Madrid reconstruida:', madridTimeFull);

console.log('\n=== RESUMEN ===');
console.log('Madrid:', madridTimeFull);
console.log('Lima:  ', limaTimeFull);
console.log('Diferencia esperada: 7 horas (Madrid UTC+2, Lima UTC-5)');