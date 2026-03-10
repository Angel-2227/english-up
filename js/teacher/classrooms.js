// =============================================
// ENGLISH UP! — js/teacher/classrooms.js
// Tab de Salones en el panel del profesor
// =============================================

import { State, showToast, openModal, closeModal, escapeHTML } from "../app.js";
import {
  getAllClassrooms, createClassroom, updateClassroom, deleteClassroom,
  addStudentToClassroom, removeStudentFromClassroom, getClassroomMembers,
  watchClassrooms
} from "../classrooms.js";
import { getActiveStudents } from "../db.js";
import { emojiToDataURL } from "../auth.js";

const CLASSROOM_EMOJIS = ["🏫","🎓","📚","🌟","🎯","🦁","🦊","🐸","🌈","🚀","⚡","🏆","🎸","🎨","🌻"];

let _unsubClassrooms = null;

// ════════════════════════════════════════════
// RENDER TAB
// ════════════════════════════════════════════

export function renderClassroomsTab(container) {
  container.innerHTML = `
    <div class="classrooms-tab">
      <div class="classrooms-toolbar">
        <h3>🏫 Classrooms</h3>
        <button class="btn btn-primary btn-sm" id="btn-new-classroom">+ New Classroom</button>
      </div>
      <div id="classrooms-list-wrap">
        <div style="color:var(--color-text-faint);padding:var(--sp-6) 0;text-align:center">Loading…</div>
      </div>
    </div>
  `;

  container.querySelector("#btn-new-classroom")?.addEventListener("click", () => {
    openCreateClassroomModal(container);
  });

  // Real-time listener
  if (_unsubClassrooms) _unsubClassrooms();
  _unsubClassrooms = watchClassrooms(classrooms => {
    renderClassroomsList(container.querySelector("#classrooms-list-wrap"), classrooms);
  });
}

// ════════════════════════════════════════════
// LIST
// ════════════════════════════════════════════

function renderClassroomsList(wrap, classrooms) {
  if (!wrap) return;

  if (classrooms.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:var(--sp-10) 0">
        <div class="empty-state-icon">🏫</div>
        <h3>No classrooms yet</h3>
        <p>Create your first classroom to organize your students.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="classrooms-grid">
      ${classrooms.map(c => buildClassroomCard(c)).join("")}
    </div>
  `;

  wrap.querySelectorAll("[data-classroom-id]").forEach(card => {
    const id = card.dataset.classroomId;
    card.querySelector(".btn-classroom-manage")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openManageClassroomModal(id);
    });
    card.querySelector(".btn-classroom-edit")?.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditClassroomModal(id, classrooms.find(c => c.id === id));
    });
    card.querySelector(".btn-classroom-delete")?.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmDeleteClassroom(id, classrooms.find(c => c.id === id)?.name);
    });
  });
}

function buildClassroomCard(classroom) {
  const count = (classroom.members ?? []).length;
  return `
    <div class="classroom-card" data-classroom-id="${escapeHTML(classroom.id)}">
      <div class="classroom-card-header">
        <div class="classroom-card-emoji">${escapeHTML(classroom.emoji || "🏫")}</div>
        <div>
          <div class="classroom-card-title">${escapeHTML(classroom.name)}</div>
          <div class="classroom-card-count">👥 ${count} student${count !== 1 ? "s" : ""}</div>
        </div>
      </div>
      ${classroom.description ? `<div class="classroom-card-desc">${escapeHTML(classroom.description)}</div>` : ""}
      <div class="classroom-card-footer">
        <button class="btn btn-primary btn-sm btn-classroom-manage">👥 Manage Students</button>
        <div class="classroom-card-actions">
          <button class="btn btn-ghost btn-sm btn-classroom-edit" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm btn-classroom-delete" title="Delete" style="color:#ef4444">🗑️</button>
        </div>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════
// CREATE CLASSROOM MODAL
// ════════════════════════════════════════════

function openCreateClassroomModal(container) {
  let selectedEmoji = "🏫";

  openModal(`
    <div class="modal-header">
      <h3>🏫 New Classroom</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="classroom-form">
        <div>
          <label>Name *</label>
          <input type="text" id="cr-name" class="form-input" placeholder="e.g. Morning Group A" maxlength="40" />
        </div>
        <div>
          <label>Description</label>
          <input type="text" id="cr-desc" class="form-input" placeholder="Optional description…" maxlength="80" />
        </div>
        <div>
          <label>Icon</label>
          <div class="classroom-emoji-picker" id="cr-emoji-picker">
            ${CLASSROOM_EMOJIS.map(e => `
              <button class="classroom-emoji-opt ${e === selectedEmoji ? "selected" : ""}"
                      data-emoji="${e}">${e}</button>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-create-cr">Create</button>
    </div>
  `);

  // Emoji picker
  document.getElementById("cr-emoji-picker")?.addEventListener("click", e => {
    const btn = e.target.closest(".classroom-emoji-opt");
    if (!btn) return;
    selectedEmoji = btn.dataset.emoji;
    document.querySelectorAll(".classroom-emoji-opt").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });

  document.getElementById("btn-create-cr")?.addEventListener("click", async () => {
    const name = (document.getElementById("cr-name")?.value ?? "").trim();
    const desc = (document.getElementById("cr-desc")?.value ?? "").trim();
    if (!name) { showToast("Name is required.", "warning"); return; }

    const btn = document.getElementById("btn-create-cr");
    btn.disabled = true; btn.textContent = "Creating…";

    try {
      await createClassroom({ name, description: desc, emoji: selectedEmoji });
      closeModal();
      showToast("Classroom created! 🎉", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not create classroom.", "error");
      btn.disabled = false; btn.textContent = "Create";
    }
  });
}

// ════════════════════════════════════════════
// EDIT CLASSROOM MODAL
// ════════════════════════════════════════════

function openEditClassroomModal(classroomId, classroom) {
  if (!classroom) return;
  let selectedEmoji = classroom.emoji || "🏫";

  openModal(`
    <div class="modal-header">
      <h3>✏️ Edit Classroom</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="classroom-form">
        <div>
          <label>Name *</label>
          <input type="text" id="cr-edit-name" class="form-input"
                 value="${escapeHTML(classroom.name)}" maxlength="40" />
        </div>
        <div>
          <label>Description</label>
          <input type="text" id="cr-edit-desc" class="form-input"
                 value="${escapeHTML(classroom.description || "")}" maxlength="80" />
        </div>
        <div>
          <label>Icon</label>
          <div class="classroom-emoji-picker" id="cr-edit-emoji-picker">
            ${CLASSROOM_EMOJIS.map(e => `
              <button class="classroom-emoji-opt ${e === selectedEmoji ? "selected" : ""}"
                      data-emoji="${e}">${e}</button>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-cr-edit">Save Changes</button>
    </div>
  `);

  document.getElementById("cr-edit-emoji-picker")?.addEventListener("click", e => {
    const btn = e.target.closest(".classroom-emoji-opt");
    if (!btn) return;
    selectedEmoji = btn.dataset.emoji;
    document.querySelectorAll(".classroom-emoji-opt").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  });

  document.getElementById("btn-save-cr-edit")?.addEventListener("click", async () => {
    const name = (document.getElementById("cr-edit-name")?.value ?? "").trim();
    const desc = (document.getElementById("cr-edit-desc")?.value ?? "").trim();
    if (!name) { showToast("Name is required.", "warning"); return; }

    const btn = document.getElementById("btn-save-cr-edit");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
      await updateClassroom(classroomId, { name, description: desc, emoji: selectedEmoji });
      closeModal();
      showToast("Classroom updated!", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not update classroom.", "error");
      btn.disabled = false; btn.textContent = "Save Changes";
    }
  });
}

// ════════════════════════════════════════════
// DELETE CLASSROOM
// ════════════════════════════════════════════

function confirmDeleteClassroom(classroomId, name) {
  openModal(`
    <div class="modal-header">
      <h3>🗑️ Delete Classroom</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete <strong>${escapeHTML(name)}</strong>?</p>
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:var(--sp-2)">
        Students will be unassigned but their progress won't be deleted.
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-delete-cr">Yes, Delete</button>
    </div>
  `);

  document.getElementById("btn-confirm-delete-cr")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-confirm-delete-cr");
    btn.disabled = true; btn.textContent = "Deleting…";
    try {
      await deleteClassroom(classroomId);
      closeModal();
      showToast("Classroom deleted.", "info");
    } catch (err) {
      console.error(err);
      showToast("Could not delete classroom.", "error");
      btn.disabled = false; btn.textContent = "Yes, Delete";
    }
  });
}

// ════════════════════════════════════════════
// MANAGE STUDENTS MODAL
// ════════════════════════════════════════════

async function openManageClassroomModal(classroomId) {
  openModal(`
    <div class="modal-header">
      <h3>👥 Manage Students</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="manage-cr-body">
      <div style="color:var(--color-text-faint);padding:var(--sp-4) 0;text-align:center">Loading…</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `);

  try {
    const [allStudents, currentMembers] = await Promise.all([
      getActiveStudents(),
      getClassroomMembers(classroomId),
    ]);

    const memberIds = new Set(currentMembers.map(m => m.id));

    const body = document.getElementById("manage-cr-body");
    if (!body) return;

    // Filter to real students (not admins)
    const students = allStudents.filter(s => s.role !== "admin");

    if (students.length === 0) {
      body.innerHTML = `<p style="color:var(--color-text-faint);text-align:center">No active students found.</p>`;
      return;
    }

    body.innerHTML = `
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-3)">
        Toggle students to add or remove them from this classroom.
      </p>
      <div class="classroom-members-list" id="students-toggle-list">
        ${students.map(s => {
          const inClass = memberIds.has(s.id);
          const displayName = s.nickname || s.name || "Student";
          return `
            <div class="classroom-member-row" data-uid="${escapeHTML(s.id)}">
              <div class="classroom-member-name">
                ${escapeHTML(s.avatar ? s.avatar : "👤")} ${escapeHTML(displayName)}
                ${s.classroomId && s.classroomId !== classroomId
                  ? `<span style="font-size:var(--text-xs);color:#f59e0b;margin-left:4px">(other class)</span>`
                  : ""}
              </div>
              <span class="classroom-member-xp">⚡ ${(s.xp ?? 0).toLocaleString()} XP</span>
              <button class="btn btn-sm ${inClass ? "btn-danger-outline" : "btn-primary"} btn-toggle-member"
                      data-uid="${escapeHTML(s.id)}"
                      data-in="${inClass ? "1" : "0"}">
                ${inClass ? "Remove" : "Add"}
              </button>
            </div>
          `;
        }).join("")}
      </div>
    `;

    // Toggle handlers
    body.querySelectorAll(".btn-toggle-member").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid  = btn.dataset.uid;
        const isIn = btn.dataset.in === "1";
        btn.disabled = true;
        try {
          if (isIn) {
            await removeStudentFromClassroom(uid);
            btn.dataset.in = "0";
            btn.textContent = "Add";
            btn.className = "btn btn-sm btn-primary btn-toggle-member";
          } else {
            await addStudentToClassroom(classroomId, uid);
            btn.dataset.in = "1";
            btn.textContent = "Remove";
            btn.className = "btn btn-sm btn-danger-outline btn-toggle-member";
          }
        } catch (err) {
          console.error(err);
          showToast("Action failed.", "error");
        }
        btn.disabled = false;
      });
    });

  } catch (err) {
    console.error(err);
    const body = document.getElementById("manage-cr-body");
    if (body) body.innerHTML = `<p style="color:#ef4444">Could not load students.</p>`;
  }
}
