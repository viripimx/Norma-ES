/**
 * Norma Escobar — Web App de recepción del diagnóstico.
 * Copia este archivo completo dentro de un proyecto de Google Apps Script
 * (ver README.md, sección "Apps Script", para el paso a paso de despliegue).
 *
 * Responsabilidad:
 *   POST -> validar -> normalizar -> generar ID -> escribir en "Leads" -> responder JSON
 *
 * Decisiones técnicas documentadas:
 * - No se añade una columna "request_id" a la hoja "Leads" (la especificación
 *   pide exactamente 22 columnas, en ese orden). La deduplicación se resuelve
 *   con CacheService (memoria temporal de Apps Script, no toca el Sheet).
 * - El ID del lead se genera en el servidor contando cuántas filas ya
 *   existen con la fecha de hoy, protegido con LockService para evitar
 *   condiciones de carrera si llegan dos envíos casi al mismo tiempo.
 * - Nunca se devuelven excepciones, stack traces ni datos de otros leads
 *   al navegador.
 */

var SHEET_NAME = "Leads";

var COLUMNS = [
  "id", "fecha_creacion", "hora_creacion", "nombre", "whatsapp", "correo",
  "segmento", "motivo", "notas", "fuente", "campana", "utm_medium",
  "utm_content", "utm_term", "cta_origen", "etapa", "temperatura",
  "fecha_ultima_interaccion", "proxima_accion", "fecha_proxima_accion",
  "motivo_no_conversion", "cliente_recurrente"
];

var SEGMENTOS_VALIDOS = ["PF", "PROFESIONISTA", "NEGOCIO", "MORAL", "NO_SEGURO"];
var MOTIVOS_VALIDOS = ["REVISAR", "CONTABILIDAD", "PENDIENTE", "FACTURACION", "HABLAR", "OTRO"];

var CACHE_DEDUPE_SECONDS = 3600; // 1 hora es suficiente para dobles envíos/reintentos.

// Límites de longitud del lado servidor. nombre y correo se exigen en
// validatePayload (exceder rechaza la solicitud, no se truncan). El resto son
// campos de contexto/metadata: se truncan en appendLeadRow, no rechazan nada,
// así no cambia el formulario ni su copy.
var MAX_LEN = {
  nombre: 80,
  correo: 200,
  notas: 500,
  fuente: 100,
  campana: 150,
  utm_medium: 150,
  utm_content: 150,
  utm_term: 150,
  cta_origen: 100
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (lockError) {
    return jsonResponse({ status: "error", message: "Sistema ocupado, intenta de nuevo." });
  }

  try {
    var payload = parsePayload(e);
    var validation = validatePayload(payload);
    if (!validation.valid) {
      return jsonResponse({ status: "error", message: validation.message });
    }

    var cache = CacheService.getScriptCache();
    var cacheKey = "req_" + payload.request_id;
    if (cache.get(cacheKey)) {
      // Ya se procesó este mismo request_id (doble clic / reintento).
      var existingId = cache.get(cacheKey);
      return jsonResponse({ status: "ok", id: existingId });
    }

    var sheet = getLeadsSheet();
    var leadId = generateLeadId(sheet);

    appendLeadRow(sheet, leadId, payload);

    cache.put(cacheKey, leadId, CACHE_DEDUPE_SECONDS);

    return jsonResponse({ status: "ok", id: leadId });
  } catch (err) {
    Logger.log("Error en doPost: " + err);
    return jsonResponse({ status: "error", message: "No fue posible procesar tu solicitud. Intenta nuevamente." });
  } finally {
    lock.releaseLock();
  }
}

// Manejador defensivo por si algún navegador llegara a enviar un preflight.
function doOptions(e) {
  return ContentService.createTextOutput("");
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Sin cuerpo de solicitud.");
  }
  return JSON.parse(e.postData.contents);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, message: "Solicitud inválida." };
  }
  if (!payload.request_id || typeof payload.request_id !== "string") {
    return { valid: false, message: "Falta identificador de solicitud." };
  }
  if (!payload.nombre || String(payload.nombre).trim().length === 0 || String(payload.nombre).length > MAX_LEN.nombre) {
    return { valid: false, message: "Nombre inválido." };
  }
  var whatsappDigits = String(payload.whatsapp || "").replace(/[^0-9]/g, "");
  if (whatsappDigits.length < 10) {
    return { valid: false, message: "WhatsApp inválido." };
  }
  if (payload.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.correo)) {
    return { valid: false, message: "Correo inválido." };
  }
  if (payload.correo && String(payload.correo).length > MAX_LEN.correo) {
    return { valid: false, message: "Correo inválido." };
  }
  if (!Array.isArray(payload.segmento) || payload.segmento.length === 0) {
    return { valid: false, message: "Falta seleccionar situación." };
  }
  if (filterValidCodes(payload.segmento, SEGMENTOS_VALIDOS).length === 0) {
    return { valid: false, message: "Selecciona una situación válida." };
  }
  if (!Array.isArray(payload.motivo) || payload.motivo.length === 0) {
    return { valid: false, message: "Falta seleccionar motivo." };
  }
  if (filterValidCodes(payload.motivo, MOTIVOS_VALIDOS).length === 0) {
    return { valid: false, message: "Selecciona un motivo válido." };
  }
  return { valid: true };
}

function filterValidCodes(values, validList) {
  return (values || []).filter(function (v) {
    return validList.indexOf(v) !== -1;
  });
}

// Neutraliza valores que Google Sheets podría interpretar como fórmula
// (si el primer carácter significativo es =, +, -, @, tab o retorno de carro),
// anteponiendo una comilla simple para forzar texto. El texto normal
// (acentos, espacios, puntuación interna) sale sin ningún cambio.
function sanitizeForSheets(value) {
  var str = String(value === undefined || value === null ? "" : value);
  var leading = str.replace(/^[\s\t\r\n]+/, "");
  var dangerousLeadChars = ["=", "+", "-", "@", "\t", "\r"];
  if (leading.length > 0 && dangerousLeadChars.indexOf(leading.charAt(0)) !== -1) {
    return "'" + str;
  }
  return str;
}

// Recorta un campo libre a una longitud máxima razonable (no rechaza la
// solicitud, solo evita valores desproporcionados en Sheets).
function truncateField(value, maxLength) {
  var str = String(value === undefined || value === null ? "" : value);
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

function getLeadsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS);
  }
  return sheet;
}

function generateLeadId(sheet) {
  var timezone = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), timezone, "yyyyMMdd");

  var lastRow = sheet.getLastRow();
  var countToday = 0;

  if (lastRow > 1) {
    var fechaColumnValues = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // columna B = fecha_creacion
    for (var i = 0; i < fechaColumnValues.length; i++) {
      var value = fechaColumnValues[i][0];
      var valueStr = value instanceof Date
        ? Utilities.formatDate(value, timezone, "yyyyMMdd")
        : String(value).replace(/-/g, "");
      if (valueStr === today) countToday++;
    }
  }

  var sequence = ("0000" + (countToday + 1)).slice(-4);
  return "RF-" + today + "-" + sequence;
}

function appendLeadRow(sheet, leadId, payload) {
  var timezone = Session.getScriptTimeZone();
  var now = new Date();
  var fecha = Utilities.formatDate(now, timezone, "yyyy-MM-dd");
  var hora = Utilities.formatDate(now, timezone, "HH:mm:ss");

  var segmentos = filterValidCodes(payload.segmento, SEGMENTOS_VALIDOS).join(";");
  var motivos = filterValidCodes(payload.motivo, MOTIVOS_VALIDOS).join(";");
  var utm = payload.utm || {};

  // nombre y correo ya fueron validados en validatePayload (longitud máxima
  // rechaza la solicitud, no se truncan) — aquí solo se sanean contra fórmulas.
  var nombre = sanitizeForSheets(String(payload.nombre || "").trim());
  var correo = sanitizeForSheets(String(payload.correo || "").trim());

  // Campos externos de texto libre sin validación de rechazo: se recortan a un
  // largo razonable y luego se sanean contra fórmulas antes de escribir en Sheets.
  var notas = sanitizeForSheets(truncateField(String(payload.notas || "").trim(), MAX_LEN.notas));
  var fuente = sanitizeForSheets(truncateField(utm.source ? String(utm.source) : "directo", MAX_LEN.fuente));
  var campana = sanitizeForSheets(truncateField(utm.campaign ? String(utm.campaign) : "", MAX_LEN.campana));
  var utmMedium = sanitizeForSheets(truncateField(utm.medium ? String(utm.medium) : "", MAX_LEN.utm_medium));
  var utmContent = sanitizeForSheets(truncateField(utm.content ? String(utm.content) : "", MAX_LEN.utm_content));
  var utmTerm = sanitizeForSheets(truncateField(utm.term ? String(utm.term) : "", MAX_LEN.utm_term));
  var ctaOrigen = sanitizeForSheets(truncateField(String(payload.cta_origen || ""), MAX_LEN.cta_origen));

  var row = [
    leadId,                                   // id
    fecha,                                     // fecha_creacion
    hora,                                      // hora_creacion
    nombre,                                     // nombre
    "'" + String(payload.whatsapp || "").trim(), // whatsapp (prefijo ' para forzar texto, sin cambios)
    correo,                                     // correo
    segmentos,                                 // segmento
    motivos,                                   // motivo
    notas,                                      // notas
    fuente,                                     // fuente
    campana,                                    // campana
    utmMedium,                                  // utm_medium
    utmContent,                                 // utm_content
    utmTerm,                                    // utm_term
    ctaOrigen,                                  // cta_origen
    "Nuevo",                                   // etapa
    calcularTemperatura(motivos),              // temperatura
    "",                                        // fecha_ultima_interaccion
    "",                                        // proxima_accion
    "",                                        // fecha_proxima_accion
    "",                                        // motivo_no_conversion
    "No"                                       // cliente_recurrente
  ];

  sheet.appendRow(row);
}

/**
 * Regla simple de temperatura (no scoring numérico):
 * Alta   si el motivo es PENDIENTE.
 * Media  si es REVISAR, CONTABILIDAD, FACTURACION o HABLAR.
 * Baja   si es OTRO.
 * Editable manualmente después en Sheets.
 */
function calcularTemperatura(motivosJoined) {
  var motivos = motivosJoined ? motivosJoined.split(";") : [];
  var alta = ["PENDIENTE"];
  var media = ["REVISAR", "CONTABILIDAD", "FACTURACION", "HABLAR"];

  for (var i = 0; i < motivos.length; i++) {
    if (alta.indexOf(motivos[i]) !== -1) return "Alta";
  }
  for (var j = 0; j < motivos.length; j++) {
    if (media.indexOf(motivos[j]) !== -1) return "Media";
  }
  return "Baja";
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
