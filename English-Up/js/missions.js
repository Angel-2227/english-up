// =============================================
// ENGLISH UP! — js/missions.js
// Vista Missions del estudiante
// =============================================

import { State, registerRoute, navigate, escapeHTML, showToast } from "./app.js";
import { getAssignedMissions, getMissionResult } from "./db.js";
import { launchMission } from "./mission-engine.js";

// ════════════════════════════════════════════
// REGISTRO
// ════════════════════════════════════════════

export function registerMissions() {
  registerRoute("missions", renderMissionsPage);
}

// ════════════════════════════════════════════
// RENDER PAGE
// ════════════════════════════════════════════

async function renderMissionsPage(_, container) {
  container.innerHTML = buildSkeleton();

  try {
    const uid      = State.user.uid;
    const missions = await getAssignedMissions(uid);

    if (missions.length === 0) {
      container.innerHTML = `
        <div class="missions-header">
          <h1 class="missions-title">🎯 Missions</h1>
          <p class="missions-subtitle">Challenges assigned by your teacher</p>
        </div>
        <div class="path-empty">
          <div class="path-empty-icon">🗺️</div>
          <h3>No missions yet</h3>
          <p>Your teacher hasn't assigned any missions to you yet. Check back soon!</p>
        </div>`;
      return;
    }

    // Fetch results for each mission
    const results = await Promise.all(
      missions.map(m => getMissionResult(uid, m.id).catch(() => null))
    );

    container.innerHTML = `
      <div class="missions-header">
        <h1 class="missions-title">🎯 Missions</h1>
        <p class="missions-subtitle">${missions.length} mission${missions.length !== 1 ? "s" : ""} assigned to you</p>
      </div>
      <div class="missions-grid" id="missions-grid">
        ${missions.map((m, i) => buildMissionCard(m, results[i])).join("")}
      </div>
    `;

    // Bind clicks
    container.querySelectorAll(".mission-card").forEach(card => {
      card.addEventListener("click", () => {
        const missionId = card.dataset.missionId;
        const mission   = missions.find(m => m.id === missionId);
        if (!mission) return;
        launchMission(mission, container, () => renderMissionsPage(_, container));
      });
    });

  } catch (err) {
    console.error("[Missions]", err);
    container.innerHTML = `
      <div class="path-empty">
        <div class="path-empty-icon">😕</div>
        <h3>Could not load missions</h3>
        <p>Please refresh and try again.</p>
      </div>`;
  }
}

// ════════════════════════════════════════════
// CARD HTML
// ════════════════════════════════════════════

function buildMissionCard(mission, result) {
  const done  = result?.score != null;
  const score = result?.score ?? 0;
  const xp    = mission.xpReward ?? 20;

  const typeLabel = {
    quiz:       "🧠 Quiz",
    gapfill:    "✏️ Gap Fill",
    matching:   "🔗 Matching",
    unscramble: "🔀 Unscramble",
    link:       "🔗 Link",
  }[mission.type] ?? "🎯 Mission";

  const qCount = mission.questions?.length ?? 0;

  return `
    <div class="mission-card ${done ? "completed" : ""}" data-mission-id="${mission.id}">
      <div class="mc-top">
        <div class="mc-icon">${mission.emoji || "🎯"}</div>
        <div class="mc-info">
          <div class="mc-title">${escapeHTML(mission.title)}</div>
          ${mission.description
            ? `<div class="mc-desc">${escapeHTML(mission.description)}</div>`
            : ""}
        </div>
      </div>
      <div class="mc-badges">
        <span class="mc-badge mc-badge-type">${typeLabel}</span>
        <span class="mc-badge mc-badge-xp">⚡ up to ${xp} XP</span>
        ${mission.timeLimit
          ? `<span class="mc-badge mc-badge-time">⏱ ${formatTime(mission.timeLimit)}</span>`
          : ""}
        ${done
          ? `<span class="mc-badge mc-badge-done">✅ ${score}%</span>`
          : ""}
      </div>
      ${done ? `
        <div class="mc-score-bar-track">
          <div class="mc-score-bar-fill" style="width:${score}%"></div>
        </div>
        <div class="mc-score-label">${score}% · ${result.xpEarned ?? 0} XP earned</div>
      ` : `
        ${qCount > 0
          ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted)">${qCount} question${qCount !== 1 ? "s" : ""}</div>`
          : ""}
        <div class="btn btn-primary btn-sm" style="align-self:flex-start;pointer-events:none">
          Start Mission →
        </div>
      `}
    </div>
  `;
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function buildSkeleton() {
  return `
    <div class="missions-header">
      <div class="skeleton-node" style="width:200px;height:36px"></div>
    </div>
    <div class="missions-grid">
      ${[1,2,3].map(() => `<div class="skeleton-node" style="height:160px"></div>`).join("")}
    </div>`;
}

function formatTime(secs) {
  if (!secs) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s > 0 ? s + "s" : ""}`.trim() : `${s}s`;
}
