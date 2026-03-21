// =============================================
// ENGLISH UP! — js/dashboard.js
// Vista "camino" del estudiante estilo Duolingo
// =============================================

import { State, registerRoute, navigate, escapeHTML } from "./app.js";
import { getPublishedModules, getPublishedLessons, getUserProgress } from "./db.js";
import { emojiToDataURL } from "./auth.js";
import { SYSTEM_BADGES }  from "./db.js";

// ════════════════════════════════════════════
// REGISTRO DE RUTA
// ════════════════════════════════════════════

export function registerDashboard() {
  registerRoute("home", renderDashboard);
}

// ════════════════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════════════════

async function renderDashboard(_, container) {
  // Skeleton mientras carga
  container.innerHTML = buildSkeleton();

  try {
    const [modules, progress] = await Promise.all([
      getPublishedModules(),
      getUserProgress(State.user.uid),
    ]);

    // Para cada módulo, cargar sus lecciones
    const modulesWithLessons = await Promise.all(
      modules.map(async m => ({
        ...m,
        lessons: await getPublishedLessons(m.id),
      }))
    );

    container.innerHTML = buildDashboardHTML(modulesWithLessons, progress);

    // Bind clicks en nodos disponibles
    container.querySelectorAll(".lesson-node.current, .lesson-node.done").forEach(node => {
      node.addEventListener("click", () => {
        const { moduleId, lessonId } = node.dataset;
        if (moduleId && lessonId) {
          navigate("lesson", { moduleId, lessonId });
        }
      });
    });

  } catch (err) {
    console.error("[Dashboard]", err);
    container.innerHTML = `
      <div class="path-empty">
        <div class="path-empty-icon">😕</div>
        <h3>Could not load your path</h3>
        <p>Please refresh the page. If the problem persists, contact your teacher.</p>
      </div>
    `;
  }
}

// ════════════════════════════════════════════
// BUILD HTML
// ════════════════════════════════════════════

function buildDashboardHTML(modules, progress) {
  const profile = State.profile;

  return `
    ${buildStudentHeader(profile, progress)}
    <div class="path-container">
      ${modules.length === 0
        ? buildEmpty()
        : modules.map((m, mi) => buildModule(m, mi, modules, progress)).join("")
      }
    </div>
  `;
}

// ── Student header ────────────────────────────────────────────────────────────

function buildStudentHeader(profile, progress) {
  const xp        = profile.xp        ?? 0;
  const streak    = profile.streak    ?? 0;
  const badges    = profile.badges    ?? [];
  const completed = Object.values(progress).filter(p => p.completed).length;

  // Avatar src
  let avatarSrc;
  if (profile.avatar) {
    avatarSrc = emojiToDataURL(profile.avatar, 72);
  } else {
    avatarSrc = profile.photoURL || "";
  }

  const badgeHTML = badges.length > 0
    ? `<div class="student-badges">
        ${badges.slice(0, 8).map(id => {
          const def = SYSTEM_BADGES.find(b => b.id === id);
          return def
            ? `<div class="badge-item" data-tooltip="${escapeHTML(def.name)}">${def.emoji}</div>`
            : "";
        }).join("")}
        ${badges.length > 8 ? `<div class="badge-item" data-tooltip="More badges">+${badges.length - 8}</div>` : ""}
      </div>`
    : "";

  return `
    <div class="student-header">
      <img class="student-avatar"
           src="${escapeHTML(avatarSrc)}"
           alt="${escapeHTML(profile.name)}"
           onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\'/>'">
      <div class="student-info">
        <div class="student-name">${escapeHTML(profile.name)}</div>
        <div class="student-stats">
          <div class="stat-pill stat-pill-xp">⚡ ${xp.toLocaleString()} XP</div>
          <div class="stat-pill stat-pill-streak">🔥 ${streak} day streak</div>
          <div class="stat-pill stat-pill-done">✅ ${completed} lesson${completed !== 1 ? "s" : ""} done</div>
        </div>
        ${badgeHTML}
      </div>
    </div>
  `;
}

// ── Module section ────────────────────────────────────────────────────────────

function buildModule(module, moduleIndex, allModules, progress) {
  const lessons         = module.lessons ?? [];
  const completedCount  = lessons.filter(l => isCompleted(l, module, progress)).length;
  const pct             = lessons.length > 0
    ? Math.round((completedCount / lessons.length) * 100)
    : 0;

  // Un módulo está desbloqueado si:
  // - es el primero, o
  // - el módulo anterior tiene al menos 1 lección completada
  const isUnlocked = isModuleUnlocked(moduleIndex, allModules, progress);

  return `
    <div class="module-section ${isUnlocked ? "" : "locked"}">
      <div class="module-header" style="--module-color: ${escapeHTML(module.color || "#f59e0b")}">
        <div class="module-emoji">${module.emoji || "📚"}</div>
        <div class="module-meta">
          <div class="module-title">${escapeHTML(module.title)}</div>
          ${module.description
            ? `<div class="module-desc">${escapeHTML(module.description)}</div>`
            : ""}
          ${isUnlocked && lessons.length > 0 ? `
            <div class="module-progress-bar-track">
              <div class="module-progress-bar-fill" style="width:${pct}%"></div>
            </div>
          ` : ""}
        </div>
        ${!isUnlocked ? `<div style="font-size:var(--text-xl)">🔒</div>` : ""}
        ${isUnlocked && lessons.length > 0
          ? `<div style="font-size:var(--text-sm);font-weight:var(--weight-extrabold);opacity:.9">
               ${completedCount}/${lessons.length}
             </div>`
          : ""}
      </div>

      ${isUnlocked
        ? buildLessonPath(module, lessons, progress)
        : `<div style="text-align:center;color:var(--color-text-faint);font-size:var(--text-sm);padding:var(--sp-4)">
             Complete the previous module to unlock this one.
           </div>`
      }
    </div>
  `;
}

// ── Lesson path (nodes + connectors) ─────────────────────────────────────────

function buildLessonPath(module, lessons, progress) {
  if (lessons.length === 0) {
    return `<div class="path-empty">
      <div class="path-empty-icon">🚧</div>
      <h3>Coming soon</h3>
      <p>Your teacher is preparing lessons for this module.</p>
    </div>`;
  }

  const uid = State.user.uid;

  return `
    <div class="lesson-path">
      ${lessons.map((lesson, i) => {
        const done      = isCompleted(lesson, module, progress);
        const unlocked  = isLessonUnlocked(i, lessons, module, progress, uid);
        const state     = done ? "done" : (unlocked ? "current" : "locked");

        const icon = done ? "✅" : (unlocked ? "📖" : "🔒");

        // Connector above (except first)
        const connector = i > 0
          ? `<div class="path-connector ${isCompleted(lessons[i-1], module, progress) ? "done" : ""}"></div>`
          : "";

        return `
          ${connector}
          <div class="lesson-node ${state}"
               data-module-id="${escapeHTML(module.id)}"
               data-lesson-id="${escapeHTML(lesson.id)}"
               role="button"
               tabindex="${state !== "locked" ? "0" : "-1"}"
               aria-label="${escapeHTML(lesson.title)}">

            <div class="node-icon">${icon}</div>

            <div class="node-text">
              <div class="node-title">${escapeHTML(lesson.title)}</div>
              <div class="node-meta">
                ${lesson.duration ? `<span>⏱ ${lesson.duration} min</span>` : ""}
                <span class="node-xp">⚡ +${lesson.xpReward ?? 10} XP</span>
                ${done ? `<span style="color:var(--green-600);font-weight:700">Completed!</span>` : ""}
              </div>
            </div>

            ${state === "current" ? `<div class="node-arrow">▶</div>` : ""}
          </div>
        `;
      }).join("")}
    </div>
  `;
}

// ════════════════════════════════════════════
// LÓGICA DE DESBLOQUEO
// ════════════════════════════════════════════

/** ¿Está completada esta lección? */
function isCompleted(lesson, module, progress) {
  const key = `${module.id}_${lesson.id}`;
  return progress[key]?.completed === true;
}

/**
 * ¿Está desbloqueada esta lección?
 * Regla: lineal por defecto.
 * La primera lección de un módulo siempre está disponible (si el módulo lo está).
 * Las siguientes requieren que la anterior esté completada.
 * EXCEPCIÓN: si lesson.unlockedFor incluye el uid del estudiante, siempre disponible.
 */
function isLessonUnlocked(index, lessons, module, progress, uid) {
  const lesson = lessons[index];

  // Override manual del teacher
  if (Array.isArray(lesson.unlockedFor) && lesson.unlockedFor.includes(uid)) {
    return true;
  }

  // Primera lección: siempre disponible
  if (index === 0) return true;

  // Las demás: requieren que la anterior esté completada
  return isCompleted(lessons[index - 1], module, progress);
}

/**
 * ¿Está desbloqueado el módulo?
 * El primero siempre. Los demás necesitan que el anterior tenga al menos 1 lección completada.
 */
function isModuleUnlocked(moduleIndex, allModules, progress) {
  if (moduleIndex === 0) return true;
  const prevModule  = allModules[moduleIndex - 1];
  const prevLessons = prevModule.lessons ?? [];
  return prevLessons.some(l => isCompleted(l, prevModule, progress));
}

// ════════════════════════════════════════════
// SKELETON / EMPTY
// ════════════════════════════════════════════

function buildSkeleton() {
  return `
    <div class="path-skeleton">
      <div class="skeleton-node" style="height:96px;margin-bottom:var(--sp-2)"></div>
      <div class="skeleton-node"></div>
      <div class="skeleton-connector"></div>
      <div class="skeleton-node"></div>
      <div class="skeleton-connector"></div>
      <div class="skeleton-node"></div>
    </div>
  `;
}

function buildEmpty() {
  return `
    <div class="path-empty">
      <div class="path-empty-icon">🌱</div>
      <h3>Your journey is just beginning</h3>
      <p>Your teacher hasn't published any modules yet. Check back soon!</p>
    </div>
  `;
}
