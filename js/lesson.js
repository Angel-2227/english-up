// =============================================
// ENGLISH UP! — js/lesson.js
// Renderizar clase: editor Quill, HTML estático o URL externa
// =============================================

import { currentUser, isAdmin } from "./auth.js";
import {
  getLesson, getModule, completeLesson, updateLesson,
  getProgress, saveQuizResult
} from "./db.js";
import { validateURL, buildResourceEmbed } from "./storage.js";
import { showToast, navigate, openModal, closeModal, escapeHTML } from "./app.js";
import { checkAutoAwards } from "./gamification.js";

// ════════════════════════════════════════════
// RENDERIZAR VISTA DE LECCIÓN
// ════════════════════════════════════════════

export async function renderLessonView(moduleId, lessonId) {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="lesson-layout"><div class="page-loader">Loading lesson...</div></div>`;

  try {
    const [mod, lesson, progress] = await Promise.all([
      getModule(moduleId),
      getLesson(moduleId, lessonId),
      getProgress(currentUser.uid)
    ]);

    if (!lesson || !mod) {
      main.innerHTML = `<div class="lesson-layout"><div class="empty-state">
        <div class="empty-state__icon">❌</div>
        <div class="empty-state__title">Lesson not found</div>
      </div></div>`;
      return;
    }

    if (!isAdmin && !lesson.published) {
      main.innerHTML = `<div class="lesson-layout"><div class="empty-state">
        <div class="empty-state__icon">🔒</div>
        <div class="empty-state__title">This lesson is not available yet</div>
      </div></div>`;
      return;
    }

    const lessonKey   = `${moduleId}__${lessonId}`;
    const isCompleted = (progress.completedLessons || []).includes(lessonKey);
    const contentHTML = buildLessonContent(lesson);

    main.innerHTML = `
      <div class="lesson-layout">

        <!-- Header -->
        <div class="lesson-header">
          <div class="lesson-breadcrumb">
            <span class="lesson-breadcrumb__link" onclick="navigate('home')">🏠 Home</span>
            <span class="lesson-breadcrumb__sep">/</span>
            <span class="lesson-breadcrumb__link"
                  onclick="navigate('module', {moduleId:'${moduleId}'})">
              ${escapeHTML(mod.title || mod.name || "Module")}
            </span>
            <span class="lesson-breadcrumb__sep">/</span>
            <span>${escapeHTML(lesson.title)}</span>
          </div>

          <div class="lesson-title-row">
            <h1 class="lesson-title">${escapeHTML(lesson.title)}</h1>
            <div class="lesson-actions">
              <button class="btn btn-ghost btn-sm" onclick="window.print()">🖨️ Print</button>
              ${isAdmin ? `
                <button class="btn btn-secondary btn-sm" id="btn-edit-lesson">✏️ Edit Content</button>
              ` : ""}
            </div>
          </div>

          <div class="lesson-meta-row">
            ${lesson.level ? `
              <span class="lesson-meta-item">
                <span class="level-tag level-tag--${(lesson.level || "").toLowerCase().replace(/[^a-z0-9]/g,"")}">
                  ${lesson.level}
                </span>
              </span>
            ` : ""}
            <span class="lesson-meta-item">${contentTypeLabel(lesson.contentType)}</span>
            ${lesson.xpReward ? `<span class="lesson-meta-item">⭐ ${lesson.xpReward} XP</span>` : ""}
            ${isCompleted
              ? `<span class="lesson-meta-item" style="color:var(--accent-green);font-weight:700;">✅ Completed</span>`
              : ""}
          </div>

          ${lesson.objectives ? `
            <div class="lesson-objectives">
              <div class="lesson-objectives__title">🎯 Learning Objectives</div>
              <div class="lesson-objectives__list">
                ${lesson.objectives.split("\n").filter(Boolean).map(o =>
                  `<div class="lesson-objectives__item">${escapeHTML(o.trim())}</div>`
                ).join("")}
              </div>
            </div>
          ` : ""}
        </div>

        <!-- Contenido principal -->
        ${contentHTML}

        <!-- Quiz -->
        ${lesson.quiz?.questions?.length ? `
          <div id="lesson-quiz-section" style="margin-bottom:var(--space-xl);">
            <div class="section-header">
              <div class="section-header__title">📝 Quick Quiz</div>
            </div>
            <div class="card">
              <p style="margin-bottom:var(--space-md);font-family:var(--font-ui);color:var(--text-secondary);">
                Test your understanding — ${lesson.quiz.questions.length} questions.
              </p>
              <button class="btn btn-primary" id="btn-start-quiz">Start Quiz →</button>
            </div>
          </div>
        ` : ""}

        <!-- Footer -->
        <div class="lesson-footer">
          <div class="lesson-footer__nav" id="lesson-nav-btns"></div>
          ${!isAdmin ? `
            <button class="lesson-complete-btn ${isCompleted ? "completed" : ""}"
                    id="btn-complete" ${isCompleted ? "disabled" : ""}>
              ${isCompleted ? "✅ Completed!" : "Mark as Complete ✓"}
            </button>
          ` : ""}
        </div>

      </div>
    `;

    // Eventos
    document.getElementById("btn-complete")
      ?.addEventListener("click", () => handleComplete(moduleId, lessonId, lesson));

    document.getElementById("btn-edit-lesson")
      ?.addEventListener("click", () => openLessonEditor(moduleId, lessonId, lesson));

    document.getElementById("btn-start-quiz")
      ?.addEventListener("click", () => renderQuizInline(lesson.quiz, moduleId, lessonId));

    await buildLessonNav(moduleId, lessonId);

  } catch (err) {
    console.error("[Lesson]", err);
    main.innerHTML = `<div class="lesson-layout"><div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">Could not load lesson</div>
      <div class="empty-state__text">${err.message}</div>
    </div></div>`;
  }
}

// ════════════════════════════════════════════
// CONSTRUIR CONTENIDO SEGÚN TIPO
// ════════════════════════════════════════════

function buildLessonContent(lesson) {
  const type = lesson.contentType || "editor";

  // Archivo HTML estático en /lessons/ de Cloudflare Pages
  if (type === "html" && lesson.externalURL) {
    return buildResourceEmbed(lesson.externalURL, lesson.title, "html");
  }

  // URL externa (Google Sites, Canva, Genially, YouTube, Padlet…)
  if (type === "url" && lesson.externalURL) {
    return buildResourceEmbed(lesson.externalURL, lesson.title, "url");
  }

  // Editor Quill guardado en Firestore
  if (type === "editor" && lesson.contentBody) {
    return `
      <div class="lesson-content ql-snow">
        <div class="ql-editor" style="padding:0;">${lesson.contentBody}</div>
      </div>
    `;
  }

  // Sin contenido aún
  return `
    <div class="lesson-content">
      <div class="empty-state">
        <div class="empty-state__icon">📝</div>
        <div class="empty-state__title">No content yet</div>
        <div class="empty-state__text">
          ${isAdmin
            ? 'Click "Edit Content" to add content.'
            : "Your teacher hasn't added content to this lesson yet."}
        </div>
      </div>
    </div>
  `;
}

function contentTypeLabel(type) {
  if (type === "html") return "📄 HTML file";
  if (type === "url")  return "🔗 External resource";
  return "✏️ Written lesson";
}

// ════════════════════════════════════════════
// MARCAR COMO COMPLETADA
// ════════════════════════════════════════════

async function handleComplete(moduleId, lessonId, lesson) {
  const btn = document.getElementById("btn-complete");
  if (btn) { btn.disabled = true; btn.textContent = "Saving..."; }

  try {
    const xp = lesson.xpReward || 15;
    await completeLesson(currentUser.uid, moduleId, lessonId, xp);
    showToast(`+${xp} XP! Lesson completed 🎉`, "success");

    if (btn) {
      btn.textContent = "✅ Completed!";
      btn.classList.add("completed");
    }
    await checkAutoAwards(currentUser.uid, {});

  } catch (err) {
    console.error("[Lesson]", err);
    showToast("Error saving progress.", "error");
    if (btn) { btn.disabled = false; btn.textContent = "Mark as Complete ✓"; }
  }
}

// ════════════════════════════════════════════
// NAVEGACIÓN PREV / NEXT
// ════════════════════════════════════════════

async function buildLessonNav(moduleId, currentLessonId) {
  const navEl = document.getElementById("lesson-nav-btns");
  if (!navEl) return;
  try {
    const { getLessons, getPublishedLessons } = await import("./db.js");
    const lessons = isAdmin
      ? await getLessons(moduleId)
      : await getPublishedLessons(moduleId);

    const idx  = lessons.findIndex(l => l.id === currentLessonId);
    const prev = lessons[idx - 1] || null;
    const next = lessons[idx + 1] || null;

    navEl.innerHTML = `
      ${prev
        ? `<button class="btn btn-secondary btn-sm"
               onclick="navigate('lesson',{moduleId:'${moduleId}',lessonId:'${prev.id}'})">
             ← ${escapeHTML(prev.title)}
           </button>`
        : "<span></span>"}
      <button class="btn btn-ghost btn-sm"
              onclick="navigate('module',{moduleId:'${moduleId}'})">
        ↑ Back to module
      </button>
      ${next
        ? `<button class="btn btn-primary btn-sm"
               onclick="navigate('lesson',{moduleId:'${moduleId}',lessonId:'${next.id}'})">
             ${escapeHTML(next.title)} →
           </button>`
        : "<span></span>"}
    `;
  } catch { /* ignorar */ }
}

// ════════════════════════════════════════════
// EDITOR DE CONTENIDO (ADMIN)
// Tres tabs: Editor Quill / HTML estático / URL externa
// ════════════════════════════════════════════

export async function openLessonEditor(moduleId, lessonId, lesson) {
  await loadQuill();

  const currentType = lesson.contentType || "editor";
  const currentURL  = lesson.externalURL  || "";

  openModal(`
    <div style="min-width:min(560px,90vw);">
      <h3 style="margin-bottom:var(--space-lg);">✏️ Edit: ${escapeHTML(lesson.title)}</h3>

      <!-- Tabs de tipo -->
      <div class="tabs" style="margin-bottom:var(--space-lg);">
        <button class="tab-btn ${currentType === "editor" ? "active" : ""}"
                id="tab-editor" data-panel="panel-editor">
          ✏️ Write with editor
        </button>
        <button class="tab-btn ${currentType === "html" ? "active" : ""}"
                id="tab-html" data-panel="panel-html">
          📄 HTML file (static)
        </button>
        <button class="tab-btn ${currentType === "url" ? "active" : ""}"
                id="tab-url" data-panel="panel-url">
          🔗 External URL
        </button>
      </div>

      <!-- Panel: Editor Quill -->
      <div id="panel-editor" class="editor-panel"
           style="${currentType !== "editor" ? "display:none" : ""}">
        <div id="quill-editor" style="min-height:240px;border-radius:var(--radius-md);overflow:hidden;">
          ${lesson.contentBody || ""}
        </div>
        <p class="form-hint" style="margin-top:var(--space-sm);">
          Content is saved directly in the database. No file needed.
        </p>
      </div>

      <!-- Panel: HTML estático -->
      <div id="panel-html" class="editor-panel"
           style="${currentType !== "html" ? "display:none" : ""}">
        <div class="form-group">
          <label class="form-label">URL of your HTML file <span>*</span></label>
          <input class="form-input" type="url" id="input-html-url"
            value="${escapeHTML(currentType === "html" ? currentURL : "")}"
            placeholder="https://tuapp.pages.dev/lessons/modulo1/leccion1.html" />
          <div class="form-hint">
            Upload your <code>.html</code> file to the <code>/lessons/moduleId/</code> folder
            in your Cloudflare Pages project, then paste the full URL here.
          </div>
          <div id="html-url-error" class="form-error" style="display:none;"></div>
        </div>
        <div class="tip-box" style="margin-top:var(--space-md);">
          <strong>📁 How to upload your HTML file</strong>
          Place your file at: <code>lessons/[moduleId]/[filename].html</code> in your project folder,
          then redeploy to Cloudflare Pages. The URL will be:
          <code>${window.location.origin}/lessons/[moduleId]/[filename].html</code>
        </div>
      </div>

      <!-- Panel: URL externa -->
      <div id="panel-url" class="editor-panel"
           style="${currentType !== "url" ? "display:none" : ""}">
        <div class="form-group">
          <label class="form-label">External URL <span>*</span></label>
          <input class="form-input" type="url" id="input-ext-url"
            value="${escapeHTML(currentType === "url" ? currentURL : "")}"
            placeholder="https://sites.google.com/view/tu-clase" />
          <div class="form-hint">
            Works with: Google Sites, Genially, Padlet, Wix, Nearpod, Educaplay, etc.<br>
            For Notion, Google Docs, YouTube and similar — the student will see a button to open it in a new tab.
          </div>
          <div id="ext-url-error" class="form-error" style="display:none;"></div>
        </div>
      </div>

      <!-- Botones -->
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-content">💾 Save</button>
      </div>
    </div>
  `);

  // Inicializar Quill
  const quill = new window.Quill("#quill-editor", {
    theme: "snow",
    placeholder: "Write your lesson content here...",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ color: [] }, { background: [] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "blockquote", "code-block"],
        ["image"],
        ["clean"]
      ]
    }
  });

  // Switching de tabs
  let activeType = currentType;
  document.querySelectorAll(".tab-btn[data-panel]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn[data-panel]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".editor-panel").forEach(p => p.style.display = "none");
      document.getElementById(btn.dataset.panel).style.display = "";
      // mapear panel → tipo
      const map = { "panel-editor": "editor", "panel-html": "html", "panel-url": "url" };
      activeType = map[btn.dataset.panel];
    });
  });

  // Guardar
  document.getElementById("btn-save-content").addEventListener("click", async () => {
    const btn = document.getElementById("btn-save-content");
    btn.disabled = true; btn.textContent = "Saving...";

    try {
      if (activeType === "editor") {
        const body = quill.root.innerHTML;
        await updateLesson(moduleId, lessonId, {
          contentType: "editor",
          contentBody: body,
          externalURL: ""
        });
        showToast("Content saved ✅", "success");

      } else if (activeType === "html") {
        const url = document.getElementById("input-html-url").value.trim();
        const { valid, error } = validateURL(url);
        if (!valid) {
          showFieldError("html-url-error", error);
          return;
        }
        await updateLesson(moduleId, lessonId, {
          contentType: "html",
          externalURL: url,
          contentBody: ""
        });
        showToast("HTML file URL saved ✅", "success");

      } else if (activeType === "url") {
        const url = document.getElementById("input-ext-url").value.trim();
        const { valid, error } = validateURL(url);
        if (!valid) {
          showFieldError("ext-url-error", error);
          return;
        }
        await updateLesson(moduleId, lessonId, {
          contentType: "url",
          externalURL: url,
          contentBody: ""
        });
        showToast("External URL saved ✅", "success");
      }

      closeModal();
      renderLessonView(moduleId, lessonId);

    } catch (err) {
      console.error("[LessonEditor]", err);
      showToast("Error saving. Try again.", "error");
    } finally {
      btn.disabled = false; btn.textContent = "💾 Save";
    }
  });
}

function showFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "";
  setTimeout(() => { el.style.display = "none"; }, 5000);
}

// ════════════════════════════════════════════
// QUIZ INLINE
// ════════════════════════════════════════════

export function renderQuizInline(quiz, moduleId, lessonId) {
  const section = document.getElementById("lesson-quiz-section");
  if (!section || !quiz?.questions?.length) return;

  let current = 0;
  let score   = 0;
  const total = quiz.questions.length;

  function renderQuestion() {
    const q = quiz.questions[current];
    section.innerHTML = `
      <div class="section-header">
        <div class="section-header__title">📝 Quick Quiz</div>
      </div>
      <div class="quiz-question">
        <div class="quiz-question__num">Question ${current + 1} of ${total}</div>
        <div class="quiz-question__text">${escapeHTML(q.question)}</div>
        <div class="quiz-options">
          ${q.options.map((opt, i) => `
            <div class="quiz-option" data-idx="${i}">
              <div class="quiz-option__letter">${String.fromCharCode(65 + i)}</div>
              <span>${escapeHTML(opt)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    section.querySelectorAll(".quiz-option").forEach(opt => {
      opt.addEventListener("click", () => {
        const chosen  = parseInt(opt.dataset.idx);
        const correct = q.correctIndex;
        section.querySelectorAll(".quiz-option").forEach((o, i) => {
          o.style.pointerEvents = "none";
          if (i === correct) o.classList.add("correct");
          else if (i === chosen) o.classList.add("wrong");
        });
        if (chosen === correct) score++;
        setTimeout(() => { current++; current < total ? renderQuestion() : finishQuiz(); }, 900);
      });
    });
  }

  async function finishQuiz() {
    const pct  = Math.round((score / total) * 100);
    const pass = pct >= 70;
    section.innerHTML = `
      <div class="section-header">
        <div class="section-header__title">📝 Quiz Results</div>
      </div>
      <div class="card" style="text-align:center;padding:var(--space-2xl);">
        <div class="quiz-result__score" style="color:${pass ? "var(--accent-green)" : "var(--accent-red)"};">
          ${pct}%
        </div>
        <div class="quiz-result__label">${pass ? "🎉 Great job!" : "📚 Keep studying!"}</div>
        <p style="color:var(--text-muted);margin:var(--space-md) 0;font-family:var(--font-ui);">
          ${score} / ${total} correct
        </p>
        <button class="btn btn-secondary" onclick="location.reload()">Try again</button>
      </div>
    `;
    await saveQuizResult(currentUser.uid, `${moduleId}__${lessonId}`, score, total);
    await checkAutoAwards(currentUser.uid, { quizPercent: pct });
    showToast(pass ? `Quiz passed! ${pct}% 🎉` : `${pct}% — You need 70% to pass.`,
              pass ? "success" : "info");
  }

  renderQuestion();
}

// ════════════════════════════════════════════
// CARGAR QUILL DINÁMICAMENTE
// ════════════════════════════════════════════

async function loadQuill() {
  if (window.Quill) return;
  if (!document.getElementById("quill-css")) {
    const link = document.createElement("link");
    link.id   = "quill-css";
    link.rel  = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css";
    document.head.appendChild(link);
  }
  await new Promise((res, rej) => {
    if (window.Quill) return res();
    const s   = document.createElement("script");
    s.src     = "https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js";
    s.onload  = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}
