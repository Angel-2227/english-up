// =============================================
// ENGLISH UP! — js/teacher/vocabulary.js
// Panel del teacher: gestión de vocabulario
// Creación manual + extracción con IA
// =============================================

import { showToast, openModal, closeModal, escapeHTML } from "../app.js";
import { State } from "../app.js";
import {
  getAllVocabulary, createVocabularyItem, updateVocabularyItem,
  deleteVocabularyItem, bulkCreateVocabulary,
  extractVocabularyWithAI, PARTS_OF_SPEECH,
  watchVocabulary,
} from "../vocabulary-db.js";
import { getModules, getLessons } from "../db.js";

// ════════════════════════════════════════════
// RENDER TAB
// ════════════════════════════════════════════

let _unsubVocab = null;

export async function renderVocabularyTeacherTab(container) {
  container.innerHTML = `
    <div class="vocab-teacher-toolbar">
      <div>
        <span class="section-title">📖 Vocabulary Bank</span>
        <div id="vocab-count-label" style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px"></div>
      </div>
      <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="btn-extract-vocab">🤖 Extract from Lesson</button>
        <button class="btn btn-primary btn-sm" id="btn-add-word">＋ Add Word</button>
      </div>
    </div>

    <!-- Search -->
    <div class="vocab-controls" style="margin-bottom:var(--sp-4)">
      <div class="vocab-search-wrap">
        <span class="vocab-search-icon">🔍</span>
        <input class="vocab-search" id="vocab-teacher-search" type="search"
               placeholder="Search words…" autocomplete="off" />
      </div>
      <div class="vocab-filter-group" id="vocab-teacher-filters">
        <button class="vocab-filter-btn active" data-filter="all">All</button>
        ${PARTS_OF_SPEECH.map(p => `
          <button class="vocab-filter-btn" data-filter="${p.value}">${p.emoji} ${p.label}</button>
        `).join("")}
      </div>
    </div>

    <div id="vocab-teacher-list" class="vocab-teacher-list">
      <div class="path-skeleton">
        ${[1,2,3].map(() => `<div class="skeleton-node" style="height:60px"></div>`).join("")}
      </div>
    </div>
  `;

  // Bind toolbar
  container.querySelector("#btn-add-word")
    ?.addEventListener("click", () => openWordModal(null, container));

  container.querySelector("#btn-extract-vocab")
    ?.addEventListener("click", () => openExtractModal(container));

  // Search
  container.querySelector("#vocab-teacher-search")
    ?.addEventListener("input", e => filterTeacherList(container, e.target.value, currentFilter(container)));

  // Filter buttons
  container.querySelectorAll(".vocab-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".vocab-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterTeacherList(container, searchVal(container), currentFilter(container));
    });
  });

  // Real-time listener
  if (_unsubVocab) _unsubVocab();
  _unsubVocab = watchVocabulary(words => {
    renderTeacherList(container, words);
    const countEl = container.querySelector("#vocab-count-label");
    if (countEl) countEl.textContent = `${words.length} word${words.length !== 1 ? "s" : ""}`;
  });
}

// ════════════════════════════════════════════
// LIST
// ════════════════════════════════════════════

let _allWords = [];

function renderTeacherList(container, words) {
  _allWords = words;
  filterTeacherList(container, searchVal(container), currentFilter(container));
}

function filterTeacherList(container, search, filter) {
  const listEl = container.querySelector("#vocab-teacher-list");
  if (!listEl) return;

  const q       = (search || "").toLowerCase();
  const filtered = _allWords.filter(w => {
    if (filter !== "all" && w.partOfSpeech !== filter) return false;
    if (q && !w.word.toLowerCase().includes(q)
          && !w.definition.toLowerCase().includes(q)) return false;
    return true;
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="vocab-empty">
        <div class="vocab-empty-icon">🔍</div>
        <h3>${_allWords.length === 0 ? "No words yet" : "No results"}</h3>
        <p>${_allWords.length === 0 ? "Click + Add Word or use AI extraction." : "Try a different search."}</p>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(w => buildTeacherRow(w)).join("");

  listEl.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const wordId = btn.dataset.wordId;
      const word   = _allWords.find(w => w.id === wordId);
      if (!word) return;
      if (action === "edit")   openWordModal(word, container);
      if (action === "delete") confirmDelete(word, container);
    });
  });
}

function buildTeacherRow(word) {
  const pos = PARTS_OF_SPEECH.find(p => p.value === word.partOfSpeech) ?? PARTS_OF_SPEECH[7];
  return `
    <div class="vocab-teacher-row">
      <div class="vocab-teacher-word">${escapeHTML(word.word)}</div>
      <span class="vocab-pos-badge pos-${escapeHTML(word.partOfSpeech)}" style="flex-shrink:0">${pos.emoji} ${pos.label}</span>
      <div class="vocab-teacher-def">${escapeHTML(word.definition)}</div>
      ${word.lessonName ? `<div style="font-size:var(--text-xs);color:var(--color-text-faint);white-space:nowrap">📚 ${escapeHTML(word.lessonName)}</div>` : ""}
      <div class="vocab-teacher-actions">
        <button class="btn btn-ghost btn-sm" data-action="edit"   data-word-id="${word.id}">✏️</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-word-id="${word.id}" style="color:var(--color-danger)">🗑</button>
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════
// ADD / EDIT WORD MODAL
// ════════════════════════════════════════════

async function openWordModal(word, container) {
  const isEdit = !!word;

  // Load modules for linking
  let modulesHTML = `<option value="">— None (global) —</option>`;
  let lessonsHTML = `<option value="">— Select module first —</option>`;
  let modules     = [];

  try {
    modules = await getModules();
    modulesHTML += modules.map(m =>
      `<option value="${m.id}" ${word?.moduleId === m.id ? "selected" : ""}>${escapeHTML(m.emoji || "📚")} ${escapeHTML(m.title)}</option>`
    ).join("");

    if (word?.moduleId) {
      const lessons = await getLessons(word.moduleId);
      lessonsHTML = `<option value="">— None —</option>` + lessons.map(l =>
        `<option value="${l.id}" ${word?.lessonId === l.id ? "selected" : ""}>${escapeHTML(l.title)}</option>`
      ).join("");
    }
  } catch { /* no modules yet */ }

  openModal(`
    <div class="modal-header">
      <h3>${isEdit ? "✏️ Edit Word" : "＋ Add Vocabulary"}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" style="max-height:70dvh;overflow-y:auto">
      <div class="form-group">
        <label class="form-label">Word / Phrase *</label>
        <input id="vw-word" class="form-input" type="text"
               placeholder="e.g. to strum, softly, embarrassed…"
               value="${escapeHTML(word?.word || "")}" />
      </div>

      <div class="form-group">
        <label class="form-label">Pronunciation (IPA)</label>
        <input id="vw-pron" class="form-input" type="text"
               placeholder="e.g. /strʌm/"
               value="${escapeHTML(word?.pronunciation || "")}" />
      </div>

      <div class="form-group">
        <label class="form-label">Part of Speech</label>
        <select id="vw-pos" class="form-select">
          ${PARTS_OF_SPEECH.map(p =>
            `<option value="${p.value}" ${(word?.partOfSpeech ?? "other") === p.value ? "selected" : ""}>${p.emoji} ${p.label}</option>`
          ).join("")}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Definition (English) *</label>
        <textarea id="vw-def" class="form-input" rows="2"
                  placeholder="Clear, simple definition in English…">${escapeHTML(word?.definition || "")}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Translation (Spanish)</label>
        <input id="vw-trans" class="form-input" type="text"
               placeholder="e.g. rasguear"
               value="${escapeHTML(word?.translation || "")}" />
      </div>

      <div class="form-group">
        <label class="form-label">Example sentences (one per line)</label>
        <textarea id="vw-examples" class="form-input" rows="3"
                  placeholder="He strums the guitar softly.&#10;She was strumming a melody.">${escapeHTML((word?.examples ?? []).join("\n"))}</textarea>
      </div>

      <div style="display:flex;gap:var(--sp-4);flex-wrap:wrap">
        <div class="form-group" style="flex:1;min-width:140px">
          <label class="form-label">Link to Module</label>
          <select id="vw-module" class="form-select">${modulesHTML}</select>
        </div>
        <div class="form-group" style="flex:1;min-width:140px">
          <label class="form-label">Link to Lesson</label>
          <select id="vw-lesson" class="form-select">${lessonsHTML}</select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-word">
        ${isEdit ? "💾 Save Changes" : "＋ Add Word"}
      </button>
    </div>
  `);

  // Dynamic lesson loading based on module select
  document.getElementById("vw-module")?.addEventListener("change", async (e) => {
    const moduleId   = e.target.value;
    const lessonSel  = document.getElementById("vw-lesson");
    if (!lessonSel) return;
    if (!moduleId) { lessonSel.innerHTML = `<option value="">— None —</option>`; return; }
    try {
      const lessons = await getLessons(moduleId);
      lessonSel.innerHTML = `<option value="">— None —</option>` +
        lessons.map(l => `<option value="${l.id}">${escapeHTML(l.title)}</option>`).join("");
    } catch { lessonSel.innerHTML = `<option value="">— Could not load —</option>`; }
  });

  document.getElementById("btn-save-word")?.addEventListener("click", async () => {
    const wordVal    = (document.getElementById("vw-word")?.value ?? "").trim();
    const defVal     = (document.getElementById("vw-def")?.value  ?? "").trim();
    if (!wordVal || !defVal) { showToast("Word and definition are required.", "warning"); return; }

    const moduleId   = document.getElementById("vw-module")?.value  || null;
    const lessonId   = document.getElementById("vw-lesson")?.value  || null;
    const moduleName = modules.find(m => m.id === moduleId)?.title  || "";

    let lessonName = "";
    if (moduleId && lessonId) {
      try {
        const lessons = await getLessons(moduleId);
        lessonName    = lessons.find(l => l.id === lessonId)?.title || "";
      } catch { /* ignore */ }
    }

    const data = {
      word:          wordVal,
      pronunciation: document.getElementById("vw-pron")?.value.trim()     || "",
      partOfSpeech:  document.getElementById("vw-pos")?.value             || "other",
      definition:    defVal,
      translation:   document.getElementById("vw-trans")?.value.trim()    || "",
      examples:      (document.getElementById("vw-examples")?.value ?? "")
                       .split("\n").map(s => s.trim()).filter(Boolean),
      moduleId,
      lessonId,
      moduleName,
      lessonName,
      createdBy: State.user?.uid || null,
    };

    const btn = document.getElementById("btn-save-word");
    btn.disabled = true; btn.textContent = "Saving…";

    try {
      if (isEdit) {
        await updateVocabularyItem(word.id, data);
        showToast("Word updated! ✅", "success");
      } else {
        await createVocabularyItem(data);
        showToast("Word added! ✅", "success");
      }
      closeModal();
    } catch (err) {
      console.error(err);
      showToast("Could not save word.", "error");
      btn.disabled = false;
      btn.textContent = isEdit ? "💾 Save Changes" : "＋ Add Word";
    }
  });
}

// ════════════════════════════════════════════
// AI EXTRACTION MODAL
// ════════════════════════════════════════════

async function openExtractModal(container) {
  let modules = [];
  try { modules = await getModules(); } catch { }
 
  openModal(`
    <div class="modal-header">
      <h3>🤖 Extract Vocabulary with AI</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="extract-modal-body" style="max-height:70dvh;overflow-y:auto">
 
      <!-- SOURCE TABS -->
      <div style="display:flex;gap:var(--sp-1);background:var(--color-surface-alt);padding:var(--sp-1);border-radius:var(--radius-md);margin-bottom:var(--sp-5)">
        <button class="ext-tab active" data-etab="paste" style="flex:1;padding:var(--sp-2) var(--sp-3);border-radius:var(--radius-sm);font-size:var(--text-sm);font-weight:var(--weight-bold);color:var(--color-text-muted);transition:all 150ms">✍️ Paste Text</button>
        <button class="ext-tab" data-etab="lesson" style="flex:1;padding:var(--sp-2) var(--sp-3);border-radius:var(--radius-sm);font-size:var(--text-sm);font-weight:var(--weight-bold);color:var(--color-text-muted);transition:all 150ms">📚 From Lesson</button>
      </div>
 
      <!-- PASTE TEXT PANEL -->
      <div id="ext-panel-paste">
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-3)">
          Paste any text from your lesson — lyrics, dialogue, grammar notes, reading — and Claude will extract vocabulary from it.
        </p>
        <div class="form-group">
          <label class="form-label">Lesson title (for context)</label>
          <input id="ext-paste-title" class="form-input" type="text"
                 placeholder="e.g. Killing Me Softly — The Fugees" />
        </div>
        <div class="form-group">
          <label class="form-label">Text to analyze *</label>
          <textarea id="ext-paste-text" class="form-input" rows="7"
                    style="resize:vertical;font-size:var(--text-sm)"
                    placeholder="Paste lesson content here: song lyrics, a reading, grammar explanations, vocabulary lists, dialogue…
 
Tip: you can paste the full lesson text including HTML — Claude will ignore the tags."></textarea>
        </div>
      </div>
 
      <!-- FROM LESSON PANEL (editor-type only) -->
      <div id="ext-panel-lesson" style="display:none">
        <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">
          Select a lesson built with the text editor. Claude will read its content automatically.
        </p>
        <div class="form-group">
          <label class="form-label">Module</label>
          <select id="ext-module" class="form-select">
            <option value="">— Select a module —</option>
            ${modules.map(m => `<option value="${m.id}">${escapeHTML(m.emoji || "📚")} ${escapeHTML(m.title)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Lesson</label>
          <select id="ext-lesson" class="form-select" disabled>
            <option value="">— Select module first —</option>
          </select>
        </div>
        <p style="font-size:var(--text-xs);color:var(--color-text-faint)">
          ⚠️ Only works with lessons created using the built-in text editor (type = editor). For HTML/URL lessons use the "Paste Text" tab instead.
        </p>
      </div>
 
      <!-- SHARED: module assignment + run button -->
      <div class="form-group" style="margin-top:var(--sp-4)">
        <label class="form-label">Assign extracted words to module</label>
        <select id="ext-assign-module" class="form-select">
          <option value="">— No module (global) —</option>
          ${modules.map(m => `<option value="${m.id}">${escapeHTML(m.emoji || "📚")} ${escapeHTML(m.title)}</option>`).join("")}
        </select>
      </div>
 
      <button class="btn btn-secondary" id="btn-run-extract" style="width:100%;margin-top:var(--sp-2)">
        🤖 Analyze with AI
      </button>
 
      <div id="ext-results-area"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary hidden" id="btn-save-extracted" disabled>✅ Add Selected Words</button>
    </div>
  `);
 
  // ── Tab switching ──
  document.querySelectorAll(".ext-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ext-tab").forEach(b => {
        b.classList.remove("active");
        b.style.background = "";
        b.style.color = "var(--color-text-muted)";
        b.style.boxShadow = "";
      });
      btn.classList.add("active");
      btn.style.background = "var(--color-surface)";
      btn.style.color = "var(--color-text)";
      btn.style.boxShadow = "var(--shadow-sm)";
 
      const tab = btn.dataset.etab;
      document.getElementById("ext-panel-paste").style.display  = tab === "paste"  ? "" : "none";
      document.getElementById("ext-panel-lesson").style.display = tab === "lesson" ? "" : "none";
    });
    // style active tab on init
    if (btn.classList.contains("active")) {
      btn.style.background = "var(--color-surface)";
      btn.style.color = "var(--color-text)";
      btn.style.boxShadow = "var(--shadow-sm)";
    }
  });
 
  // ── Module → Lessons loader ──
  document.getElementById("ext-module")?.addEventListener("change", async (e) => {
    const moduleId  = e.target.value;
    const lessonSel = document.getElementById("ext-lesson");
    if (!lessonSel) return;
    lessonSel.innerHTML = `<option value="">Loading…</option>`;
    lessonSel.disabled  = true;
    if (!moduleId) { lessonSel.innerHTML = `<option value="">— Select module first —</option>`; return; }
    try {
      const lessons = await getLessons(moduleId);
      const editorLessons = lessons.filter(l => l.type === "editor");
      if (editorLessons.length === 0) {
        lessonSel.innerHTML = `<option value="">— No editor-type lessons in this module —</option>`;
      } else {
        lessonSel.innerHTML = `<option value="">— Select a lesson —</option>` +
          editorLessons.map(l =>
            `<option value="${l.id}" data-title="${escapeHTML(l.title)}" data-content="${escapeHTML(l.contentBody || "")}">${escapeHTML(l.title)}</option>`
          ).join("");
        lessonSel.disabled = false;
      }
    } catch {
      lessonSel.innerHTML = `<option value="">— Could not load —</option>`;
    }
  });
 
  // ── Run AI extraction ──
  let extractedItems  = [];
  let selectedIndices = new Set();
 
  document.getElementById("btn-run-extract")?.addEventListener("click", async () => {
    const activeTab = document.querySelector(".ext-tab.active")?.dataset.etab ?? "paste";
    let lessonText  = "";
    let lessonTitle = "";
 
    if (activeTab === "paste") {
      lessonText  = (document.getElementById("ext-paste-text")?.value ?? "").trim();
      lessonTitle = (document.getElementById("ext-paste-title")?.value ?? "").trim() || "Lesson";
      if (!lessonText) { showToast("Please paste some text first.", "warning"); return; }
    } else {
      const lessonSel = document.getElementById("ext-lesson");
      const opt       = lessonSel?.options[lessonSel?.selectedIndex];
      if (!opt?.value) { showToast("Please select a lesson first.", "warning"); return; }
      lessonTitle = opt.dataset.title || "Lesson";
      lessonText  = opt.dataset.content || "";
      if (!lessonText || lessonText.length < 30) {
        showToast("This lesson has no text content. Use 'Paste Text' instead.", "warning");
        return;
      }
    }
 
    // Strip HTML tags
    lessonText = lessonText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
 
    const runBtn = document.getElementById("btn-run-extract");
    runBtn.disabled    = true;
    runBtn.textContent = "🤖 Analyzing…";
 
    const resultsArea = document.getElementById("ext-results-area");
    if (resultsArea) {
      resultsArea.innerHTML = `
        <div class="extract-loading" style="margin-top:var(--sp-4)">
          <div class="extract-spinner"></div>
          <div>Claude is reading the content…</div>
        </div>`;
    }
 
    try {
      extractedItems  = await extractVocabularyWithAI(lessonText, lessonTitle);
      selectedIndices = new Set(extractedItems.map((_, i) => i));
 
      if (extractedItems.length === 0) {
        if (resultsArea) resultsArea.innerHTML = `<p style="color:var(--color-danger);margin-top:var(--sp-4);text-align:center">Could not extract vocabulary. Try adding more text.</p>`;
        runBtn.disabled    = false;
        runBtn.textContent = "🤖 Try Again";
        return;
      }
 
      if (resultsArea) {
        resultsArea.innerHTML = `
          <div style="font-size:var(--text-sm);font-weight:var(--weight-bold);margin:var(--sp-4) 0 var(--sp-3)">
            ✅ ${extractedItems.length} words found — uncheck any you don't want:
          </div>
          <div class="extract-results-list">
            ${extractedItems.map((item, i) => `
              <div class="extract-item selected-item" data-index="${i}">
                <input type="checkbox" checked id="ext-cb-${i}" style="flex-shrink:0;width:16px;height:16px" />
                <div style="flex:1;min-width:0">
                  <div class="extract-item-word">
                    ${escapeHTML(item.word)}
                    <span style="font-size:10px;color:var(--color-text-faint);margin-left:4px">${escapeHTML(item.partOfSpeech || "")}</span>
                  </div>
                  <div class="extract-item-def">${escapeHTML(item.definition)}</div>
                  ${item.translation ? `<div style="font-size:10px;color:var(--teal-600);font-weight:700">🇪🇸 ${escapeHTML(item.translation)}</div>` : ""}
                </div>
              </div>`).join("")}
          </div>`;
 
        resultsArea.querySelectorAll(".extract-item").forEach(item => {
          const idx = parseInt(item.dataset.index);
          const cb  = item.querySelector("input[type=checkbox]");
          const toggle = () => {
            item.classList.toggle("selected-item", cb.checked);
            if (cb.checked) selectedIndices.add(idx);
            else             selectedIndices.delete(idx);
            updateSaveBtn();
          };
          item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; toggle(); } });
          cb.addEventListener("change", toggle);
        });
      }
 
      updateSaveBtn();
      const saveBtn = document.getElementById("btn-save-extracted");
      if (saveBtn) saveBtn.classList.remove("hidden");
      runBtn.disabled    = false;
      runBtn.textContent = "🔄 Re-analyze";
 
    } catch (err) {
      console.error("[Extract]", err);
      if (resultsArea) resultsArea.innerHTML = `<p style="color:var(--color-danger);margin-top:var(--sp-4)">AI error: ${escapeHTML(err.message)}</p>`;
      runBtn.disabled    = false;
      runBtn.textContent = "🤖 Analyze with AI";
    }
  });
 
  const updateSaveBtn = () => {
    const btn = document.getElementById("btn-save-extracted");
    if (!btn) return;
    btn.disabled    = selectedIndices.size === 0;
    btn.textContent = `✅ Add ${selectedIndices.size} Word${selectedIndices.size !== 1 ? "s" : ""}`;
  };
 
  // ── Save selected ──
  document.getElementById("btn-save-extracted")?.addEventListener("click", async () => {
    if (selectedIndices.size === 0) return;
 
    const moduleId   = document.getElementById("ext-assign-module")?.value || null;
    const moduleSel  = document.getElementById("ext-assign-module");
    const moduleName = moduleSel?.options[moduleSel?.selectedIndex]?.textContent?.replace(/^[^\s]+\s/, "").trim() || "";
 
    const activeTab  = document.querySelector(".ext-tab.active")?.dataset.etab ?? "paste";
    const lessonId   = activeTab === "lesson" ? (document.getElementById("ext-lesson")?.value || null) : null;
    const lessonOpt  = document.getElementById("ext-lesson")?.options[document.getElementById("ext-lesson")?.selectedIndex];
    const lessonName = lessonId ? (lessonOpt?.dataset.title || "") : "";
 
    const btn = document.getElementById("btn-save-extracted");
    btn.disabled    = true;
    btn.textContent = "Saving…";
 
    const selected = [...selectedIndices].map(i => ({
      ...extractedItems[i],
      moduleId,
      lessonId,
      moduleName,
      lessonName,
      createdBy: State.user?.uid || null,
    }));
 
    try {
      await bulkCreateVocabulary(selected);
      closeModal();
      showToast(`✅ ${selected.length} words added!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Could not save words.", "error");
      btn.disabled    = false;
      btn.textContent = `✅ Add ${selectedIndices.size} Words`;
    }
  });
}

// ════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════

function confirmDelete(word, container) {
  openModal(`
    <div class="modal-header">
      <h3>🗑 Delete Word</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Delete <strong>"${escapeHTML(word.word)}"</strong>? This cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-del-word">Yes, delete</button>
    </div>
  `);

  document.getElementById("btn-confirm-del-word")?.addEventListener("click", async () => {
    try {
      await deleteVocabularyItem(word.id);
      showToast("Word deleted.", "info");
      closeModal();
    } catch {
      showToast("Could not delete.", "error");
    }
  });
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

const searchVal     = c => c.querySelector("#vocab-teacher-search")?.value ?? "";
const currentFilter = c => c.querySelector(".vocab-filter-btn.active")?.dataset.filter ?? "all";
