/**
 * @OnlyCurrentDoc
 */

/**
 * inventory-sync.js
 * -----------------
 * Sincronización de Google Sheets -> Webhooks (DataWeave)
 *
 * HOJAS SOPORTADAS:
 * - REPORTE_ENVIADOS (~25 columnas)
 * - ENTREGADO (~16 columnas)
 * - PROVINCIA_ENVIADOS (28 columnas A-AB, ID único: PEDIDO columna D)
 * - LIMA_ENVIADOS (28 columnas A-AB, ID único: PEDIDO columna D)
 * 
 * IMPORTANTE:
 * - PROVINCIA y LIMA tienen EXACTAMENTE la misma estructura (28 columnas)
 * - Ambas usan PEDIDO (columna D) como ID único
 * - Ambas tienen COURIER en columna P (index 15)
 * - Ambas tienen NOMBRES en columna I (index 8)
 * - Ambas tienen ESTADO en columna AB (index 27)
 * - El mapeo es DINÁMICO por nombre de header, NO por índice
 *
 * SINCRONIZACIÓN AUTOMÁTICA:
 * - Al pulsar '5. Activar Sincronización Automática' se crea UN trigger time-based
 *   que ejecuta `runAutoSyncAll` cada N minutos (por defecto CONFIG.TRIGGER_FREQUENCY_MINUTES = 5).
 * - `runAutoSyncAll` ejecuta en background la sincronización de todas las hojas sin mostrar UI.
 * - '6. Desactivar Sincronización Automática' elimina el trigger creado.
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
  // Si TRIGGER_FREQUENCY_MINUTES está presente se usará prioridad sobre horas.
  TRIGGER_FREQUENCY_HOURS: 1,
  TRIGGER_FREQUENCY_MINUTES: 5,
  
  // Tamaño del lote para envíos (para evitar error 413 FUNCTION_PAYLOAD_TOO_LARGE)
  // Ajusta este valor si sigues recibiendo errores. Valores recomendados: 50-100
  // IMPORTANTE: Para hojas muy grandes (>500 filas), usa lotes más pequeños para evitar timeout
  BATCH_SIZE: 50,
  
  // Delay entre lotes en milisegundos (para evitar rate limits)
  // Aumentado a 1000ms para evitar timeouts en hojas grandes
  BATCH_DELAY_MS: 1000
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
 * 
 * IMPORTANTE: Si ves error de permisos insuficientes:
 * 1. Cierra el diálogo de error
 * 2. Ve a: Extensiones → Apps Script
 * 3. En el editor, selecciona la función "createTriggers" en el menú desplegable
 * 4. Haz clic en "Ejecutar" (▶️)
 * 5. Acepta los permisos cuando aparezca el popup de Google
 * 6. Scope requerido: https://www.googleapis.com/auth/script.scriptapp
 * 7. Vuelve a Google Sheets y prueba el botón "5. Activar Sincronización Automática"
 */
function createTriggers() {
  // Intentamos eliminar triggers anteriores — si faltan permisos, informamos al usuario
  try {
    deleteTriggers();
  } catch (e) {
    try {
      const message = 'No se pudieron gestionar los disparadores automáticos debido a permisos insuficientes.\n\n' +
                     '📋 PASOS PARA SOLUCIONAR:\n\n' +
                     '1. Cierra este mensaje\n' +
                     '2. Ve a: Extensiones → Apps Script\n' +
                     '3. En el menú superior, selecciona "createTriggers"\n' +
                     '4. Haz clic en el botón "Ejecutar" (▶️)\n' +
                     '5. Acepta los permisos cuando aparezca el popup\n' +
                     '6. Vuelve a Sheets y usa el menú nuevamente\n\n' +
                     'Permiso requerido:\n' +
                     'https://www.googleapis.com/auth/script.scriptapp';
      
      SpreadsheetApp.getUi().alert('⚠️ Permisos Insuficientes', message, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (uiErr) {
      // fallback logging
      Logger.log('Permisos insuficientes para gestionar triggers: ' + e.message);
    }
    return;
  }
  
  // Crear triggers con prioridad a minutos si está configurado
  const useMinutes = typeof CONFIG.TRIGGER_FREQUENCY_MINUTES === 'number' && CONFIG.TRIGGER_FREQUENCY_MINUTES > 0;

  // Helper para crear trigger con minutos u horas
  function createTimeTrigger(functionName) {
    try {
      const trig = ScriptApp.newTrigger(functionName).timeBased();
      if (useMinutes) {
        trig.everyMinutes(CONFIG.TRIGGER_FREQUENCY_MINUTES).create();
      } else {
        trig.everyHours(CONFIG.TRIGGER_FREQUENCY_HOURS).create();
      }
    } catch (err) {
      // Probablemente permisos insuficientes (scope script.scriptapp)
      try {
        const message = '⚠️ No se pudieron crear triggers por permisos insuficientes.\n\n' +
                       '📋 PASOS PARA AUTORIZAR:\n\n' +
                       '1. Cierra este mensaje\n' +
                       '2. Abre: Extensiones → Apps Script\n' +
                       '3. Selecciona "createTriggers" en el menú superior\n' +
                       '4. Haz clic en "Ejecutar" (▶️)\n' +
                       '5. En el popup, haz clic en "Revisar permisos"\n' +
                       '6. Selecciona tu cuenta de Google\n' +
                       '7. Haz clic en "Avanzado" → "Ir a [nombre del proyecto]"\n' +
                       '8. Acepta los permisos\n' +
                       '9. Vuelve a Sheets y usa el menú nuevamente\n\n' +
                       'Permiso requerido:\n' +
                       'https://www.googleapis.com/auth/script.scriptapp';
        
        SpreadsheetApp.getUi().alert(message);
      } catch (uiErr) {
        Logger.log('No se pudieron crear triggers: ' + err.message);
      }
      throw err;
    }
  }

  // Crear UN solo trigger que ejecuta la sincronización de todas las hojas en background
  createTimeTrigger('runAutoSyncAll');

  // Mensaje informativo (si hay UI disponible)
  try {
    const freqText = useMinutes ? `${CONFIG.TRIGGER_FREQUENCY_MINUTES} minuto(s)` : `${CONFIG.TRIGGER_FREQUENCY_HOURS} hora(s)`;
    SpreadsheetApp.getUi().alert(`¡Activado! La sincronización automática en background se ejecutará cada ${freqText} para todas las hojas.`);
  } catch (e) {
    // No hay UI (ejecución por trigger), no hacemos nada
  }
}

/**
 * Elimina todos los disparadores de tiempo asociados a este script.
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    const handlerFunction = trigger.getHandlerFunction();
    // Eliminar triggers antiguos o el nuevo handler central
    const handlersToDelete = new Set([
      'triggerShippedSync',
      'triggerDeliveredSync',
      'triggerProvinciaEnviadosSync',
      'triggerLimaEnviadosSync',
      'runAutoSyncAll'
    ]);
    if (handlersToDelete.has(handlerFunction)) {
      try {
        ScriptApp.deleteTrigger(trigger);
      } catch (e) {
        Logger.log(`No se pudo eliminar trigger ${handlerFunction}: ${e.message}`);
      }
    }
  }
  Logger.log('Se han eliminado los disparadores automáticos existentes.');
  try {
    SpreadsheetApp.getUi().alert('Sincronización automática desactivada.');
  } catch (e) {
    // No UI disponible
  }
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
 * Handler instalable para "On edit" que puedes seleccionar manualmente al crear un activador.
 * - En el editor de Apps Script, al añadir un activador, selecciona la función `onSheetEdit`
 *   y el evento "On edit" (From spreadsheet -> On edit).
 * - Envía sólo la(s) fila(s) editada(s) al webhook correspondiente para minimizar trabajo.
 * @param {Object} e Evento de Apps Script (installable onEdit event)
 */
function onSheetEdit(e) {
  try {
    if (!e || !e.range) {
      Logger.log('onSheetEdit: evento inválido');
      return;
    }

    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    const firstRow = 1;
    const headers = sheet.getRange(firstRow, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Función auxiliar para construir objetos fila
    function rowToObject(rowIndex) {
      const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
      const obj = {};
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        if (h) obj[h] = values[i];
      }
      
      return obj;
    }

    const startRow = e.range.getRow();
    const numRows = e.range.getNumRows ? e.range.getNumRows() : 1;
    const rows = [];
    for (let r = 0; r < numRows; r++) {
      const idx = startRow + r;
      if (idx === 1) continue; // evitar cabecera
      rows.push(rowToObject(idx));
    }

    if (rows.length === 0) {
      Logger.log('onSheetEdit: no hay filas relevantes editadas');
      return;
    }

    // Enviar a endpoints según la hoja
    if (sheetName === CONFIG.PROVINCIA_ENVIADOS_SHEET_NAME || sheetName === CONFIG.LIMA_ENVIADOS_SHEET_NAME) {
      const tipo = sheetName === CONFIG.PROVINCIA_ENVIADOS_SHEET_NAME ? 'PROVINCIA' : 'LIMA';
      const dataConTipo = rows.map(r => ({ ...r, TIPO_ORIGEN: tipo }));
      
      try {
        const result = sendDataInBatches(dataConTipo, CONFIG.ENVIOS_TEMPORALES_WEBHOOK_URL, tipo);
        Logger.log(`onSheetEdit: enviado temporal, ${result.totalSent} filas en ${result.batches} lote(s)`);
      } catch (err) {
        Logger.log('onSheetEdit: error enviando temporal: ' + err.message);
      }
      return;
    }

    if (sheetName === CONFIG.SHIPPED_SHEET_NAME) {
      // Para REPORTE_ENVIADOS enviamos la(s) fila(s) editada(s) al webhook de shipped
      try {
        const result = sendDataInBatches(rows, CONFIG.SHIPPED_WEBHOOK_URL);
        Logger.log(`onSheetEdit: enviado shipped, ${result.totalSent} filas en ${result.batches} lote(s)`);
      } catch (err) {
        Logger.log('onSheetEdit: error enviando shipped: ' + err.message);
      }
      return;
    }

    if (sheetName === CONFIG.DELIVERED_SHEET_NAME) {
      try {
        const result = sendDataInBatches(rows, CONFIG.DELIVERED_WEBHOOK_URL);
        Logger.log(`onSheetEdit: enviado delivered, ${result.totalSent} filas en ${result.batches} lote(s)`);
      } catch (err) {
        Logger.log('onSheetEdit: error enviando delivered: ' + err.message);
      }
      return;
    }

    // Si la hoja no coincide con ninguna conocida, no hacemos nada
    Logger.log('onSheetEdit: hoja no gestionada: ' + sheetName);

  } catch (ex) {
    Logger.log('onSheetEdit: excepción: ' + ex.message);
  }
}


/**
 * Handler central para la sincronización automática en background.
 * Llama a las funciones de sincronización para todas las hojas en una sola ejecución.
 * Esta función está pensada para ser invocada por un trigger time-based cada N minutos.
 */
function runAutoSyncAll() {
  // Ejecutar las sincronizaciones en silencioso (sin ventanas UI)
  try {
    // Temporal: Provincia y Lima (enviar todo cada vez)
    syncSheetTemporal(CONFIG.PROVINCIA_ENVIADOS_SHEET_NAME, CONFIG.PROVINCIA_ENVIADOS_UNIQUE_ID_COLUMN, 'PROVINCIA');
    syncSheetTemporal(CONFIG.LIMA_ENVIADOS_SHEET_NAME, CONFIG.LIMA_ENVIADOS_UNIQUE_ID_COLUMN, 'LIMA');

    // REPORTE_ENVIADOS y ENTREGADO usan su lógica (REPORTE usa log para evitar duplicados)
    syncSheet(CONFIG.SHIPPED_SHEET_NAME, CONFIG.SHIPPED_UNIQUE_ID_COLUMN, CONFIG.SHIPPED_WEBHOOK_URL, 'ENVIADO', true);
    syncSheet(CONFIG.DELIVERED_SHEET_NAME, CONFIG.DELIVERED_UNIQUE_ID_COLUMN, CONFIG.DELIVERED_WEBHOOK_URL, 'ENTREGADO', false);

  } catch (e) {
    // Registrar pero no mostrar UI
    Logger.log(`Error en runAutoSyncAll: ${e.message}`);
  }
}

/**
 * Sincronización especial para hojas temporales (PROVINCIA_ENVIADOS y LIMA_ENVIADOS).
 * Ambas usan el mismo webhook pero con diferentes tipos de origen.
 * 
 * IMPORTANTE: Para hojas muy grandes (>500 filas), considera usar la sincronización automática
 * en lugar de la manual para evitar timeouts de 6 minutos de Google Apps Script.
 */
function syncSheetTemporal(sheetName, uniqueIdColumn, tipoOrigen) {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date().getTime();
  const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutos (dejamos 1 min de margen)

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

    // Advertencia si hay muchas filas
    if (isManualExecution() && dataToSend.length > 500) {
      const response = ui.alert(
        'Advertencia: Hoja Grande', 
        `Esta hoja tiene ${dataToSend.length} filas. La sincronización manual puede tardar varios minutos.\n\n¿Deseas continuar?\n\nRecomendación: Usa "5. Activar Sincronización Automática" para hojas grandes.`,
        ui.ButtonSet.YES_NO
      );
      
      if (response !== ui.Button.YES) {
        Logger.log(`Sincronización cancelada por el usuario para ${sheetName}`);
        return;
      }
    }

    // Agregar tipo de origen (PROVINCIA o LIMA) a cada registro
    const dataConTipo = dataToSend.map(row => ({
      ...row,
      TIPO_ORIGEN: tipoOrigen
    }));

    // Verificar tiempo transcurrido
    const elapsedTime = new Date().getTime() - startTime;
    if (elapsedTime > MAX_EXECUTION_TIME) {
      throw new Error('Tiempo de ejecución excedido. Usa sincronización automática para hojas grandes.');
    }

    // Enviar en lotes para evitar error 413
    const result = sendDataInBatches(dataConTipo, CONFIG.ENVIOS_TEMPORALES_WEBHOOK_URL, tipoOrigen);
    
    if (result.success) {
      const successMsg = `✅ Sincronización exitosa: ${result.totalSent} filas procesadas en ${result.batches} lote(s)`;
      Logger.log(successMsg);
      if (isManualExecution()) {
        ui.alert('Sincronización Exitosa', `Se han procesado ${result.totalSent} filas desde ${sheetName} en ${result.batches} lote(s).\n\nTiempo: ${Math.round(elapsedTime / 1000)}s`, ui.ButtonSet.OK);
      }
    } else {
      const errorMsg = `⚠️ Sincronización parcial: ${result.totalSent}/${dataToSend.length} filas enviadas. Errores: ${result.errors.length}`;
      Logger.log(errorMsg);
      if (isManualExecution()) {
        ui.alert('Error de Sincronización', `${errorMsg}\n\nPrimeros errores:\n${result.errors.slice(0, 3).join('\n')}`, ui.ButtonSet.OK);
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

    // Enviar en lotes para evitar error 413
    const result = sendDataInBatches(dataToSend, webhookUrl);

    // Solo registrar en el log si useLog es true Y el envío fue exitoso
    if (useLog && result.success && result.totalSent > 0) {
      const timestamp = new Date();
      const rowsToLog = idsToLog.slice(0, result.totalSent).map(id => [id, timestamp]);
      if (rowsToLog.length > 0) {
        logSheet.getRange(logSheet.getLastRow() + 1, 1, rowsToLog.length, 2).setValues(rowsToLog);
        Logger.log(`📝 Registrados ${rowsToLog.length} IDs en el log`);
      }
      
      if (isManualExecution()) {
        ui.alert('Sincronización Exitosa', `Se procesaron ${result.totalSent} filas en ${result.batches} lote(s).`, ui.ButtonSet.OK);
      }
    } else if (!useLog) {
      // Sin log: solo mostrar resultado
      if (result.success) {
        Logger.log(`✅ Sincronización exitosa: ${result.totalSent} filas en ${result.batches} lote(s)`);
        if (isManualExecution()) {
          ui.alert('Sincronización Exitosa', `Se han procesado ${result.totalSent} filas desde ${sheetName} en ${result.batches} lote(s).`, ui.ButtonSet.OK);
        }
      } else {
        const errorMsg = `⚠️ Sincronización parcial: ${result.totalSent}/${dataToSend.length} filas. Errores: ${result.errors.length}`;
        Logger.log(errorMsg);
        if (isManualExecution()) {
          ui.alert('Error de Sincronización', `${errorMsg}\n\nPrimeros errores:\n${result.errors.slice(0, 2).join('\n')}`, ui.ButtonSet.OK);
        }
      }
    } else {
      // useLog=true pero hubo errores
      const errorMsg = `⚠️ Error en sincronización: solo ${result.totalSent}/${dataToSend.length} filas enviadas. No se actualizó el log.`;
      Logger.log(errorMsg);
      if (isManualExecution()) {
        ui.alert('Error de Sincronización', `${errorMsg}\n\nErrores:\n${result.errors.slice(0, 2).join('\n')}`, ui.ButtonSet.OK);
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
 * Divide un array en lotes (chunks) del tamaño especificado.
 * @param {Array} array - Array a dividir
 * @param {number} size - Tamaño de cada lote
 * @returns {Array<Array>} Array de lotes
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Envía datos en lotes para evitar el error 413 (payload demasiado grande).
 * @param {Array} dataToSend - Datos a enviar
 * @param {string} webhookUrl - URL del webhook
 * @param {string} tipoOrigen - Tipo de origen (opcional, para hojas temporales)
 * @returns {Object} Resultado del envío con estadísticas
 */
function sendDataInBatches(dataToSend, webhookUrl, tipoOrigen = null) {
  if (dataToSend.length === 0) {
    return { success: true, totalSent: 0, batches: 0, errors: [] };
  }

  const batches = chunkArray(dataToSend, CONFIG.BATCH_SIZE);
  const results = {
    success: true,
    totalSent: 0,
    batches: batches.length,
    errors: []
  };

  Logger.log(`📦 Enviando ${dataToSend.length} filas en ${batches.length} lote(s) de hasta ${CONFIG.BATCH_SIZE} filas cada uno`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchNum = i + 1;
    
    try {
      const payload = tipoOrigen 
        ? { data: batch, tipoOrigen: tipoOrigen }
        : { data: batch };
      
      Logger.log(`📤 Enviando lote ${batchNum}/${batches.length} (${batch.length} filas)...`);
      
      const response = sendPayloadToWebhook(payload, webhookUrl);
      const responseCode = response.getResponseCode();
      const responseBody = response.getContentText();

      if (responseCode === 200) {
        results.totalSent += batch.length;
        Logger.log(`✅ Lote ${batchNum}/${batches.length} procesado exitosamente`);
      } else {
        const error = `Error en lote ${batchNum}: código ${responseCode}, respuesta: ${responseBody}`;
        Logger.log(`❌ ${error}`);
        results.errors.push(error);
        results.success = false;
      }

      // Delay entre lotes para evitar rate limits (excepto en el último)
      if (i < batches.length - 1) {
        Utilities.sleep(CONFIG.BATCH_DELAY_MS);
      }

    } catch (error) {
      const errorMsg = `Excepción en lote ${batchNum}: ${error.message}`;
      Logger.log(`❌ ${errorMsg}`);
      results.errors.push(errorMsg);
      results.success = false;
    }
  }

  Logger.log(`📊 Resumen: ${results.totalSent}/${dataToSend.length} filas enviadas en ${batches.length} lote(s)`);
  
  return results;
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
  const sheetName = mainSheet.getName();

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
  // Si no hay objeto de evento, asumimos ejecución manual y podemos mostrar UI.
  // Al invocar desde triggers (runAutoSyncAll) no se pasa `e`, por lo que
  // ciertos invocadores podrían pasar undefined; aquí mantenemos la
  // lógica original: retorna true cuando no hay objeto e.
  return !e;
}
