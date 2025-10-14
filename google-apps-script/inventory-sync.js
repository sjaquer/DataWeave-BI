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

  // URL del webhook para datos temporales (PROVINCIA_ENVIADOS y LIMA_ENVIADOS).
  ENVIOS_TEMPORALES_WEBHOOK_URL: 'https://dataweave-bi.vercel.app/api/webhooks/envios-temporales',

  // Nombres de las hojas
  SHIPPED_SHEET_NAME: 'REPORTE_ENVIADOS',
  DELIVERED_SHEET_NAME: 'ENTREGADO',
  PROVINCIA_ENVIADOS_SHEET_NAME: 'PROVINCIA_ENVIADOS',
  LIMA_ENVIADOS_SHEET_NAME: 'LIMA_ENVIADOS',
  LOG_SHEET_NAME: 'LOG_ENVIOS',

  // Columnas de ID único para cada hoja
  SHIPPED_UNIQUE_ID_COLUMN: 'PEDIDO',
  DELIVERED_UNIQUE_ID_COLUMN: 'ID',
  PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN: 'PEDIDO',
  LIMA_ENVIADOS_UNIQUE_ID_COLUMN: 'PEDIDO',

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
      .addItem('1. Sincronizar PROVINCIA ENVIADOS (Temporal)', 'triggerProvinciaEnviadosSync')
      .addItem('2. Sincronizar LIMA ENVIADOS (Temporal)', 'triggerLimaEnviadosSync')
      .addItem('3. Sincronizar REPORTE ENVIADOS', 'triggerShippedSync')
      .addItem('4. Sincronizar ENTREGADO', 'triggerDeliveredSync')
      .addSeparator()
      .addItem('5. Activar Sincronización Automática', 'createTriggers')
      .addItem('6. Desactivar Sincronización Automática', 'deleteTriggers')
      .addToUi();
}

/**
 * Crea disparadores (triggers) para ambas sincronizaciones.
 */
function createTriggers() {
  deleteTriggers();
  
  // Trigger para PROVINCIA_ENVIADOS (ejecutar primero)
  ScriptApp.newTrigger('triggerProvinciaEnviadosSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  // Trigger para LIMA_ENVIADOS
  ScriptApp.newTrigger('triggerLimaEnviadosSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  // Trigger para REPORTE_ENVIADOS
  ScriptApp.newTrigger('triggerShippedSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  // Trigger para ENTREGADO
  ScriptApp.newTrigger('triggerDeliveredSync')
      .timeBased()
      .everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS)
      .create();

  SpreadsheetApp.getUi().alert(`¡Activado! La sincronización automática se ejecutará cada ${CONFIG.TRIGGER_FREQUENCY_HOURS} hora(s) para las 4 hojas.`);
}

/**
 * Elimina todos los disparadores de tiempo asociados a este script.
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    const handlerFunction = trigger.getHandlerFunction();
    if (handlerFunction === 'triggerShippedSync' || 
        handlerFunction === 'triggerDeliveredSync' || 
        handlerFunction === 'triggerProvinciaEnviadosSync' ||
        handlerFunction === 'triggerLimaEnviadosSync') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  Logger.log('Se han eliminado los disparadores automáticos existentes.');
  SpreadsheetApp.getUi().alert('Sincronización automática desactivada.');
}


// =========================================
// LÓGICA DE SINCRONIZACIÓN
// =========================================

/**
 * Funciones de disparo para el menú.
 */
function triggerProvinciaEnviadosSync() {
  syncSheetTemporal(
    CONFIG.PROVINCIA_ENVIADOS_SHEET_NAME,
    CONFIG.PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN,
    'PROVINCIA'
  );
}

function triggerLimaEnviadosSync() {
  syncSheetTemporal(
    CONFIG.LIMA_ENVIADOS_SHEET_NAME,
    CONFIG.LIMA_ENVIADOS_UNIQUE_ID_COLUMN,
    'LIMA'
  );
}

function triggerShippedSync() {
  syncSheet(
    CONFIG.SHIPPED_SHEET_NAME,
    CONFIG.SHIPPED_UNIQUE_ID_COLUMN,
    CONFIG.SHIPPED_WEBHOOK_URL,
    'ENVIADO',
    true // Usar log para esta hoja
  );
}

function triggerDeliveredSync() {
  syncSheet(
    CONFIG.DELIVERED_SHEET_NAME,
    CONFIG.DELIVERED_UNIQUE_ID_COLUMN,
    CONFIG.DELIVERED_WEBHOOK_URL,
    'ENTREGADO',
    false // NO usar log para esta hoja, siempre enviar todo para actualizaciones
  );
}

/**
 * Sincronización especial para hojas temporales (PROVINCIA_ENVIADOS y LIMA_ENVIADOS).
 * Ambas usan el mismo webhook pero con diferentes tipos de origen.
 */
function syncSheetTemporal(sheetName, uniqueIdColumn, tipoOrigen) {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  try {
    const mainSheet = spreadsheet.getSheetByName(sheetName);
    if (!mainSheet) throw new Error(`No se encontró la hoja "${sheetName}".`);

    const { dataToSend } = findRowsToSendTemporal(mainSheet, uniqueIdColumn);

    if (dataToSend.length === 0) {
      Logger.log(`No hay filas para enviar desde "${sheetName}".`);
      if (isManualExecution()) {
        ui.alert('Sincronización', `No se encontraron registros en "${sheetName}" para enviar.`, ui.ButtonSet.OK);
      }
      return;
    }

    // Agregar tipo de origen (PROVINCIA o LIMA) a cada registro
    const dataConTipo = dataToSend.map(row => ({
      ...row,
      TIPO_ORIGEN: tipoOrigen
    }));

    const payload = { 
      data: dataConTipo,
      tipoOrigen: tipoOrigen
    }; 
    
    const response = sendPayloadToWebhook(payload, CONFIG.ENVIOS_TEMPORALES_WEBHOOK_URL);

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    
    if (responseCode === 200) {
      Logger.log(`Éxito (${responseCode}): Se han procesado ${dataToSend.length} filas desde ${sheetName}. Respuesta: ${responseBody}`);
      if (isManualExecution()) {
        const serverMessage = JSON.parse(responseBody).message;
        ui.alert('Sincronización Exitosa', serverMessage, ui.ButtonSet.OK);
      }
    } else {
      const errorMsg = `Error al enviar los datos. Código: ${responseCode}\nRespuesta: ${responseBody}`;
      Logger.log(errorMsg);
      ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK);
    }

  } catch (error) {
    const errorMessage = `Error en hoja "${sheetName}": ${error.message}`;
    Logger.log(errorMessage);
    if (isManualExecution()) {
        ui.alert('Error de Sincronización', errorMessage, ui.ButtonSet.OK);
    }
  }
}


/**
 * Lógica principal de sincronización, reutilizable para cualquier hoja.
 * @param {string} sheetName - El nombre de la hoja a sincronizar.
 * @param {string} uniqueIdColumn - El nombre de la columna que es el ID único.
 * @param {string} webhookUrl - La URL del webhook a la que se enviarán los datos.
 * @param {string} logPrefix - Un prefijo para los IDs en el log para evitar colisiones.
 * @param {boolean} useLog - Si es true, solo envía filas nuevas. Si es false, envía todo.
 */
function syncSheet(sheetName, uniqueIdColumn, webhookUrl, logPrefix, useLog) {
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

    const sentIds = useLog ? getSentIds(logSheet, logPrefix) : new Set();
    const { dataToSend, idsToLog } = findRowsToSend(mainSheet, uniqueIdColumn, sentIds, logPrefix, useLog);

    if (dataToSend.length === 0) {
      Logger.log(`No hay filas nuevas para enviar desde "${sheetName}".`);
      if (isManualExecution()) {
        ui.alert('Sincronización', `No se encontraron registros ${useLog ? 'nuevos' : ''} en "${sheetName}" para enviar.`, ui.ButtonSet.OK);
      }
      return;
    }

    const payload = { data: dataToSend }; 
    const response = sendPayloadToWebhook(payload, webhookUrl);

    // Solo registrar en el log si useLog es true
    if (useLog) {
      handleWebhookResponse(response, logSheet, idsToLog);
    } else {
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();
        if (responseCode === 200) {
            Logger.log(`Éxito (${responseCode}): Se han procesado ${dataToSend.length} filas desde ${sheetName}. Respuesta: ${responseBody}`);
            if (isManualExecution()) {
                const serverMessage = JSON.parse(responseBody).message;
                ui.alert('Sincronización Exitosa', serverMessage, ui.ButtonSet.OK);
            }
        } else {
            const errorMsg = `Error al enviar los datos. Código: ${responseCode}\nRespuesta: ${responseBody}`;
            Logger.log(errorMsg);
            ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK);
        }
    }

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
 * Busca filas para enviar.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} mainSheet - La hoja principal.
 * @param {string} uniqueIdColumn - El nombre de la columna de ID.
 * @param {Set<string>} sentIds - Conjunto de IDs ya enviados.
 * @param {string} logPrefix - Prefijo para construir el ID del log.
 * @param {boolean} useLog - Si es true, filtra por sentIds. Si es false, toma todo.
 * @returns {{dataToSend: Array<Object>, idsToLog: Array<string>}}
 */
function findRowsToSend(mainSheet, uniqueIdColumn, sentIds, logPrefix, useLog) {
  const allValues = mainSheet.getDataRange().getValues();
  if (allValues.length <= 1) return { dataToSend: [], idsToLog: [] };

  const headers = allValues[0];
  const uniqueIdColumnIndex = headers.indexOf(uniqueIdColumn);

  if (uniqueIdColumnIndex === -1) {
    throw new Error(`No se encontró la columna de ID único "${uniqueIdColumn}" en la hoja "${mainSheet.getName()}".`);
  }

  const dataToSend = [];
  const idsToLog = [];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    let uniqueId = String(row[uniqueIdColumnIndex]);

    // Si la columna de ID es 'ID', usamos el número de fila como fallback si está vacía.
    if (uniqueIdColumn === 'ID' && !uniqueId) {
      uniqueId = String(i + 1); // El número de fila es i + 1
    }

    const logId = `${logPrefix}-${uniqueId}`;

    const rowObject = {};
    headers.forEach((header, index) => {
      if (header) {
        rowObject[header] = row[index];
      }
    });

    if (useLog) {
      if (uniqueId && !sentIds.has(logId)) {
        if (uniqueIdColumn === 'ID') rowObject['ID'] = uniqueId;
        dataToSend.push(rowObject);
        idsToLog.push(logId);
      }
    } else {
      if (uniqueId) {
        if (uniqueIdColumn === 'ID') rowObject['ID'] = uniqueId;
        dataToSend.push(rowObject);
        // No añadimos a idsToLog porque no se registrará en el log
      }
    }
  }
  return { dataToSend, idsToLog };
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
function handleWebhookResponse(response, logSheet, idsToLog) {
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();
  const ui = SpreadsheetApp.getUi();

  if (responseCode === 200) {
    Logger.log(`Éxito (${responseCode}): Se han procesado ${idsToLog.length} filas. Respuesta: ${responseBody}`);
    
    const timestamp = new Date();
    const rowsToLog = idsToLog.map(id => [id, timestamp]);
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
    ui.alert('Error de Sincronización', errorMsg, ui.ButtonSet.OK);
  }
}

/**
 * Busca filas para enviar (versión para hojas temporales).
 * @param {GoogleAppsScript.Spreadsheet.Sheet} mainSheet - La hoja principal.
 * @param {string} uniqueIdColumn - El nombre de la columna de ID.
 * @returns {{dataToSend: Array<Object>}}
 */
function findRowsToSendTemporal(mainSheet, uniqueIdColumn) {
  const allValues = mainSheet.getDataRange().getValues();
  if (allValues.length <= 1) return { dataToSend: [] };

  const headers = allValues[0];
  const uniqueIdColumnIndex = headers.indexOf(uniqueIdColumn);

  if (uniqueIdColumnIndex === -1) {
    throw new Error(`No se encontró la columna de ID único "${uniqueIdColumn}" en la hoja "${mainSheet.getName()}".`);
  }

  const dataToSend = [];

  for (let i = 1; i < allValues.length; i++) {
    const row = allValues[i];
    let uniqueId = String(row[uniqueIdColumnIndex]);

    const rowObject = {};
    headers.forEach((header, index) => {
      if (header) {
        rowObject[header] = row[index];
      }
    });

    if (uniqueId) {
      dataToSend.push(rowObject);
    }
  }
  
  return { dataToSend };
}


/**
 * Verifica si el script fue ejecutado manualmente o por un trigger.
 * @param {object} e - El objeto de evento del trigger.
 */
function isManualExecution(e) {
  // `e` (el objeto de evento) solo existe cuando se ejecuta por un trigger.
  return !e;
}
