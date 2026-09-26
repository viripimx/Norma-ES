/**
 * Configuración central del sitio.
 * Ningún secreto vive aquí — todos estos valores son públicos por naturaleza
 * (visibles en el código fuente de cualquier sitio que los use).
 * Actualiza estos valores antes de publicar en producción.
 */
const CONFIG = {
  // Número real de Norma: +52 55 2280 1360. Si el enlace de wa.me no abre
  // el chat correctamente, prueba con "5215522801360" — algunos números
  // móviles de México registrados en WhatsApp antes de 2021 requieren el
  // "1" extra después del 52 para que el deep link funcione.
  whatsappNumber: "525522801360",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbywJiU98dIXTXWyrYEF4zulmBNiYq1UmhAPF7i-HjU8I0_LGVZURYc3g7fvTZtLZaKKHw/exec",
  ga4MeasurementId: "G-V1Z6CYHME7",
  graciasUrl: "gracias.html",
  brandName: "Norma Escobar",
  ctaPrincipalText: "Quiero revisar mi situación"
};

// Se expone explícitamente en window para que el resto de los scripts
// (cargados como <script> planos, sin módulos) puedan leerlo.
window.CONFIG = CONFIG;
