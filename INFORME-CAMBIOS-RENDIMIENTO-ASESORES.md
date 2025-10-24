# Informe de Evolución y Corrección: Dashboard de Rendimiento de Asesores

## 1. Resumen Ejecutivo de Mejoras

La plataforma de rendimiento de asesores ha recibido una actualización integral, enfocada en tres pilares: una **interfaz de usuario más clara**, **capacidades de análisis de datos más potentes** y, lo más importante, una **precisión de datos absoluta**.

### 1.1. Nueva Interfaz y Filtros Avanzados

*   **Dashboard Rediseñado:** Se implementó una interfaz moderna basada en tarjetas (KPI cards) que destacan las métricas clave: `Total de Intentos`, `Llamadas Efectivas` y `Tasa de Efectividad`.
*   **Filtros de Fecha Dinámicos:** El usuario ahora cuenta con filtros predefinidos (`Hoy`, `Ayer`, `Esta Semana`, `Este Mes`) y un selector de rango de fechas personalizado para un análisis flexible.
*   **Tabla de Desglose por Asesor:** Se presenta una tabla detallada que muestra el rendimiento individual, incluyendo `Primera Llamada`, `Última Llamada` y `Horas Trabajadas`, permitiendo una visión granular de la actividad del equipo.

### 1.2. Nueva Lógica de Suma Acumulada

Un cambio fundamental fue la corrección de la lógica de agregación de datos para rangos de fechas múltiples.

*   **Problema Anterior:** Al seleccionar un rango (ej. una semana), el sistema no sumaba correctamente los datos de cada día, mostrando métricas inconsistentes.
*   **Solución Implementada:** El backend ahora itera correctamente sobre cada día dentro del rango solicitado, obtiene los datos (ya sea de caché o de la API) y los acumula, presentando un total consolidado y preciso para el período completo.

## 2. El Camino Hacia la Solución: Crónica de una Discrepancia de Datos

El desafío más grande fue resolver una discrepancia persistente entre los datos mostrados en nuestro dashboard y los de la plataforma de Zadarma. Este problema resultó ser complejo y su solución requirió descartar varias hipótesis iniciales.

### 2.1. El Problema Original

*   **Síntoma:** Para un día específico (ej. 23 de octubre), el dashboard mostraba **~907 intentos**, mientras que Zadarma reportaba **~1201**. Consecuentemente, las horas de "Última Llamada" eran incorrectamente tempranas (ej. ~15:22), omitiendo toda la actividad de la tarde/noche.

### 2.2. Hipótesis #1 (Incorrecta): El Caché estaba Incompleto

*   **Teoría:** Se pensó que el proceso de sincronización diaria se interrumpía, guardando en nuestra base de datos (Firestore) solo una fracción de las llamadas del día.
*   **Acción Tomada:** Se implementó un mecanismo de **"auto-reparación"** en la API. La idea era que si, al leer los datos de un día pasado, se detectaba que la última llamada era demasiado temprana, el sistema forzaría una nueva sincronización con Zadarma.
*   **Resultado:** **El problema persistió.** Los números no cambiaron. Esto demostró que, aunque la idea era buena, el problema no radicaba en una simple interrupción del caché.

### 2.3. Hipótesis #2 (Incorrecta): La "Consolidación" de Datos era Defectuosa

*   **Teoría:** La siguiente sospecha recayó en la función `consolidateCalls`, diseñada para eliminar registros duplicados que a veces envía Zadarma. Se pensó que esta función estaba siendo demasiado agresiva y eliminaba llamadas legítimas.
*   **Acción Tomada:** Se reescribió por completo la lógica de `consolidateCalls`. La nueva versión, más inteligente, agrupaba los registros por ID de llamada y seleccionaba el "mejor" (priorizando estados como `answered` y mayor duración) en lugar de descartarlos.
*   **Resultado:** **El problema persistió idéntico.** Este fue el punto de inflexión que confirmó que el error no era un problema de *procesamiento* de datos, sino un problema en la *obtención* de los mismos.

### 2.4. Hipótesis #3 (Correcta): El Fallo Fundamental de Zona Horaria

*   **Teoría (Impulsada por tu insistencia):** El sistema entero estaba "pensando" en hora UTC, no en la hora local de Perú (`America/Lima`).
*   **Análisis Final y Descubrimiento:**
    1.  **Petición Incorrecta:** Al solicitar el "23 de octubre", el backend le pedía a Zadarma las llamadas del día **UTC**, que abarca desde las 7:00 PM del día 22 hasta las 6:59 PM del día 23 (hora de Lima). **Nunca se solicitaban las llamadas posteriores a las 7 PM.** Este era el origen de todos los males.
    2.  **Almacenamiento Incorrecto:** Como consecuencia, una llamada de las 10 PM del día 23 (hora Lima) se registraba en nuestra base de datos con la fecha del día 24, porque en UTC ya había cambiado el día. Esto corrompía el caché de forma irreparable con la lógica anterior.
*   **Conclusión de la Búsqueda:** El retraso en encontrar la solución se debió a un enfoque inicial en los síntomas (caché, consolidación) en lugar de la enfermedad subyacente: un error de diseño fundamental en la gestión de zonas horarias a nivel de la lógica de negocio.

## 3. Desglose Técnico de la Solución Final

La solución definitiva consistió en una refactorización estructural para hacer que todo el sistema opere basado en la zona horaria de Lima.

### 3.1. Corrección en la Petición a la API (`/api/zadarma/stats/route.ts`)

Se modificó la forma en que se define el rango de fechas para la API de Zadarma.

**Código ANTERIOR:**
'''typescript
// Tomaba la fecha del query ("2025-10-23") y la interpretaba como el inicio del día UTC.
const start = startOfDay(new Date(startDateQuery));
const end = startOfDay(new Date(endDateQuery));

// Esto resultaba en un rango de 00:00 UTC a 23:59 UTC.
'''

**Código NUEVO Y CORRECTO:**
'''typescript
import { toZonedTime, format } from 'date-fns-tz';
import { parseISO } from 'date-fns';

const LIMA_TIME_ZONE = 'America/Lima';

// 1. Interpretar la fecha del query como un día de Lima.
const limaDate = parseISO(startDateQuery);

// 2. Definir el inicio y el fin de ese día EN LIMA.
const startOfLimaDay = toZonedTime(`${format(limaDate, 'yyyy-MM-dd')}T00:00:00`, LIMA_TIME_ZONE);
const endOfLimaDay = toZonedTime(`${format(limaDate, 'yyyy-MM-dd')}T23:59:59`, LIMA_TIME_ZONE);

// 3. Llamar a la API de Zadarma usando estos rangos exactos (la función fetchZadarmaAPI los recibe y formatea a UTC 'yyyy-MM-dd HH:mm:ss').
const freshCalls = await fetchZadarmaAPI(startOfLimaDay, endOfLimaDay, ...);
'''

### 3.2. Corrección en el Almacenamiento en Caché (`/lib/zadarma-helpers.ts`)

Se ajustaron las funciones que guardan los datos para que la fecha de la llamada (`callDate`) se base en la hora de Lima.

**Código ANTERIOR:**
'''typescript
// La fecha de la llamada se formateaba directamente desde el timestamp UTC.
const callDate = format(new Date(call.callstart), 'yyyy-MM-dd');

// Resultado: una llamada de las 22:00 del día 23 en Lima (-5) era una llamada de las 03:00 del día 24 en UTC (+0),
// por lo que se guardaba con la etiqueta de fecha del día 24.
'''

**Código NUEVO Y CORRECTO:**
'''typescript
import { toZonedTime, format } from 'date-fns-tz';
const LIMA_TIME_ZONE = 'America/Lima';

// 1. Tomar el timestamp UTC de la llamada.
const callTimeUTC = new Date(call.callstart);

// 2. Convertirlo a la hora de Lima.
const callTimeLima = toZonedTime(callTimeUTC, LIMA_TIME_ZONE);

// 3. Formatear la etiqueta de fecha BASADO en la hora de Lima.
const callDate = format(callTimeLima, 'yyyy-MM-dd');

// Ahora la llamada de las 22:00 del día 23 en Lima se guarda correctamente con la etiqueta "2025-10-23".
'''

Esta corrección estructural ha alineado finalmente la lógica del sistema con la realidad operativa del negocio, garantizando la integridad y precisión de los datos en toda la plataforma.
