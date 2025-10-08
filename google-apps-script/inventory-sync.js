/**
 * @OnlyCurrentDoc
 *
 * El código anterior le indica a Apps Script que este script solo necesita acceso a este documento.
 */

// =========================================
// CONFIGURACIÓN CENTRALIZADA
// =========================================
const CONFIG = {
  // URL del webhook que creamos en tu aplicación Next.js.
  // ¡¡¡IMPORTANTE!!! Debes reemplazar esta URL por la URL de producción de tu aplicación de Firebase App Hosting.
  WEBHOOK_URL: 'https://TU_NUEVO_DOMINIO_DE_FIREBASE_AQUI/api/webhooks/sheets',

  // Nombre de la hoja que contiene los datos de los pedidos confirmados.
  SHEET_NAME: 'REPORTE_ENVIADOS',

  // Nombre de la columna que usaremos para marcar las filas como enviadas.
  STATUS_COLUMN_NAME: 'SYNC_STATUS',
  
  // Valor que se escribirá en la columna de estado después de un envío exitoso.
  SENT_STATUS_VALUE: 'ENVIADO',

  // Frecuencia del disparador automático en horas. (1 = cada hora)
  TRIGGER_FREQUENCY_HOURS: 1
};


// =========================================
// GESTIÓN DEL MENÚ Y DISPARADORES
// =========================================

/**
 * Crea un menú personalizado en la UI de Google Sheets al abrir el documento.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Sincronización Avanzada')
      .addItem('1. Enviar Datos Nuevos Manualmente', 'triggerSync')
      .addSeparator()
      .addItem('2. Activar Sincronización Automática', 'createTrigger')
      .addItem('3. Desactivar Sincronización Automática', 'deleteTriggers')
      .addToUi();
}

/**
 * Crea un disparador (trigger) que ejecuta la sincronización automáticamente.
 * Se ejecutará según la frecuencia definida en CONFIG.
 */
function createTrigger() {
  deleteTriggers(); // Limpiamos disparadores antiguos para evitar duplicados.
  
  ScriptApp.newTrigger('triggerSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  SpreadsheetApp.getUi().alert(`¡Activado! La sincronización automática se ejecutará cada ${CONFIG.TRIGGER_FREQUENCY_HOURS} hora(s).`);
}

/**
 * Elimina todos los disparadores de tiempo asociados a este script.
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  Logger.log('Se han eliminado los disparadores automáticos existentes.');
}


// =========================================
// LÓGICA PRINCIPAL DE SINCRONIZACIÓN
// =========================================

/**
 * Función que inicia el proceso de sincronización.
 * Puede ser llamada manualmente o por un disparador.
 */
function triggerSync() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      throw new Error(`No se encontró la hoja "${CONFIG.SHEET_NAME}".`);
    }

    const dataRange = sheet.getDataRange();
    const allValues = dataRange.getValues();
    
    if (allValues.length <= 1) {
      Logger.log('No hay datos para procesar en la hoja.');
      return; // No hay filas de datos.
    }

    const headers = allValues[0];
    const statusColumnIndex = headers.indexOf(CONFIG.STATUS_COLUMN_NAME);

    if (statusColumnIndex === -1) {
       throw new Error(`No se encontró la columna de estado "${CONFIG.STATUS_COLUMN_NAME}". Por favor, agrégala al final de tu hoja.`);
    }

    const { newRows, rowNumbersToUpdate } = findNewRows(allValues, statusColumnIndex);

    if (newRows.length === 0) {
      Logger.log('No hay filas nuevas para enviar.');
      return;
    }

    const payload = createPayload(newRows, headers);
    const response = sendPayloadToWebhook(payload);

    handleWebhookResponse(response, sheet, rowNumbersToUpdate, statusColumnIndex);

  } catch (error) {
    const errorMessage = `Se produjo un error inesperado: ${error.message}`;
    Logger.log(errorMessage);
    // Solo mostramos alerta si el script fue ejecutado manualmente.
    if (typeof e === 'undefined' || !e.triggerUid) { 
        ui.alert('Error de Sincronización', errorMessage, ui.ButtonSet.OK);
    }
  }
}

/**
 * Busca filas que no han sido enviadas (donde la columna de estado está vacía).
 * @param {Array<Array<any>>} allValues - Todos los valores de la hoja.
 * @param {number} statusColumnIndex - El índice de la columna de estado.
 * @returns {{newRows: Array<Object>, rowNumbersToUpdate: Array<number>}}
 */
function findNewRows(allValues, statusColumnIndex) {
  const newRows = [];
  const rowNumbersToUpdate = [];
  const headers = allValues[0];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    // Consideramos una fila como nueva si la celda de estado está vacía y tiene un número de pedido.
    if (row[statusColumnIndex] === '' && row[headers.indexOf('PEDIDO')]) {
      
      const rowObject = {};
      headers.forEach((header, index) => {
        if(header) { // Asegurarse de que la cabecera no está vacía
          rowObject[header] = row[index];
        }
      });
      newRows.push(rowObject);
      rowNumbersToUpdate.push(i + 1); // El número de fila real (base 1)
    }
  }
  return { newRows, rowNumbersToUpdate };
}

/**
 * Crea el objeto de payload para enviar al webhook.
 * @param {Array<Object>} rows - Las filas a procesar (ya como objetos).
 * @returns {object} El payload listo para ser enviado.
 */
function createPayload(rows) {
  // El backend espera un objeto con una clave "orders" que es un array de objetos.
  return { orders: rows };
}

/**
 * Envía el payload al webhook.
 * @param {object} payload - El payload a enviar.
 * @returns {HTTPResponse} La respuesta del servidor.
 */
function sendPayloadToWebhook(payload) {
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // Capturamos errores HTTP manualmente.
  };

  Logger.log(`Enviando ${payload.orders.length} pedido(s) a ${CONFIG.WEBHOOK_URL}`);
  return UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
}

/**
 * Maneja la respuesta del servidor después de enviar los datos.
 * @param {HTTPResponse} response - La respuesta del servidor.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - La hoja de Google Sheets.
 * @param {Array<number>} rowNumbers - Los números de fila para actualizar.
 * @param {number} statusColIndex - El índice de la columna de estado.
 */
function handleWebhookResponse(response, sheet, rowNumbers, statusColIndex) {
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const ui = SpreadsheetApp.getUi();

  if (responseCode === 200) {
    Logger.log(`Éxito (${responseCode}): Se han enviado ${rowNumbers.length} filas. Respuesta: ${responseBody}`);
    
    // Actualiza la columna de estado para las filas enviadas exitosamente.
    rowNumbers.forEach(rowNum => {
      sheet.getRange(rowNum, statusColIndex + 1).setValue(CONFIG.SENT_STATUS_VALUE);
    });

  } else {
    const errorMsg = `Error al enviar los datos. El servidor respondió con el código: ${responseCode}\n\nRespuesta: ${responseBody}`;
    Logger.log(errorMsg);
    ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK); // Siempre alertamos en caso de error.
  }
}