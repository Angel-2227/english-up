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
  SYSTEM_BADGES, getAppConfig, updateAppConfig,
  getSkinsConfig, updateSkinsEnabled, updateSkinsScheduled,
} from "../db.js";
import { emojiToDataURL } from "../auth.js";
import { SKINS, applySkin, _updateSkinsCache } from "../theme.js";

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
// TAB: SETTINGS (General + Skins)
// ════════════════════════════════════════════

async function renderSettingsTab(container) {
  if (!container) return;
  container.innerHTML = `<div style="padding:var(--sp-4);color:var(--color-text-faint)">Loading settings…</div>`;

  try {
    const [config, skinsConfig] = await Promise.all([getAppConfig(), getSkinsConfig()]);
    renderSettingsHTML(container, config, skinsConfig);
  } catch(err) {
    container.innerHTML = `<p style="color:#ef4444;padding:var(--sp-4)">Could not load settings.</p>`;
  }
}

function renderSettingsHTML(container, config, skinsConfig) {
  container.innerHTML = `
    <div class="settings-tabs">
      <button class="settings-tab-btn active" data-stab="general">⚙️ General</button>
      <button class="settings-tab-btn" data-stab="skins">🎨 Temáticas</button>
    </div>
    <div id="stab-general" class="settings-tab-panel">
      ${buildGeneralSettings(config)}
    </div>
    <div id="stab-skins" class="settings-tab-panel hidden">
      ${buildSkinsPanel(skinsConfig)}
    </div>
  `;

  // Sub-tab switching
  container.querySelectorAll(".settings-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".settings-tab-btn").forEach(b => b.classList.remove("active"));
      container.querySelectorAll(".settings-tab-panel").forEach(p => p.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById(`stab-${btn.dataset.stab}`)?.classList.remove("hidden");
    });
  });

  bindGeneralSettings(container, config);
  bindSkinsPanel(container, skinsConfig);
}

// ── General Settings ─────────────────────────────────────────────────────────

function buildGeneralSettings(config) {
  return `
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
}

function bindGeneralSettings(container, config) {
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
}

// ── Skins Panel ───────────────────────────────────────────────────────────────

function buildSkinsPanel(skinsConfig) {
  const enabled   = skinsConfig.enabled   ?? [];
  const scheduled = skinsConfig.scheduled ?? [];

  const toggleableSkins = Object.values(SKINS).filter(s => s.teacherCanToggle);

  const skinToggles = toggleableSkins.map(skin => {
    const isOn = enabled.includes(skin.id);
    return `
      <div class="skin-mgr-card ${isOn ? "skin-mgr-card-on" : ""}">
        <span class="skin-mgr-emoji">${skin.emoji}</span>
        <div class="skin-mgr-info">
          <span class="skin-mgr-name">${skin.name}</span>
          <span class="skin-mgr-desc">${skin.desc}</span>
          ${skin.autoDate ? `<span class="skin-mgr-auto">📅 Auto: mes ${skin.autoDate.month}, días ${skin.autoDate.dayStart}–${skin.autoDate.dayEnd}</span>` : ""}
        </div>
        <label class="toggle-switch" title="${isOn ? "Deshabilitar" : "Habilitar"} para estudiantes">
          <input type="checkbox" class="skin-toggle-cb" data-skin-id="${skin.id}" ${isOn ? "checked" : ""}>
          <span class="toggle-slider"></span>
        </label>
        <button class="btn btn-sm btn-outline skin-preview-btn" data-skin-id="${skin.id}">
          👁 Preview
        </button>
      </div>
    `;
  }).join("");

  const schedItems = scheduled.length === 0
    ? `<p class="skin-sched-empty">No hay programaciones. Usa ＋ Nueva para crear una.</p>`
    : scheduled.map((s, i) => buildSchedRow(s, i)).join("");

  return `
    <div class="skins-panel">
      <section class="skins-section">
        <div class="section-header">
          <h3 class="section-title">🎨 Temáticas disponibles</h3>
        </div>
        <p class="skins-hint">Activa las temáticas que los estudiantes podrán elegir.</p>
        <div class="skin-mgr-list" id="skin-mgr-list">
          ${skinToggles}
        </div>
      </section>

      <section class="skins-section">
        <div class="section-header">
          <h3 class="section-title">📅 Programaciones automáticas</h3>
          <button class="btn btn-primary btn-sm" id="btn-new-sched">＋ Nueva</button>
        </div>
        <p class="skins-hint">Define cuándo se activa una temática automáticamente para todos.</p>
        <div class="skin-sched-list" id="skin-sched-list">
          ${schedItems}
        </div>
      </section>
    </div>
  `;
}

function buildSchedRow(sched, index) {
  const skin   = SKINS[sched.skinId];
  const label  = sched.label || (skin ? skin.name : sched.skinId);
  const typeLabel = { range: "📅 Rango de fechas", days: "📆 Días de semana", hours: "🕐 Rango horario" }[sched.type] || sched.type;

  let detail = "";
  if (sched.type === "range") {
    detail = `${sched.startDate} → ${sched.endDate}`;
    if (sched.startTime) detail += ` (${sched.startTime}–${sched.endTime || "23:59"})`;
  } else if (sched.type === "days") {
    const dayNames = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    detail = (sched.daysOfWeek || []).map(d => dayNames[d]).join(", ");
    if (sched.startTime) detail += ` ${sched.startTime}–${sched.endTime}`;
  } else if (sched.type === "hours") {
    detail = `Todos los días ${sched.startTime}–${sched.endTime}`;
  }

  return `
    <div class="skin-sched-row ${sched.active ? "sched-active" : "sched-inactive"}" data-sched-idx="${index}">
      <span class="sched-emoji">${skin ? skin.emoji : "🎨"}</span>
      <div class="sched-info">
        <span class="sched-label">${escapeHTML(label)}</span>
        <span class="sched-type">${typeLabel}</span>
        <span class="sched-detail">${escapeHTML(detail)}</span>
      </div>
      <label class="toggle-switch toggle-switch-sm" title="Activar/desactivar esta programación">
        <input type="checkbox" class="sched-active-cb" data-sched-idx="${index}" ${sched.active ? "checked" : ""}>
        <span class="toggle-slider"></span>
      </label>
      <button class="btn btn-sm btn-outline sched-edit-btn" data-sched-idx="${index}">✏️</button>
      <button class="btn btn-sm btn-danger sched-del-btn" data-sched-idx="${index}">🗑</button>
    </div>
  `;
}

function bindSkinsPanel(container, skinsConfig) {
  let enabled   = [...(skinsConfig.enabled ?? [])];
  let scheduled = [...(skinsConfig.scheduled ?? [])];

  // Toggle de skin habilitada
  container.querySelectorAll(".skin-toggle-cb").forEach(cb => {
    cb.addEventListener("change", async () => {
      const skinId = cb.dataset.skinId;
      if (cb.checked) {
        if (!enabled.includes(skinId)) enabled.push(skinId);
      } else {
        enabled = enabled.filter(id => id !== skinId);
      }
      cb.closest(".skin-mgr-card").classList.toggle("skin-mgr-card-on", cb.checked);
      try {
        await updateSkinsEnabled(enabled);
        _updateSkinsCache({ enabled, scheduled });
        showToast(cb.checked ? `✅ ${skinId} habilitado` : `${skinId} deshabilitado`, "success");
      } catch(e) { showToast("Error al guardar.", "error"); }
    });
  });

  // Preview
  container.querySelectorAll(".skin-preview-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      applySkin(btn.dataset.skinId, true);
      showToast(`Preview: ${btn.dataset.skinId}`, "info", 1500);
    });
  });

  // Nueva programación
  container.querySelector("#btn-new-sched")?.addEventListener("click", () => {
    openSchedModal(null, scheduled, async (newList) => {
      scheduled = newList;
      try {
        await updateSkinsScheduled(scheduled);
        _updateSkinsCache({ enabled, scheduled });
        refreshSchedList(container, scheduled, enabled);
        showToast("Programación guardada.", "success");
      } catch(e) { showToast("Error al guardar.", "error"); }
    });
  });

  // Delegación de eventos en la lista de programaciones
  bindSchedList(container, scheduled, enabled, async (newList) => {
    scheduled = newList;
    try {
      await updateSkinsScheduled(scheduled);
      _updateSkinsCache({ enabled, scheduled });
      showToast("Guardado.", "success");
    } catch(e) { showToast("Error al guardar.", "error"); }
  });
}

function refreshSchedList(container, scheduled, enabled) {
  const el = container.querySelector("#skin-sched-list");
  if (!el) return;
  el.innerHTML = scheduled.length === 0
    ? `<p class="skin-sched-empty">No hay programaciones.</p>`
    : scheduled.map((s, i) => buildSchedRow(s, i)).join("");
  bindSchedList(container, scheduled, enabled, async (newList) => {
    try {
      await updateSkinsScheduled(newList);
      _updateSkinsCache({ enabled, scheduled: newList });
    } catch(e) { showToast("Error al guardar.", "error"); }
  });
}

function bindSchedList(container, scheduled, enabled, onSave) {
  const el = container.querySelector("#skin-sched-list");
  if (!el) return;

  el.querySelectorAll(".sched-active-cb").forEach(cb => {
    cb.addEventListener("change", async () => {
      const idx = parseInt(cb.dataset.schedIdx);
      scheduled[idx] = { ...scheduled[idx], active: cb.checked };
      cb.closest(".skin-sched-row").classList.toggle("sched-active", cb.checked);
      cb.closest(".skin-sched-row").classList.toggle("sched-inactive", !cb.checked);
      await onSave([...scheduled]);
    });
  });

  el.querySelectorAll(".sched-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.schedIdx);
      openSchedModal(scheduled[idx], scheduled, async (newList) => {
        await onSave(newList);
        refreshSchedList(container, newList, enabled);
      }, idx);
    });
  });

  el.querySelectorAll(".sched-del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.schedIdx);
      if (!confirm("¿Eliminar esta programación?")) return;
      scheduled.splice(idx, 1);
      await onSave([...scheduled]);
      refreshSchedList(container, scheduled, enabled);
    });
  });
}

// ── Modal: crear/editar programación ─────────────────────────────────────────

function openSchedModal(existing, scheduled, onSave, editIdx = null) {
  const toggleableSkins = Object.values(SKINS).filter(s => s.teacherCanToggle);
  const skinOptions = toggleableSkins.map(s =>
    `<option value="${s.id}" ${existing?.skinId === s.id ? "selected" : ""}>${s.emoji} ${s.name}</option>`
  ).join("");

  const type = existing?.type || "range";

  const html = `
    <div class="modal-header">
      <h3>📅 ${existing ? "Editar" : "Nueva"} Programación</h3>
      <button class="modal-close" onclick="window.closeModal()" type="button">✕</button>
    </div>
    <div class="modal-body">
      <div class="sched-form">
        <label class="settings-label">
          Nombre / Etiqueta
          <input type="text" id="sched-label" class="settings-input"
                 value="${escapeHTML(existing?.label || "")}" placeholder="Ej: Navidad 2025" />
        </label>

        <label class="settings-label">
          Temática
          <select id="sched-skin" class="settings-input">${skinOptions}</select>
        </label>

        <label class="settings-label">
          Tipo de programación
          <select id="sched-type" class="settings-input">
            <option value="range" ${type === "range" ? "selected" : ""}>📅 Rango de fechas</option>
            <option value="days"  ${type === "days"  ? "selected" : ""}>📆 Días de la semana</option>
            <option value="hours" ${type === "hours" ? "selected" : ""}>🕐 Rango horario diario</option>
          </select>
        </label>

        <div id="sched-fields-range" class="sched-fields ${type !== "range" ? "hidden" : ""}">
          <div class="form-row">
            <label class="settings-label">
              Fecha inicio
              <input type="date" id="sched-start-date" class="settings-input"
                     value="${existing?.startDate || ""}">
            </label>
            <label class="settings-label">
              Fecha fin
              <input type="date" id="sched-end-date" class="settings-input"
                     value="${existing?.endDate || ""}">
            </label>
          </div>
          <div class="form-row">
            <label class="settings-label">
              Hora inicio (opcional)
              <input type="time" id="sched-start-time-range" class="settings-input"
                     value="${existing?.startTime || ""}">
            </label>
            <label class="settings-label">
              Hora fin (opcional)
              <input type="time" id="sched-end-time-range" class="settings-input"
                     value="${existing?.endTime || ""}">
            </label>
          </div>
        </div>

        <div id="sched-fields-days" class="sched-fields ${type !== "days" ? "hidden" : ""}">
          <label class="settings-label">Días de la semana</label>
          <div class="days-picker">
            ${["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map((d, i) => `
              <label class="day-chip ${(existing?.daysOfWeek || []).includes(i) ? "day-chip-on" : ""}">
                <input type="checkbox" value="${i}" class="day-cb"
                       ${(existing?.daysOfWeek || []).includes(i) ? "checked" : ""}>
                ${d}
              </label>`).join("")}
          </div>
          <div class="form-row" style="margin-top:var(--sp-3)">
            <label class="settings-label">
              Hora inicio (opcional)
              <input type="time" id="sched-start-time-days" class="settings-input"
                     value="${existing?.startTime || ""}">
            </label>
            <label class="settings-label">
              Hora fin (opcional)
              <input type="time" id="sched-end-time-days" class="settings-input"
                     value="${existing?.endTime || ""}">
            </label>
          </div>
        </div>

        <div id="sched-fields-hours" class="sched-fields ${type !== "hours" ? "hidden" : ""}">
          <div class="form-row">
            <label class="settings-label">
              Hora inicio
              <input type="time" id="sched-start-time-hours" class="settings-input"
                     value="${existing?.startTime || ""}">
            </label>
            <label class="settings-label">
              Hora fin
              <input type="time" id="sched-end-time-hours" class="settings-input"
                     value="${existing?.endTime || ""}">
            </label>
          </div>
        </div>

        <label class="settings-label settings-toggle">
          <span>Activa inmediatamente</span>
          <input type="checkbox" id="sched-active" ${existing?.active !== false ? "checked" : ""}>
        </label>

        <button class="btn btn-primary" id="btn-save-sched">💾 Guardar programación</button>
      </div>
    </div>
  `;

  const overlay = document.getElementById("modal-overlay");
  const box     = document.getElementById("modal-box");
  if (!overlay || !box) return;
  box.innerHTML = html;
  overlay.classList.remove("hidden");
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.add("hidden"); };

  // Mostrar campos según tipo
  const typeSelect = box.querySelector("#sched-type");
  typeSelect.addEventListener("change", () => {
    box.querySelectorAll(".sched-fields").forEach(f => f.classList.add("hidden"));
    box.querySelector(`#sched-fields-${typeSelect.value}`)?.classList.remove("hidden");
  });

  // Day chips
  box.querySelectorAll(".day-chip").forEach(chip => {
    chip.addEventListener("click", () => chip.classList.toggle("day-chip-on"));
  });

  box.querySelector("#btn-save-sched").addEventListener("click", () => {
    const schedType = typeSelect.value;
    const newSched = {
      id:      existing?.id || `sched_${Date.now()}`,
      skinId:  box.querySelector("#sched-skin").value,
      label:   box.querySelector("#sched-label").value.trim() || "Sin nombre",
      type:    schedType,
      active:  box.querySelector("#sched-active").checked,
      startDate:   null, endDate: null,
      startTime:   null, endTime: null,
      daysOfWeek:  null,
    };

    if (schedType === "range") {
      newSched.startDate = box.querySelector("#sched-start-date").value  || null;
      newSched.endDate   = box.querySelector("#sched-end-date").value    || null;
      newSched.startTime = box.querySelector("#sched-start-time-range").value || null;
      newSched.endTime   = box.querySelector("#sched-end-time-range").value   || null;
    } else if (schedType === "days") {
      newSched.daysOfWeek = [...box.querySelectorAll(".day-cb:checked")].map(cb => parseInt(cb.value));
      newSched.startTime  = box.querySelector("#sched-start-time-days").value || null;
      newSched.endTime    = box.querySelector("#sched-end-time-days").value   || null;
    } else if (schedType === "hours") {
      newSched.startTime = box.querySelector("#sched-start-time-hours").value || null;
      newSched.endTime   = box.querySelector("#sched-end-time-hours").value   || null;
    }

    const newList = [...scheduled];
    if (editIdx !== null) newList[editIdx] = newSched;
    else newList.push(newSched);

    overlay.classList.add("hidden");
    onSave(newList);
  });
}