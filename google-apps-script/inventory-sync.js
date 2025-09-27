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
  // ¡¡¡IMPORTANTE!!! Debes reemplazar esta URL por la URL de producción de tu aplicación.
  WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/inventory',

  // Nombre de la hoja que contiene los datos de movimientos de inventario.
  SHEET_NAME: 'MOVIMIENTOS_INVENTARIO',

  // Nombre de la columna que usaremos para marcar las filas como enviadas.
  STATUS_COLUMN_NAME: 'SYNC_STATUS',
  
  // Valor que se escribirá en la columna de estado después de un envío exitoso.
  SENT_STATUS_VALUE: 'ENVIADO',

  // Frecuencia del disparador automático en horas.
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
      .addItem('1. Enviar Datos Manualmente', 'triggerSync')
      .addSeparator()
      .addItem('2. Activar Sincronización Automática (Cada Hora)', 'createTrigger')
      .addItem('3. Desactivar Sincronización Automática', 'deleteTriggers')
      .addToUi();
}

/**
 * Crea un disparador (trigger) que ejecuta la sincronización automáticamente.
 * Se ejecutará cada hora. Si ya existe un disparador, se eliminará para evitar duplicados.
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
 * Elimina todos los disparadores asociados a este script.
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  Logger.log('Se han eliminado los disparadores existentes.');
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
      const errorMsg = `Error: No se encontró la hoja "${CONFIG.SHEET_NAME}".`;
      Logger.log(errorMsg);
      ui.alert(errorMsg);
      return;
    }

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length <= 1) {
      Logger.log('No hay datos para procesar en la hoja.');
      // No mostramos alerta al usuario para no ser intrusivos en ejecuciones automáticas.
      return;
    }

    const headers = values[0];
    const statusColumnIndex = headers.indexOf(CONFIG.STATUS_COLUMN_NAME);

    if (statusColumnIndex === -1) {
      const errorMsg = `Error: No se encontró la columna "${CONFIG.STATUS_COLUMN_NAME}". Por favor, añádela a tu hoja.`;
      Logger.log(errorMsg);
      ui.alert(errorMsg);
      return;
    }

    const { newRows, rowNumbersToUpdate } = findNewRows(values, statusColumnIndex);

    if (newRows.length === 0) {
      Logger.log('No hay filas nuevas para enviar.');
      // No mostramos alerta en ejecuciones automáticas.
      return;
    }

    const payload = createPayload(newRows, headers);
    const response = sendPayload(payload);

    handleResponse(response, sheet, rowNumbersToUpdate, statusColumnIndex);

  } catch (error) {
    const errorMsg = `Se produjo un error inesperado durante la sincronización: ${error.toString()}`;
    Logger.log(errorMsg);
    // Solo mostramos alerta si el script fue ejecutado manualmente.
    if (e.triggerUid === undefined) { 
        ui.alert(errorMsg);
    }
  }
}

/**
 * Busca filas que no han sido enviadas.
 * @param {Array<Array<any>>} allValues - Todos los valores de la hoja.
 * @param {number} statusColumnIndex - El índice de la columna de estado.
 * @returns {{newRows: Array<Array<any>>, rowNumbersToUpdate: Array<number>}}
 */
function findNewRows(allValues, statusColumnIndex) {
  const newRows = [];
  const rowNumbersToUpdate = [];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    if (row[statusColumnIndex] === '') {
      newRows.push(row);
      rowNumbersToUpdate.push(i + 1); // El número de fila real (base 1)
    }
  }
  return { newRows, rowNumbersToUpdate };
}

/**
 * Crea el objeto de payload para enviar al webhook.
 * @param {Array<Array<any>>} rows - Las filas a procesar.
 * @param {Array<string>} headers - Las cabeceras de la hoja.
 * @returns {object} El payload listo para ser enviado.
 */
function createPayload(rows, headers) {
  const movements = rows.map(row => {
    const movementObject = {};
    headers.forEach((header, index) => {
      if (header === 'TIMESTAMP' && row[index] instanceof Date) {
        // Formatea la fecha para asegurar consistencia.
        movementObject[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
      } else {
        movementObject[header] = row[index];
      }
    });
    return movementObject;
  });

  return { movements: movements };
}

/**
 * Envía el payload al webhook.
 * @param {object} payload - El payload a enviar.
 * @returns {HTTPResponse} La respuesta del servidor.
 */
function sendPayload(payload) {
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true // Capturamos errores HTTP manualmente.
  };

  Logger.log(`Enviando ${payload.movements.length} fila(s) a ${CONFIG.WEBHOOK_URL}`);
  return UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
}

/**
 * Maneja la respuesta del servidor después de enviar los datos.
 * @param {HTTPResponse} response - La respuesta del servidor.
 * @param {Sheet} sheet - La hoja de Google Sheets.
 * @param {Array<number>} rowNumbers - Los números de fila para actualizar.
 * @param {number} statusColIndex - El índice de la columna de estado.
 */
function handleResponse(response, sheet, rowNumbers, statusColIndex) {
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const ui = SpreadsheetApp.getUi();

  if (responseCode === 200) {
    Logger.log(`Éxito (${responseCode}): Se han enviado ${rowNumbers.length} filas. Respuesta: ${responseBody}`);
    
    // Optimizamos la actualización escribiendo en un rango a la vez si es posible.
    // Esto es mucho más eficiente que actualizar celda por celda.
    rowNumbers.forEach(rowNum => {
      sheet.getRange(rowNum, statusColIndex + 1).setValue(CONFIG.SENT_STATUS_VALUE);
    });

  } else {
    const errorMsg = `Error al enviar los datos. El servidor respondió con el código: ${responseCode}\n\nRespuesta: ${responseBody}`;
    Logger.log(errorMsg);
    ui.alert(errorMsg); // Siempre alertamos en caso de error.
  }
}
