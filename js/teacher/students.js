// =============================================
// ENGLISH UP! — js/teacher/students.js
// Panel del teacher: tab Estudiantes + router
// =============================================

import {
  State, registerRoute, navigate,
  showToast, openModal, closeModal, escapeHTML
} from "../app.js";
import {
  watchAllUsers, approveUser, blockUser, unblockUser, deleteUser,
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
        <button class="teacher-tab"        data-tab="classrooms">🏫 Classrooms</button>
        <button class="teacher-tab"        data-tab="modules">📚 Modules</button>
        <button class="teacher-tab"        data-tab="missions">🎯 Missions</button>
        <button class="teacher-tab"        data-tab="settings">⚙️ Settings</button>
      </div>
      <div id="tab-students"   class="teacher-tab-content active"></div>
      <div id="tab-classrooms" class="teacher-tab-content"></div>
      <div id="tab-modules"    class="teacher-tab-content"></div>
      <div id="tab-missions"   class="teacher-tab-content"></div>
      <div id="tab-settings"   class="teacher-tab-content"></div>
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

      if (btn.dataset.tab === "classrooms") {
        const { renderClassroomsTab } = await import("./classrooms.js");
        renderClassroomsTab(document.getElementById("tab-classrooms"));
      }
      if (btn.dataset.tab === "modules") {
        const { renderModulesTab } = await import("./modules.js");
        renderModulesTab(document.getElementById("tab-modules"));
      }
      if (btn.dataset.tab === "missions") {
        const { renderMissionsTeacherTab } = await import("./missions.js");
        renderMissionsTeacherTab(document.getElementById("tab-missions"));
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
  if (!container) return;

  container.innerHTML = `
    <div class="students-toolbar">
      <div class="students-search-wrap">
        <input type="search" id="student-search" class="students-search" placeholder="🔍 Search by name or email…" />
      </div>
      <div class="students-filter-group">
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="pending">⏳ Pending</button>
        <button class="filter-btn" data-filter="active">✅ Active</button>
        <button class="filter-btn" data-filter="blocked">🚫 Blocked</button>
      </div>
    </div>
    <div id="students-list" class="students-list"></div>
  `;

  let allUsers  = [];
  let filter    = "all";
  let searchVal = "";

  function renderList() {
    let users = allUsers.filter(u => {
      if (u.id === State.user?.uid) return false; // Skip self (admin)
      if (filter !== "all" && u.status !== filter) return false;
      if (searchVal) {
        const q = searchVal.toLowerCase();
        return (u.name||"").toLowerCase().includes(q)
          || (u.email||"").toLowerCase().includes(q)
          || (u.nickname||"").toLowerCase().includes(q);
      }
      return true;
    });

    const listEl = document.getElementById("students-list");
    if (!listEl) return;

    if (users.length === 0) {
      listEl.innerHTML = `
        <div style="padding:var(--sp-10);text-align:center;color:var(--color-text-faint)">
          No students found.
        </div>`;
      return;
    }

    listEl.innerHTML = users.map(u => buildStudentRow(u)).join("");

    // Bind actions
    listEl.querySelectorAll("[data-uid]").forEach(row => {
      const uid = row.dataset.uid;
      const u   = allUsers.find(x => x.id === uid);
      if (!u) return;

      row.querySelector(".btn-approve")?.addEventListener("click",  () => handleApprove(uid));
      row.querySelector(".btn-block")?.addEventListener("click",    () => handleBlock(uid));
      row.querySelector(".btn-unblock")?.addEventListener("click",  () => handleUnblock(uid));
      row.querySelector(".btn-details")?.addEventListener("click",  () => openStudentModal(u));
      row.querySelector(".btn-delete")?.addEventListener("click",   () => confirmDeleteStudent(u));
    });
  }

  // Real-time listener
  if (_unsubUsers) _unsubUsers();
  _unsubUsers = watchAllUsers(users => {
    allUsers = users;
    renderList();
  });

  // Filters
  container.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filter = btn.dataset.filter;
      renderList();
    });
  });

  // Search
  container.querySelector("#student-search")?.addEventListener("input", e => {
    searchVal = e.target.value.trim();
    renderList();
  });
}

// ── Row builder ───────────────────────────────────────────────────────────────

function buildStudentRow(u) {
  let avatarSrc;
  if (u.avatar) {
    avatarSrc = emojiToDataURL(u.avatar, 48);
  } else {
    avatarSrc = u.photoURL || "";
  }

  const statusClass = { pending: "badge-warning", active: "badge-success", blocked: "badge-danger" }[u.status] || "";
  const statusLabel = { pending: "⏳ Pending", active: "✅ Active", blocked: "🚫 Blocked" }[u.status] || u.status;
  const displayName = u.nickname ? `${u.nickname} <span class="student-realname">(${escapeHTML(u.name)})</span>` : escapeHTML(u.name);

  return `
    <div class="student-row" data-uid="${escapeHTML(u.id)}">
      <img class="student-row-avatar"
           src="${escapeHTML(avatarSrc)}"
           alt="${escapeHTML(u.name)}"
           onerror="this.src=''" />
      <div class="student-row-info">
        <div class="student-row-name">${displayName}</div>
        <div class="student-row-email">${escapeHTML(u.email)}</div>
      </div>
      <div class="student-row-stats">
        <span class="stat-mini">⚡ ${(u.xp ?? 0).toLocaleString()}</span>
        <span class="stat-mini">🔥 ${u.streak ?? 0}</span>
        <span class="stat-mini">🏅 ${(u.badges ?? []).length}</span>
      </div>
      <span class="badge ${statusClass}">${statusLabel}</span>
      <div class="student-row-actions">
        ${u.status === "pending"  ? `<button class="btn btn-success btn-sm btn-approve">Approve</button>` : ""}
        ${u.status === "active"   ? `<button class="btn btn-danger  btn-sm btn-block">Block</button>` : ""}
        ${u.status === "blocked"  ? `<button class="btn btn-ghost   btn-sm btn-unblock">Unblock</button>` : ""}
        <button class="btn btn-ghost btn-sm btn-details">Details</button>
        <button class="btn btn-danger btn-sm btn-delete" title="Delete student">🗑</button>
      </div>
    </div>
  `;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function handleApprove(uid) {
  try { await approveUser(uid); showToast("Student approved!", "success"); }
  catch(e) { showToast("Error: " + e.message, "error"); }
}

async function handleBlock(uid) {
  try { await blockUser(uid); showToast("Student blocked.", "info"); }
  catch(e) { showToast("Error: " + e.message, "error"); }
}

async function handleUnblock(uid) {
  try { await unblockUser(uid); showToast("Student unblocked.", "success"); }
  catch(e) { showToast("Error: " + e.message, "error"); }
}

function confirmDeleteStudent(u) {
  const displayName = u.nickname || u.name || "this student";
  openModal(`
    <div class="modal-header">
      <h3>🗑 Delete Student</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to permanently delete <strong>${escapeHTML(displayName)}</strong>?</p>
      <p style="margin-top:var(--sp-3);padding:var(--sp-3) var(--sp-4);background:#fff1f2;border-radius:var(--radius-md);border:1px solid #fecdd3;font-size:var(--text-sm);color:#be123c;">
        ⚠️ This will delete all their data — XP, progress, badges, and classroom membership. This action cannot be undone.
      </p>
      <p style="margin-top:var(--sp-3);font-size:var(--text-sm);color:var(--color-text-muted);">
        Note: their Google account will not be deleted, only their profile in this app.
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-delete-student">Yes, delete permanently</button>
    </div>
  `);

  document.getElementById("btn-confirm-delete-student")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-confirm-delete-student");
    btn.disabled    = true;
    btn.textContent = "Deleting…";
    try {
      await deleteUser(u.id);
      closeModal();
      showToast(`${escapeHTML(displayName)} has been deleted.`, "info");
    } catch(err) {
      console.error(err);
      showToast("Could not delete student. Try again.", "error");
      btn.disabled    = false;
      btn.textContent = "Yes, delete permanently";
    }
  });
}

// ════════════════════════════════════════════
// STUDENT DETAIL MODAL
// ════════════════════════════════════════════

async function openStudentModal(u) {
  openModal(`
    <div class="modal-header">
      <h3>👤 ${escapeHTML(u.nickname || u.name)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="student-modal-body">
      <div style="color:var(--color-text-faint);text-align:center;padding:var(--sp-4)">Loading…</div>
    </div>
  `);

  try {
    const modules = await getModules();
    const allLessons = await Promise.all(modules.map(async m => ({
      module: m,
      lessons: await getLessons(m.id),
    })));

    const body = document.getElementById("student-modal-body");
    if (!body) return;

    const progress = u.progress ?? {};
    const badges   = u.badges   ?? [];

    // Badges section
    const badgesHTML = SYSTEM_BADGES.map(b => {
      const has = badges.includes(b.id);
      return `
        <div class="badge-row" data-badge="${escapeHTML(b.id)}" data-has="${has ? "1" : "0"}">
          <span>${b.emoji} ${escapeHTML(b.name)}</span>
          <button class="btn btn-xs ${has ? "btn-danger" : "btn-primary"} btn-badge-toggle">
            ${has ? "Revoke" : "Award"}
          </button>
        </div>`;
    }).join("");

    // Lessons section
    const lessonsHTML = allLessons.map(({ module: m, lessons }) => {
      if (!lessons.length) return "";
      return `
        <div style="margin-bottom:var(--sp-4)">
          <div style="font-weight:var(--weight-bold);margin-bottom:var(--sp-2)">${m.emoji || "📚"} ${escapeHTML(m.title)}</div>
          ${lessons.map(l => {
            const key  = `${m.id}_${l.id}`;
            const done = progress[key]?.completed === true;
            const unlocked = Array.isArray(l.unlockedFor) && l.unlockedFor.includes(u.id);
            return `
              <div class="lesson-unlock-row">
                <span class="${done ? "text-green" : ""}">
                  ${done ? "✅" : "⬜"} ${escapeHTML(l.title)}
                </span>
                <button class="btn btn-xs ${unlocked ? "btn-danger" : "btn-ghost"} btn-unlock-lesson"
                        data-module="${escapeHTML(m.id)}"
                        data-lesson="${escapeHTML(l.id)}"
                        data-unlocked="${unlocked ? "1" : "0"}">
                  ${unlocked ? "🔒 Lock" : "🔓 Unlock"}
                </button>
              </div>`;
          }).join("")}
        </div>`;
    }).join("");

    body.innerHTML = `
      <div class="student-modal-grid">
        <div>
          <div class="modal-section-title">📊 Stats</div>
          <div class="student-stats-mini">
            <span>⚡ ${(u.xp ?? 0).toLocaleString()} XP</span>
            <span>🔥 ${u.streak ?? 0} streak</span>
            <span>🏅 ${badges.length} badges</span>
          </div>
        </div>
        <div>
          <div class="modal-section-title">🏅 Badges</div>
          <div class="badges-manage-list">${badgesHTML}</div>
        </div>
        <div>
          <div class="modal-section-title">🔓 Lesson Access</div>
          ${lessonsHTML || "<p style='color:var(--color-text-faint)'>No modules yet.</p>"}
        </div>
      </div>
    `;

    // Badge toggles
    body.querySelectorAll(".btn-badge-toggle").forEach(btn => {
      const row = btn.closest(".badge-row");
      btn.addEventListener("click", async () => {
        const badgeId = row.dataset.badge;
        const has     = row.dataset.has === "1";
        btn.disabled  = true;
        try {
          if (has) { await revokeBadge(u.id, badgeId); row.dataset.has = "0"; btn.textContent = "Award"; btn.className = "btn btn-xs btn-primary btn-badge-toggle"; }
          else     { await awardBadge(u.id, badgeId);  row.dataset.has = "1"; btn.textContent = "Revoke"; btn.className = "btn btn-xs btn-danger btn-badge-toggle"; }
          showToast("Badge updated!", "success");
        } catch(e) { showToast("Error.", "error"); }
        btn.disabled = false;
      });
    });

    // Lesson unlock toggles
    body.querySelectorAll(".btn-unlock-lesson").forEach(btn => {
      btn.addEventListener("click", async () => {
        const { moduleId: mId, lessonId: lId } = { moduleId: btn.dataset.module, lessonId: btn.dataset.lesson };
        // Use correct variable names
        const mod = btn.dataset.module;
        const les = btn.dataset.lesson;
        const unlocked = btn.dataset.unlocked === "1";
        btn.disabled = true;
        try {
          if (unlocked) {
            await lockLessonForUser(mod, les, u.id);
            btn.dataset.unlocked = "0";
            btn.textContent = "🔓 Unlock";
            btn.className = "btn btn-xs btn-ghost btn-unlock-lesson";
          } else {
            await unlockLessonForUser(mod, les, u.id);
            btn.dataset.unlocked = "1";
            btn.textContent = "🔒 Lock";
            btn.className = "btn btn-xs btn-danger btn-unlock-lesson";
          }
          showToast("Access updated!", "success");
        } catch(e) { showToast("Error.", "error"); }
        btn.disabled = false;
      });
    });

  } catch (err) {
    console.error(err);
    const body = document.getElementById("student-modal-body");
    if (body) body.innerHTML = `<p style="color:#ef4444">Could not load details.</p>`;
  }
}

// ════════════════════════════════════════════
// TAB: SETTINGS
// ════════════════════════════════════════════

async function renderSettingsTab(container) {
  if (!container) return;
  container.innerHTML = `<div style="padding:var(--sp-4);color:var(--color-text-faint)">Loading settings…</div>`;

  try {
    const config = await getAppConfig();

    container.innerHTML = `
      <div class="settings-form">
        <div class="settings-group">
          <h3 class="settings-group-title">⚙️ App Settings</h3>

          <label class="settings-label">
            App Name
            <input type="text" id="cfg-app-name" class="settings-input"
                   value="${escapeHTML(config.appName || "English Up!")}" />
          </label>

          <label class="settings-label">
            Welcome Message
            <input type="text" id="cfg-welcome" class="settings-input"
                   value="${escapeHTML(config.welcomeMessage || "")}"
                   placeholder="Shown on login screen" />
          </label>

          <label class="settings-label settings-toggle">
            <span>Allow students to see leaderboard</span>
            <input type="checkbox" id="cfg-leaderboard"
                   ${config.showLeaderboard ? "checked" : ""} />
          </label>
        </div>

        <button class="btn btn-primary" id="btn-save-settings">Save Settings</button>
        <p id="settings-saved" class="settings-saved hidden">✅ Saved!</p>
      </div>
    `;

    container.querySelector("#btn-save-settings")?.addEventListener("click", async () => {
      const data = {
        appName:         document.getElementById("cfg-app-name")?.value.trim() || "English Up!",
        welcomeMessage:  document.getElementById("cfg-welcome")?.value.trim()  || "",
        showLeaderboard: document.getElementById("cfg-leaderboard")?.checked   ?? false,
      };
      try {
        await updateAppConfig(data);
        const saved = document.getElementById("settings-saved");
        saved?.classList.remove("hidden");
        setTimeout(() => saved?.classList.add("hidden"), 2000);
        showToast("Settings saved!", "success");
      } catch(e) { showToast("Could not save settings.", "error"); }
    });

  } catch(err) {
    container.innerHTML = `<p style="color:#ef4444;padding:var(--sp-4)">Could not load settings.</p>`;
  }
}
