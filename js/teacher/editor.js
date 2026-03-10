// =============================================
// ENGLISH UP! — js/teacher/editor.js
// Utilidades del editor Quill: init, get/set,
// helpers para contenido de lecciones tipo "editor"
// =============================================

// ════════════════════════════════════════════
// CDN LOADERS
// ════════════════════════════════════════════

const QUILL_CSS = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css";
const QUILL_JS  = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js";

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function loadCSS(href) {
  return new Promise(res => {
    if (document.querySelector(`link[href="${href}"]`)) { res(); return; }
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = href; l.onload = res;
    document.head.appendChild(l);
  });
}

export async function ensureQuill() {
  if (window.Quill) return;
  await Promise.all([loadCSS(QUILL_CSS), loadScript(QUILL_JS)]);
}

// ════════════════════════════════════════════
// INIT QUILL IN A CONTAINER
// ════════════════════════════════════════════

/**
 * Crea una instancia de Quill dentro de `wrapperEl`.
 * Inyecta el DOM necesario si no existe.
 *
 * @param {HTMLElement} wrapperEl  - Elemento que actuará como wrapper
 * @param {string}      initialHTML - Contenido inicial (HTML string)
 * @param {object}      [options]  - Opciones extra para Quill
 * @returns {Promise<Quill>}
 */
export async function initEditor(wrapperEl, initialHTML = "", options = {}) {
  await ensureQuill();

  // Aplicar clase si no la tiene
  wrapperEl.classList.add("quill-wrapper");

  // Crear contenedor interno si no existe
  let editorDiv = wrapperEl.querySelector(".ql-container") ? null : document.createElement("div");
  if (editorDiv) {
    editorDiv.innerHTML = initialHTML;
    wrapperEl.appendChild(editorDiv);
  }

  const toolbar = options.toolbar ?? [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["blockquote", "code-block"],
    ["link", "image"],
    ["clean"],
  ];

  const quill = new window.Quill(editorDiv ?? wrapperEl, {
    theme:   "snow",
    modules: { toolbar },
    ...options,
  });

  return quill;
}

// ════════════════════════════════════════════
// GET / SET CONTENT
// ════════════════════════════════════════════

/** Obtiene el contenido HTML del editor */
export function getHTML(quill) {
  return quill?.root?.innerHTML ?? "";
}

/** Establece contenido HTML */
export function setHTML(quill, html) {
  if (!quill) return;
  quill.root.innerHTML = html || "";
}

/** ¿Está vacío el editor? */
export function isEmpty(quill) {
  if (!quill) return true;
  const text = quill.getText().trim();
  return text.length === 0 || text === "\n";
}

// ════════════════════════════════════════════
// RENDER LESSON CONTENT (viewer mode)
// ════════════════════════════════════════════

/**
 * Renderiza el HTML guardado de una lección tipo "editor"
 * dentro del elemento `containerEl`.
 * Aplica estilos de tipografía propios de la app.
 *
 * @param {HTMLElement} containerEl
 * @param {string}      html
 */
export function renderEditorContent(containerEl, html) {
  containerEl.classList.add("lesson-editor-content");
  containerEl.innerHTML = html || "<p><em>No content yet.</em></p>";

  // Open links in new tab
  containerEl.querySelectorAll("a").forEach(a => {
    a.target = "_blank";
    a.rel    = "noopener noreferrer";
  });

  // Make images responsive
  containerEl.querySelectorAll("img").forEach(img => {
    img.style.maxWidth = "100%";
    img.style.height   = "auto";
    img.style.borderRadius = "8px";
  });
}

// ════════════════════════════════════════════
// AUTO-SAVE HELPER
// ════════════════════════════════════════════

/**
 * Configura auto-guardado del editor con debounce.
 * Llama a `saveFn(html)` después de `delay` ms sin cambios.
 *
 * @param {Quill}    quill
 * @param {Function} saveFn   - async (html: string) => void
 * @param {number}   [delay]  - debounce en ms (default 1500)
 * @returns {Function} - cleanup function (quill.off)
 */
export function enableAutosave(quill, saveFn, delay = 1500) {
  let timer = null;

  const handler = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const html = getHTML(quill);
      try {
        await saveFn(html);
      } catch (err) {
        console.warn("[Editor] Autosave failed:", err);
      }
    }, delay);
  };

  quill.on("text-change", handler);

  // Return cleanup
  return () => {
    quill.off("text-change", handler);
    clearTimeout(timer);
  };
}

// ════════════════════════════════════════════
// WORD COUNT
// ════════════════════════════════════════════

/** Devuelve el número de palabras en el editor */
export function wordCount(quill) {
  if (!quill) return 0;
  const text = quill.getText().trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}
