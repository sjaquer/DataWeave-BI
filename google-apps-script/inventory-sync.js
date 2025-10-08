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
  
  // Nombre de la hoja que se usará para registrar los envíos y evitar duplicados.
  LOG_SHEET_NAME: 'LOG_ENVIOS',

  // Nombre de la columna que sirve como identificador único para cada fila.
  UNIQUE_ID_COLUMN: 'PEDIDO',

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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const mainSheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);
    if (!mainSheet) {
      throw new Error(`No se encontró la hoja "${CONFIG.SHEET_NAME}".`);
    }

    let logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(CONFIG.LOG_SHEET_NAME);
      logSheet.appendRow(['ID_PEDIDO_ENVIADO', 'FECHA_ENVIO']);
      Logger.log(`Hoja de log "${CONFIG.LOG_SHEET_NAME}" creada.`);
    }

    const sentIds = getSentIds(logSheet);
    const { newRows, sentIdsForLog } = findNewRows(mainSheet, sentIds);

    if (newRows.length === 0) {
      Logger.log('No hay filas nuevas para enviar.');
      // Opcional: mostrar alerta si es manual
      if (typeof e === 'undefined' || !e.triggerUid) { 
        ui.alert('Sincronización', 'No se encontraron pedidos nuevos para enviar.', ui.ButtonSet.OK);
      }
      return;
    }

    const payload = createPayload(newRows);
    const response = sendPayloadToWebhook(payload);

    handleWebhookResponse(response, logSheet, sentIdsForLog);

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
 * Obtiene un conjunto de IDs que ya han sido enviados, leyendo la hoja de log.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} logSheet - La hoja de logs.
 * @returns {Set<string>} Un conjunto de IDs de pedidos ya enviados.
 */
function getSentIds(logSheet) {
  const logData = logSheet.getDataRange().getValues();
  // Empezar desde 1 para saltar la cabecera
  const sentIds = new Set();
  for (let i = 1; i < logData.length; i++) {
    const id = logData[i][0]; // Asumimos que el ID está en la primera columna
    if (id) {
      sentIds.add(String(id));
    }
  }
  return sentIds;
}


/**
 * Busca filas que no han sido enviadas comparando con los IDs del log.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} mainSheet - La hoja principal de datos.
 * @param {Set<string>} sentIds - Un conjunto de IDs que ya fueron enviados.
 * @returns {{newRows: Array<Object>, sentIdsForLog: Array<string>}}
 */
function findNewRows(mainSheet, sentIds) {
  const allValues = mainSheet.getDataRange().getValues();
  if (allValues.length <= 1) return { newRows: [], sentIdsForLog: [] };

  const headers = allValues[0];
  const uniqueIdColumnIndex = headers.indexOf(CONFIG.UNIQUE_ID_COLUMN);

  if (uniqueIdColumnIndex === -1) {
    throw new Error(`No se encontró la columna de ID único "${CONFIG.UNIQUE_ID_COLUMN}" en la hoja "${CONFIG.SHEET_NAME}".`);
  }

  const newRows = [];
  const sentIdsForLog = [];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    const uniqueId = String(row[uniqueIdColumnIndex]);

    if (uniqueId && !sentIds.has(uniqueId)) {
      const rowObject = {};
      headers.forEach((header, index) => {
        if(header) {
          rowObject[header] = row[index];
        }
      });
      newRows.push(rowObject);
      sentIdsForLog.push(uniqueId);
    }
  }
  return { newRows, sentIdsForLog };
}


/**
 * Crea el objeto de payload para enviar al webhook.
 * @param {Array<Object>} rows - Las filas a procesar (ya como objetos).
 * @returns {object} El payload listo para ser enviado.
 */
function createPayload(rows) {
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
 * Maneja la respuesta del servidor y actualiza la hoja de log.
 * @param {HTTPResponse} response - La respuesta del servidor.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} logSheet - La hoja de logs.
 * @param {Array<string>} sentIdsForLog - Los IDs de los pedidos que se acaban de enviar.
 */
function handleWebhookResponse(response, logSheet, sentIdsForLog) {
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const ui = SpreadsheetApp.getUi();

  if (responseCode === 200) {
    Logger.log(`Éxito (${responseCode}): Se han procesado ${sentIdsForLog.length} filas. Respuesta: ${responseBody}`);
    
    // Actualiza la hoja de log con los nuevos IDs enviados
    const timestamp = new Date();
    const rowsToLog = sentIdsForLog.map(id => [id, timestamp]);
    if (rowsToLog.length > 0) {
      logSheet.getRange(logSheet.getLastRow() + 1, 1, rowsToLog.length, 2).setValues(rowsToLog);
    }
    
    // Alerta de éxito solo si es manual
    if (typeof e === 'undefined' || !e.triggerUid) { 
        const serverMessage = JSON.parse(responseBody).message;
        ui.alert('Sincronización Exitosa', serverMessage, ui.ButtonSet.OK);
    }

  } else {
    const errorMsg = `Error al enviar los datos. El servidor respondió con el código: ${responseCode}\n\nRespuesta: ${responseBody}`;
    Logger.log(errorMsg);
    // Siempre alertamos en caso de error para que el usuario esté al tanto.
    ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK);
  }
}
