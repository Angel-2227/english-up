// =============================================
// ENGLISH UP! — js/teacher.js
// Panel docente: módulos, estudiantes, misiones, evaluaciones
// =============================================

import { currentUser } from "./auth.js";
import {
  getModules, createModule, updateModule, deleteModule, toggleModulePublished,
  getLessons, createLesson, updateLesson, deleteLesson, toggleLessonPublished,
  getAllUsers, approveUser, blockUser,
  getAllProgress, getProgress,
  getMissions, createMission, updateMission, deleteMission,
  getPendingSubmissions, getMissionSubmissions, reviewSubmission, awardBadge,
  getBadges, getAppConfig, saveAppConfig,
  getPendingUsers
} from "./db.js";
import { showToast, navigate, openModal, closeModal, formatDate, escapeHTML, confirmAction } from "./app.js";
import { SYSTEM_BADGES } from "./gamification.js";

// ════════════════════════════════════════════
// TEACHER HOME
// ════════════════════════════════════════════

export async function renderTeacherHome() {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `<div class="page-loader">Loading dashboard...</div>`;

  try {
    const [users, submissions, pending] = await Promise.all([
      getAllUsers(),
      getPendingSubmissions(),
      getPendingUsers()
    ]);

    const activeStudents = users.filter(u => u.status === "active" && u.role !== "admin");

    main.innerHTML = `
      <div class="teacher-home">
        <div class="teacher-welcome">
          <h1>👋 Teacher Dashboard</h1>
          <p class="text-secondary">Welcome back! Here's what needs your attention.</p>
        </div>

        <div class="teacher-stats-grid">
          <div class="stat-card" style="--accent:#58CC02">
            <div class="stat-value">${activeStudents.length}</div>
            <div class="stat-label">Active Students</div>
          </div>
          <div class="stat-card" style="--accent:#FF9600">
            <div class="stat-value">${pending.length}</div>
            <div class="stat-label">Pending Approvals</div>
          </div>
          <div class="stat-card" style="--accent:#FF4B4B">
            <div class="stat-value">${submissions.length}</div>
            <div class="stat-label">Missions to Review</div>
          </div>
        </div>

        ${pending.length ? `
          <div class="teacher-alert">
            <strong>⏳ ${pending.length} student(s) waiting for approval</strong>
            <button class="btn btn--primary btn--sm" onclick="navigate('teacher')">Go to panel →</button>
          </div>
        ` : ""}

        ${submissions.length ? `
          <div class="teacher-alert teacher-alert--warn">
            <strong>📝 ${submissions.length} mission(s) need review</strong>
            <button class="btn btn--primary btn--sm" onclick="navigate('teacher')">Review now →</button>
          </div>
        ` : ""}

        <div class="teacher-quick-actions">
          <h3>Quick Actions</h3>
          <div class="quick-actions-grid">
            <button class="quick-action-btn" onclick="navigate('teacher')"><span>📚</span> Manage Modules</button>
            <button class="quick-action-btn" onclick="navigate('teacher')"><span>👥</span> View Students</button>
            <button class="quick-action-btn" onclick="navigate('teacher')"><span>🎯</span> Create Mission</button>
            <button class="quick-action-btn" onclick="navigate('teacher')"><span>📊</span> See Progress</button>
          </div>
        </div>
      </div>
    `;

    injectTeacherStyles();
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="error-state">Failed to load dashboard.</div>`;
  }
}

// ════════════════════════════════════════════
// PANEL DOCENTE COMPLETO
// ════════════════════════════════════════════

export async function renderTeacherPanel() {
  const main = document.getElementById("main-content");
  if (!main) return;

  main.innerHTML = `
    <div class="teacher-panel">
      <div class="teacher-panel-header">
        <h1>⚙️ Teacher Panel</h1>
      </div>
      <div class="teacher-tabs">
        <button class="teacher-tab active" data-tab="modules">📚 Modules</button>
        <button class="teacher-tab" data-tab="students">👥 Students</button>
        <button class="teacher-tab" data-tab="missions">🎯 Missions</button>
        <button class="teacher-tab" data-tab="submissions">📝 Review</button>
        <button class="teacher-tab" data-tab="badges">🏅 Badges</button>
        <button class="teacher-tab" data-tab="settings">⚙️ Settings</button>
      </div>
      <div class="teacher-tab-content" id="teacher-tab-content">
        <div class="page-loader">Loading...</div>
      </div>
    </div>
  `;

  document.querySelectorAll(".teacher-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".teacher-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadTab(btn.dataset.tab);
    });
  });

  loadTab("modules");
  injectTeacherStyles();
}

async function loadTab(tab) {
  const content = document.getElementById("teacher-tab-content");
  if (!content) return;
  content.innerHTML = `<div class="page-loader">Loading...</div>`;
  try {
    switch (tab) {
      case "modules":     await renderModulesTab(content);     break;
      case "students":    await renderStudentsTab(content);    break;
      case "missions":    await renderMissionsTab(content);    break;
      case "submissions": await renderSubmissionsTab(content); break;
      case "badges":      await renderBadgesTab(content);      break;
      case "settings":    await renderSettingsTab(content);    break;
    }
  } catch (err) {
    console.error(err);
    content.innerHTML = `<div class="error-state">Error loading tab.</div>`;
  }
}

// ════════════════════════════════════════════
// TAB: MÓDULOS
// ════════════════════════════════════════════

async function renderModulesTab(container) {
  const modules = await getModules();

  container.innerHTML = `
    <div class="tab-modules">
      <div class="tab-header">
        <h2>Modules</h2>
        <button class="btn btn--primary btn--sm" id="btn-new-module">➕ New Module</button>
      </div>
      <div class="modules-list" id="modules-list">
        ${modules.length === 0 ? `<p class="text-secondary">No modules yet. Create your first one!</p>` : ""}
        ${modules.map(mod => `
          <div class="module-admin-card" data-mid="${mod.id}">
            <div class="module-admin-card-header" style="border-left: 5px solid ${mod.color || "#58CC02"}">
              <div>
                <span class="module-order">#${mod.order || "?"}</span>
                <strong>${escapeHTML(mod.name || mod.title || "")}</strong>
                <span class="tag tag--${mod.published ? "green" : "gray"}">
                  ${mod.published ? "Published" : "Draft"}
                </span>
                ${mod.level ? `<span class="tag">${escapeHTML(mod.level)}</span>` : ""}
              </div>
              <div class="module-admin-actions">
                <button class="btn btn--ghost btn--sm" data-action="toggle" data-mid="${mod.id}" data-pub="${mod.published}">
                  ${mod.published ? "Unpublish" : "Publish"}
                </button>
                <button class="btn btn--ghost btn--sm" data-action="lessons" data-mid="${mod.id}">📋 Lessons</button>
                <button class="btn btn--ghost btn--sm" data-action="edit" data-mid="${mod.id}">✏️ Edit</button>
                <button class="btn btn--danger btn--sm" data-action="delete" data-mid="${mod.id}">🗑️</button>
              </div>
            </div>
            ${mod.description ? `<p class="module-admin-desc">${escapeHTML(mod.description)}</p>` : ""}
            <div class="module-lessons-panel hidden" id="lessons-${mod.id}"></div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  container.querySelector("#btn-new-module").addEventListener("click", () => openModuleForm());

  container.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { action, mid } = btn.dataset;
      if (action === "edit") {
        const mod = modules.find(m => m.id === mid);
        openModuleForm(mod);
      } else if (action === "delete") {
        if (!confirmAction("Delete this module and all its lessons?")) return;
        await deleteModule(mid);
        showToast("Module deleted.", "info");
        loadTab("modules");
      } else if (action === "toggle") {
        const pub = btn.dataset.pub === "true";
        await toggleModulePublished(mid, !pub);
        showToast(`Module ${!pub ? "published" : "unpublished"}.`, "success");
        loadTab("modules");
      } else if (action === "lessons") {
        const panel = document.getElementById(`lessons-${mid}`);
        if (panel.classList.contains("hidden")) {
          panel.classList.remove("hidden");
          await renderLessonsPanel(mid, panel);
        } else {
          panel.classList.add("hidden");
        }
      }
    });
  });
}

async function renderLessonsPanel(moduleId, container) {
  container.innerHTML = `<div class="page-loader small">Loading lessons...</div>`;
  const lessons = await getLessons(moduleId);

  // Etiqueta visual por tipo de contenido
  const typeTag = (type) => {
    if (type === "html")   return `<span class="tag tag--blue">📄 HTML file</span>`;
    if (type === "url")    return `<span class="tag tag--purple">🔗 URL</span>`;
    return `<span class="tag tag--gray">✏️ Editor</span>`;
  };

  container.innerHTML = `
    <div class="lessons-panel">
      <div class="lessons-panel-header">
        <span>Lessons (${lessons.length})</span>
        <button class="btn btn--primary btn--sm" id="btn-new-lesson-${moduleId}">➕ Add Lesson</button>
      </div>
      <div class="lessons-panel-list">
        ${lessons.length === 0 ? `<p class="text-secondary">No lessons yet.</p>` : ""}
        ${lessons.map(l => `
          <div class="lesson-admin-row">
            <span class="lesson-order">#${l.order || "?"}</span>
            <span class="lesson-admin-title">${escapeHTML(l.title)}</span>
            <span class="tag tag--${l.published ? "green" : "gray"}">${l.published ? "Live" : "Draft"}</span>
            ${typeTag(l.contentType)}
            <div class="lesson-admin-actions">
              <button class="btn btn--ghost btn--xs"
                onclick="navigate('lesson',{moduleId:'${moduleId}',lessonId:'${l.id}'})">
                👁️ View
              </button>
              <button class="btn btn--ghost btn--xs la-toggle" data-lid="${l.id}" data-pub="${l.published}">
                ${l.published ? "Unpublish" : "Publish"}
              </button>
              <button class="btn btn--ghost btn--xs la-edit" data-lid="${l.id}">✏️ Edit</button>
              <button class="btn btn--ghost btn--xs la-content" data-lid="${l.id}">📝 Content</button>
              <button class="btn btn--ghost btn--xs la-quiz" data-lid="${l.id}">❓ Quiz</button>
              <button class="btn btn--danger btn--xs la-delete" data-lid="${l.id}">🗑️</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  container.querySelector(`#btn-new-lesson-${moduleId}`)
    .addEventListener("click", () => openLessonForm(moduleId));

  container.querySelectorAll(".la-toggle").forEach(b => {
    b.addEventListener("click", async () => {
      const pub = b.dataset.pub === "true";
      await toggleLessonPublished(moduleId, b.dataset.lid, !pub);
      showToast(`Lesson ${!pub ? "published" : "unpublished"}.`, "success");
      renderLessonsPanel(moduleId, container);
    });
  });

  container.querySelectorAll(".la-edit").forEach(b => {
    b.addEventListener("click", () => {
      const lesson = lessons.find(l => l.id === b.dataset.lid);
      openLessonForm(moduleId, lesson);
    });
  });

  // Botón "Content" → abre el editor de contenido (Quill / HTML url / URL externa)
  container.querySelectorAll(".la-content").forEach(b => {
    b.addEventListener("click", async () => {
      const lesson = lessons.find(l => l.id === b.dataset.lid);
      if (!lesson) return;
      const { openLessonEditor } = await import("./lesson.js");
      openLessonEditor(moduleId, b.dataset.lid, lesson);
    });
  });

  container.querySelectorAll(".la-quiz").forEach(b => {
    b.addEventListener("click", async () => {
      const { openQuizEditor } = await import("./quiz.js");
      openQuizEditor(moduleId, b.dataset.lid);
    });
  });

  container.querySelectorAll(".la-delete").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirmAction("Delete this lesson?")) return;
      await deleteLesson(moduleId, b.dataset.lid);
      showToast("Lesson deleted.", "info");
      renderLessonsPanel(moduleId, container);
    });
  });
}

// ════════════════════════════════════════════
// FORMULARIO MÓDULO
// ════════════════════════════════════════════

function openModuleForm(mod = null) {
  const isEdit = !!mod;
  openModal(`
    <div class="form-modal">
      <h2>${isEdit ? "✏️ Edit Module" : "➕ New Module"}</h2>
      <div class="form-group">
        <label class="form-label">Module Name <span>*</span></label>
        <input id="mod-name" class="form-input" type="text"
          value="${escapeHTML(mod?.name || mod?.title || "")}" placeholder="e.g. Who Am I?">
      </div>
      <div class="form-group">
        <label class="form-label">Level</label>
        <select id="mod-level" class="form-select">
          <option value="">— Select level —</option>
          ${["A1","A1-A2","A2","A2+","B1"].map(l =>
            `<option ${(mod?.level === l) ? "selected" : ""}>${l}</option>`
          ).join("")}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Order</label>
        <input id="mod-order" class="form-input" type="number" value="${mod?.order || ""}" placeholder="1">
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input id="mod-color" type="color" value="${mod?.color || "#58CC02"}">
      </div>
      <div class="form-group">
        <label class="form-label">Emoji</label>
        <input id="mod-emoji" class="form-input" type="text"
          value="${escapeHTML(mod?.emoji || "")}" placeholder="📖" maxlength="4">
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <textarea id="mod-desc" class="form-textarea" rows="2"
          placeholder="Brief description...">${escapeHTML(mod?.description || "")}</textarea>
      </div>
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-mod">💾 Save</button>
      </div>
    </div>
  `);

  document.getElementById("btn-save-mod").addEventListener("click", async () => {
    const name = document.getElementById("mod-name").value.trim();
    if (!name) { showToast("Module name is required.", "warning"); return; }

    const btn = document.getElementById("btn-save-mod");
    btn.disabled = true; btn.textContent = "Saving...";

    const data = {
      name,
      title:       name, // alias
      level:       document.getElementById("mod-level").value,
      order:       parseInt(document.getElementById("mod-order").value) || 0,
      color:       document.getElementById("mod-color").value,
      emoji:       document.getElementById("mod-emoji").value.trim() || "📖",
      description: document.getElementById("mod-desc").value.trim()
    };

    try {
      if (isEdit) await updateModule(mod.id, data);
      else        await createModule(data);
      showToast(`Module ${isEdit ? "updated" : "created"} ✅`, "success");
      closeModal();
      loadTab("modules");
    } catch (err) {
      console.error(err); showToast("Error saving module.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save"; }
  });
}

// ════════════════════════════════════════════
// FORMULARIO LECCIÓN (metadatos)
// El contenido se edita con el botón "Content" → openLessonEditor en lesson.js
// ════════════════════════════════════════════

function openLessonForm(moduleId, lesson = null) {
  const isEdit = !!lesson;
  openModal(`
    <div class="form-modal">
      <h2>${isEdit ? "✏️ Edit Lesson" : "➕ New Lesson"}</h2>

      <div class="form-group">
        <label class="form-label">Title <span>*</span></label>
        <input id="les-title" class="form-input" type="text"
          value="${escapeHTML(lesson?.title || "")}" placeholder="e.g. Hello, World!">
      </div>

      <div class="form-group">
        <label class="form-label">Order</label>
        <input id="les-order" class="form-input" type="number" value="${lesson?.order || ""}">
      </div>

      <div class="form-group">
        <label class="form-label">Level tag</label>
        <input id="les-level" class="form-input" type="text"
          value="${escapeHTML(lesson?.level || "")}" placeholder="A1">
      </div>

      <div class="form-group">
        <label class="form-label">XP Reward</label>
        <input id="les-xp" class="form-input" type="number"
          value="${lesson?.xpReward || 15}" min="5" max="100">
      </div>

      <div class="form-group">
        <label class="form-label">Objectives <span style="font-weight:400;color:var(--text-muted);">(one per line)</span></label>
        <textarea id="les-obj" class="form-textarea" rows="3"
          placeholder="Students will be able to introduce themselves&#10;Students will learn greetings">${escapeHTML(lesson?.objectives || "")}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Content type</label>
        <select id="les-ctype" class="form-select">
          <option value="editor" ${(lesson?.contentType !== "html" && lesson?.contentType !== "url") ? "selected" : ""}>
            ✏️ Write with editor
          </option>
          <option value="html" ${lesson?.contentType === "html" ? "selected" : ""}>
            📄 HTML file (in /lessons/ folder)
          </option>
          <option value="url" ${lesson?.contentType === "url" ? "selected" : ""}>
            🔗 External URL (Google Sites, Canva, etc.)
          </option>
        </select>
        <div class="form-hint">You can change and set the actual content after saving, using the "Content" button.</div>
      </div>

      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-les">💾 Save</button>
      </div>
    </div>
  `);

  document.getElementById("btn-save-les").addEventListener("click", async () => {
    const title = document.getElementById("les-title").value.trim();
    if (!title) { showToast("Title is required.", "warning"); return; }

    const btn = document.getElementById("btn-save-les");
    btn.disabled = true; btn.textContent = "Saving...";

    const data = {
      title,
      order:       parseInt(document.getElementById("les-order").value) || 0,
      level:       document.getElementById("les-level").value.trim(),
      xpReward:    parseInt(document.getElementById("les-xp").value) || 15,
      objectives:  document.getElementById("les-obj").value.trim(),
      contentType: document.getElementById("les-ctype").value
    };

    try {
      if (isEdit) await updateLesson(moduleId, lesson.id, data);
      else        await createLesson(moduleId, data);
      showToast(`Lesson ${isEdit ? "updated" : "created"} ✅`, "success");
      closeModal();
      const panel = document.getElementById(`lessons-${moduleId}`);
      if (panel) renderLessonsPanel(moduleId, panel);
    } catch (err) {
      console.error(err); showToast("Error saving lesson.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save"; }
  });
}

// ════════════════════════════════════════════
// TAB: ESTUDIANTES
// ════════════════════════════════════════════

async function renderStudentsTab(container) {
  const [users, allProgress] = await Promise.all([getAllUsers(), getAllProgress()]);
  const students = users.filter(u => u.role !== "admin");
  const progMap  = Object.fromEntries(allProgress.map(p => [p.id, p]));

  container.innerHTML = `
    <div class="tab-students">
      <div class="tab-header">
        <h2>Students (${students.length})</h2>
      </div>
      <div class="students-table-wrap">
        <table class="students-table">
          <thead>
            <tr>
              <th>Student</th><th>Status</th><th>XP</th>
              <th>Lessons</th><th>Streak</th><th>Last Active</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(s => {
              const prog = progMap[s.id] || {};
              return `
                <tr>
                  <td>
                    <div class="student-cell">
                      ${s.photoURL
                        ? `<img src="${s.photoURL}" class="student-avatar" alt="">`
                        : `<div class="student-avatar-placeholder">${(s.displayName||"?")[0]}</div>`}
                      <div>
                        <div class="student-name">${escapeHTML(s.displayName || "Unknown")}</div>
                        <div class="student-email">${escapeHTML(s.email || "")}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="tag tag--${s.status === "active" ? "green" : s.status === "pending" ? "orange" : "red"}">
                      ${s.status || "pending"}
                    </span>
                  </td>
                  <td>${prog.xp || 0}</td>
                  <td>${(prog.completedLessons || []).length}</td>
                  <td>${prog.streak || 0} 🔥</td>
                  <td>${formatDate(s.lastActive)}</td>
                  <td>
                    <div class="student-actions">
                      ${s.status === "pending"
                        ? `<button class="btn btn--success btn--xs sa-approve" data-uid="${s.id}">✅ Approve</button>`
                        : ""}
                      ${s.status === "active"
                        ? `<button class="btn btn--danger btn--xs sa-block" data-uid="${s.id}">🚫 Block</button>`
                        : ""}
                      ${s.status === "blocked"
                        ? `<button class="btn btn--outline btn--xs sa-approve" data-uid="${s.id}">♻️ Unblock</button>`
                        : ""}
                      <button class="btn btn--ghost btn--xs sa-badge"
                        data-uid="${s.id}"
                        data-name="${escapeHTML(s.displayName || "Student")}">🏅 Badge</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.querySelectorAll(".sa-approve").forEach(b => {
    b.addEventListener("click", async () => {
      await approveUser(b.dataset.uid);
      showToast("Student approved ✅", "success");
      renderStudentsTab(container);
    });
  });

  container.querySelectorAll(".sa-block").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirmAction("Block this student?")) return;
      await blockUser(b.dataset.uid);
      showToast("Student blocked.", "info");
      renderStudentsTab(container);
    });
  });

  container.querySelectorAll(".sa-badge").forEach(b => {
    b.addEventListener("click", () => openManualBadgeModal(b.dataset.uid, b.dataset.name));
  });
}

// ════════════════════════════════════════════
// TAB: MISIONES
// ════════════════════════════════════════════

async function renderMissionsTab(container) {
  const [missions, users] = await Promise.all([getMissions(), getAllUsers()]);
  const students = users.filter(u => u.role !== "admin" && u.status === "active");

  container.innerHTML = `
    <div class="tab-missions">
      <div class="tab-header">
        <h2>Missions</h2>
        <button class="btn btn--primary btn--sm" id="btn-new-mission">➕ New Mission</button>
      </div>
      <div class="missions-list">
        ${missions.length === 0 ? `<p class="text-secondary">No missions yet.</p>` : ""}
        ${missions.map(m => `
          <div class="mission-admin-card">
            <div class="mission-admin-header">
              <div>
                <strong>${escapeHTML(m.title)}</strong>
                ${m.deadline ? `<span class="text-secondary"> · Due ${formatDate(m.deadline)}</span>` : ""}
              </div>
              <div>
                <button class="btn btn--ghost btn--xs m-edit" data-mid="${m.id}">✏️</button>
                <button class="btn btn--danger btn--xs m-delete" data-mid="${m.id}">🗑️</button>
              </div>
            </div>
            <p class="mission-admin-desc">${escapeHTML(m.description || "")}</p>
            <div class="mission-admin-assigned">
              Assigned to: ${m.assignedTo?.length
                ? m.assignedTo.map(uid => {
                    const u = students.find(s => s.id === uid);
                    return u ? escapeHTML(u.displayName || u.email) : uid;
                  }).join(", ")
                : "nobody"}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  container.querySelector("#btn-new-mission")
    .addEventListener("click", () => openMissionForm(null, students));

  container.querySelectorAll(".m-edit").forEach(b => {
    b.addEventListener("click", () => {
      const m = missions.find(x => x.id === b.dataset.mid);
      openMissionForm(m, students);
    });
  });

  container.querySelectorAll(".m-delete").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirmAction("Delete this mission?")) return;
      await deleteMission(b.dataset.mid);
      showToast("Mission deleted.", "info");
      renderMissionsTab(container);
    });
  });
}

function openMissionForm(mission = null, students = []) {
  const isEdit   = !!mission;
  const assigned = mission?.assignedTo || [];

  openModal(`
    <div class="form-modal">
      <h2>${isEdit ? "✏️ Edit Mission" : "🎯 New Mission"}</h2>
      <div class="form-group">
        <label class="form-label">Title <span>*</span></label>
        <input id="mis-title" class="form-input" type="text"
          value="${escapeHTML(mission?.title || "")}" placeholder="e.g. Describe your family">
      </div>
      <div class="form-group">
        <label class="form-label">Instructions</label>
        <textarea id="mis-desc" class="form-textarea" rows="3"
          placeholder="What should the student do?">${escapeHTML(mission?.description || "")}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Deadline (optional)</label>
        <input id="mis-deadline" class="form-input" type="date" value="${mission?.deadlineStr || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">XP Reward</label>
        <input id="mis-xp" class="form-input" type="number" value="${mission?.xp || 20}" min="5" max="100">
      </div>
      <div class="form-group">
        <label class="form-label">Assign to students</label>
        <div class="student-checkboxes">
          ${students.map(s => `
            <label class="checkbox-label">
              <input type="checkbox" value="${s.id}" ${assigned.includes(s.id) ? "checked" : ""}>
              ${escapeHTML(s.displayName || s.email)}
            </label>
          `).join("")}
        </div>
      </div>
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-mission">💾 Save</button>
      </div>
    </div>
  `);

  document.getElementById("btn-save-mission").addEventListener("click", async () => {
    const title = document.getElementById("mis-title").value.trim();
    if (!title) { showToast("Title is required.", "warning"); return; }

    const assignedTo = [...document.querySelectorAll(".student-checkboxes input:checked")]
      .map(c => c.value);

    const btn = document.getElementById("btn-save-mission");
    btn.disabled = true; btn.textContent = "Saving...";

    const data = {
      title,
      description: document.getElementById("mis-desc").value.trim(),
      deadlineStr: document.getElementById("mis-deadline").value || "",
      xp:          parseInt(document.getElementById("mis-xp").value) || 20,
      assignedTo
    };

    try {
      if (isEdit) await updateMission(mission.id, data);
      else        await createMission(data);
      showToast(`Mission ${isEdit ? "updated" : "created"} ✅`, "success");
      closeModal();
      loadTab("missions");
    } catch (err) {
      console.error(err); showToast("Error saving mission.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save"; }
  });
}

// ════════════════════════════════════════════
// TAB: REVISAR ENTREGAS
// ════════════════════════════════════════════

async function renderSubmissionsTab(container) {
  const [submissions, users, missions] = await Promise.all([
    getPendingSubmissions(), getAllUsers(), getMissions()
  ]);

  const usersMap   = Object.fromEntries(users.map(u => [u.id, u]));
  const missionMap = Object.fromEntries(missions.map(m => [m.id, m]));

  container.innerHTML = `
    <div class="tab-submissions">
      <div class="tab-header">
        <h2>Pending Reviews (${submissions.length})</h2>
      </div>
      ${submissions.length === 0
        ? `<div class="empty-state">🎉 All caught up! No pending reviews.</div>`
        : ""}
      <div class="submissions-list">
        ${submissions.map(s => {
          const student = usersMap[s.uid];
          const mission = missionMap[s.missionId];
          return `
            <div class="submission-card" data-sid="${s.id}">
              <div class="submission-header">
                <div>
                  <strong>${escapeHTML(student?.displayName || "Unknown")}</strong>
                  <span class="text-secondary"> · ${escapeHTML(mission?.title || "Unknown mission")}</span>
                </div>
                <span class="text-secondary">${formatDate(s.submittedAt)}</span>
              </div>
              <div class="submission-body">${escapeHTML(s.content || "")}</div>
              <div class="submission-actions">
                <div class="form-row">
                  <label>Grade (0–100)</label>
                  <input type="number" class="grade-input form-input" min="0" max="100" value="80" style="width:80px">
                  <input type="text" class="feedback-input form-input" placeholder="Feedback for student..." style="flex:1">
                  <button class="btn btn--primary btn--sm sub-approve" data-sid="${s.id}">✅ Approve</button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  container.querySelectorAll(".sub-approve").forEach(btn => {
    btn.addEventListener("click", async () => {
      const card     = btn.closest(".submission-card");
      const grade    = parseInt(card.querySelector(".grade-input").value) || 0;
      const feedback = card.querySelector(".feedback-input").value.trim();

      btn.disabled = true; btn.textContent = "Saving...";
      try {
        await reviewSubmission(btn.dataset.sid, grade, feedback);
        showToast("Submission reviewed ✅", "success");
        renderSubmissionsTab(container);
      } catch (err) {
        console.error(err); showToast("Error.", "error");
        btn.disabled = false; btn.textContent = "✅ Approve";
      }
    });
  });
}

// ════════════════════════════════════════════
// TAB: INSIGNIAS
// ════════════════════════════════════════════

async function renderBadgesTab(container) {
  const [users, allProgress] = await Promise.all([getAllUsers(), getAllProgress()]);
  const students = users.filter(u => u.role !== "admin" && u.status === "active");
  const progMap  = Object.fromEntries(allProgress.map(p => [p.id, p]));

  container.innerHTML = `
    <div class="tab-badges">
      <div class="tab-header"><h2>Badge Overview</h2></div>
      <table class="badges-overview-table">
        <thead>
          <tr><th>Student</th><th>Badges Earned</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${students.map(s => {
            const prog   = progMap[s.id] || {};
            const earned = prog.badges || [];
            const previews = SYSTEM_BADGES
              .filter(b => earned.includes(b.id)).slice(0, 6)
              .map(b => `<span title="${b.name}">${b.emoji}</span>`).join("");
            return `
              <tr>
                <td>${escapeHTML(s.displayName || s.email)}</td>
                <td>${previews || "—"} <span class="text-secondary">(${earned.length})</span></td>
                <td>
                  <button class="btn btn--ghost btn--xs"
                    onclick="openManualBadgeModal('${s.id}','${escapeHTML(s.displayName || "Student")}')">
                    🏅 Manage
                  </button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function openManualBadgeModal(uid, name) {
  const progress = await getProgress(uid);
  const earned   = new Set(progress.badges || []);

  openModal(`
    <div class="form-modal">
      <h2>🏅 Badges — ${escapeHTML(name)}</h2>
      <div class="badge-toggle-grid">
        ${SYSTEM_BADGES.map(b => `
          <label class="badge-toggle-item ${earned.has(b.id) ? "earned" : ""}">
            <input type="checkbox" value="${b.id}" ${earned.has(b.id) ? "checked" : ""}>
            <span class="badge-toggle-emoji">${b.emoji}</span>
            <span class="badge-toggle-name">${b.name}</span>
          </label>
        `).join("")}
      </div>
      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-badges">💾 Save</button>
      </div>
    </div>
  `);

  document.getElementById("btn-save-badges").addEventListener("click", async () => {
    const checked   = [...document.querySelectorAll(".badge-toggle-item input:checked")].map(i => i.value);
    const unchecked = SYSTEM_BADGES.map(b => b.id).filter(id => !checked.includes(id));

    const btn = document.getElementById("btn-save-badges");
    btn.disabled = true; btn.textContent = "Saving...";

    try {
      const { revokeBadge } = await import("./db.js");
      await Promise.all([
        ...checked.map(id => !earned.has(id) ? awardBadge(uid, id) : Promise.resolve()),
        ...unchecked.map(id => earned.has(id) ? revokeBadge(uid, id) : Promise.resolve())
      ]);
      showToast("Badges updated ✅", "success");
      closeModal();
    } catch (err) {
      console.error(err); showToast("Error.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save"; }
  });
}

window.openManualBadgeModal = openManualBadgeModal;

// ════════════════════════════════════════════
// TAB: CONFIGURACIÓN
// ════════════════════════════════════════════

async function renderSettingsTab(container) {
  const config = await getAppConfig();

  container.innerHTML = `
    <div class="tab-settings">
      <div class="tab-header"><h2>Settings</h2></div>
      <div class="settings-section">
        <h3>Platform</h3>
        <div class="form-group">
          <label class="form-label">Platform Name</label>
          <input id="cfg-name" class="form-input" type="text"
            value="${escapeHTML(config.platformName || "English Up!")}">
        </div>
        <div class="form-group">
          <label class="form-label">Welcome Message</label>
          <input id="cfg-welcome" class="form-input" type="text"
            value="${escapeHTML(config.welcomeMessage || "")}">
        </div>
      </div>
      <div class="settings-section">
        <h3>Lessons folder base URL</h3>
        <p class="form-hint">
          Your static HTML lessons should be in the <code>/lessons/</code> folder of your
          Cloudflare Pages project. The base URL is automatically
          <code>${window.location.origin}/lessons/</code>
        </p>
      </div>
      <div class="settings-section">
        <h3>AI Assistant</h3>
        <div class="form-group">
          <label class="form-label">Default language</label>
          <select id="cfg-ai-lang" class="form-select">
            <option value="en" ${config.aiLanguage !== "es" ? "selected" : ""}>English (simple A1–A2)</option>
            <option value="es" ${config.aiLanguage === "es" ? "selected" : ""}>Español</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-save-config">💾 Save Settings</button>
    </div>
  `;

  document.getElementById("btn-save-config").addEventListener("click", async () => {
    const btn = document.getElementById("btn-save-config");
    btn.disabled = true; btn.textContent = "Saving...";
    try {
      await saveAppConfig({
        platformName:   document.getElementById("cfg-name").value.trim(),
        welcomeMessage: document.getElementById("cfg-welcome").value.trim(),
        aiLanguage:     document.getElementById("cfg-ai-lang").value
      });
      showToast("Settings saved ✅", "success");
    } catch (err) {
      console.error(err); showToast("Error saving.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save Settings"; }
  });
}

// ════════════════════════════════════════════
// ESTILOS
// ════════════════════════════════════════════

function injectTeacherStyles() {
  if (document.getElementById("teacher-extra-styles")) return;
  const s = document.createElement("style");
  s.id = "teacher-extra-styles";
  s.textContent = `
    .teacher-stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-bottom:1.5rem}
    .stat-card{background:var(--bg-card);border-radius:14px;padding:1.25rem;text-align:center;border-top:4px solid var(--accent)}
    .stat-value{font-size:2rem;font-weight:800;color:var(--accent)}
    .stat-label{font-size:.8rem;color:var(--text-secondary);margin-top:.25rem}
    .teacher-alert{display:flex;align-items:center;justify-content:space-between;background:var(--bg-secondary);border-left:4px solid var(--accent-green);border-radius:10px;padding:1rem;margin-bottom:1rem}
    .teacher-alert--warn{border-color:var(--accent-orange)}
    .quick-actions-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.75rem}
    .quick-action-btn{background:var(--bg-card);border:2px solid var(--border);border-radius:12px;padding:1rem;cursor:pointer;font-size:.9rem;font-weight:600;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:.5rem;color:var(--text-primary)}
    .quick-action-btn:hover{border-color:var(--accent-green);transform:translateY(-2px)}
    .quick-action-btn span{font-size:1.5rem}
    .teacher-tabs{display:flex;gap:.5rem;flex-wrap:wrap;border-bottom:2px solid var(--border);margin-bottom:1.5rem}
    .teacher-tab{background:none;border:none;padding:.75rem 1rem;cursor:pointer;font-weight:600;color:var(--text-secondary);border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .15s}
    .teacher-tab.active{color:var(--accent-green);border-bottom-color:var(--accent-green)}
    .tab-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}
    .tab-header h2{font-size:1.25rem;font-weight:700}
    .module-admin-card{background:var(--bg-card);border-radius:14px;margin-bottom:.75rem;overflow:hidden}
    .module-admin-card-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;flex-wrap:wrap;gap:.5rem}
    .module-admin-actions{display:flex;gap:.5rem;flex-wrap:wrap}
    .module-admin-desc{padding:0 1.25rem .75rem;color:var(--text-secondary);font-size:.85rem}
    .module-order{color:var(--text-secondary);margin-right:.5rem}
    .lessons-panel{padding:0 1rem 1rem;border-top:1px solid var(--border)}
    .lessons-panel-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 0}
    .lesson-admin-row{display:flex;align-items:center;gap:.75rem;padding:.5rem 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
    .lesson-admin-title{flex:1;font-weight:600}
    .lesson-admin-actions{display:flex;gap:.4rem;flex-wrap:wrap}
    .lesson-order{color:var(--text-secondary);font-size:.85rem;min-width:28px}
    .students-table{width:100%;border-collapse:collapse}
    .students-table th{text-align:left;padding:.75rem;border-bottom:2px solid var(--border);font-size:.85rem;color:var(--text-secondary)}
    .students-table td{padding:.75rem;border-bottom:1px solid var(--border);vertical-align:middle}
    .student-cell{display:flex;align-items:center;gap:.75rem}
    .student-avatar{width:36px;height:36px;border-radius:50%}
    .student-avatar-placeholder{width:36px;height:36px;border-radius:50%;background:var(--accent-green);color:white;display:flex;align-items:center;justify-content:center;font-weight:700}
    .student-name{font-weight:600}
    .student-email{font-size:.78rem;color:var(--text-secondary)}
    .student-actions{display:flex;gap:.4rem;flex-wrap:wrap}
    .mission-admin-card{background:var(--bg-card);border-radius:14px;padding:1rem 1.25rem;margin-bottom:.75rem}
    .mission-admin-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem}
    .mission-admin-assigned{font-size:.8rem;color:var(--text-secondary);margin-top:.5rem}
    .submission-card{background:var(--bg-card);border-radius:14px;padding:1rem 1.25rem;margin-bottom:1rem}
    .submission-header{display:flex;justify-content:space-between;margin-bottom:.5rem}
    .submission-body{background:var(--bg-secondary);border-radius:8px;padding:.75rem;margin:.75rem 0;font-size:.9rem;white-space:pre-wrap}
    .submission-actions .form-row{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
    .student-checkboxes{display:flex;flex-direction:column;gap:.5rem;max-height:180px;overflow-y:auto;padding:.5rem;border:1px solid var(--border);border-radius:8px}
    .checkbox-label{display:flex;align-items:center;gap:.5rem;cursor:pointer}
    .badge-toggle-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.75rem}
    .badge-toggle-item{display:flex;flex-direction:column;align-items:center;gap:.25rem;padding:.75rem;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .15s}
    .badge-toggle-item.earned{border-color:var(--accent-yellow)}
    .badge-toggle-item input{position:absolute;opacity:0;pointer-events:none}
    .badge-toggle-emoji{font-size:1.75rem}
    .badge-toggle-name{font-size:.75rem;font-weight:600;text-align:center}
    .settings-section{background:var(--bg-card);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem}
    .settings-section h3{font-size:1rem;font-weight:700;margin-bottom:1rem}
    .tag{display:inline-block;padding:2px 8px;border-radius:20px;font-size:.75rem;font-weight:600;background:var(--bg-secondary)}
    .tag--green {background:#58CC0220;color:#58CC02}
    .tag--gray  {background:var(--bg-secondary);color:var(--text-secondary)}
    .tag--orange{background:#FF960020;color:#FF9600}
    .tag--red   {background:#FF4B4B20;color:#FF4B4B}
    .tag--blue  {background:#1CB0F620;color:#1CB0F6}
    .tag--purple{background:#CE82FF20;color:#CE82FF}
    .btn--danger {background:#FF4B4B;color:white}
    .btn--success{background:#58CC02;color:white}
    .btn--outline{background:transparent;border:2px solid var(--border);color:var(--text-primary)}
    .btn--xs{padding:3px 8px;font-size:.75rem;border-radius:6px}
    .empty-state{text-align:center;padding:3rem;color:var(--text-secondary);font-size:1.1rem}
    .hidden{display:none!important}
    .badges-overview-table{width:100%;border-collapse:collapse}
    .badges-overview-table th,.badges-overview-table td{padding:.75rem;border-bottom:1px solid var(--border);text-align:left}
    /* Lesson external card */
    .lesson-external-card{display:flex;align-items:center;gap:1.5rem;padding:2rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-xl);margin-bottom:var(--space-xl);box-shadow:var(--shadow-sm)}
    .lesson-external-icon{font-size:3rem}
    .lesson-external-body{flex:1}
    .lesson-external-label{font-size:.78rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:.25rem}
    .lesson-external-title{font-size:1.1rem;font-weight:800;color:var(--text-primary);margin-bottom:.25rem}
    .lesson-external-url{font-size:.78rem;color:var(--accent-blue);word-break:break-all}
  `;
  document.head.appendChild(s);
}
