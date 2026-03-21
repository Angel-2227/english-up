// =============================================
// ENGLISH UP! — js/lesson-context.js
// Extrae el texto de la lección activa para
// pasárselo al AI como contexto.
//
// Soporta:
//   "editor"         → .ql-editor en el DOM (Quill / contentBody)
//   "html"           → iframe de /lessons/* via postMessage
//   "html_unreadable"→ iframe existe pero no responde (CORS, timeout)
// =============================================

let _lessonContext = null;

// ════════════════════════════════════════════
// EXTRACCIÓN PRINCIPAL
// ════════════════════════════════════════════

/**
 * Extrae el texto de la lección visible actualmente.
 * @returns {Promise<{title:string, type:string, text:string|null}|null>}
 */
export async function extractLessonContext() {

  // 1. Lección tipo "editor" (Quill) — texto ya en el DOM
  const quillEditor = document.querySelector(".lesson-content .ql-editor");
  if (quillEditor) {
    const title = _getLessonTitle();
    const text  = _cleanText(quillEditor.innerText);
    if (text.length > 40) {
      _lessonContext = { title, type: "editor", text: _truncate(text) };
      return _lessonContext;
    }
  }

  // 2. Lección tipo "html" — iframe apuntando a /lessons/*
  const iframe = document.querySelector(".lesson-iframe");
  if (iframe?.src?.includes("/lessons/")) {
    const title = _getLessonTitle();
    const text  = await _requestIframeText(iframe);
    if (text) {
      _lessonContext = { title, type: "html", text: _truncate(text) };
      return _lessonContext;
    }
    // El iframe existe pero no respondió (timeout o CORS)
    _lessonContext = { title, type: "html_unreadable", text: null };
    return _lessonContext;
  }

  // 3. URL externa o sin lección → sin contexto
  _lessonContext = null;
  return null;
}

/**
 * Devuelve el último contexto extraído sin hacer nueva extracción.
 */
export function getCachedLessonContext() {
  return _lessonContext;
}

/**
 * Limpia el caché. Llamar al navegar a otra lección.
 */
export function clearLessonContext() {
  _lessonContext = null;
}

// ════════════════════════════════════════════
// COMUNICACIÓN CON IFRAME via postMessage
// ════════════════════════════════════════════

/**
 * Envía un mensaje al iframe pidiéndole su texto
 * y espera la respuesta con un timeout de 2 segundos.
 */
function _requestIframeText(iframe) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 2000);

    const handler = (event) => {
      // Solo aceptar mensajes del mismo origen (nuestros /lessons/*)
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type !== "ENGLISHUP_LESSON_TEXT") return;

      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data.text || null);
    };

    window.addEventListener("message", handler);

    try {
      iframe.contentWindow.postMessage(
        { type: "ENGLISHUP_GET_TEXT" },
        window.location.origin
      );
    } catch {
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(null);
    }
  });
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function _getLessonTitle() {
  return document.querySelector(".lesson-title")?.textContent?.trim()
    || "Current lesson";
}

function _cleanText(raw) {
  return (raw || "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\t/g, " ")
    .replace(/ {3,}/g, " ")
    .trim();
}

/** Trunca a ~3000 caracteres para no saturar el contexto de la IA. */
function _truncate(text, max = 3000) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…[content truncated]";
}
