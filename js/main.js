/**
 * Punto de entrada: conecta CTAs, scroll suave, menú mobile,
 * enlaces de WhatsApp y arranca analytics.js / form.js.
 */
(function () {
  "use strict";

  function buildWhatsappUrl(message) {
    var number = (window.CONFIG && window.CONFIG.whatsappNumber) || "";
    var digits = number.replace(/[^0-9]/g, "");
    return "https://wa.me/" + digits + "?text=" + encodeURIComponent(message);
  }

  function isWhatsappConfigured() {
    return (
      window.CONFIG &&
      window.CONFIG.whatsappNumber &&
      window.CONFIG.whatsappNumber !== "[WHATSAPP_PENDIENTE]"
    );
  }

  function setupWhatsappLinks() {
    var directMessage = "Hola, quiero revisar mi situación fiscal.";
    var links = Array.prototype.slice.call(document.querySelectorAll("[data-whatsapp-link]"));

    links.forEach(function (link) {
      // gracias.html arma su propio mensaje inline; aquí solo cubrimos
      // los enlaces "genéricos" (header futuro, formulario, footer).
      if (link.id === "whatsapp-gracias-link") return;

      if (isWhatsappConfigured()) {
        link.href = buildWhatsappUrl(directMessage);
      } else {
        link.href = "#";
        link.setAttribute("aria-disabled", "true");
      }

      link.addEventListener("click", function (event) {
        if (!isWhatsappConfigured()) {
          event.preventDefault();
          return;
        }
        var origin = link.getAttribute("data-cta-location") || "desconocido";
        if (window.NormaAnalytics) {
          window.NormaAnalytics.trackEvent("whatsapp_click", { origin: origin });
        }
      });
    });
  }

  function smoothScrollTo(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" });
  }

  function setupAnchorOffset() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    function updateOffset() {
      document.documentElement.style.setProperty("--sticky-header-offset", (header.offsetHeight + 8) + "px");
    }
    updateOffset();
    window.addEventListener("resize", updateOffset);
    if (window.ResizeObserver) new ResizeObserver(updateOffset).observe(header);
    // Reajusta también las anclas al entrar directamente con un fragmento.
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }

  function setupCtaDelegation() {
    // Un único listener delegado maneja todos los CTA de la página,
    // en vez de enganchar un listener por botón.
    document.addEventListener("click", function (event) {
      var el = event.target.closest("[data-cta-location]");
      if (!el) return;
      if (el.hasAttribute("data-whatsapp-link")) return; // manejado aparte

      var location = el.getAttribute("data-cta-location");
      var ctaType = el.getAttribute("data-cta-type") || "";

      if (window.NormaAnalytics) {
        window.NormaAnalytics.trackEvent("cta_review_click", {
          location: location,
          cta_type: ctaType
        });
      }

      var href = el.getAttribute("href") || "";
      if (href.charAt(0) === "#") {
        event.preventDefault();
        if (window.NormaForm) {
          window.NormaForm.setCtaOrigin(location, ctaType);
        }
        smoothScrollTo(href);
      }
    });
  }

  function setupNavToggle() {
    var toggle = document.getElementById("nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    // Cierra el menú al elegir una opción (mobile).
    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupAnchorOffset();
    if (window.NormaAnalytics) window.NormaAnalytics.init();
    if (window.NormaForm) window.NormaForm.init();

    setupCtaDelegation();
    setupNavToggle();
    setupWhatsappLinks();
  });
})();
