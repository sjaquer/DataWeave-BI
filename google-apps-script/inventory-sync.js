/**
 * @OnlyCurrentDoc
 */

// =========================================
// CONFIGURACIÓN CENTRALIZADA
// =========================================
const CONFIG = {
  // URL del webhook para la hoja REPORTE_ENVIADOS.
  SHIPPED_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/sheets',
  
  // URL del webhook para la nueva hoja ENTREGADO.
  DELIVERED_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/delivered',

  // Nombres de las hojas
  SHIPPED_SHEET_NAME: 'REPORTE_ENVIADOS',
  DELIVERED_SHEET_NAME: 'ENTREGADO', // Corregido de "ENTREGADOS" a "ENTREGADO"
  LOG_SHEET_NAME: 'LOG_ENVIOS',

  // Columnas de ID único para cada hoja
  SHIPPED_UNIQUE_ID_COLUMN: 'PEDIDO',
  DELIVERED_UNIQUE_ID_COLUMN: 'ID', // Usaremos el ID de fila como identificador único

  // Frecuencia del disparador automático en horas.
  TRIGGER_FREQUENCY_HOURS: 1
};


// =========================================
// GESTIÓN DEL MENÚ Y DISPARADORES
// =========================================

/**
 * Crea un menú personalizado en la UI de Google Sheets.
 */
function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('Sincronización DataWeave')
      .addItem('1. Sincronizar REPORTE ENVIADOS', 'triggerShippedSync')
      .addItem('2. Sincronizar ENTREGADO', 'triggerDeliveredSync')
      .addSeparator()
      .addItem('3. Activar Sincronización Automática', 'createTrigger')
      .addItem('4. Desactivar Sincronización Automática', 'deleteTriggers')
      .addToUi();
}

/**
 * Crea un disparador (trigger) que ejecuta ambas sincronizaciones.
 */
function createTrigger() {
  deleteTriggers();
  
  // Trigger para REPORTE_ENVIADOS
  ScriptApp.newTrigger('triggerShippedSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  // Trigger para ENTREGADOS
  ScriptApp.newTrigger('triggerDeliveredSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  SpreadsheetApp.getUi().alert(`¡Activado! La sincronización automática se ejecutará cada ${CONFIG.TRIGGER_FREQUENCY_HOURS} hora(s) para ambas hojas.`);
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
// LÓGICA DE SINCRONIZACIÓN
// =========================================

/**
 * Funciones de disparo para el menú.
 */
function triggerShippedSync() {
  syncSheet(
    CONFIG.SHIPPED_SHEET_NAME,
    CONFIG.SHIPPED_UNIQUE_ID_COLUMN,
    CONFIG.SHIPPED_WEBHOOK_URL,
    'ENVIADO'
  );
}

function triggerDeliveredSync() {
  syncSheet(
    CONFIG.DELIVERED_SHEET_NAME,
    CONFIG.DELIVERED_UNIQUE_ID_COLUMN,
    CONFIG.DELIVERED_WEBHOOK_URL,
    'ENTREGADO'
  );
}


/**
 * Lógica principal de sincronización, reutilizable para cualquier hoja.
 * @param {string} sheetName - El nombre de la hoja a sincronizar.
 * @param {string} uniqueIdColumn - El nombre de la columna que es el ID único.
 * @param {string} webhookUrl - La URL del webhook a la que se enviarán los datos.
 * @param {string} logPrefix - Un prefijo para los IDs en el log para evitar colisiones.
 */
function syncSheet(sheetName, uniqueIdColumn, webhookUrl, logPrefix) {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const mainSheet = spreadsheet.getSheetByName(sheetName);
    if (!mainSheet) throw new Error(`No se encontró la hoja "${sheetName}".`);

    let logSheet = spreadsheet.getSheetByName(CONFIG.LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = spreadsheet.insertSheet(CONFIG.LOG_SHEET_NAME);
      logSheet.appendRow(['ID_REGISTRO_ENVIADO', 'FECHA_ENVIO']);
      Logger.log(`Hoja de log "${CONFIG.LOG_SHEET_NAME}" creada.`);
    }

    const sentIds = getSentIds(logSheet, logPrefix);
    const { newRows, sentIdsForLog } = findNewRows(mainSheet, uniqueIdColumn, sentIds, logPrefix);

    if (newRows.length === 0) {
      Logger.log(`No hay filas nuevas para enviar desde "${sheetName}".`);
      // No mostrar alerta si es ejecución automática.
      if (isManualExecution()) {
        ui.alert('Sincronización', `No se encontraron registros nuevos en "${sheetName}" para enviar.`, ui.ButtonSet.OK);
      }
      return;
    }

    const payload = { data: newRows }; // El backend espera un objeto con clave "data"
    const response = sendPayloadToWebhook(payload, webhookUrl);

    handleWebhookResponse(response, logSheet, sentIdsForLog);

  } catch (error) {
    const errorMessage = `Error en hoja "${sheetName}": ${error.message}`;
    Logger.log(errorMessage);
    if (isManualExecution()) {
        ui.alert('Error de Sincronización', errorMessage, ui.ButtonSet.OK);
    }
  }
}

/**
 * Obtiene un conjunto de IDs que ya han sido enviados.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} logSheet - La hoja de logs.
 * @param {string} logPrefix - El prefijo para filtrar los logs.
 * @returns {Set<string>} Un conjunto de IDs ya enviados.
 */
function getSentIds(logSheet, logPrefix) {
  const logData = logSheet.getDataRange().getValues();
  const sentIds = new Set();
  for (let i = 1; i < logData.length; i++) {
    const loggedId = String(logData[i][0]);
    if (loggedId.startsWith(logPrefix + '-')) {
      sentIds.add(loggedId);
    }
  }
  return sentIds;
}


/**
 * Busca filas que no han sido enviadas.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} mainSheet - La hoja principal.
 * @param {string} uniqueIdColumn - El nombre de la columna de ID.
 * @param {Set<string>} sentIds - Conjunto de IDs ya enviados.
 * @param {string} logPrefix - Prefijo para construir el ID del log.
 * @returns {{newRows: Array<Object>, sentIdsForLog: Array<string>}}
 */
function findNewRows(mainSheet, uniqueIdColumn, sentIds, logPrefix) {
  const allValues = mainSheet.getDataRange().getValues();
  if (allValues.length <= 1) return { newRows: [], sentIdsForLog: [] };

  const headers = allValues[0];
  const uniqueIdColumnIndex = headers.indexOf(uniqueIdColumn);

  if (uniqueIdColumnIndex === -1) {
    throw new Error(`No se encontró la columna de ID único "${uniqueIdColumn}" en la hoja "${mainSheet.getName()}".`);
  }

  const newRows = [];
  const sentIdsForLog = [];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    let uniqueId = String(row[uniqueIdColumnIndex]);

    // Si la columna de ID es 'ID', usamos el número de fila como fallback.
    if (uniqueIdColumn === 'ID' && !uniqueId) {
      uniqueId = String(i + 1); // El número de fila es i + 1
    }

    const logId = `${logPrefix}-${uniqueId}`;

    if (uniqueId && !sentIds.has(logId)) {
      const rowObject = {};
      headers.forEach((header, index) => {
        if (header) {
          rowObject[header] = row[index];
        }
      });
      // Si el ID es el de la fila, lo añadimos explícitamente al objeto.
      if (uniqueIdColumn === 'ID') {
        rowObject['ID'] = uniqueId;
      }
      newRows.push(rowObject);
      sentIdsForLog.push(logId);
    }
  }
  return { newRows, sentIdsForLog };
}


/**
 * Envía el payload al webhook.
 */
function sendPayloadToWebhook(payload, webhookUrl) {
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  Logger.log(`Enviando ${payload.data.length} registro(s) a ${webhookUrl}`);
  return UrlFetchApp.fetch(webhookUrl, options);
}

/**
 * Maneja la respuesta del servidor y actualiza la hoja de log.
 */
function handleWebhookResponse(response, logSheet, sentIdsForLog) {
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const ui = SpreadsheetApp.getUi();

  if (responseCode === 200) {
    Logger.log(`Éxito (${responseCode}): Se han procesado ${sentIdsForLog.length} filas. Respuesta: ${responseBody}`);
    
    const timestamp = new Date();
    const rowsToLog = sentIdsForLog.map(id => [id, timestamp]);
    if (rowsToLog.length > 0) {
      logSheet.getRange(logSheet.getLastRow() + 1, 1, rowsToLog.length, 2).setValues(rowsToLog);
    }
    
    if (isManualExecution()) {
        const serverMessage = JSON.parse(responseBody).message;
        ui.alert('Sincronización Exitosa', serverMessage, ui.ButtonSet.OK);
    }

  } else {
    const errorMsg = `Error al enviar los datos. Código: ${responseCode}\nRespuesta: ${responseBody}`;
    Logger.log(errorMsg);
    // Siempre alertamos en caso de error.
    ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK);
  }
}

/**
 * Verifica si el script fue ejecutado manually o por un trigger.
 * @param {object} e - El objeto de evento del trigger.
 */
function isManualExecution(e) {
  return !e;
}
