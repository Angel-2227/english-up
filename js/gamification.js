// =============================================
// ENGLISH UP! — js/gamification.js
// XP, insignias, misiones, racha
// =============================================

import { currentUser, currentProfile } from "./auth.js";
import {
  getProgress, awardBadge, revokeBadge,
  getBadges, createBadge,
  getUserMissions, getMissions,
  getUserSubmissions, submitMission,
  getAllProgress, getAllUsers
} from "./db.js";
import { showToast, openModal, closeModal, formatDate, escapeHTML } from "./app.js";

// ════════════════════════════════════════════
// DEFINICIÓN DE INSIGNIAS DEL SISTEMA
// ════════════════════════════════════════════

export const SYSTEM_BADGES = [
  // Módulos
  { id: "module_0", emoji: "🎬", name: "The Hook",        desc: "Completed Module 0",        color: "#FF6B6B" },
  { id: "module_1", emoji: "👋", name: "Who Am I?",       desc: "Completed Module 1",        color: "#58CC02" },
  { id: "module_2", emoji: "🌍", name: "My World",        desc: "Completed Module 2",        color: "#1CB0F6" },
  { id: "module_3", emoji: "💪", name: "Action Hero",     desc: "Completed Module 3",        color: "#FF9600" },
  { id: "module_4", emoji: "📖", name: "Storyteller",     desc: "Completed Module 4",        color: "#CE82FF" },
  { id: "module_5", emoji: "🗺️", name: "Explorer",        desc: "Completed Module 5",        color: "#00CD9C" },
  { id: "module_6", emoji: "🎤", name: "Expressive",      desc: "Completed Module 6",        color: "#FF4B4B" },
  // Racha
  { id: "streak_3",  emoji: "🔥", name: "On Fire",        desc: "3-class streak",            color: "#FF9600" },
  { id: "streak_5",  emoji: "🔥", name: "Hot Streak",     desc: "5-class streak",            color: "#FF6B00" },
  { id: "streak_10", emoji: "⚡", name: "Unstoppable",    desc: "10-class streak",           color: "#FFD700" },
  // Quiz
  { id: "quiz_perfect", emoji: "⭐", name: "Perfect Score", desc: "100% on any quiz",        color: "#FFD700" },
  { id: "quiz_70",      emoji: "✅", name: "Quiz Passed",   desc: "70%+ on a module quiz",   color: "#58CC02" },
  // Especiales
  { id: "first_lesson",  emoji: "🌱", name: "First Step",   desc: "Completed your first lesson", color: "#58CC02" },
  { id: "course_done",   emoji: "🏆", name: "Champion",     desc: "Completed the full course",   color: "#FFD700" },
  { id: "mission_hero",  emoji: "🎯", name: "Mission Hero", desc: "Completed 5 missions",        color: "#CE82FF" },
];

// ════════════════════════════════════════════
// LÓGICA DE XP
// ════════════════════════════════════════════

export const XP_LEVELS = [
  { level: 1,  minXP: 0,    label: "Beginner" },
  { level: 2,  minXP: 50,   label: "Learner" },
  { level: 3,  minXP: 120,  label: "Explorer" },
  { level: 4,  minXP: 250,  label: "Achiever" },
  { level: 5,  minXP: 450,  label: "Pro" },
  { level: 6,  minXP: 700,  label: "Expert" },
  { level: 7,  minXP: 1000, label: "Master" },
  { level: 8,  minXP: 1400, label: "Champion" },
];

export function getLevel(xp = 0) {
  let current = XP_LEVELS[0];
  for (const lvl of XP_LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
    else break;
  }
  const nextIdx  = XP_LEVELS.indexOf(current) + 1;
  const next     = XP_LEVELS[nextIdx] || null;
  const progress = next
    ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  return { ...current, xp, next, progress };
}

// ════════════════════════════════════════════
// VERIFICAR Y OTORGAR INSIGNIAS AUTOMÁTICAS
// ════════════════════════════════════════════

export async function checkAutoAwards(uid, context = {}) {
  const progress = await getProgress(uid);
  const earned   = progress.badges || [];
  const awarded  = [];

  // Primera lección
  if (!earned.includes("first_lesson") && (progress.completedLessons || []).length >= 1) {
    await awardBadge(uid, "first_lesson");
    awarded.push("first_lesson");
  }

  // Quiz perfecto
  if (context.quizPercent === 100 && !earned.includes("quiz_perfect")) {
    await awardBadge(uid, "quiz_perfect");
    awarded.push("quiz_perfect");
  }

  // Quiz pasado
  if (context.quizPercent >= 70 && !earned.includes("quiz_70")) {
    await awardBadge(uid, "quiz_70");
    awarded.push("quiz_70");
  }

  // Módulo completado — se pasa como context.moduleCompleted = "module_1"
  if (context.moduleCompleted) {
    const badgeId = context.moduleCompleted;
    if (!earned.includes(badgeId)) {
      await awardBadge(uid, badgeId);
      awarded.push(badgeId);
    }
  }

  // Misiones: 5 completadas
  if (!earned.includes("mission_hero")) {
    const subs  = await getUserSubmissions(uid);
    const doneM = subs.filter(s => s.status === "reviewed" && s.grade >= 70);
    if (doneM.length >= 5) {
      await awardBadge(uid, "mission_hero");
      awarded.push("mission_hero");
    }
  }

  // Notificar insignias nuevas
  for (const badgeId of awarded) {
    const badge = SYSTEM_BADGES.find(b => b.id === badgeId);
    if (badge) showBadgeUnlock(badge);
  }

  return awarded;
}

// ════════════════════════════════════════════
// ANIMACIÓN DE DESBLOQUEO DE INSIGNIA
// ════════════════════════════════════════════

export function showBadgeUnlock(badge) {
  const container = document.body;
  const popup = document.createElement("div");
  popup.className = "badge-unlock-popup";
  popup.innerHTML = `
    <div class="badge-unlock-inner">
      <div class="badge-unlock-emoji">${badge.emoji}</div>
      <div class="badge-unlock-text">
        <div class="badge-unlock-title">Badge Unlocked! 🎉</div>
        <div class="badge-unlock-name">${badge.name}</div>
        <div class="badge-unlock-desc">${badge.desc}</div>
      </div>
    </div>
  `;
  container.appendChild(popup);

  // Inyectar estilos si no existen
  if (!document.getElementById("badge-popup-styles")) {
    const style = document.createElement("style");
    style.id = "badge-popup-styles";
    style.textContent = `
      .badge-unlock-popup {
        position: fixed; bottom: 90px; right: 24px; z-index: 9999;
        background: var(--bg-card); border: 2px solid var(--accent-warm);
        border-radius: 16px; padding: 16px 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.18);
        animation: badgeSlideIn 0.5s cubic-bezier(.22,1,.36,1),
                   badgeFadeOut 0.4s 3.8s ease forwards;
        max-width: 280px;
      }
      .badge-unlock-inner { display: flex; align-items: center; gap: 14px; }
      .badge-unlock-emoji { font-size: 2.5rem; }
      .badge-unlock-title { font-weight: 800; color: var(--accent-warm); font-size: 0.75rem; text-transform: uppercase; }
      .badge-unlock-name  { font-weight: 700; font-size: 1rem; color: var(--text-primary); }
      .badge-unlock-desc  { font-size: 0.8rem; color: var(--text-secondary); }
      @keyframes badgeSlideIn {
        from { opacity: 0; transform: translateX(120px); }
        to   { opacity: 1; transform: translateX(0); }
      }
      @keyframes badgeFadeOut {
        from { opacity: 1; }
        to   { opacity: 0; transform: translateY(20px); }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => popup.remove(), 4300);
}

// ════════════════════════════════════════════
// PÁGINA DE INSIGNIAS (para estudiantes)
// ════════════════════════════════════════════

export async function renderBadgesPage() {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="page-loader">Loading badges...</div>`;

  try {
    const progress = await getProgress(currentUser.uid);
    const earned   = new Set(progress.badges || []);
    const levelInfo = getLevel(progress.xp || 0);

    // Agrupar insignias (sin streaks)
    const groups = [
      { label: "📚 Modules",  ids: SYSTEM_BADGES.filter(b => b.id.startsWith("module_")) },
      { label: "📝 Quizzes",  ids: SYSTEM_BADGES.filter(b => b.id.startsWith("quiz_")) },
      { label: "⭐ Special",  ids: SYSTEM_BADGES.filter(b =>
          !b.id.startsWith("module_") && !b.id.startsWith("streak_") && !b.id.startsWith("quiz_")) }
    ];

    const badgesHTML = groups.map(g => `
      <div class="badges-group">
        <h3 class="badges-group-label">${g.label}</h3>
        <div class="badges-grid">
          ${g.ids.map(badge => {
            const isEarned = earned.has(badge.id);
            return `
              <div class="badge-card ${isEarned ? "badge-earned" : "badge-locked"}"
                   title="${badge.desc}" style="${isEarned ? `--badge-color:${badge.color}` : ""}">
                <div class="badge-emoji">${isEarned ? badge.emoji : "🔒"}</div>
                <div class="badge-card-name">${badge.name}</div>
                <div class="badge-card-desc">${badge.desc}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");

    main.innerHTML = `
      <div class="page-badges">
        <div class="page-header">
          <h1>🏅 My Badges</h1>
          <p class="page-subtitle">You've earned <strong>${earned.size}</strong> of ${SYSTEM_BADGES.length} badges</p>
        </div>

        <div class="level-banner">
          <div class="level-info">
            <span class="level-num">Level ${levelInfo.level}</span>
            <span class="level-label">${levelInfo.label}</span>
          </div>
          <div class="level-bar-wrap">
            <div class="level-bar-fill" style="width: ${levelInfo.progress}%"></div>
          </div>
          <span class="level-xp">${levelInfo.xp} XP ${levelInfo.next ? `→ ${levelInfo.next.minXP}` : "(MAX)"}</span>
        </div>

        ${badgesHTML}
      </div>
    `;

    injectBadgePageStyles();
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="error-state">Could not load badges. Try again later.</div>`;
  }
}

function injectBadgePageStyles() {
  if (document.getElementById("badge-page-styles")) return;
  const s = document.createElement("style");
  s.id = "badge-page-styles";
  s.textContent = `
    .page-badges { max-width: 860px; margin: 0 auto; padding: 2rem 1rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.8rem; font-weight: 800; }
    .page-subtitle { color: var(--text-secondary); }
    .level-banner {
      background: var(--bg-secondary); border-radius: 14px;
      padding: 1rem 1.5rem; margin-bottom: 2rem;
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    }
    .level-info { display: flex; flex-direction: column; min-width: 80px; }
    .level-num  { font-weight: 800; font-size: 1.2rem; color: var(--accent-warm); }
    .level-label{ font-size: 0.8rem; color: var(--text-secondary); }
    .level-bar-wrap {
      flex: 1; height: 10px; background: var(--border);
      border-radius: 99px; overflow: hidden; min-width: 100px;
    }
    .level-bar-fill {
      height: 100%; background: var(--accent-warm);
      border-radius: 99px; transition: width 0.6s ease;
    }
    .level-xp { font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap; }
    .badges-group { margin-bottom: 2rem; }
    .badges-group-label { font-weight: 700; margin-bottom: 1rem; font-size: 1rem; }
    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 1rem;
    }
    .badge-card {
      background: var(--bg-card); border: 2px solid var(--border);
      border-radius: 14px; padding: 1rem;
      text-align: center; transition: transform 0.2s;
    }
    .badge-earned {
      border-color: var(--badge-color, var(--accent-warm));
      box-shadow: 0 0 14px color-mix(in srgb, var(--badge-color, var(--accent-warm)) 30%, transparent);
    }
    .badge-earned:hover { transform: translateY(-4px); }
    .badge-locked { opacity: 0.45; filter: grayscale(1); }
    .badge-emoji      { font-size: 2rem; margin-bottom: 0.4rem; }
    .badge-card-name  { font-weight: 700; font-size: 0.85rem; }
    .badge-card-desc  { font-size: 0.72rem; color: var(--text-secondary); margin-top: 0.25rem; }
  `;
  document.head.appendChild(s);
}