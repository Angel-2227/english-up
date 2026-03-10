// =============================================
// ENGLISH UP! — js/lesson.js
// Visor de lecciones: html / url / editor
// Flujo de completar lección + XP
// =============================================

import { State, registerRoute, navigate, showToast, escapeHTML } from "./app.js";
import { getModule, getLesson, completeLesson, checkAutoBadges } from "./db.js";
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

    // Render content
    renderLessonContent(lesson, container);

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

      <!-- Complete bar -->
      <div class="lesson-complete-bar ${isCompleted ? "completed" : ""}">
        <div class="lcb-left">
          ${isCompleted
            ? `<div class="lcb-title">✅ You completed this lesson!</div>
               <div class="lcb-desc">Great work. Keep going on your path.</div>`
            : `<div class="lcb-title">Done with this lesson?</div>
               <div class="lcb-desc">Mark it complete to earn your XP and keep your streak.</div>`
          }
        </div>
        ${isCompleted
          ? `<button class="btn btn-ghost" onclick="navigate('home')">← Back to path</button>`
          : `<button id="btn-complete-lesson" class="btn btn-primary btn-lg">
               ⚡ Complete — +${xp} XP
             </button>`
        }
      </div>

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
