// =============================================
// ENGLISH UP! — js/teacher/students.js
// Panel del teacher: tab Estudiantes + router
// =============================================

import {
  State, registerRoute, navigate,
  showToast, openModal, closeModal, escapeHTML
} from "../app.js";
import {
  watchAllUsers, approveUser, blockUser, unblockUser,
  updateUserProfile, awardBadge, revokeBadge,
  getModules, getLessons, unlockLessonForUser, lockLessonForUser,
  SYSTEM_BADGES, getAppConfig, updateAppConfig
} from "../db.js";
import { emojiToDataURL } from "../auth.js";

// ════════════════════════════════════════════
// REGISTRO
// ════════════════════════════════════════════

export function registerTeacher() {
  registerRoute("teacher", renderTeacherPanel);
}

// ════════════════════════════════════════════
// PANEL PRINCIPAL (shell con tabs)
// ════════════════════════════════════════════

let _unsubUsers = null;

async function renderTeacherPanel(_, container) {
  container.innerHTML = `
    <div class="teacher-panel">
      <div class="teacher-header">
        <h1 class="teacher-title">🎓 Teacher Panel</h1>
      </div>
      <div class="teacher-tabs">
        <button class="teacher-tab active" data-tab="students">👥 Students</button>
        <button class="teacher-tab"        data-tab="modules">📚 Modules</button>
        <button class="teacher-tab"        data-tab="settings">⚙️ Settings</button>
      </div>
      <div id="tab-students" class="teacher-tab-content active"></div>
      <div id="tab-modules"  class="teacher-tab-content"></div>
      <div id="tab-settings" class="teacher-tab-content"></div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll(".teacher-tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      container.querySelectorAll(".teacher-tab").forEach(b => b.classList.remove("active"));
      container.querySelectorAll(".teacher-tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId)?.classList.add("active");

      if (btn.dataset.tab === "modules") {
        const { renderModulesTab } = await import("./modules.js");
        renderModulesTab(document.getElementById("tab-modules"));
      }
      if (btn.dataset.tab === "settings") {
        renderSettingsTab(document.getElementById("tab-settings"));
      }
    });
  });

  // Load students tab by default
  renderStudentsTab(document.getElementById("tab-students"));
}

// ════════════════════════════════════════════
// TAB: ESTUDIANTES
// ════════════════════════════════════════════

function renderStudentsTab(container) {
  if (_unsubUsers) _unsubUsers();

  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">All Students</span>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
        <select id="student-filter" class="form-select" style="width:auto;font-size:var(--text-xs)">
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>
    </div>
    <div id="pending-banner" class="pending-banner hidden">
      <span class="pending-banner-icon">⏳</span>
      <span class="pending-banner-text" id="pending-banner-text"></span>
    </div>
    <div id="students-grid" class="students-grid">
      <div class="path-skeleton" style="grid-column:1/-1">
        ${[1,2,3].map(() => `<div class="skeleton-node"></div>`).join("")}
      </div>
    </div>
  `;

  let filterValue = "all";
  document.getElementById("student-filter")?.addEventListener("change", e => {
    filterValue = e.target.value;
    renderCards(latestUsers, filterValue);
  });

  let latestUsers = [];

  _unsubUsers = watchAllUsers(users => {
    latestUsers = users;
    // Pending banner
    const pending = users.filter(u => u.status === "pending");
    const banner  = document.getElementById("pending-banner");
    const bannerText = document.getElementById("pending-banner-text");
    if (banner && bannerText) {
      if (pending.length > 0) {
        banner.classList.remove("hidden");
        bannerText.textContent = `${pending.length} student${pending.length > 1 ? "s" : ""} waiting for approval`;
      } else {
        banner.classList.add("hidden");
      }
    }
    renderCards(users, filterValue);
  });
}

function renderCards(users, filter) {
  const grid = document.getElementById("students-grid");
  if (!grid) return;

  const filtered = filter === "all"
    ? users
    : users.filter(u => u.status === filter);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="path-empty" style="grid-column:1/-1;padding:var(--sp-12)">
        <div class="path-empty-icon">🤷</div>
        <h3>No students found</h3>
        <p>No students match this filter.</p>
      </div>`;
    return;
  }

  // Sort: pending first, then alphabetical
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return  1;
    return (a.name || "").localeCompare(b.name || "");
  });

  grid.innerHTML = sorted.map(u => buildStudentCard(u)).join("");

  // Bind actions
  grid.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", e => handleStudentAction(e, btn));
  });
}

// ── Student card HTML ─────────────────────────────────────────────────────────

function buildStudentCard(u) {
  const avatarSrc = u.avatar
    ? emojiToDataURL(u.avatar, 52)
    : (u.photoURL || "");

  const badges = (u.badges ?? []).slice(0, 5).map(id => {
    const def = SYSTEM_BADGES.find(b => b.id === id);
    return def ? `<div class="sc-badge" title="${escapeHTML(def.name)}">${def.emoji}</div>` : "";
  }).join("");

  const xp     = u.xp     ?? 0;
  const streak = u.streak ?? 0;

  // Simple progress: count completed lessons
  const progressCount = Object.values(u.progress ?? {}).filter(p => p.completed).length;

  return `
    <div class="student-card ${u.status}" data-uid="${escapeHTML(u.id)}">
      <div class="sc-top">
        <img class="sc-avatar"
             src="${escapeHTML(avatarSrc)}"
             alt="${escapeHTML(u.name)}"
             onerror="this.style.background='var(--brand-200)';this.src=''">
        <div class="sc-info">
          <div class="sc-name">${escapeHTML(u.name || "Unknown")}</div>
          <div class="sc-email">${escapeHTML(u.email || "")}</div>
        </div>
        <span class="sc-status ${u.status}">${u.status}</span>
      </div>

      <div class="sc-stats">
        <div class="sc-stat">⚡ <strong>${xp.toLocaleString()}</strong> XP</div>
        <div class="sc-stat">🔥 <strong>${streak}</strong> days</div>
        <div class="sc-stat">✅ <strong>${progressCount}</strong> done</div>
      </div>

      ${badges ? `<div class="sc-badges">${badges}</div>` : ""}

      <div class="sc-progress-track">
        <div class="sc-progress-fill" style="width:${Math.min(xp / 5, 100)}%"></div>
      </div>

      <div class="sc-actions">
        ${u.status === "pending" ? `
          <button class="btn btn-secondary btn-sm" data-action="approve" data-uid="${u.id}">✅ Approve</button>
          <button class="btn btn-ghost btn-sm"     data-action="block"   data-uid="${u.id}">🚫 Block</button>
        ` : u.status === "active" ? `
          <button class="btn btn-ghost btn-sm"   data-action="edit-xp"   data-uid="${u.id}">⚡ XP</button>
          <button class="btn btn-ghost btn-sm"   data-action="badges"    data-uid="${u.id}">🏅 Badges</button>
          <button class="btn btn-ghost btn-sm"   data-action="unlock"    data-uid="${u.id}">🔓 Unlock</button>
          <button class="btn btn-danger btn-sm"  data-action="block"     data-uid="${u.id}">🚫</button>
        ` : `
          <button class="btn btn-secondary btn-sm" data-action="unblock" data-uid="${u.id}">✅ Unblock</button>
        `}
      </div>
    </div>
  `;
}

// ── Action handler ────────────────────────────────────────────────────────────

async function handleStudentAction(e, btn) {
  const action = btn.dataset.action;
  const uid    = btn.dataset.uid;
  if (!uid) return;

  btn.disabled = true;

  try {
    switch (action) {
      case "approve":
        await approveUser(uid);
        showToast("Student approved ✅", "success");
        break;

      case "block":
        await blockUser(uid);
        showToast("Student blocked", "info");
        break;

      case "unblock":
        await unblockUser(uid);
        showToast("Student unblocked ✅", "success");
        break;

      case "edit-xp":
        openXPModal(uid);
        break;

      case "badges":
        openBadgesModal(uid);
        break;

      case "unlock":
        openUnlockModal(uid);
        break;
    }
  } catch (err) {
    console.error("[Students]", err);
    showToast("Something went wrong", "error");
  } finally {
    btn.disabled = false;
  }
}

// ── XP Modal ──────────────────────────────────────────────────────────────────

function openXPModal(uid) {
  const card = document.querySelector(`.student-card[data-uid="${uid}"]`);
  const name = card?.querySelector(".sc-name")?.textContent || "Student";

  openModal(`
    <div class="modal-header">
      <h3>⚡ Edit XP — ${escapeHTML(name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Set XP to</label>
        <input id="xp-input" class="form-input" type="number" min="0" placeholder="e.g. 250" />
        <span class="form-hint">This will overwrite the current XP value.</span>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-xp">Save XP</button>
    </div>
  `);

  document.getElementById("btn-save-xp")?.addEventListener("click", async () => {
    const val = parseInt(document.getElementById("xp-input")?.value ?? "", 10);
    if (isNaN(val) || val < 0) { showToast("Enter a valid number", "warning"); return; }
    try {
      await updateUserProfile(uid, { xp: val });
      showToast("XP updated ✅", "success");
      closeModal();
    } catch {
      showToast("Could not update XP", "error");
    }
  });
}

// ── Badges Modal ──────────────────────────────────────────────────────────────

function openBadgesModal(uid) {
  const card   = document.querySelector(`.student-card[data-uid="${uid}"]`);
  const name   = card?.querySelector(".sc-name")?.textContent || "Student";
  const earned = new Set(
    [...(card?.querySelectorAll(".sc-badge") ?? [])].map(b => b.title)
  );

  // Re-read from DOM isn't reliable; fetch inline via watchAllUsers cache isn't available here.
  // Instead, build checkbox list from SYSTEM_BADGES

  openModal(`
    <div class="modal-header">
      <h3>🏅 Badges — ${escapeHTML(name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" style="margin-bottom:var(--sp-4)">
        Check badges to award them; uncheck to revoke.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--sp-3)">
        ${SYSTEM_BADGES.map(b => `
          <label style="display:flex;align-items:center;gap:var(--sp-3);cursor:pointer;
                        padding:var(--sp-3) var(--sp-4);border-radius:var(--radius-md);
                        background:var(--color-surface-alt);font-size:var(--text-sm)">
            <input type="checkbox" data-badge-id="${b.id}"
                   style="width:16px;height:16px;cursor:pointer">
            <span style="font-size:20px">${b.emoji}</span>
            <div>
              <div style="font-weight:var(--weight-bold)">${escapeHTML(b.name)}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-muted)">${escapeHTML(b.desc)}</div>
            </div>
          </label>
        `).join("")}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-badges">Save Badges</button>
    </div>
  `);

  document.getElementById("btn-save-badges")?.addEventListener("click", async () => {
    const checks = [...document.querySelectorAll("[data-badge-id]")];
    const toAward  = checks.filter(c => c.checked).map(c => c.dataset.badgeId);
    const toRevoke = checks.filter(c => !c.checked).map(c => c.dataset.badgeId);
    try {
      await Promise.all([
        ...toAward.map(id  => awardBadge(uid, id)),
        ...toRevoke.map(id => revokeBadge(uid, id)),
      ]);
      showToast("Badges updated ✅", "success");
      closeModal();
    } catch {
      showToast("Could not update badges", "error");
    }
  });
}

// ── Unlock Lessons Modal ──────────────────────────────────────────────────────

async function openUnlockModal(uid) {
  openModal(`
    <div class="modal-header">
      <h3>🔓 Unlock Lessons</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" style="margin-bottom:var(--sp-5)">
        Check lessons to unlock them manually for this student,
        regardless of their progress.
      </p>
      <div id="unlock-list">Loading…</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-unlock">Save</button>
    </div>
  `);

  // Load modules + lessons
  try {
    const modules = await getModules();
    const modulesWithLessons = await Promise.all(
      modules.map(async m => ({ ...m, lessons: await getLessons(m.id) }))
    );

    const listEl = document.getElementById("unlock-list");
    if (!listEl) return;

    listEl.innerHTML = modulesWithLessons
      .filter(m => m.lessons.length > 0)
      .map(m => `
        <div class="unlock-module-group">
          <div class="unlock-module-title">${m.emoji || "📚"} ${escapeHTML(m.title)}</div>
          ${m.lessons.map(l => `
            <div class="unlock-lesson-row">
              <span class="unlock-lesson-name">${escapeHTML(l.title)}</span>
              <label class="toggle-switch">
                <input type="checkbox"
                       data-module="${m.id}"
                       data-lesson="${l.id}"
                       ${Array.isArray(l.unlockedFor) && l.unlockedFor.includes(uid) ? "checked" : ""}>
                <span class="toggle-track"></span>
              </label>
            </div>
          `).join("")}
        </div>
      `).join("") || "<p class='form-hint'>No modules available.</p>";

  } catch (err) {
    document.getElementById("unlock-list").textContent = "Could not load modules.";
    console.error(err);
  }

  document.getElementById("btn-save-unlock")?.addEventListener("click", async () => {
    const checks = [...document.querySelectorAll("#unlock-list input[type=checkbox]")];
    try {
      await Promise.all(checks.map(c => {
        const fn = c.checked ? unlockLessonForUser : lockLessonForUser;
        return fn(c.dataset.module, c.dataset.lesson, uid);
      }));
      showToast("Access updated ✅", "success");
      closeModal();
    } catch {
      showToast("Could not update access", "error");
    }
  });
}


// ════════════════════════════════════════════
// TAB: SETTINGS
// ════════════════════════════════════════════

async function renderSettingsTab(container) {
  const cfg = await getAppConfig().catch(() => ({}));

  container.innerHTML = `
    <div class="settings-section">
      <h3>Platform</h3>
      <div class="form-group">
        <label class="form-label">Platform Name</label>
        <input id="cfg-name" class="form-input" type="text"
               value="${escapeHTML(cfg.platformName || "English Up!")}" />
      </div>
      <div class="form-group">
        <label class="form-label">Welcome Message</label>
        <input id="cfg-welcome" class="form-input" type="text"
               value="${escapeHTML(cfg.welcomeMessage || "")}"
               placeholder="Shown to students on the dashboard" />
      </div>
      <button class="btn btn-primary" id="btn-save-platform">💾 Save</button>
    </div>

    <div class="settings-section">
      <h3>Features</h3>
      <div class="toggle-row">
        <div>
          <div class="toggle-label">AI Assistant</div>
          <div class="toggle-hint">Let students use the AI chat widget</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="cfg-ai" ${cfg.aiEnabled !== false ? "checked" : ""}>
          <span class="toggle-track"></span>
        </label>
      </div>
      <div class="toggle-row">
        <div>
          <div class="toggle-label">Gamification</div>
          <div class="toggle-hint">Show XP, streaks, and badges to students</div>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" id="cfg-gamification" ${cfg.gamificationEnabled !== false ? "checked" : ""}>
          <span class="toggle-track"></span>
        </label>
      </div>
      <div style="margin-top:var(--sp-5)">
        <button class="btn btn-primary" id="btn-save-features">💾 Save</button>
      </div>
    </div>
  `;

  document.getElementById("btn-save-platform")?.addEventListener("click", async () => {
    try {
      await updateAppConfig({
        platformName:   document.getElementById("cfg-name")?.value    || "English Up!",
        welcomeMessage: document.getElementById("cfg-welcome")?.value || "",
      });
      showToast("Platform settings saved ✅", "success");
    } catch { showToast("Could not save", "error"); }
  });

  document.getElementById("btn-save-features")?.addEventListener("click", async () => {
    try {
      await updateAppConfig({
        aiEnabled:            document.getElementById("cfg-ai")?.checked ?? true,
        gamificationEnabled:  document.getElementById("cfg-gamification")?.checked ?? true,
      });
      showToast("Features saved ✅", "success");
    } catch { showToast("Could not save", "error"); }
  });
}
