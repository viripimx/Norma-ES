/**
 * Lógica del diagnóstico de 3 pasos.
 * Estados: idle -> editing -> validating -> submitting -> success | error
 *
 * Decisión técnica documentada (ver README): el POST a Apps Script se
 * envía con `fetch(url, { method: "POST", body: JSON.stringify(payload) })`
 * SIN establecer manualmente el header Content-Type. Al dejarlo así, el
 * navegador usa por defecto `text/plain;charset=UTF-8`, que es un tipo
 * "simple" para CORS y evita que el navegador dispare una petición de
 * preflight (OPTIONS) — Apps Script no maneja bien ese preflight por
 * defecto. Apps Script igual puede leer el cuerpo crudo (`e.postData.contents`)
 * y parsearlo como JSON sin importar el Content-Type declarado. Esto
 * permite que el frontend SÍ pueda leer la respuesta JSON real (éxito o
 * error), en vez de usar `no-cors` a ciegas.
 */
(function () {
  "use strict";

  var TOTAL_STEPS = 3;
  var currentStep = 1;
  var state = "idle";
  var formStarted = false;
  var REQUEST_TIMEOUT_MS = 20000;
  var ctaOrigin = { location: "", type: "" };
  var utmParams = { source: "", medium: "", campaign: "", content: "", term: "" };
  var requestId = "";

  var formEl, progressTextEl, btnAtras, btnSiguiente, btnEnviar;

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }
  function $all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  // ---------- Utilidades ----------

  function generateRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    // Fallback simple si randomUUID no está disponible.
    return "req-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  }

  function sanitizeUtmValue(value) {
    if (!value) return "";
    return String(value).replace(/[\r\n\t<>]/g, "").trim().slice(0, 100);
  }

  function captureUtms() {
    var params = new URLSearchParams(window.location.search);
    utmParams = {
      source: sanitizeUtmValue(params.get("utm_source")),
      medium: sanitizeUtmValue(params.get("utm_medium")),
      campaign: sanitizeUtmValue(params.get("utm_campaign")),
      content: sanitizeUtmValue(params.get("utm_content")),
      term: sanitizeUtmValue(params.get("utm_term"))
    };
  }

  function isValidWhatsapp(value) {
    var digits = value.replace(/[^0-9]/g, "");
    return digits.length >= 10;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setError(fieldErrorId, message) {
    var el = document.getElementById(fieldErrorId);
    if (el) el.textContent = message || "";
    $all('[aria-describedby~="' + fieldErrorId + '"]', formEl).forEach(function (field) {
      field.setAttribute("aria-invalid", message ? "true" : "false");
    });
  }

  function focusFirstError() {
    var field = $('.form-step:not([hidden]) [aria-invalid="true"]', formEl);
    if (field) field.focus();
  }

  function isSubmissionLocked() {
    return state === "submitting" || state === "success";
  }

  // ---------- Navegación entre pasos ----------

  function showStep(step, moveFocus) {
    currentStep = step;
    $all(".form-step", formEl).forEach(function (stepEl) {
      var isActive = Number(stepEl.getAttribute("data-step")) === step;
      stepEl.hidden = !isActive;
    });

    $all(".progress-dot", formEl).forEach(function (dot) {
      var dotStep = Number(dot.getAttribute("data-step-indicator"));
      dot.classList.toggle("is-active", dotStep <= step);
    });

    if (progressTextEl) {
      progressTextEl.textContent = "Paso " + step + " de " + TOTAL_STEPS;
    }

    btnAtras.hidden = step === 1;
    btnSiguiente.hidden = step === TOTAL_STEPS;
    btnEnviar.hidden = step !== TOTAL_STEPS;

    // Mueve el foco al primer campo/heading del paso nuevo (accesibilidad).
    var activeStepEl = $('.form-step[data-step="' + step + '"]', formEl);
    if (activeStepEl && moveFocus !== false) {
      var legend = activeStepEl.querySelector("legend");
      var firstField = activeStepEl.querySelector("input, select");
      if (firstField) {
        firstField.focus({ preventScroll: true });
      } else if (legend) {
        legend.setAttribute("tabindex", "-1");
        legend.focus({ preventScroll: true });
      }
    }
  }

  // ---------- Validación por paso ----------

  function validateStep1() {
    var nombre = $("#nombre").value.trim();
    var whatsapp = $("#whatsapp").value.trim();
    var correo = $("#correo").value.trim();
    var valid = true;

    setError("error-nombre", "");
    setError("error-whatsapp", "");
    setError("error-correo", "");

    if (!nombre) {
      setError("error-nombre", "Ingresa tu nombre.");
      valid = false;
    }
    if (!whatsapp || !isValidWhatsapp(whatsapp)) {
      setError("error-whatsapp", "Ingresa un número de WhatsApp válido.");
      valid = false;
    }
    if (correo && !isValidEmail(correo)) {
      setError("error-correo", "Ingresa un correo válido.");
      valid = false;
    }
    return valid;
  }

  function validateRadioGroup(name, errorId) {
    var checked = $all('input[name="' + name + '"]:checked', formEl);
    setError(errorId, "");
    if (checked.length === 0) {
      setError(errorId, "Selecciona una opción.");
      return false;
    }
    return true;
  }

  function validateStep2() {
    return validateRadioGroup("situacion", "error-situacion");
  }

  function validateStep3() {
    return validateRadioGroup("motivo", "error-motivo");
  }

  function validateCurrentStep() {
    state = "validating";
    if (currentStep === 1) return validateStep1();
    if (currentStep === 2) return validateStep2();
    if (currentStep === 3) return validateStep3();
    return true;
  }

  // ---------- Construcción del payload ----------

  function collectValues(name) {
    return $all('input[name="' + name + '"]:checked', formEl).map(function (el) {
      return el.value;
    });
  }

  function buildNotes() {
    var detalle = $("#detalle");
    return detalle && detalle.value.trim() ? detalle.value.trim() : "";
  }

  function buildPayload() {
    return {
      request_id: requestId,
      nombre: $("#nombre").value.trim(),
      whatsapp: $("#whatsapp").value.trim(),
      correo: $("#correo").value.trim(),
      segmento: collectValues("situacion"),
      motivo: collectValues("motivo"),
      notas: buildNotes(),
      utm: utmParams,
      cta_origen: ctaOrigin.location + (ctaOrigin.type ? ":" + ctaOrigin.type : "")
    };
  }

  // ---------- Envío ----------

  var ENVIAR_LABEL = "Quiero revisar mi situación";

  function setSubmitting(isSubmitting) {
    btnEnviar.disabled = isSubmitting;
    btnEnviar.textContent = isSubmitting ? "Enviando…" : ENVIAR_LABEL;
    btnAtras.disabled = isSubmitting;
    btnSiguiente.disabled = isSubmitting;
    formEl.setAttribute("aria-busy", String(isSubmitting));
  }

  function showFormStatus(message) {
    var statusEl = document.getElementById("form-status");
    if (statusEl) statusEl.textContent = message || "";
  }

  function isAppsScriptConfigured() {
    return (
      window.CONFIG &&
      window.CONFIG.appsScriptUrl &&
      window.CONFIG.appsScriptUrl !== "[APPS_SCRIPT_URL_PENDIENTE]"
    );
  }

  function submitForm() {
    if (isSubmissionLocked()) return;
    if (!isAppsScriptConfigured()) {
      state = "error";
      showFormStatus(
        "El envío todavía no está disponible. Escríbenos por WhatsApp mientras tanto."
      );
      return;
    }

    state = "submitting";
    setSubmitting(true);
    showFormStatus("");

    var payload = buildPayload();
    var controller = new AbortController();
    var timeoutId = setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    fetch(window.CONFIG.appsScriptUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal
      // Sin header Content-Type explícito — ver nota al inicio del archivo.
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        clearTimeout(timeoutId);
        if (data && data.status === "ok") {
          state = "success";
          if (window.NormaAnalytics) {
            window.NormaAnalytics.trackEvent("form_submit", {});
          }
          window.location.href = window.CONFIG.graciasUrl;
        } else {
          throw new Error((data && data.message) || "Error desconocido");
        }
      })
      .catch(function () {
        clearTimeout(timeoutId);
        state = "error";
        setSubmitting(false);
        showFormStatus(
          "No pudimos enviar tu información. Intenta de nuevo o escríbenos por WhatsApp."
        );
      });
  }

  // ---------- Eventos de navegación del formulario ----------

  function handleNext() {
    if (isSubmissionLocked() || currentStep >= TOTAL_STEPS) return;
    if (!validateCurrentStep()) {
      focusFirstError();
      return;
    }
    state = "editing";
    if (window.NormaAnalytics) {
      window.NormaAnalytics.trackEvent("form_step_complete", { step: currentStep });
    }
    showStep(currentStep + 1);
  }

  function handleBack() {
    if (isSubmissionLocked() || currentStep <= 1) return;
    state = "editing";
    showStep(currentStep - 1);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (isSubmissionLocked() || currentStep !== TOTAL_STEPS) return;
    state = "validating";
    var results = [validateStep1(), validateStep2(), validateStep3()];
    var firstInvalid = results.indexOf(false);
    if (firstInvalid !== -1) {
      showStep(firstInvalid + 1, false);
      focusFirstError();
      return;
    }
    submitForm();
  }

  function handleFirstInteraction() {
    if (!formStarted) {
      formStarted = true;
      if (!isSubmissionLocked()) state = "editing";
      if (window.NormaAnalytics) {
        window.NormaAnalytics.trackEvent("form_start", {});
      }
    }
  }

  // ---------- API pública ----------

  function setCtaOrigin(location, type) {
    ctaOrigin = { location: location || "", type: type || "" };
  }

  function init() {
    formEl = document.getElementById("diagnostico-form");
    if (!formEl) return; // gracias.html no tiene formulario

    progressTextEl = document.getElementById("progress-text");
    btnAtras = document.getElementById("btn-atras");
    btnSiguiente = document.getElementById("btn-siguiente");
    btnEnviar = document.getElementById("btn-enviar");

    requestId = generateRequestId();
    captureUtms();
    showStep(1, false);

    btnSiguiente.addEventListener("click", handleNext);
    btnAtras.addEventListener("click", handleBack);
    formEl.addEventListener("submit", handleSubmit);
    formEl.addEventListener(
      "input",
      function () {
        handleFirstInteraction();
      },
      { once: true }
    );
  }

  window.NormaForm = {
    init: init,
    setCtaOrigin: setCtaOrigin
  };
})();
