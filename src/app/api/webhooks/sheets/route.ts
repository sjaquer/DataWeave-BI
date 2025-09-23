// /src/app/api/webhooks/sheets/route.ts
import { NextResponse } from 'next/server';

/**
 * Endpoint para recibir actualizaciones de datos desde Google Sheets.
 * El Google Apps Script enviará una petición POST a esta ruta con los datos
 * de los pedidos confirmados.
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // TODO: Procesar los datos recibidos.
    // Por ahora, solo registraremos los datos en la consola para verificar que llegan.
    console.log('Datos recibidos desde Google Sheets:', data);

    // Aquí iría la lógica para guardar estos datos en Firestore o
    // volver a ejecutar el análisis y cachear el resultado.

    return NextResponse.json({ status: 'success', message: 'Datos recibidos correctamente.' });
  } catch (error) {
    console.error('Error al procesar el webhook de Google Sheets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return NextResponse.json({ status: 'error', message: errorMessage }, { status: 500 });
  }
}
