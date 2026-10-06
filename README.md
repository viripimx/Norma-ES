# Norma Escobar — Landing + Diagnóstico (MVP)

Sitio 100% estático (HTML + CSS + JavaScript vanilla). Sin frameworks, sin build step, sin `npm install`. Funciona directamente al abrir `index.html` o al desplegarse en Vercel desde la raíz del repositorio.

## 1. Estructura

```
/
├── index.html          Landing completa + diagnóstico (#diagnostico)
├── gracias.html         Página de confirmación tras el envío
├── privacidad.html      Aviso de Privacidad Integral (enlazado desde el formulario y el footer)
├── css/
│   └── styles.css       Único archivo de estilos
├── js/
│   ├── config.js        Valores centrales (WhatsApp, Apps Script URL, GA4, etc.)
│   ├── analytics.js     Wrapper de GA4 con lista blanca de parámetros
│   ├── form.js          Lógica del formulario de 3 pasos
│   └── main.js          CTAs, scroll suave, menú mobile, enlaces de WhatsApp
├── apps-script/
│   └── Code.gs           Copia de referencia del backend (se despliega aparte, ver sección 5)
├── assets/
│   ├── logo.png            Logo aprobado del Brandbook (monograma NE + wordmark + "Contadora") — no modificar
│   ├── iconografia.png     Set de 5 íconos de servicios del Brandbook, usado sin recortar en la sección "Servicios"
│   ├── norma.jpg           Fotografía real de Norma, usada en la sección "Sobre Norma"
│   └── hero-editorial.png  Fotografía real aprobada ("Ilustración editorial original"), usada en el Hero
├── .gitignore
└── README.md
```

**Decisión técnica documentada:** las secciones "CTA final" y "Diagnóstico" de la arquitectura se implementaron como **una sola sección física** (`#diagnostico`, al final de `index.html`, antes del footer). El título/texto de "CTA final" funcionan como encabezado del formulario, y el propio formulario de 3 pasos es la acción concreta. Tras la pasada de reducción editorial (V2), los CTA repetidos por sección se recortaron a los momentos principales: header, hero, Revisión Fiscal, Servicios, y el CTA final que enlaza al mismo `#diagnostico`. Las secciones Problema, Cómo funciona y FAQ ya no llevan un botón propio, para no repetir la misma llamada a la acción cinco o seis veces en una sola página.

**`iconografia.png`:** el Brandbook agrupa 5 íconos por tipo de servicio (Contabilidad, Asesoría Fiscal, Planeación Financiera, Acompañamiento, Crecimiento) en una sola imagen compuesta. La sección "Servicios" de la landing está organizada por tipo de cliente, no por tipo de servicio, así que el set completo se colocó como apoyo visual entre el texto y las 4 tarjetas. Por instrucción explícita, se recortó únicamente la etiqueta de texto "ICONOGRAFÍA" que encabezaba la imagen original (48px superiores), dejando intactos los 5 íconos y sus nombres — no se fragmentó en íconos individuales.

## 2. Configuración antes de producción

Edita **únicamente** `js/config.js`:

```js
const CONFIG = {
  whatsappNumber: "525522801360",            // ← ya es el número real de Norma
  appsScriptUrl: "https://script.google.com/macros/s/XXXXX/exec", // ← URL del Web App desplegado
  ga4MeasurementId: "G-XXXXXXXXXX",          // ← Measurement ID real de GA4
  graciasUrl: "gracias.html"
};
```

**Sobre el número de WhatsApp:** se usó `52` + los 10 dígitos dados (`5522801360`). Si al probar el enlace `wa.me` el chat no abre correctamente, es un indicio del viejo requisito de WhatsApp para líneas móviles mexicanas registradas antes de 2021 (añadir un "1" extra: `5215522801360`) — probar esa variante antes de asumir que el número está mal.

Ningún valor aquí es secreto (son visibles por naturaleza en el código fuente de cualquier sitio que los use) — por eso pueden vivir versionados en el repositorio sin riesgo real.

**Precio de la Revisión Fiscal:** el copy público (landing y FAQ) está redactado para funcionar sin mostrar un número ("te lo confirmamos al agendar"). No hay ningún placeholder de precio visible en la interfaz. Cuando el precio se confirme, es una decisión de copy (no técnica) si se desea mostrarlo explícitamente.

## 3. Valores todavía pendientes

Estos valores **no se inventaron** y deben sustituirse con datos reales de Norma antes de publicar:

| Valor | Dónde vive | Qué falta |
|---|---|---|
| URL del Apps Script | `js/config.js` → `appsScriptUrl` | Se obtiene al desplegar el Web App (sección 5) |
| GA4 Measurement ID | `js/config.js` → `ga4MeasurementId` | Crear la propiedad GA4 real |
| Tiempo de respuesta | No se muestra ningún tiempo en `gracias.html` (a propósito, para no inventarlo) | Definir si en el futuro se quiere comunicar uno |
| Favicon | No hay `<link rel="icon">` en `index.html`/`gracias.html` | El Brandbook no incluye una variante cuadrada del monograma adecuada para favicon (`logo.png` es el lockup completo con wordmark, e `iconografia.png` son íconos de servicio, no de marca) — se dejó pendiente en vez de recortar/inventar uno. |

**Resuelto en esta iteración:** el número de WhatsApp, el logo (`assets/logo.png`, usado tal cual en header y footer, sin recortar ni recolorear) y la fotografía de Norma (`assets/norma.jpg`) ya están integrados — ver sección 2 y la carpeta `assets/` arriba.

**Aviso de Privacidad:** `privacidad.html` contiene el Aviso de Privacidad Integral completo (responsable, datos recabados, finalidades, derechos ARCO, etc.). El formulario de diagnóstico (paso 3, antes del botón de envío) y el footer de `index.html` y `gracias.html` enlazan a esta página.

Mientras `appsScriptUrl` siga como `"[APPS_SCRIPT_URL_PENDIENTE]"`, el formulario muestra un mensaje indicando que el envío aún no está disponible, sin romperse. Mientras `ga4MeasurementId` siga como `"[GA4_PENDIENTE]"`, GA4 simplemente no se carga (el sitio funciona igual).

## 4. Google Sheets

1. Crea un Google Sheet nuevo (o usa uno existente).
2. No necesitas crear la pestaña `Leads` a mano: el Apps Script la crea automáticamente (con encabezados) la primera vez que recibe un envío, si no existe.
3. Si prefieres crearla manualmente, nómbrala exactamente `Leads` y usa esta fila de encabezados, en este orden:

```
id | fecha_creacion | hora_creacion | nombre | whatsapp | correo | segmento | motivo | notas | fuente | campana | utm_medium | utm_content | utm_term | cta_origen | etapa | temperatura | fecha_ultima_interaccion | proxima_accion | fecha_proxima_accion | motivo_no_conversion | cliente_recurrente
```

**Columna `whatsapp`:** se guarda con un apóstrofo inicial (`'`) para forzar formato de texto y no perder ceros ni el signo `+`.

**Restringe el acceso al Sheet** solo a quien opera el CRM (Norma / el equipo) — ahí vive información de contacto real de prospectos.

## 5. Apps Script — despliegue paso a paso

1. Abre el Google Sheet que vas a usar como CRM.
2. Menú **Extensiones → Apps Script**. Esto crea un proyecto de Apps Script ya vinculado a ese Spreadsheet (no necesitas indicar el ID del Sheet en el código — `SpreadsheetApp.getActiveSpreadsheet()` ya apunta al Sheet contenedor).
3. Borra el contenido de `Code.gs` que abre por defecto y pega **todo** el contenido de `apps-script/Code.gs` de este repositorio.
4. Guarda el proyecto (ícono de disco o `Ctrl+S`).
5. Menú **Desplegar → Nueva implementación**.
   - Tipo: **Aplicación web**.
   - Descripción: la que quieras (ej. "Diagnóstico Norma Escobar v1").
   - Ejecutar como: **Yo** (tu cuenta, la dueña del Sheet).
   - Quién tiene acceso: **Cualquier usuario**.
6. Al desplegar, Google pedirá autorizar permisos (acceso a Sheets) — acepta con la cuenta correcta.
7. Copia la **URL del Web App** que te entrega (termina en `/exec`) y pégala en `js/config.js` como `appsScriptUrl`.
8. **Permisos necesarios:** acceso a Google Sheets (para leer/escribir en el Spreadsheet contenedor) y envío de correo (`MailApp`, para el aviso de lead nuevo). No se requiere ningún otro servicio de Google. Al desplegar una versión que incluya el aviso, Google pedirá autorizar el permiso de envío de correo.
9. Cada vez que edites `Code.gs` dentro del editor de Apps Script, debes publicar una **nueva versión** (Implementar → Administrar implementaciones → editar → Nueva versión) para que los cambios se reflejen en la misma URL pública — editar el código sin redesplegar no actualiza el Web App en producción.
10. **Aviso de lead nuevo:** cada lead nuevo (no los duplicados ni los inválidos) genera un correo a la dirección definida en la constante `NOTIFY_EMAIL` al inicio de `Code.gs`. Si el correo falla, el lead se guarda igual y el error solo queda en el log de Apps Script. Dejar `NOTIFY_EMAIL = ""` desactiva el aviso.

**Nota sobre CORS (documentada según lo pedido):** el frontend llama a Apps Script con `fetch(url, { method: "POST", body: JSON.stringify(payload) })`, **sin** establecer manualmente el header `Content-Type`. Al omitirlo, el navegador usa por defecto `text/plain;charset=UTF-8`, que es un tipo "simple" para CORS y evita que el navegador dispare una petición de preflight (`OPTIONS`) que Apps Script no maneja bien por defecto. Apps Script igual lee el cuerpo crudo (`e.postData.contents`) y lo parsea como JSON sin importar el `Content-Type` declarado. Esto permite que el frontend sí pueda leer la respuesta JSON real (éxito o error) en vez de usar `no-cors` a ciegas, tal como se pidió. Se incluyó además un `doOptions()` defensivo por si algún navegador llegara a enviar un preflight de todas formas.

## 6. Despliegue en Vercel

```
local  →  GitHub  →  Vercel
```

1. Inicializa el repositorio (`git init`, si no existe ya) y sube el proyecto a GitHub.
2. En Vercel: **Add New → Project** → importa el repositorio.
3. Framework detectado: **Other / Static** — no hay build command, no hay output directory especial (la raíz del repo se sirve tal cual).
4. Despliega. Vercel entrega una URL pública.

**Qué nunca debe subirse a GitHub:** credenciales de servicio, cualquier archivo de configuración de Google Cloud con claves privadas, exports del Sheet o capturas con datos reales de leads (ver `.gitignore`).

## 7. Pruebas después del deploy

**Formulario:** completa los 3 pasos con datos de prueba, confirma que cada validación funciona (nombre vacío, WhatsApp inválido, ninguna opción de situación/necesidad marcada), confirma que el botón "Atrás" conserva lo escrito, y que un doble clic en "Enviar" no crea dos filas.

**CRM:** tras un envío exitoso, verifica en el Sheet real que apareció una fila nueva, con ID en formato `RF-AAAAMMDD-XXXX`, fecha/hora correctas, y los 22 campos en su columna correcta.

**GA4:** con `ga4MeasurementId` ya configurado, abre el reporte **Tiempo real → DebugView** de GA4 y confirma que aparecen `cta_review_click`, `form_start`, `form_step_complete`, `form_submit`, `whatsapp_click` y `thank_you_view` — e inspecciona cada uno para confirmar que **ningún parámetro contiene nombre, teléfono, correo, segmento o motivo**.

**WhatsApp:** confirma que el botón del header/formulario/footer/gracias abre WhatsApp con el número correcto y el mensaje esperado (mensaje fijo genérico en todos los casos, sin datos personales).

**Responsive:** prueba en 375px, 768px y 1280px — sin scroll horizontal, un solo paso del formulario visible a la vez en todos los tamaños.

**Accesibilidad:** navega el formulario completo solo con teclado (Tab/Shift+Tab/Enter), confirma que el foco se mueve al cambiar de paso, y que los errores se anuncian como texto (no solo con color).

## 8. Riesgos y límites conocidos

- Apps Script Web Apps tienen cuotas diarias de ejecución de Google — irrelevantes al volumen esperado del MVP, pero a vigilar si crece mucho el tráfico.
- Google Sheets no escala indefinidamente como base de datos (rendimiento se degrada con miles de filas) — aceptado como límite del MVP; migrar a otra base es una decisión de una fase futura, no de esta.
- Sin backend propio, todo valor de `config.js` es público en el navegador — por diseño del stack (sitio estático sin servidor propio); no debe añadirse ahí ningún valor que sí sea un secreto real.
- No se probó en todos los navegadores — se recomienda validar explícitamente en Safari iOS además de Chrome/Firefox antes de considerar el sitio listo para tráfico real.
