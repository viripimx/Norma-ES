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
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbyIOPMkL6MTr1elm5gleyWJmdkMLMhVIt1UEJbhWClwfvlNOBNMKucaCGtJEWD64KqMQg/exec",
  ga4MeasurementId: "G-DHRJXFEEPH",
  graciasUrl: "gracias.html"
};

// Se expone explícitamente en window para que el resto de los scripts
// (cargados como <script> planos, sin módulos) puedan leerlo.
window.CONFIG = CONFIG;
