// =============================================
// ENGLISH UP! — js/storage.js
// Sin Firebase Storage — recursos por URL estática o editor
// =============================================

/**
 * Tipos de contenido de lección soportados:
 *
 *  "editor"  → HTML escrito con Quill, guardado en Firestore (contentBody)
 *  "html"    → Archivo HTML subido a /lessons/ en Cloudflare Pages (externalURL)
 *  "url"     → Enlace externo cualquiera: Google Sites, Canva, Genially, YouTube, etc.
 *
 * En los tres casos se guarda solo una URL o un string HTML en Firestore.
 * No se necesita Firebase Storage.
 */

// ════════════════════════════════════════════
// VALIDAR URL
// ════════════════════════════════════════════

/**
 * Verifica que una URL sea válida.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateURL(url) {
  if (!url || !url.trim()) {
    return { valid: false, error: "URL cannot be empty." };
  }
  try {
    const parsed = new URL(url.trim());
    if (!["https:", "http:"].includes(parsed.protocol)) {
      return { valid: false, error: "URL must start with https:// or http://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL. Example: https://tuapp.pages.dev/lessons/mod1/lesson1.html" };
  }
}

// ════════════════════════════════════════════
// CONSTRUIR EMBED SEGÚN TIPO Y URL
// ════════════════════════════════════════════

/**
 * Genera el HTML a mostrar para una lección con URL (html o url externa).
 * Detecta si el dominio bloquea iframes y adapta la presentación.
 *
 * @param {string} url    - URL del recurso
 * @param {string} title  - Título de la lección
 * @param {string} type   - "html" | "url"
 * @returns {string}      - HTML string listo para inyectar
 */
export function buildResourceEmbed(url, title = "Lesson", type = "url") {
  // Dominios conocidos que bloquean iframe (X-Frame-Options: DENY / SAMEORIGIN)
  const NO_EMBED = [
    "notion.so", "docs.google.com", "drive.google.com",
    "slides.google.com", "sheets.google.com",
    "youtube.com", "youtu.be",
    "loom.com", "figma.com",
    "miro.com", "canva.com/design",
    "linkedin.com", "instagram.com", "twitter.com", "x.com"
  ];

  const blocked = NO_EMBED.some(d => url.includes(d));

  if (blocked) {
    return `
      <div class="lesson-external-card">
        <div class="lesson-external-icon">${type === "html" ? "📄" : "🔗"}</div>
        <div class="lesson-external-body">
          <div class="lesson-external-label">
            ${type === "html" ? "HTML Lesson File" : "External Resource"}
          </div>
          <div class="lesson-external-title">${escHTML(title)}</div>
          <div class="lesson-external-url">${escHTML(url)}</div>
        </div>
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           class="btn btn-primary">
          Open ↗
        </a>
      </div>
    `;
  }

  // Iframe normal
  return `
    <div class="lesson-iframe-wrap">
      <iframe
        src="${url}"
        class="lesson-iframe"
        title="${escHTML(title)}"
        loading="lazy"
        allowfullscreen
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation">
      </iframe>
      <a href="${url}" target="_blank" rel="noopener noreferrer"
         class="lesson-open-new">
        ↗ Open in new tab
      </a>
    </div>
  `;
}

// Helper interno
function escHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ════════════════════════════════════════════
// HELPER: CONSTRUIR URL DE LECCIÓN ESTÁTICA
// ════════════════════════════════════════════

/**
 * Devuelve la URL pública de un HTML en /lessons/ de Cloudflare Pages.
 * Usa window.location.origin para ser compatible con cualquier dominio.
 *
 * @param {string} moduleId  - ej: "modulo1"
 * @param {string} filename  - ej: "leccion1.html"
 * @returns {string}
 */
export function getLessonStaticURL(moduleId, filename) {
  const base = window.location.origin; // https://tuapp.pages.dev
  return `${base}/lessons/${moduleId}/${filename}`;
}
