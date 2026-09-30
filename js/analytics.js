/**
 * Wrapper de analítica (GA4).
 * Regla no negociable: ningún evento puede llevar información que
 * identifique a la persona (nombre, WhatsApp, correo, segmento, motivo,
 * texto libre, RFC, CURP, etc.). Por eso cada evento tiene una lista
 * blanca explícita de parámetros permitidos, y cualquier parámetro que
 * no esté en esa lista se descarta silenciosamente (con aviso en
 * consola solo para ayudar en desarrollo).
 */
(function () {
  "use strict";

  // Lista blanca de parámetros permitidos, por evento.
  var ALLOWED_PARAMS = {
    cta_review_click: ["location", "cta_type"],
    form_start: [],
    form_step_complete: ["step"],
    form_submit: [],
    whatsapp_click: ["origin"],
    thank_you_view: []
  };

  var gaLoaded = false;

  function isGa4Configured() {
    return (
      window.CONFIG &&
      window.CONFIG.ga4MeasurementId &&
      window.CONFIG.ga4MeasurementId !== "[GA4_PENDIENTE]"
    );
  }

  function loadGaScript(measurementId) {
    if (gaLoaded) return;
    gaLoaded = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      // Sin envío de PII ni de parámetros de URL con información personal.
      allow_google_signals: false
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }

  function init() {
    if (isGa4Configured()) {
      loadGaScript(window.CONFIG.ga4MeasurementId);
    }
    // Si GA4 no está configurado todavía, el sitio funciona igual;
    // trackEvent() simplemente no tendrá efecto (ver abajo).
  }

  function sanitizeParams(eventName, params) {
    var allowed = ALLOWED_PARAMS[eventName];
    var clean = {};

    if (!allowed) {
      console.warn("[analytics] Evento no reconocido, se ignora:", eventName);
      return null;
    }

    params = params || {};

    Object.keys(params).forEach(function (key) {
      if (allowed.indexOf(key) === -1) {
        console.warn(
          "[analytics] Parámetro no permitido para '" + eventName + "', se descarta:",
          key
        );
        return;
      }
      var value = params[key];
      // Solo se aceptan valores primitivos cortos (string/number/boolean),
      // nunca objetos, arreglos ni texto libre largo.
      if (
        (typeof value === "string" && value.length <= 64) ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        clean[key] = value;
      }
    });

    return clean;
  }

  function trackEvent(eventName, params) {
    var clean = sanitizeParams(eventName, params);
    if (clean === null) return;

    if (window.gtag) {
      window.gtag("event", eventName, clean);
    }
    // Si GA4 no está configurado, no hacemos nada más: no rompemos el sitio.
  }

  window.NormaAnalytics = {
    init: init,
    trackEvent: trackEvent
  };
})();
