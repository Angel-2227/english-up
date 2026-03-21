// =============================================
// ENGLISH UP! — js/lesson.js
// Visor de lecciones: html / url / editor
// Flujo de completar lección + XP
// =============================================

import { State, registerRoute, navigate, showToast, escapeHTML } from "./app.js";
import { getModule, getLesson, completeLesson, checkAutoBadges, saveLessonResponse } from "./db.js";
import { renderEditorContent } from "./teacher/editor.js";
import { updateNavbar } from "./auth.js";

// Dominios que bloquean iframe (X-Frame-Options: DENY / SAMEORIGIN)
const NO_EMBED_DOMAINS = [
  "notion.so", "docs.google.com", "drive.google.com",
  "slides.google.com", "sheets.google.com",
  "youtube.com", "youtu.be",
  "loom.com", "figma.com", "miro.com",
  "canva.com/design",
  "linkedin.com", "instagram.com", "twitter.com", "x.com",
];

function isEmbedBlocked(url) {
  return NO_EMBED_DOMAINS.some(d => url.includes(d));
}

// ════════════════════════════════════════════
// REGISTRO DE RUTA
// ════════════════════════════════════════════

export function registerLesson() {
  registerRoute("lesson", renderLesson);
}

// ════════════════════════════════════════════
// RENDER LESSON
// ════════════════════════════════════════════

async function renderLesson({ moduleId, lessonId }, container) {
  if (!moduleId || !lessonId) {
    navigate("home");
    return;
  }

  container.innerHTML = buildSkeleton();

  try {
    const [module, lesson] = await Promise.all([
      getModule(moduleId),
      getLesson(moduleId, lessonId),
    ]);

    if (!module || !lesson) {
      container.innerHTML = buildError("Lesson not found.");
      return;
    }

    const progress   = State.profile?.progress ?? {};
    const progressKey= `${moduleId}_${lessonId}`;
    const isCompleted= progress[progressKey]?.completed === true;

    container.innerHTML = buildLessonPage(module, lesson, isCompleted);

    // Bind back button
    container.querySelector(".btn-back-lesson")
      ?.addEventListener("click", () => navigate("home"));

    // Bind print button
    container.querySelector("[data-action='print']")
      ?.addEventListener("click", () => window.print());

    // Bind complete button
    const completeBtn = container.querySelector("#btn-complete-lesson");
    if (completeBtn && !isCompleted) {
      completeBtn.addEventListener("click", () =>
        handleComplete(moduleId, lessonId, lesson.xpReward ?? 10, completeBtn)
      );
    }

    // Reveal complete bar only when user scrolls near the bottom
    // (already-completed lessons are always visible via CSS)
    if (!isCompleted) {
      const bar      = container.querySelector(".lesson-complete-bar");
      const sentinel = container.querySelector(".lesson-content-sentinel");
      if (bar && sentinel) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              bar.classList.add("visible");
              observer.disconnect();
            }
          },
          { threshold: 0.1 }
        );
        observer.observe(sentinel);
      }
    }

    // Render content — attach IDs to lesson object so editor can use them
    lesson._moduleId = moduleId;
    lesson._lessonId = lessonId;
    renderLessonContent(lesson, container);

    // Escuchar respuestas enviadas desde HTMLs via postMessage
    listenForLessonResponses(moduleId, lessonId);

  } catch (err) {
    console.error("[Lesson]", err);
    container.innerHTML = buildError("Could not load this lesson. Please try again.");
  }
}

// ════════════════════════════════════════════
// LESSON PAGE HTML
// ════════════════════════════════════════════

function buildLessonPage(module, lesson, isCompleted) {
  const xp  = lesson.xpReward ?? 10;
  const dur = lesson.duration ?? 60;

  return `
    <div class="lesson-page">

      <!-- Nav bar -->
      <div class="lesson-nav-bar">
        <button class="btn-back-lesson">← Back to path</button>
        <div class="lesson-nav-actions">
          <button class="btn btn-ghost btn-sm" data-action="print">🖨 Print</button>
        </div>
      </div>

      <!-- Header card -->
      <div class="lesson-header-card">
        <div class="lesson-module-tag">
          ${module.emoji || "📚"} ${escapeHTML(module.title)}
        </div>
        <h1 class="lesson-title">${escapeHTML(lesson.title)}</h1>
        <div class="lesson-meta-row">
          <span class="lesson-meta-item">⏱ ${dur} min</span>
          <span class="lesson-meta-item xp">⚡ +${xp} XP</span>
          ${isCompleted
            ? `<span class="lesson-meta-item" style="color:var(--green-600)">✅ Completed!</span>`
            : ""}
        </div>
      </div>

      <!-- Content injected here -->
      <div id="lesson-content-area"></div>

      <!-- Sentinel: IntersectionObserver watches this to reveal complete bar -->
      <div class="lesson-content-sentinel"></div>

      <!-- Complete bar -->
      <div class="lesson-complete-bar ${isCompleted ? "completed" : ""}">${isCompleted ? `
        <div class="lcb-left">
          <div class="lcb-title">✅ You completed this lesson!</div>
          <div class="lcb-desc">Great work. Keep going on your path.</div>
        </div>
        <button class="btn btn-ghost" onclick="navigate('home')">← Back to path</button>
      ` : `
        <div class="lcb-left">
          <div class="lcb-title">Done with this lesson?</div>
          <div class="lcb-desc">Mark it complete to earn your XP and keep your streak.</div>
        </div>
        <button id="btn-complete-lesson" class="btn btn-primary btn-lg">
          ⚡ Complete — +${xp} XP
        </button>
      `}</div>

    </div>
  `;
}

// ════════════════════════════════════════════
// CONTENT RENDERERS
// ════════════════════════════════════════════

function renderLessonContent(lesson, container) {
  const area = container.querySelector("#lesson-content-area");
  if (!area) return;

  switch (lesson.type) {
    case "html":
    case "url":
      renderIframe(lesson, area);
      break;

    case "editor":
      renderEditor(lesson, area);
      break;

    default:
      area.innerHTML = buildError("Unknown lesson type.");
  }
}

// ── iframe ────────────────────────────────────────────────────────────────────

function renderIframe(lesson, area) {
  const url = lesson.externalURL || "";

  if (!url) {
    area.innerHTML = `
      <div class="lesson-external-card">
        <div class="lesson-external-icon">⚠️</div>
        <div class="lesson-external-title">No URL configured</div>
        <div class="lesson-external-desc">Ask your teacher to add a link for this lesson.</div>
      </div>`;
    return;
  }

  if (isEmbedBlocked(url)) {
    area.innerHTML = `
      <div class="lesson-external-card">
        <div class="lesson-external-icon">${lesson.type === "html" ? "📄" : "🔗"}</div>
        <div class="lesson-external-title">${escapeHTML(lesson.title)}</div>
        <div class="lesson-external-desc">
          This resource needs to be opened in a new tab.
        </div>
        <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"
           class="btn btn-primary">
          Open Lesson ↗
        </a>
      </div>`;
    return;
  }

  area.innerHTML = `
    <div class="lesson-iframe-wrap">
      <div class="lesson-iframe-loading" id="iframe-loading">
        <div class="lesson-iframe-spinner"></div>
        <span>Loading lesson…</span>
      </div>
      <iframe
        id="lesson-iframe"
        class="lesson-iframe"
        src="${escapeHTML(url)}"
        title="${escapeHTML(lesson.title)}"
        loading="lazy"
        allow="fullscreen"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">
      </iframe>
    </div>`;

  const iframe  = area.querySelector("#lesson-iframe");
  const loading = area.querySelector("#iframe-loading");

  iframe?.addEventListener("load", () => {
    loading?.classList.add("hidden");
    // Auto-resize
    try {
      const h = iframe.contentDocument?.body?.scrollHeight;
      if (h && h > 200) iframe.style.height = h + 32 + "px";
    } catch { /* cross-origin */ }
  });

  iframe?.addEventListener("error", () => {
    loading?.classList.add("hidden");
    area.innerHTML = `
      <div class="lesson-external-card">
        <div class="lesson-external-icon">❌</div>
        <div class="lesson-external-title">Could not load lesson</div>
        <div class="lesson-external-desc">
          The lesson could not be embedded. Try opening it directly.
        </div>
        <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"
           class="btn btn-primary">Open Lesson ↗</a>
      </div>`;
  });
}

// ── Editor content ────────────────────────────────────────────────────────────

function renderEditor(lesson, area) {
  const wrapper = document.createElement("div");
  area.appendChild(wrapper);
  renderEditorContent(wrapper, lesson.contentBody || "");

  // Botón "Enviar mis respuestas" — solo aparece si hay campos editables
  // Espera un tick para que renderEditorContent termine de inyectar el HTML
  requestAnimationFrame(() => {
    const editables = wrapper.querySelectorAll(
      "[contenteditable='true'], input:not([type='button']):not([type='submit']), textarea, select"
    );
    if (editables.length === 0) return;

    const submitBar = document.createElement("div");
    submitBar.className = "editor-submit-bar";
    submitBar.innerHTML = `
      <div class="esb-left">
        <div class="esb-title">¿Terminaste los ejercicios?</div>
        <div class="esb-desc">Envía tus respuestas al profe para que las pueda revisar.</div>
      </div>
      <button class="btn btn-primary esb-btn" id="btn-send-editor-responses">
        📤 Enviar mis respuestas
      </button>
      <div class="esb-confirm hidden" id="esb-confirm">✅ ¡Respuestas enviadas!</div>
    `;
    area.appendChild(submitBar);

    document.getElementById("btn-send-editor-responses")
      ?.addEventListener("click", () => handleEditorSubmit(wrapper, lesson));
  });
}

/**
 * Recorre todos los campos editables del contenido del editor
 * y los envía como respuestas al profe.
 */
async function handleEditorSubmit(wrapper, lesson) {
  const btn     = document.getElementById("btn-send-editor-responses");
  const confirm = document.getElementById("esb-confirm");

  if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }

  const responses = {};

  // 1. contenteditable — etiquetados con data-label o con texto cercano
  wrapper.querySelectorAll("[contenteditable='true']").forEach((el, i) => {
    const label = el.dataset.label
      || el.closest("[data-label]")?.dataset.label
      || el.getAttribute("placeholder")
      || el.getAttribute("data-placeholder")
      || `respuesta_${i + 1}`;
    const value = el.innerText?.trim() || "";
    if (value) responses[label] = value;
  });

  // 2. inputs de texto / número / email
  wrapper.querySelectorAll("input:not([type='button']):not([type='submit']):not([type='checkbox']):not([type='radio'])").forEach((el, i) => {
    const label = el.name || el.id || el.placeholder || el.dataset.label || `input_${i + 1}`;
    if (el.value?.trim()) responses[label] = el.value.trim();
  });

  // 3. textareas
  wrapper.querySelectorAll("textarea").forEach((el, i) => {
    const label = el.name || el.id || el.placeholder || `textarea_${i + 1}`;
    if (el.value?.trim()) responses[label] = el.value.trim();
  });

  // 4. selects
  wrapper.querySelectorAll("select").forEach((el, i) => {
    const label = el.name || el.id || `select_${i + 1}`;
    if (el.value) responses[label] = el.value;
  });

  // 5. checkboxes
  wrapper.querySelectorAll("input[type='checkbox']").forEach((el, i) => {
    const label = el.name || el.id || el.dataset.label || `checkbox_${i + 1}`;
    responses[label] = el.checked;
  });

  // 6. radio buttons — agrupa por name
  const radios = {};
  wrapper.querySelectorAll("input[type='radio']:checked").forEach(el => {
    if (el.name) radios[el.name] = el.value;
  });
  Object.assign(responses, radios);

  if (Object.keys(responses).length === 0) {
    if (btn) { btn.disabled = false; btn.textContent = "📤 Enviar mis respuestas"; }
    showToast("No hay respuestas para enviar todavía.", "info");
    return;
  }

  try {
    // Obtener moduleId / lessonId desde el objeto lección (inyectados en renderLesson)
    const moduleId = lesson._moduleId || "unknown";
    const lessonId = lesson._lessonId || lesson.id || "unknown";

    await saveLessonResponse(State.user.uid, moduleId, lessonId, responses);

    if (confirm) confirm.classList.remove("hidden");
    if (btn)     btn.textContent = "✅ Enviado";
    showToast("¡Respuestas enviadas al profe! 📤", "success");

    setTimeout(() => {
      if (btn) { btn.disabled = false; btn.textContent = "📤 Enviar mis respuestas"; }
    }, 4000);
  } catch (err) {
    console.error("[Lesson] editor submit error:", err);
    if (btn) { btn.disabled = false; btn.textContent = "📤 Enviar mis respuestas"; }
    showToast("No se pudieron enviar las respuestas. Intenta de nuevo.", "error");
  }
}

// ════════════════════════════════════════════
// COMPLETE LESSON
// ════════════════════════════════════════════

async function handleComplete(moduleId, lessonId, xpReward, btn) {
  btn.disabled    = true;
  btn.textContent = "Saving…";

  try {
    await completeLesson(State.user.uid, moduleId, lessonId, xpReward);

    // Check + award auto-badges
    const newBadges = await checkAutoBadges(State.user.uid);

    // Update local state
    const progressKey = `${moduleId}_${lessonId}`;
    if (!State.profile.progress) State.profile.progress = {};
    State.profile.progress[progressKey] = { completed: true };
    State.profile.xp     = (State.profile.xp ?? 0) + xpReward;
    State.profile.streak = (State.profile.streak ?? 0);  // will refresh on next load

    // Update navbar
    updateNavbar(State.profile);

    // XP pop animation
    showXPPop(xpReward);

    // Update bar UI
    const bar = document.querySelector(".lesson-complete-bar");
    if (bar) {
      bar.classList.add("completed");
      bar.innerHTML = `
        <div class="lcb-left">
          <div class="lcb-title">✅ You completed this lesson!</div>
          <div class="lcb-desc">Great work. Keep going on your path.</div>
        </div>
        <button class="btn btn-ghost" onclick="navigate('home')">← Back to path</button>
      `;
    }

    // Update header meta
    const meta = document.querySelector(".lesson-meta-row");
    if (meta) {
      const done = document.createElement("span");
      done.className = "lesson-meta-item";
      done.style.color = "var(--green-600)";
      done.textContent = "✅ Completed!";
      meta.appendChild(done);
    }

    // Badge toasts
    if (newBadges?.length > 0) {
      newBadges.forEach((id, i) => {
        setTimeout(() => {
          const def = (window.__SYSTEM_BADGES ?? []).find(b => b.id === id);
          if (def) showToast(`${def.emoji} New badge: ${def.name}!`, "success", 4000);
        }, i * 600);
      });
    }

  } catch (err) {
    console.error("[Lesson] complete error:", err);
    showToast("Could not save progress. Please try again.", "error");
    btn.disabled    = false;
    btn.textContent = `⚡ Complete — +${xpReward} XP`;
  }
}

// ════════════════════════════════════════════
// XP POP ANIMATION
// ════════════════════════════════════════════

function showXPPop(xp) {
  const el = document.createElement("div");
  el.className   = "xp-pop";
  el.textContent = `+${xp} XP ⚡`;
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once: true });
}

// ════════════════════════════════════════════
// ESCUCHA DE RESPUESTAS DESDE HTML VIA POSTMESSAGE
// ════════════════════════════════════════════

let _responseListener = null;

/**
 * Escucha mensajes de tipo ENGLISHUP_LESSON_RESPONSE enviados
 * desde los HTMLs de lecciones y los guarda en Firestore.
 *
 * El HTML debe enviar:
 *   window.parent.postMessage({
 *     type: "ENGLISHUP_LESSON_RESPONSE",
 *     responses: { campo1: "valor", campo2: "valor", ... }
 *   }, "*");
 */
function listenForLessonResponses(moduleId, lessonId) {
  // Limpiar listener anterior
  if (_responseListener) {
    window.removeEventListener("message", _responseListener);
  }

  _responseListener = async (event) => {
    if (!event.data || event.data.type !== "ENGLISHUP_LESSON_RESPONSE") return;
    const responses = event.data.responses;
    if (!responses || typeof responses !== "object") return;

    const uid = State.user?.uid;
    if (!uid) return;

    try {
      await saveLessonResponse(uid, moduleId, lessonId, responses);
      console.log("[Lesson] Respuestas guardadas:", responses);
    } catch (err) {
      console.warn("[Lesson] No se pudieron guardar respuestas:", err);
    }
  };

  window.addEventListener("message", _responseListener);
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function buildSkeleton() {
  return `
    <div class="path-skeleton" style="padding:var(--sp-8) 0">
      <div class="skeleton-node" style="height:48px;max-width:300px"></div>
      <div class="skeleton-node" style="height:120px"></div>
      <div class="skeleton-node" style="height:60vh"></div>
    </div>`;
}

function buildError(msg) {
  return `
    <div class="path-empty">
      <div class="path-empty-icon">😕</div>
      <h3>Something went wrong</h3>
      <p>${escapeHTML(msg)}</p>
      <button class="btn btn-primary" onclick="navigate('home')" style="margin-top:var(--sp-4)">
        ← Back to path
      </button>
    </div>`;
}