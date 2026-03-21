// =============================================
// ENGLISH UP! — lesson-response-snippet.js
// Snippet para incluir en tus HTMLs de lecciones.
//
// Pega este <script> al final de tu HTML, antes de </body>.
// Llama a EnglishUp.submit(responses) cuando quieras
// guardar las respuestas del estudiante.
//
// EJEMPLO DE USO:
//
//   <button onclick="enviar()">Enviar respuestas</button>
//   <script src="lesson-response-snippet.js"></script>
//   <script>
//     function enviar() {
//       EnglishUp.submit({
//         "mi respuesta":        document.getElementById("campo1").value,
//         "pregunta 2":          document.getElementById("campo2").value,
//         "multiple choice":     document.querySelector('input[name="q3"]:checked')?.value,
//         "verdadero o falso":   document.getElementById("tf1").checked,
//       });
//     }
//   </script>
// =============================================

window.EnglishUp = {

  /**
   * Envía las respuestas del estudiante a English Up.
   * El profesor podrá verlas en el panel de Estudiantes > Details > Responses.
   *
   * @param {Object} responses  - Objeto con { "nombre del campo": valor }
   * @param {Object} [options]
   * @param {boolean} [options.showConfirmation=true]  - Muestra mensaje de éxito en la página
   * @param {string}  [options.confirmationMessage]    - Texto del mensaje de confirmación
   */
  submit(responses, options = {}) {
    if (!responses || typeof responses !== "object") {
      console.warn("[EnglishUp] submit() requiere un objeto de respuestas.");
      return;
    }

    // Enviar al padre (English Up app) via postMessage
    window.parent.postMessage({
      type:      "ENGLISHUP_LESSON_RESPONSE",
      responses: responses,
    }, "*");

    // Confirmación visual opcional (activada por defecto)
    const showConf = options.showConfirmation !== false;
    if (showConf) {
      const msg = options.confirmationMessage || "✅ Respuestas enviadas al profe.";
      _showConfirmation(msg);
    }

    console.log("[EnglishUp] Respuestas enviadas:", responses);
  },

  /**
   * Auto-envía todas las respuestas de un formulario HTML.
   * Útil si tienes un <form id="mi-form"> con inputs nombrados.
   *
   * @param {string|HTMLFormElement} formOrSelector
   * @param {Object} [options]  - Mismas opciones que submit()
   */
  submitForm(formOrSelector, options = {}) {
    const form = typeof formOrSelector === "string"
      ? document.querySelector(formOrSelector)
      : formOrSelector;

    if (!form) {
      console.warn("[EnglishUp] No se encontró el formulario:", formOrSelector);
      return;
    }

    const responses = {};
    const data = new FormData(form);
    data.forEach((value, key) => {
      responses[key] = value;
    });

    // También incluir checkboxes no marcados (FormData los omite)
    form.querySelectorAll("input[type=checkbox]").forEach(cb => {
      if (!responses.hasOwnProperty(cb.name)) {
        responses[cb.name] = false;
      } else {
        responses[cb.name] = true;
      }
    });

    this.submit(responses, options);
  },
};

// ── Confirmación visual interna ───────────────────────────────────────────────

function _showConfirmation(message) {
  // Reutilizar si ya existe
  let el = document.getElementById("_eu_confirm_toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "_eu_confirm_toast";
    el.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "left:50%",
      "transform:translateX(-50%)",
      "background:#22c55e",
      "color:#fff",
      "padding:12px 24px",
      "border-radius:12px",
      "font-family:system-ui,sans-serif",
      "font-size:15px",
      "font-weight:600",
      "box-shadow:0 4px 20px rgba(0,0,0,.25)",
      "z-index:99999",
      "transition:opacity .3s",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.style.opacity = "1";

  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.opacity = "0";
  }, 3000);
}
