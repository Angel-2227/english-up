// =============================================
// ENGLISH UP! — js/modules.js
// Renderizado de módulos, lecciones y perfil
// =============================================

import { currentUser, currentProfile, isAdmin } from "./auth.js";
import { navigate, showToast, State, formatDate } from "./app.js";
import {
  getPublishedModules, getModules,
  getPublishedLessons, getLessons,
  getModule, getProgress, watchProgress,
  getUserMissions, getUserSubmissions,
  getBadges
} from "./db.js";
import { checkAutoAwards } from "./gamification.js";

// Cache local
let progressCache = null;
let unsubProgress = null;

// ════════════════════════════════════════════
// DASHBOARD DEL ESTUDIANTE
// ════════════════════════════════════════════

export async function renderStudentDashboard() {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="dashboard"><div class="page-loader">Loading your dashboard...</div></div>`;

  try {
    const uid      = currentUser.uid;
    const progress = await getProgress(uid);
    progressCache  = progress;

    // Suscribirse a cambios en tiempo real
    if (unsubProgress) unsubProgress();
    unsubProgress = watchProgress(uid, p => {
      progressCache = p;
      updateNavXP(p.xp || 0);
    });

    const modules  = await getPublishedModules();
    const missions = await getUserMissions(uid);
    const activeMissions = missions.filter(m => {
      const now  = new Date();
      const due  = m.dueDate?.toDate?.();
      return !due || due >= now;
    }).slice(0, 3);

    // Calcular estadísticas
    const totalLessons    = modules.reduce((a, m) => a + (m.lessonCount || 0), 0);
    const completedCount  = progress.completedLessons?.length || 0;
    const totalXP         = progress.xp || 0;
    const streak          = progress.streak || 0;
    const badgeCount      = progress.badges?.length || 0;

    // Encontrar última lección pendiente
    const lastModule = modules.find(m => {
      const done = progress.moduleProgress?.[m.id] || 0;
      return done < (m.lessonCount || 1);
    });

    main.innerHTML = `
      <div class="dashboard">

        ${lastModule ? `
        <div class="continue-banner" onclick="navigate('module', {moduleId: '${lastModule.id}'})">
          <div class="continue-banner__icon">${lastModule.emoji || "📖"}</div>
          <div class="continue-banner__text">
            <div class="continue-banner__label">Continue Learning</div>
            <div class="continue-banner__title">${lastModule.title}</div>
          </div>
          <div class="continue-banner__arrow">→</div>
        </div>
        ` : ""}

        <!-- Welcome Header -->
        <div class="welcome-header">
          <div class="welcome-header__left">
            <h1 class="welcome-greeting">
              Hi, <span>${(currentUser.displayName || "Student").split(" ")[0]}</span>! 👋
            </h1>
            <p class="welcome-subtitle">Keep going — every lesson gets you closer to fluency.</p>
            <div class="welcome-stats">
              <div class="welcome-stat">
                <div class="welcome-stat__icon">🔥</div>
                <div class="welcome-stat__info">
                  <div class="welcome-stat__value">${streak}</div>
                  <div class="welcome-stat__label">Day streak</div>
                </div>
              </div>
              <div class="welcome-stat">
                <div class="welcome-stat__icon">✅</div>
                <div class="welcome-stat__info">
                  <div class="welcome-stat__value">${completedCount}</div>
                  <div class="welcome-stat__label">Lessons done</div>
                </div>
              </div>
              <div class="welcome-stat">
                <div class="welcome-stat__icon">🏅</div>
                <div class="welcome-stat__info">
                  <div class="welcome-stat__value">${badgeCount}</div>
                  <div class="welcome-stat__label">Badges</div>
                </div>
              </div>
            </div>
          </div>
          <div class="welcome-header__right">
            ${buildXPRing(totalXP)}
          </div>
        </div>

        <!-- Módulos -->
        <div class="section-header">
          <div class="section-header__title">📚 Modules</div>
        </div>
        <div class="modules-grid" id="modules-grid">
          ${modules.length ? modules.map(m => buildModuleCard(m, progress)).join("") : `
            <div class="empty-state">
              <div class="empty-state__icon">📭</div>
              <div class="empty-state__title">No modules yet</div>
              <div class="empty-state__text">Your teacher hasn't published any modules yet. Check back soon!</div>
            </div>
          `}
        </div>

        <!-- Misiones activas -->
        ${activeMissions.length ? `
        <div class="missions-section">
          <div class="section-header">
            <div class="section-header__title">🎯 Active Missions</div>
            <div class="section-header__action" onclick="navigate('profile')">See all</div>
          </div>
          <div class="missions-list">
            ${activeMissions.map(m => buildMissionCard(m, progress)).join("")}
          </div>
        </div>
        ` : ""}

        <!-- Insignias recientes -->
        ${badgeCount > 0 ? `
        <div class="badges-section">
          <div class="section-header">
            <div class="section-header__title">🏅 My Badges</div>
            <div class="section-header__action" onclick="navigate('badges')">See all</div>
          </div>
          <div id="badges-preview"></div>
        </div>
        ` : ""}

      </div>
    `;

    // Eventos en cards de módulos
    document.querySelectorAll(".module-card[data-module-id]").forEach(card => {
      card.addEventListener("click", () => {
        navigate("module", { moduleId: card.dataset.moduleId });
      });
    });

    // Cargar badges preview
    if (badgeCount > 0) loadBadgesPreview(progress.badges || []);

    // Verificar insignias nuevas — usa checkAutoAwards (no checkAndAwardBadges)
    checkAutoAwards(uid, {}).catch(console.error);

  } catch (err) {
    console.error("[Modules] Dashboard error:", err);
    main.innerHTML = `<div class="dashboard"><div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">Could not load dashboard</div>
      <div class="empty-state__text">${err.message}</div>
    </div></div>`;
  }
}


// ════════════════════════════════════════════
// VISTA DE MÓDULO
// ════════════════════════════════════════════

export async function renderModuleView(moduleId) {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="dashboard"><div class="page-loader">Loading module...</div></div>`;

  try {
    const uid      = currentUser.uid;
    const moduleData = await getModule(moduleId);
    if (!moduleData) { navigate("home"); return; }

    const lessons  = isAdmin
      ? await getLessons(moduleId)
      : await getPublishedLessons(moduleId);

    const progress = progressCache || await getProgress(uid);
    const completedInModule = lessons.filter(l =>
      progress.completedLessons?.includes(`${moduleId}__${l.id}`)
    ).length;

    const percent = lessons.length
      ? Math.round((completedInModule / lessons.length) * 100)
      : 0;

    main.innerHTML = `
      <div class="dashboard">
        <div class="module-detail">

          <!-- Header -->
          <div class="module-detail__header" data-emoji="${moduleData.emoji || "📖"}"
               style="background: linear-gradient(135deg, ${moduleData.color || "#58CC02"}, ${darkenColor(moduleData.color || "#58CC02")})">
            <div class="module-detail__back" onclick="navigate('home')">← Back to Home</div>
            <h1 class="module-detail__title">${moduleData.emoji || "📖"} ${moduleData.title}</h1>
            <div class="module-detail__meta">
              <span class="level-tag level-tag--${(moduleData.level || "a1").toLowerCase()}">
                ${moduleData.level || "A1"}
              </span>
              <span style="color:rgba(255,255,255,0.8); font-size:0.82rem; font-weight:600;">
                ${lessons.length} lesson${lessons.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div class="module-detail__progress-section">
              <div class="module-detail__progress-label">
                <span>Progress</span>
                <span>${completedInModule} / ${lessons.length}</span>
              </div>
              <div class="module-detail__progress-bar">
                <div class="module-detail__progress-fill" style="width:${percent}%"></div>
              </div>
            </div>
          </div>

          ${moduleData.description ? `<p style="color:var(--text-secondary);margin-bottom:var(--space-xl);font-family:var(--font-ui);">${moduleData.description}</p>` : ""}

          <!-- Lista de lecciones -->
          <div class="section-header">
            <div class="section-header__title">📝 Lessons</div>
          </div>

          ${lessons.length ? `
          <div class="lessons-list">
            ${lessons.map((lesson, i) => {
              const completed = progress.completedLessons?.includes(`${moduleId}__${lesson.id}`);
              const locked    = !isAdmin && i > 0 && !progress.completedLessons?.includes(`${moduleId}__${lessons[i-1].id}`);
              return buildLessonRow(lesson, i + 1, completed, locked, moduleId);
            }).join("")}
          </div>
          ` : `
          <div class="empty-state">
            <div class="empty-state__icon">📭</div>
            <div class="empty-state__title">No lessons yet</div>
            <div class="empty-state__text">Lessons will appear here once your teacher publishes them.</div>
          </div>
          `}

        </div>
      </div>
    `;

    // Eventos en lecciones
    document.querySelectorAll(".lesson-row[data-lesson-id]").forEach(row => {
      if (row.classList.contains("locked")) return;
      row.addEventListener("click", () => {
        navigate("lesson", { moduleId, lessonId: row.dataset.lessonId });
      });
    });

  } catch (err) {
    console.error("[Modules] Module view error:", err);
    main.innerHTML = `<div class="dashboard"><div class="empty-state">
      <div class="empty-state__icon">⚠️</div>
      <div class="empty-state__title">Could not load module</div>
    </div></div>`;
  }
}


// ════════════════════════════════════════════
// PÁGINA DE PERFIL
// ════════════════════════════════════════════

export async function renderProfilePage() {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="profile-layout"><div class="page-loader">Loading profile...</div></div>`;

  try {
    const uid      = currentUser.uid;
    const progress = progressCache || await getProgress(uid);
    const modules  = await getPublishedModules();
    const missions = await getUserMissions(uid);
    const submissions = await getUserSubmissions(uid);

    const totalLessons   = modules.reduce((a, m) => a + (m.lessonCount || 0), 0);
    const completedCount = progress.completedLessons?.length || 0;
    const percent        = totalLessons ? Math.round((completedCount / totalLessons) * 100) : 0;

    main.innerHTML = `
      <div class="profile-layout">

        <!-- Sidebar -->
        <div class="profile-card">
          <img class="profile-avatar"
               src="${currentUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || "S")}&background=58CC02&color=fff&size=128`}"
               alt="${currentUser.displayName}" />
          <div class="profile-name">${currentUser.displayName || "Student"}</div>
          <div class="profile-level">${currentUser.email}</div>

          <div class="profile-xp-bar">
            <div class="progress-labeled">
              <div class="progress-label-row">
                <span class="progress-label">Overall Progress</span>
                <span class="progress-value">${percent}%</span>
              </div>
              <div class="progress-wrap">
                <div class="progress-bar" style="width:${percent}%"></div>
              </div>
            </div>
          </div>

          <div class="profile-stats">
            <div class="profile-stat">
              <div class="profile-stat__value">${progress.xp || 0}</div>
              <div class="profile-stat__label">Total XP</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat__value">${progress.streak || 0}</div>
              <div class="profile-stat__label">Streak</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat__value">${completedCount}</div>
              <div class="profile-stat__label">Lessons</div>
            </div>
            <div class="profile-stat">
              <div class="profile-stat__value">${progress.badges?.length || 0}</div>
              <div class="profile-stat__label">Badges</div>
            </div>
          </div>
        </div>

        <!-- Main -->
        <div>
          <!-- Misiones -->
          <div class="section-header">
            <div class="section-header__title">🎯 My Missions</div>
          </div>
          ${missions.length ? `
          <div class="missions-list" style="margin-bottom:var(--space-2xl);">
            ${missions.map(m => buildMissionCardFull(m, submissions)).join("")}
          </div>
          ` : `
          <div class="empty-state" style="margin-bottom:var(--space-2xl);">
            <div class="empty-state__icon">🎯</div>
            <div class="empty-state__title">No missions assigned yet</div>
            <div class="empty-state__text">Your teacher will assign missions here.</div>
          </div>
          `}

          <!-- Historial de quiz -->
          ${progress.quizResults ? `
          <div class="section-header">
            <div class="section-header__title">📊 Quiz History</div>
          </div>
          <div class="card" style="margin-bottom:var(--space-2xl);">
            ${Object.entries(progress.quizResults).map(([id, r]) => `
              <div class="flex items-center justify-between" style="padding:var(--space-sm) 0; border-bottom:1px solid var(--border);">
                <span style="font-weight:700; font-size:0.9rem;">${id}</span>
                <span class="xp-pill">${r.percent}% · ${r.score}/${r.total}</span>
              </div>
            `).join("")}
          </div>
          ` : ""}
        </div>
      </div>
    `;

    // Eventos en misiones (submit)
    document.querySelectorAll("[data-submit-mission]").forEach(btn => {
      btn.addEventListener("click", () => openMissionSubmitModal(btn.dataset.submitMission));
    });

  } catch (err) {
    console.error("[Modules] Profile error:", err);
  }
}


// ════════════════════════════════════════════
// BUILDERS (HTML helpers)
// ════════════════════════════════════════════

function buildModuleCard(module, progress) {
  const done    = progress.moduleProgress?.[module.id] || 0;
  const total   = module.lessonCount || 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return `
    <div class="module-card" data-module-id="${module.id}">
      <div class="module-card__header" style="background: linear-gradient(135deg, ${module.color || "#58CC02"}, ${darkenColor(module.color || "#58CC02")})">
        <div class="module-card__emoji">${module.emoji || "📖"}</div>
        <span class="module-card__level">${module.level || "A1"}</span>
      </div>
      <div class="module-card__body">
        <div class="module-card__title">${module.title}</div>
        <div class="module-card__desc">${module.description || ""}</div>
        <div class="progress-labeled">
          <div class="progress-label-row">
            <span class="progress-label">${done}/${total} lessons</span>
            <span class="progress-value">${percent}%</span>
          </div>
          <div class="progress-wrap progress-wrap--sm">
            <div class="progress-bar" style="width:${percent}%"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildLessonRow(lesson, num, completed, locked, moduleId) {
  const statusIcon = locked ? "🔒" : completed ? "✅" : "▶️";
  return `
    <div class="lesson-row ${completed ? "completed" : ""} ${locked ? "locked" : ""}"
         data-lesson-id="${lesson.id}"
         title="${locked ? "Complete the previous lesson first" : ""}">
      <div class="lesson-row__num">${completed ? "✓" : num}</div>
      <div class="lesson-row__info">
        <div class="lesson-row__title">${lesson.title}</div>
        <div class="lesson-row__meta">
          ${lesson.contentType === "html" ? "📄 HTML file" : lesson.contentType === "url" ? "🔗 External" : "✏️ Written lesson"}
          ${lesson.quiz?.questions?.length ? " · 📝 Quiz included" : ""}
          ${lesson.xpReward ? ` · ⭐ ${lesson.xpReward} XP` : ""}
        </div>
      </div>
      <div class="lesson-row__status">${statusIcon}</div>
    </div>
  `;
}

function buildMissionCard(mission, progress) {
  return `
    <div class="mission-card">
      <div class="mission-card__icon">🎯</div>
      <div class="mission-card__body">
        <div class="mission-card__title">${mission.title}</div>
        <div class="mission-card__desc">${mission.description || ""}</div>
        <div class="mission-card__meta">
          ${mission.xpReward ? `<span class="xp-pill">⭐ ${mission.xpReward} XP</span>` : ""}
          ${mission.dueDate ? `<span class="text-sm text-muted">Due: ${formatDate(mission.dueDate)}</span>` : ""}
        </div>
      </div>
    </div>
  `;
}

function buildMissionCardFull(mission, submissions) {
  const sub = submissions.find(s => s.missionId === mission.id);
  const status = sub ? sub.status : "pending";

  return `
    <div class="mission-card">
      <div class="mission-card__icon">🎯</div>
      <div class="mission-card__body">
        <div class="mission-card__title">${mission.title}</div>
        <div class="mission-card__desc">${mission.description || ""}</div>
        <div class="mission-card__meta">
          <span class="mission-status mission-status--${status}">
            ${status === "pending" ? "⏳ Pending" : status === "reviewed" ? "✅ Reviewed" : "📤 Submitted"}
          </span>
          ${mission.xpReward ? `<span class="xp-pill">⭐ ${mission.xpReward} XP</span>` : ""}
          ${sub?.grade != null ? `<span class="xp-pill" style="background:var(--accent-blue-light);color:var(--accent-blue);">Grade: ${sub.grade}</span>` : ""}
        </div>
        ${sub?.feedback ? `
        <div style="margin-top:var(--space-sm); padding:var(--space-sm) var(--space-md); background:var(--bg-secondary); border-radius:var(--radius-md); font-size:0.85rem; font-family:var(--font-ui); color:var(--text-secondary);">
          <strong>Teacher feedback:</strong> ${sub.feedback}
        </div>
        ` : ""}
        ${!sub ? `
        <button class="btn btn-primary btn-sm" style="margin-top:var(--space-md);"
                data-submit-mission="${mission.id}">
          Submit Mission
        </button>
        ` : ""}
      </div>
    </div>
  `;
}

function buildXPRing(xp) {
  const maxXP  = 1000;
  const radius = 40;
  const circ   = 2 * Math.PI * radius;
  const filled = Math.min((xp / maxXP) * circ, circ);
  const dash   = `${filled} ${circ}`;

  return `
    <div class="xp-ring-wrap">
      <svg class="xp-ring-svg" viewBox="0 0 100 100">
        <circle class="xp-ring-bg" cx="50" cy="50" r="${radius}"/>
        <circle class="xp-ring-fill" cx="50" cy="50" r="${radius}"
                stroke-dasharray="${dash}" stroke-dashoffset="0"/>
      </svg>
      <div class="xp-ring-label">
        <div class="xp-ring-value">${xp}</div>
        <div class="xp-ring-unit">XP</div>
      </div>
    </div>
  `;
}

async function loadBadgesPreview(earnedIds) {
  const container = document.getElementById("badges-preview");
  if (!container) return;
  try {
    const allBadges = await getBadges();
    const earned    = allBadges.filter(b => earnedIds.includes(b.id)).slice(0, 6);
    container.innerHTML = `
      <div class="badge-grid">
        ${earned.map(b => `
          <div class="badge-item earned">
            <div class="badge-icon">${b.icon || "🏅"}</div>
            <div class="badge-name">${b.name}</div>
            ${b.xpReward ? `<div class="badge-xp">+${b.xpReward} XP</div>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  } catch { /* ignore */ }
}

async function openMissionSubmitModal(missionId) {
  const { openModal, closeModal } = await import("./app.js");
  const { submitMission } = await import("./db.js");

  openModal(`
    <h3 style="margin-bottom:var(--space-md);">📤 Submit Mission</h3>
    <div class="form-group">
      <label class="form-label">Your answer / work</label>
      <textarea class="form-textarea" id="mission-answer" rows="6"
        placeholder="Write your answer here..."></textarea>
    </div>
    <button class="btn btn-primary btn-full" id="btn-submit-mission">Submit →</button>
  `);

  document.getElementById("btn-submit-mission")?.addEventListener("click", async () => {
    const content = document.getElementById("mission-answer")?.value?.trim();
    if (!content) { showToast("Please write something before submitting.", "warning"); return; }
    try {
      await submitMission(currentUser.uid, missionId, content);
      showToast("Mission submitted! Your teacher will review it soon. ✅", "success");
      closeModal();
      renderStudentDashboard();
    } catch (err) {
      showToast("Could not submit. Try again.", "error");
    }
  });
}

// ════════════════════════════════════════════
// UTILIDAD: oscurecer color hex
// ════════════════════════════════════════════

function darkenColor(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r   = Math.max(0, (num >> 16) - 40);
  const g   = Math.max(0, ((num >> 8) & 0xff) - 40);
  const b   = Math.max(0, (num & 0xff) - 40);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function updateNavXP(xp) {
  const el = document.getElementById("nav-xp");
  if (el) el.textContent = `${xp} XP`;
}