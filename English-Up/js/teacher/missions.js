// =============================================
// ENGLISH UP! — js/teacher/missions.js
// Panel teacher: crear, editar, asignar misiones
// =============================================

import { showToast, openModal, closeModal, escapeHTML } from "../app.js";
import {
  getAllMissions, createMission, updateMission, deleteMission,
  getAllUsers, assignMission, unassignMission,
} from "../db.js";

// ════════════════════════════════════════════
// TIPOS DE MISIÓN
// ════════════════════════════════════════════

const MISSION_TYPES = [
  { value: "quiz",       label: "🧠 Quiz",        desc: "Multiple choice questions" },
  { value: "gapfill",    label: "✏️ Gap Fill",     desc: "Complete sentences with missing words" },
  { value: "matching",   label: "🔗 Matching",     desc: "Match columns A and B" },
  { value: "unscramble", label: "🔀 Unscramble",   desc: "Put words in the right order" },
  { value: "link",       label: "🌐 Link",         desc: "External game or activity (URL)" },
];

const MISSION_EMOJIS = ["🎯","🧠","🔥","⭐","🏆","🎮","🌍","✏️","🔗","🎵","🧩","🚀","💡","🦊","🎲"];

// ════════════════════════════════════════════
// RENDER TAB
// ════════════════════════════════════════════

export async function renderMissionsTeacherTab(container) {
  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Missions</span>
      <button class="btn btn-primary btn-sm" id="btn-new-mission">＋ New Mission</button>
    </div>
    <div id="missions-teacher-list" class="modules-list">
      <div class="path-skeleton">
        ${[1,2].map(() => `<div class="skeleton-node"></div>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-new-mission")
    ?.addEventListener("click", () => openMissionModal(null, container));

  await loadMissions(container);
}

// ════════════════════════════════════════════
// LOAD MISSIONS
// ════════════════════════════════════════════

async function loadMissions(container) {
  const listEl = document.getElementById("missions-teacher-list");
  if (!listEl) return;

  try {
    const missions = await getAllMissions();

    if (missions.length === 0) {
      listEl.innerHTML = `
        <div class="lessons-empty">
          No missions yet. Click <strong>＋ New Mission</strong> to create one.
        </div>`;
      return;
    }

    listEl.innerHTML = missions.map(m => buildTeacherMissionCard(m)).join("");

    missions.forEach(m => bindMissionCardActions(m, container));

  } catch (err) {
    console.error("[MissionsTeacher]", err);
    listEl.innerHTML = `<p style="color:var(--color-danger);padding:var(--sp-4)">Could not load missions.</p>`;
  }
}

// ════════════════════════════════════════════
// TEACHER CARD HTML
// ════════════════════════════════════════════

function buildTeacherMissionCard(m) {
  const typeInfo  = MISSION_TYPES.find(t => t.value === m.type) ?? MISSION_TYPES[0];
  const qCount    = m.questions?.length ?? 0;
  const assigned  = m.assignedTo?.length ?? 0;

  return `
    <div class="mission-teacher-card" id="mtc-${m.id}">
      <div class="mtc-top">
        <div class="mtc-emoji">${m.emoji || "🎯"}</div>
        <div class="mtc-info">
          <div class="mtc-title">${escapeHTML(m.title)}</div>
          <div class="mtc-meta">
            <span>${typeInfo.label}</span>
            ${qCount > 0 ? `<span>${qCount} question${qCount !== 1 ? "s" : ""}</span>` : ""}
            ${m.xpReward ? `<span>⚡ ${m.xpReward} XP</span>` : ""}
            ${m.timeLimit ? `<span>⏱ ${m.timeLimit}s</span>` : ""}
            <span>👥 ${assigned} assigned</span>
          </div>
        </div>
      </div>
      <div class="mtc-actions">
        <button class="btn btn-ghost btn-sm"   data-action="assign" data-id="${m.id}">👥 Assign</button>
        <button class="btn btn-ghost btn-sm"   data-action="edit"   data-id="${m.id}">✏️ Edit</button>
        <button class="btn btn-danger btn-sm"  data-action="delete" data-id="${m.id}">🗑</button>
      </div>
    </div>
  `;
}

function bindMissionCardActions(m, container) {
  const card = document.getElementById(`mtc-${m.id}`);
  card?.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      if (action === "edit")   openMissionModal(m, container);
      if (action === "delete") confirmDelete(m, container);
      if (action === "assign") openAssignModal(m, container);
    });
  });
}

// ════════════════════════════════════════════
// MISSION MODAL (create / edit)
// ════════════════════════════════════════════

function openMissionModal(mission, container) {
  const isEdit = !!mission;
  const type   = mission?.type     || "quiz";
  const title  = mission?.title    || "";
  const desc   = mission?.description || "";
  const emoji  = mission?.emoji    || "🎯";
  const xp     = mission?.xpReward ?? 20;
  const time   = mission?.timeLimit ?? "";
  const maxAtt = mission?.maxAttempts ?? "";
  const linkURL= mission?.linkURL  || "";

  openModal(`
    <div class="modal-header">
      <h3>${isEdit ? "✏️ Edit Mission" : "＋ New Mission"}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="max-height:70dvh;overflow-y:auto">

      <!-- Basic info -->
      <div class="form-group">
        <label class="form-label">Title</label>
        <input id="mis-title" class="form-input" type="text"
               placeholder="e.g. Vocabulary Quiz — Unit 1" value="${escapeHTML(title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input id="mis-desc" class="form-input" type="text"
               placeholder="Short instructions for students" value="${escapeHTML(desc)}" />
      </div>

      <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:120px">
          <label class="form-label">Emoji</label>
          <select id="mis-emoji" class="form-select">
            ${MISSION_EMOJIS.map(e => `<option value="${e}" ${e === emoji ? "selected" : ""}>${e} ${e}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:120px">
          <label class="form-label">⚡ Max XP</label>
          <input id="mis-xp" class="form-input" type="number" min="0" value="${xp}" />
        </div>
        <div class="form-group" style="flex:1;min-width:120px">
          <label class="form-label">⏱ Time limit (sec)</label>
          <input id="mis-time" class="form-input" type="number" min="0"
                 value="${time}" placeholder="blank = no limit" />
        </div>
        <div class="form-group" style="flex:1;min-width:120px">
          <label class="form-label">Max attempts</label>
          <input id="mis-attempts" class="form-input" type="number" min="0"
                 value="${maxAtt}" placeholder="blank = unlimited" />
        </div>
      </div>

      <!-- Type selector -->
      <div class="form-group">
        <label class="form-label">Mission type</label>
        <div class="lesson-type-tabs" id="mis-type-tabs">
          ${MISSION_TYPES.map(t => `
            <button class="ltt-btn ${t.value === type ? "active" : ""}"
                    data-type="${t.value}" title="${t.desc}">
              ${t.label}
            </button>`).join("")}
        </div>
      </div>

      <!-- Link panel -->
      <div class="lesson-type-panel ${type === "link" ? "active" : ""}" id="mtp-link">
        <div class="form-group">
          <label class="form-label">External URL</label>
          <input id="mis-link-url" class="form-input" type="url"
                 placeholder="https://…" value="${escapeHTML(linkURL)}" />
          <span class="form-hint">Any link: Quizlet, Wordwall, Kahoot!, Google Forms, etc.</span>
        </div>
      </div>

      <!-- Questions panel (all interactive types) -->
      <div class="lesson-type-panel ${type !== "link" ? "active" : ""}" id="mtp-questions">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-3)">
          <label class="form-label" style="margin:0">Questions</label>
          <button class="btn btn-secondary btn-sm" id="btn-add-question">＋ Add Question</button>
        </div>
        <div id="questions-builder"></div>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-mission">
        ${isEdit ? "💾 Save" : "＋ Create"}
      </button>
    </div>
  `);

  // --- Type tab switching ---
  let activeType = type;
  document.getElementById("mis-type-tabs")?.querySelectorAll(".ltt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#mis-type-tabs .ltt-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeType = btn.dataset.type;
      document.getElementById("mtp-link").classList.toggle("active", activeType === "link");
      document.getElementById("mtp-questions").classList.toggle("active", activeType !== "link");
      renderQuestionBuilder(activeType, mission?.questions ?? []);
    });
  });

  // Init builder
  renderQuestionBuilder(type, mission?.questions ?? []);

  // Add question button
  document.getElementById("btn-add-question")?.addEventListener("click", () => {
    addQuestion(activeType);
  });

  // --- Save ---
  document.getElementById("btn-save-mission")?.addEventListener("click", async () => {
    const data = collectMissionData(activeType);
    if (!data) return;

    const btn = document.getElementById("btn-save-mission");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
      if (isEdit) {
        await updateMission(mission.id, data);
        showToast("Mission updated ✅", "success");
      } else {
        await createMission(data);
        showToast("Mission created ✅", "success");
      }
      closeModal();
      await renderMissionsTeacherTab(container);
    } catch (err) {
      console.error(err);
      showToast("Could not save mission", "error");
      btn.disabled = false;
      btn.textContent = isEdit ? "💾 Save" : "＋ Create";
    }
  });
}

// ════════════════════════════════════════════
// QUESTION BUILDER
// ════════════════════════════════════════════

function renderQuestionBuilder(type, existingQuestions = []) {
  const builder = document.getElementById("questions-builder");
  if (!builder) return;

  builder.innerHTML = "";

  if (existingQuestions.length === 0) {
    builder.innerHTML = `<p class="form-hint" style="margin-bottom:var(--sp-3)">
      No questions yet. Click <strong>＋ Add Question</strong> to start.
    </p>`;
    return;
  }

  existingQuestions.forEach((q, i) => appendQuestionBlock(type, q, i));
}

function addQuestion(type) {
  const builder = document.getElementById("questions-builder");
  if (!builder) return;
  // Remove empty state msg
  builder.querySelector(".form-hint")?.remove();
  const index = builder.querySelectorAll(".question-builder").length;
  appendQuestionBlock(type, null, index);
}

function appendQuestionBlock(type, q, index) {
  const builder = document.getElementById("questions-builder");
  if (!builder) return;

  const block = document.createElement("div");
  block.className = "question-builder";
  block.dataset.index = index;

  const bodies = {
    quiz:       buildQuizFields(q),
    gapfill:    buildGapfillFields(q),
    matching:   buildMatchingFields(q),
    unscramble: buildUnscrambleFields(q),
  };

  block.innerHTML = `
    <div class="qb-header">
      <span>Question ${index + 1}</span>
      <button class="btn btn-danger btn-sm" onclick="this.closest('.question-builder').remove()">Remove</button>
    </div>
    <div class="qb-body">
      ${bodies[type] ?? ""}
      <div class="form-group">
        <label class="form-label">Explanation (shown after answer)</label>
        <input class="form-input qb-explanation" type="text"
               placeholder="Optional: why is this the answer?"
               value="${escapeHTML(q?.explanation || "")}" />
      </div>
    </div>
  `;

  builder.appendChild(block);
}

// ── Field templates ───────────────────────────────────────────────────────────

function buildQuizFields(q) {
  const opts = q?.options ?? ["", "", "", ""];
  const correct = q?.correctIndex ?? 0;
  return `
    <div class="form-group">
      <label class="form-label">Question</label>
      <input class="form-input qb-prompt" type="text"
             placeholder="e.g. What does 'brave' mean?" value="${escapeHTML(q?.prompt || "")}" />
    </div>
    <label class="form-label">Options (mark the correct one)</label>
    ${opts.map((o, i) => `
      <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2)">
        <input type="radio" name="correct-${Date.now()}-${i}" value="${i}"
               ${correct === i ? "checked" : ""} class="qb-correct-radio"
               style="flex-shrink:0;width:16px;height:16px">
        <input class="form-input qb-option" type="text"
               placeholder="Option ${String.fromCharCode(65+i)}" value="${escapeHTML(o)}" />
      </div>
    `).join("")}
  `;
}

function buildGapfillFields(q) {
  return `
    <div class="form-group">
      <label class="form-label">Sentence (use ___ for each blank)</label>
      <input class="form-input qb-prompt" type="text"
             placeholder="e.g. I ___ to school every day."
             value="${escapeHTML(q?.sentence || q?.prompt || "")}" />
      <span class="form-hint">Use three underscores ___ for each blank.</span>
    </div>
    <div class="form-group">
      <label class="form-label">Correct answers (one per blank, comma-separated)</label>
      <input class="form-input qb-gapfill-answers" type="text"
             placeholder="e.g. go, the, quickly"
             value="${escapeHTML((q?.answers ?? []).join(", "))}" />
    </div>
    <div class="form-group">
      <label class="form-label">Word bank (comma-separated, optional)</label>
      <input class="form-input qb-gapfill-bank" type="text"
             placeholder="e.g. go, went, goes, going"
             value="${escapeHTML((q?.wordBank ?? []).join(", "))}" />
    </div>
  `;
}

function buildMatchingFields(q) {
  const pairs = q?.pairs ?? [{ left: "", right: "" }, { left: "", right: "" }];
  return `
    <div class="form-group">
      <label class="form-label">Prompt (optional)</label>
      <input class="form-input qb-prompt" type="text"
             placeholder="e.g. Match the words with their definitions"
             value="${escapeHTML(q?.prompt || "")}" />
    </div>
    <div style="display:flex;gap:var(--sp-3)">
      <div class="form-group" style="flex:1">
        <label class="form-label">Column A label</label>
        <input class="form-input qb-left-label" type="text"
               placeholder="Words" value="${escapeHTML(q?.leftLabel || "")}" />
      </div>
      <div class="form-group" style="flex:1">
        <label class="form-label">Column B label</label>
        <input class="form-input qb-right-label" type="text"
               placeholder="Definitions" value="${escapeHTML(q?.rightLabel || "")}" />
      </div>
    </div>
    <label class="form-label">Pairs</label>
    <div class="qb-pairs-list">
      ${pairs.map((p, i) => `
        <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-2);align-items:center">
          <input class="form-input qb-pair-left"  type="text"
                 placeholder="A${i+1}" value="${escapeHTML(p.left)}" style="flex:1" />
          <span style="color:var(--color-text-muted);font-size:var(--text-lg)">↔</span>
          <input class="form-input qb-pair-right" type="text"
                 placeholder="B${i+1}" value="${escapeHTML(p.right)}" style="flex:1" />
        </div>
      `).join("")}
    </div>
    <button type="button" class="btn btn-ghost btn-sm qb-add-pair" style="margin-top:var(--sp-1)">
      ＋ Add pair
    </button>
    <script>
      document.querySelector('.qb-add-pair:last-of-type')?.addEventListener('click', function() {
        const list = this.previousElementSibling;
        const div = document.createElement('div');
        div.style = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
        div.innerHTML = '<input class="form-input qb-pair-left" type="text" placeholder="A" style="flex:1"/><span style="color:var(--color-text-muted);font-size:1.25rem">↔</span><input class="form-input qb-pair-right" type="text" placeholder="B" style="flex:1"/>';
        list.appendChild(div);
      });
    <\/script>
  `;
}

function buildUnscrambleFields(q) {
  return `
    <div class="form-group">
      <label class="form-label">Prompt (optional)</label>
      <input class="form-input qb-prompt" type="text"
             placeholder="e.g. Unscramble this sentence:"
             value="${escapeHTML(q?.prompt || "")}" />
    </div>
    <div class="form-group">
      <label class="form-label">Correct sentence</label>
      <input class="form-input qb-sentence" type="text"
             placeholder="e.g. I go to school every day"
             value="${escapeHTML(q?.sentence || "")}" />
      <span class="form-hint">The words will be shuffled automatically for the student.</span>
    </div>
  `;
}

// ════════════════════════════════════════════
// COLLECT DATA FROM MODAL
// ════════════════════════════════════════════

function collectMissionData(type) {
  const title = document.getElementById("mis-title")?.value?.trim();
  if (!title) { showToast("Add a title", "warning"); return null; }

  const xpRaw  = parseInt(document.getElementById("mis-xp")?.value ?? "20");
  const timeRaw= parseInt(document.getElementById("mis-time")?.value ?? "");
  const attRaw = parseInt(document.getElementById("mis-attempts")?.value ?? "");

  const base = {
    title,
    description: document.getElementById("mis-desc")?.value?.trim() || "",
    emoji:       document.getElementById("mis-emoji")?.value || "🎯",
    type,
    xpReward:    isNaN(xpRaw)  ? 20   : xpRaw,
    timeLimit:   isNaN(timeRaw)? null  : timeRaw,
    maxAttempts: isNaN(attRaw) ? null  : attRaw,
    linkURL:     "",
    questions:   [],
  };

  if (type === "link") {
    base.linkURL = document.getElementById("mis-link-url")?.value?.trim() || "";
    return base;
  }

  // Parse questions
  const blocks = document.querySelectorAll(".question-builder");
  const questions = [];

  blocks.forEach(block => {
    const explanation = block.querySelector(".qb-explanation")?.value?.trim() || "";

    if (type === "quiz") {
      const prompt  = block.querySelector(".qb-prompt")?.value?.trim() || "";
      const options = [...block.querySelectorAll(".qb-option")].map(i => i.value.trim()).filter(Boolean);
      const radios  = [...block.querySelectorAll(".qb-correct-radio")];
      const correct = radios.findIndex(r => r.checked);
      if (prompt && options.length >= 2) {
        questions.push({ type, prompt, options, correctIndex: Math.max(0, correct), explanation });
      }
    }

    if (type === "gapfill") {
      const sentence  = block.querySelector(".qb-prompt")?.value?.trim() || "";
      const answersRaw= block.querySelector(".qb-gapfill-answers")?.value || "";
      const bankRaw   = block.querySelector(".qb-gapfill-bank")?.value || "";
      const answers   = answersRaw.split(",").map(s => s.trim()).filter(Boolean);
      const wordBank  = bankRaw.split(",").map(s => s.trim()).filter(Boolean);
      if (sentence && answers.length > 0) {
        questions.push({ type, sentence, prompt: sentence, answers, wordBank, explanation });
      }
    }

    if (type === "matching") {
      const prompt     = block.querySelector(".qb-prompt")?.value?.trim() || "";
      const leftLabel  = block.querySelector(".qb-left-label")?.value?.trim() || "Column A";
      const rightLabel = block.querySelector(".qb-right-label")?.value?.trim() || "Column B";
      const lefts      = [...block.querySelectorAll(".qb-pair-left")].map(i => i.value.trim());
      const rights     = [...block.querySelectorAll(".qb-pair-right")].map(i => i.value.trim());
      const pairs      = lefts.map((l, i) => ({ left: l, right: rights[i] || "" }))
                              .filter(p => p.left && p.right);
      if (pairs.length >= 2) {
        questions.push({ type, prompt, leftLabel, rightLabel, pairs, explanation });
      }
    }

    if (type === "unscramble") {
      const prompt   = block.querySelector(".qb-prompt")?.value?.trim() || "";
      const sentence = block.querySelector(".qb-sentence")?.value?.trim() || "";
      if (sentence) {
        questions.push({ type, prompt, sentence, explanation });
      }
    }
  });

  if (type !== "link" && questions.length === 0) {
    showToast("Add at least one valid question", "warning");
    return null;
  }

  base.questions = questions;
  return base;
}

// ════════════════════════════════════════════
// ASSIGN MODAL
// ════════════════════════════════════════════

async function openAssignModal(mission, container) {
  openModal(`
    <div class="modal-header">
      <h3>👥 Assign — ${escapeHTML(mission.title)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="form-hint" style="margin-bottom:var(--sp-4)">
        Toggle students to assign or remove this mission.
      </p>
      <div id="assign-student-list">Loading…</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-assign">Save</button>
    </div>
  `);

  try {
    const users   = await getAllUsers();
    const active  = users.filter(u => u.status === "active" && u.role !== "admin");
    const assigned= new Set(mission.assignedTo ?? []);

    const listEl = document.getElementById("assign-student-list");
    if (!listEl) return;

    listEl.innerHTML = active.length === 0
      ? `<p class="form-hint">No active students yet.</p>`
      : active.map(u => `
          <div class="unlock-lesson-row">
            <span class="unlock-lesson-name">${escapeHTML(u.name || u.email)}</span>
            <label class="toggle-switch">
              <input type="checkbox" data-uid="${u.id}"
                     ${assigned.has(u.id) ? "checked" : ""}>
              <span class="toggle-track"></span>
            </label>
          </div>
        `).join("");

  } catch (err) {
    document.getElementById("assign-student-list").textContent = "Could not load students.";
    console.error(err);
  }

  document.getElementById("btn-save-assign")?.addEventListener("click", async () => {
    const checks = [...document.querySelectorAll("#assign-student-list input[type=checkbox]")];
    const toAssign   = checks.filter(c => c.checked).map(c => c.dataset.uid);
    const toUnassign = checks.filter(c => !c.checked).map(c => c.dataset.uid);

    try {
      await Promise.all([
        ...toAssign.map(uid   => assignMission(mission.id, uid)),
        ...toUnassign.map(uid => unassignMission(mission.id, uid)),
      ]);
      showToast("Assignment saved ✅", "success");
      closeModal();
      await renderMissionsTeacherTab(container);
    } catch {
      showToast("Could not save assignment", "error");
    }
  });
}

// ════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════

function confirmDelete(m, container) {
  openModal(`
    <div class="modal-header">
      <h3>🗑 Delete Mission</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Delete <strong>${escapeHTML(m.title)}</strong>? This cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-del-mission">Yes, delete</button>
    </div>
  `);
  document.getElementById("btn-confirm-del-mission")?.addEventListener("click", async () => {
    try {
      await deleteMission(m.id);
      showToast("Mission deleted", "info");
      closeModal();
      await renderMissionsTeacherTab(container);
    } catch { showToast("Could not delete", "error"); }
  });
}
