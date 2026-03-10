// =============================================
// ENGLISH UP! — js/teacher/modules.js
// Gestión de módulos y lecciones
// =============================================

import { showToast, openModal, closeModal, escapeHTML } from "../app.js";
import {
  getModules, createModule, updateModule, deleteModule,
  getLessons, createLesson, updateLesson, deleteLesson,
  reorderModules, reorderLessons,
} from "../db.js";

// ════════════════════════════════════════════
// COLORES DISPONIBLES PARA MÓDULOS
// ════════════════════════════════════════════

const MODULE_COLORS = [
  "#f59e0b","#10b981","#3b82f6","#8b5cf6",
  "#ec4899","#ef4444","#14b8a6","#f97316",
  "#6366f1","#84cc16",
];

const MODULE_EMOJIS = [
  "📚","🌍","🎵","🎬","🏠","🍕","✈️","🌟",
  "💬","🎮","🔬","🎨","💼","🌈","⚽",
];

// ════════════════════════════════════════════
// RENDER TAB MÓDULOS
// ════════════════════════════════════════════

export async function renderModulesTab(container) {
  container.innerHTML = `
    <div class="section-header">
      <span class="section-title">Modules & Lessons</span>
      <button class="btn btn-primary btn-sm" id="btn-add-module">＋ New Module</button>
    </div>
    <div id="modules-list" class="modules-list">
      <div class="path-skeleton">
        ${[1,2].map(() => `<div class="skeleton-node"></div>`).join("")}
      </div>
    </div>
  `;

  document.getElementById("btn-add-module")
    ?.addEventListener("click", () => openModuleModal(null, container));

  await loadModules(container);
}

// ════════════════════════════════════════════
// LOAD + RENDER MODULES
// ════════════════════════════════════════════

async function loadModules(container) {
  const listEl = document.getElementById("modules-list");
  if (!listEl) return;

  try {
    const modules = await getModules();

    if (modules.length === 0) {
      listEl.innerHTML = `
        <div class="lessons-empty">
          No modules yet. Click <strong>＋ New Module</strong> to create one.
        </div>`;
      return;
    }

    listEl.innerHTML = modules.map(m => buildModuleCard(m)).join("");

    // Bind card events
    modules.forEach(m => bindModuleCard(m, container));

  } catch (err) {
    console.error("[Modules]", err);
    listEl.innerHTML = `<p style="color:var(--color-danger);padding:var(--sp-4)">Could not load modules.</p>`;
  }
}

// ════════════════════════════════════════════
// MODULE CARD HTML
// ════════════════════════════════════════════

function buildModuleCard(m) {
  return `
    <div class="module-card" id="mc-${m.id}">
      <div class="module-card-header" data-module-id="${m.id}">
        <div class="mc-color-dot" style="background:${escapeHTML(m.color || "#f59e0b")}"></div>
        <div class="mc-emoji">${m.emoji || "📚"}</div>
        <div class="mc-title">${escapeHTML(m.title)}</div>
        <div class="mc-meta">order ${m.order ?? 0}</div>
        <label class="mc-pub-toggle" onclick="event.stopPropagation()">
          <input type="checkbox" class="mc-published-cb" data-module-id="${m.id}"
                 ${m.published ? "checked" : ""} style="cursor:pointer">
          ${m.published ? "✅ Live" : "⬜ Draft"}
        </label>
        <span class="mc-toggle">▼</span>
      </div>
      <div class="module-card-body" id="mcb-${m.id}">
        <!-- Lessons + actions loaded on expand -->
        <div class="module-card-loading">Loading lessons…</div>
      </div>
    </div>
  `;
}

function bindModuleCard(m, tabContainer) {
  const card   = document.getElementById(`mc-${m.id}`);
  const header = card?.querySelector(".module-card-header");
  const body   = document.getElementById(`mcb-${m.id}`);
  if (!card || !header || !body) return;

  // Toggle expand
  header.addEventListener("click", async (e) => {
    if (e.target.closest(".mc-pub-toggle")) return;
    const isOpen = card.classList.toggle("open");
    if (isOpen) {
      await loadLessonsInCard(m, body, tabContainer);
    }
  });

  // Published toggle
  const pubCb = card.querySelector(".mc-published-cb");
  pubCb?.addEventListener("change", async () => {
    try {
      await updateModule(m.id, { published: pubCb.checked });
      const label = pubCb.closest("label");
      if (label) label.childNodes[label.childNodes.length - 1].textContent =
        pubCb.checked ? " ✅ Live" : " ⬜ Draft";
      showToast(pubCb.checked ? "Module published ✅" : "Module set to draft", "info");
    } catch { showToast("Could not update module", "error"); pubCb.checked = !pubCb.checked; }
  });
}

// ════════════════════════════════════════════
// LOAD LESSONS INSIDE CARD
// ════════════════════════════════════════════

async function loadLessonsInCard(m, body, tabContainer) {
  body.innerHTML = `<div class="module-card-loading" style="padding:var(--sp-3);color:var(--color-text-muted);font-size:var(--text-sm)">Loading…</div>`;

  try {
    const lessons = await getLessons(m.id);

    body.innerHTML = `
      <div class="lessons-list" id="ll-${m.id}">
        ${lessons.length === 0
          ? `<div class="lessons-empty">No lessons yet.</div>`
          : lessons.map((l, i) => buildLessonRow(l, m.id, i)).join("")
        }
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-5)">
        <button class="btn btn-secondary btn-sm" id="btn-add-lesson-${m.id}">＋ Add Lesson</button>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;border-top:1.5px solid var(--color-border-soft);padding-top:var(--sp-4)">
        <button class="btn btn-ghost btn-sm" id="btn-edit-module-${m.id}">✏️ Edit Module</button>
        <button class="btn btn-danger btn-sm" id="btn-delete-module-${m.id}">🗑 Delete Module</button>
      </div>
    `;

    document.getElementById(`btn-add-lesson-${m.id}`)
      ?.addEventListener("click", () => openLessonModal(null, m.id, body, tabContainer));

    document.getElementById(`btn-edit-module-${m.id}`)
      ?.addEventListener("click", () => openModuleModal(m, tabContainer));

    document.getElementById(`btn-delete-module-${m.id}`)
      ?.addEventListener("click", () => confirmDeleteModule(m, tabContainer));

    // Lesson row actions
    body.querySelectorAll("[data-lesson-action]").forEach(btn => {
      btn.addEventListener("click", () => handleLessonAction(btn, m, body, tabContainer));
    });

  } catch (err) {
    body.innerHTML = `<p style="color:var(--color-danger);padding:var(--sp-4)">Could not load lessons.</p>`;
    console.error(err);
  }
}

// ════════════════════════════════════════════
// LESSON ROW HTML
// ════════════════════════════════════════════

function buildLessonRow(l, moduleId, index) {
  const typeClass = { url: "lr-type-url", html: "lr-type-html", editor: "lr-type-editor" }[l.type] || "lr-type-url";
  return `
    <div class="lesson-row" data-lesson-id="${l.id}">
      <span class="lr-order">${index + 1}</span>
      <span class="lr-title">${escapeHTML(l.title)}</span>
      <span class="lr-type ${typeClass}">${l.type || "url"}</span>
      <span class="lr-pub ${l.published ? "published" : ""}">${l.published ? "✅" : "⬜"}</span>
      <div class="lr-actions">
        <button class="lr-btn" title="Edit"
                data-lesson-action="edit"
                data-lesson-id="${l.id}"
                data-module-id="${moduleId}">✏️</button>
        <button class="lr-btn danger" title="Delete"
                data-lesson-action="delete"
                data-lesson-id="${l.id}"
                data-module-id="${moduleId}">🗑</button>
      </div>
    </div>
  `;
}

function handleLessonAction(btn, m, body, tabContainer) {
  const action   = btn.dataset.lessonAction;
  const lessonId = btn.dataset.lessonId;
  const moduleId = btn.dataset.moduleId;

  if (action === "edit") {
    getLessons(moduleId).then(lessons => {
      const lesson = lessons.find(l => l.id === lessonId);
      if (lesson) openLessonModal(lesson, moduleId, body, tabContainer);
    });
  }

  if (action === "delete") {
    confirmDeleteLesson(lessonId, moduleId, m, body, tabContainer);
  }
}

// ════════════════════════════════════════════
// MODULE MODAL (create / edit)
// ════════════════════════════════════════════

function openModuleModal(module, tabContainer) {
  const isEdit = !!module;
  const title  = module?.title       || "";
  const desc   = module?.description || "";
  const emoji  = module?.emoji       || "📚";
  const color  = module?.color       || MODULE_COLORS[0];
  const order  = module?.order       ?? 0;

  openModal(`
    <div class="modal-header">
      <h3>${isEdit ? "✏️ Edit Module" : "＋ New Module"}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input id="mod-title" class="form-input" type="text"
               placeholder="e.g. Hello World 🌍" value="${escapeHTML(title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Description (optional)</label>
        <input id="mod-desc" class="form-input" type="text"
               placeholder="Short summary of this module" value="${escapeHTML(desc)}" />
      </div>
      <div style="display:flex;gap:var(--sp-5);flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:140px">
          <label class="form-label">Emoji</label>
          <select id="mod-emoji" class="form-select">
            ${MODULE_EMOJIS.map(e => `<option value="${e}" ${e === emoji ? "selected" : ""}>${e} ${e}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="flex:1;min-width:140px">
          <label class="form-label">Order</label>
          <input id="mod-order" class="form-input" type="number" min="0" value="${order}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <div class="color-options" id="color-options">
          ${MODULE_COLORS.map(c => `
            <div class="color-swatch ${c === color ? "selected" : ""}"
                 data-color="${c}"
                 style="background:${c}"
                 title="${c}"></div>
          `).join("")}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-module">
        ${isEdit ? "💾 Save Changes" : "＋ Create Module"}
      </button>
    </div>
  `);

  let selectedColor = color;

  document.getElementById("color-options")?.addEventListener("click", e => {
    const swatch = e.target.closest(".color-swatch");
    if (!swatch) return;
    document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    selectedColor = swatch.dataset.color;
  });

  document.getElementById("btn-save-module")?.addEventListener("click", async () => {
    const data = {
      title:       document.getElementById("mod-title")?.value?.trim() || "Module",
      description: document.getElementById("mod-desc")?.value?.trim()  || "",
      emoji:       document.getElementById("mod-emoji")?.value         || "📚",
      order:       parseInt(document.getElementById("mod-order")?.value ?? "0", 10),
      color:       selectedColor,
    };

    const btn = document.getElementById("btn-save-module");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
      if (isEdit) {
        await updateModule(module.id, data);
        showToast("Module updated ✅", "success");
      } else {
        await createModule(data);
        showToast("Module created ✅", "success");
      }
      closeModal();
      await renderModulesTab(tabContainer.closest(".teacher-tab-content") ?? tabContainer);
    } catch (err) {
      console.error(err);
      showToast("Could not save module", "error");
      btn.disabled = false;
      btn.textContent = isEdit ? "💾 Save Changes" : "＋ Create Module";
    }
  });
}

// ════════════════════════════════════════════
// LESSON MODAL (create / edit)
// ════════════════════════════════════════════

function openLessonModal(lesson, moduleId, body, tabContainer) {
  const isEdit = !!lesson;
  const type   = lesson?.type        || "url";
  const title  = lesson?.title       || "";
  const url    = lesson?.externalURL || "";
  const xp     = lesson?.xpReward    ?? 10;
  const dur    = lesson?.duration    ?? 60;
  const pub    = lesson?.published   ?? false;

  openModal(`
    <div class="modal-header">
      <h3>${isEdit ? "✏️ Edit Lesson" : "＋ New Lesson"}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Title</label>
        <input id="les-title" class="form-input" type="text"
               placeholder="e.g. Session 1 — Killing Me Softly" value="${escapeHTML(title)}" />
      </div>

      <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:100px">
          <label class="form-label">⚡ XP Reward</label>
          <input id="les-xp" class="form-input" type="number" min="0" value="${xp}" />
        </div>
        <div class="form-group" style="flex:1;min-width:100px">
          <label class="form-label">⏱ Duration (min)</label>
          <input id="les-dur" class="form-input" type="number" min="1" value="${dur}" />
        </div>
        <div class="form-group" style="flex:1;min-width:100px;justify-content:flex-end">
          <label class="form-label">Published</label>
          <label style="display:flex;align-items:center;gap:var(--sp-2);margin-top:var(--sp-1)">
            <input type="checkbox" id="les-pub" ${pub ? "checked" : ""}
                   style="width:16px;height:16px"> Live
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Content type</label>
        <div class="lesson-type-tabs">
          <button class="ltt-btn ${type === "url"    ? "active" : ""}" data-type="url">🔗 URL / Embed</button>
          <button class="ltt-btn ${type === "html"   ? "active" : ""}" data-type="html">📄 HTML File URL</button>
          <button class="ltt-btn ${type === "editor" ? "active" : ""}" data-type="editor">✏️ Editor</button>
        </div>
      </div>

      <!-- URL panel -->
      <div class="lesson-type-panel ${type === "url" ? "active" : ""}" id="ltp-url">
        <div class="form-group">
          <label class="form-label">External URL</label>
          <input id="les-url" class="form-input" type="url"
                 placeholder="https://…" value="${escapeHTML(url)}" />
          <span class="form-hint">Any link: Google Sites, Canva, Genially, Loom, etc.</span>
        </div>
      </div>

      <!-- HTML File URL panel -->
      <div class="lesson-type-panel ${type === "html" ? "active" : ""}" id="ltp-html">
        <div class="form-group">
          <label class="form-label">Cloudflare Pages URL</label>
          <input id="les-html-url" class="form-input" type="url"
                 placeholder="https://english-up.pages.dev/lessons/mod0/session1.html"
                 value="${escapeHTML(type === "html" ? url : "")}" />
          <span class="form-hint">Upload your HTML file to <code>/lessons/modX/</code> and paste the URL here.</span>
        </div>
      </div>

      <!-- Editor panel -->
      <div class="lesson-type-panel ${type === "editor" ? "active" : ""}" id="ltp-editor">
        <div class="form-group">
          <label class="form-label">Content</label>
          <div id="quill-editor-wrap" class="quill-wrapper">
            <div id="quill-editor" style="min-height:200px">${lesson?.contentBody || ""}</div>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-lesson">
        ${isEdit ? "💾 Save Changes" : "＋ Add Lesson"}
      </button>
    </div>
  `);

  // Type tabs
  let activeType = type;
  document.querySelectorAll(".ltt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ltt-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".lesson-type-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      activeType = btn.dataset.type;
      document.getElementById(`ltp-${activeType}`)?.classList.add("active");
    });
  });

  // Init Quill if editor type
  let quill = null;
  if (type === "editor") {
    initQuill().then(q => { quill = q; });
  }
  document.querySelectorAll(".ltt-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.dataset.type === "editor" && !quill) {
        quill = await initQuill();
      }
    });
  });

  document.getElementById("btn-save-lesson")?.addEventListener("click", async () => {
    const lessonTitle = document.getElementById("les-title")?.value?.trim() || "Lesson";
    const xpVal       = parseInt(document.getElementById("les-xp")?.value  ?? "10", 10);
    const durVal      = parseInt(document.getElementById("les-dur")?.value  ?? "60", 10);
    const pubVal      = document.getElementById("les-pub")?.checked ?? false;

    let externalURL  = "";
    let contentBody  = "";

    if (activeType === "url") {
      externalURL = document.getElementById("les-url")?.value?.trim() || "";
    } else if (activeType === "html") {
      externalURL = document.getElementById("les-html-url")?.value?.trim() || "";
    } else if (activeType === "editor" && quill) {
      contentBody = quill.root.innerHTML;
    }

    const data = {
      title:       lessonTitle,
      type:        activeType,
      externalURL,
      contentBody,
      xpReward:    isNaN(xpVal) ? 10 : xpVal,
      duration:    isNaN(durVal) ? 60 : durVal,
      published:   pubVal,
    };

    const saveBtn = document.getElementById("btn-save-lesson");
    saveBtn.disabled = true; saveBtn.textContent = "Saving…";

    try {
      if (isEdit) {
        await updateLesson(moduleId, lesson.id, data);
        showToast("Lesson updated ✅", "success");
      } else {
        // Get current lesson count for order
        const existing = await getLessons(moduleId);
        data.order     = existing.length;
        await createLesson(moduleId, data);
        showToast("Lesson added ✅", "success");
      }
      closeModal();
      // Reload lessons inside card
      const module = { id: moduleId };
      await loadLessonsInCard(module, body, tabContainer);
    } catch (err) {
      console.error(err);
      showToast("Could not save lesson", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? "💾 Save Changes" : "＋ Add Lesson";
    }
  });
}

// ════════════════════════════════════════════
// DELETE CONFIRMATIONS
// ════════════════════════════════════════════

function confirmDeleteModule(m, tabContainer) {
  openModal(`
    <div class="modal-header">
      <h3>🗑 Delete Module</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete <strong>${escapeHTML(m.title)}</strong> and all its lessons?
         This cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-delete-mod">Yes, delete</button>
    </div>
  `);

  document.getElementById("btn-confirm-delete-mod")?.addEventListener("click", async () => {
    try {
      await deleteModule(m.id);
      showToast("Module deleted", "info");
      closeModal();
      await renderModulesTab(tabContainer);
    } catch { showToast("Could not delete", "error"); }
  });
}

function confirmDeleteLesson(lessonId, moduleId, m, body, tabContainer) {
  openModal(`
    <div class="modal-header">
      <h3>🗑 Delete Lesson</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to delete this lesson? This cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-delete-les">Yes, delete</button>
    </div>
  `);

  document.getElementById("btn-confirm-delete-les")?.addEventListener("click", async () => {
    try {
      await deleteLesson(moduleId, lessonId);
      showToast("Lesson deleted", "info");
      closeModal();
      await loadLessonsInCard({ id: moduleId }, body, tabContainer);
    } catch { showToast("Could not delete", "error"); }
  });
}

// ════════════════════════════════════════════
// QUILL INIT
// ════════════════════════════════════════════

async function initQuill() {
  // Load Quill from CDN if not already loaded
  if (!window.Quill) {
    await Promise.all([
      loadCSS("https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js"),
    ]);
  }

  const existing = document.getElementById("quill-editor");
  if (!existing) return null;

  return new window.Quill("#quill-editor", {
    theme:   "snow",
    modules: {
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link", "image"],
        ["clean"],
      ],
    },
  });
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s   = document.createElement("script");
    s.src     = src;
    s.onload  = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function loadCSS(href) {
  return new Promise(res => {
    if (document.querySelector(`link[href="${href}"]`)) { res(); return; }
    const l  = document.createElement("link");
    l.rel    = "stylesheet";
    l.href   = href;
    l.onload = res;
    document.head.appendChild(l);
  });
}
