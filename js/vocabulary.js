// =============================================
// ENGLISH UP! — js/vocabulary.js
// Vista del estudiante: banco + modos de práctica
// Flashcards · Quiz · Typewriting · Matching
// =============================================

import { State, registerRoute, navigate, showToast, openModal, closeModal, escapeHTML } from "./app.js";
import {
  getAllVocabulary, getVocabularyProgress, recordWordResult, PARTS_OF_SPEECH
} from "./vocabulary-db.js";

// ════════════════════════════════════════════
// TTS ENGINE (Web Speech API)
// Idéntico al que usa session1.html
// ════════════════════════════════════════════

let _enVoice = null;

function _pickEnglishVoice() {
  if (_enVoice) return _enVoice;
  const voices = window.speechSynthesis?.getVoices() ?? [];
  _enVoice =
    voices.find(v => v.lang === "en-US") ||
    voices.find(v => v.lang === "en-GB") ||
    voices.find(v => v.lang.startsWith("en")) ||
    null;
  return _enVoice;
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { _enVoice = null; };
}

/**
 * Lee un texto en inglés.
 * @param {string}           text  - la palabra o frase a leer
 * @param {HTMLElement|null} btn   - botón que activó (para animación .speaking)
 * @param {number}           rate  - velocidad (default 0.82, más lento para learners)
 */
function speakVocab(text, btn = null, rate = 0.82) {
  if (!("speechSynthesis" in window) || !text) return;

  window.speechSynthesis.cancel();

  // Quitar animación de cualquier botón previo
  document.querySelectorAll(".vocab-tts-btn.speaking, .flashcard-tts-btn.speaking, .word-detail-tts-btn.speaking")
    .forEach(b => b.classList.remove("speaking"));

  const utter   = new SpeechSynthesisUtterance(text);
  utter.lang    = "en-US";
  utter.rate    = rate;
  utter.pitch   = 1;
  utter.volume  = 1;

  const voice = _pickEnglishVoice();
  if (voice) utter.voice = voice;

  if (btn) {
    btn.classList.add("speaking");
    const done = () => btn.classList.remove("speaking");
    utter.onend   = done;
    utter.onerror = done;
  }

  window.speechSynthesis.speak(utter);
}

// ════════════════════════════════════════════
// REGISTRO
// ════════════════════════════════════════════

export function registerVocabulary() {
  registerRoute("vocabulary", renderVocabularyPage);
}

// ════════════════════════════════════════════
// RENDER MAIN PAGE
// ════════════════════════════════════════════

async function renderVocabularyPage(params, container) {
  container.innerHTML = buildSkeleton();

  try {
    const uid = State.user.uid;
    const [words, progress] = await Promise.all([
      getAllVocabulary(),
      getVocabularyProgress(uid),
    ]);

    if (words.length === 0) {
      container.innerHTML = `
        <div class="vocab-empty">
          <div class="vocab-empty-icon">📖</div>
          <h3>No vocabulary yet</h3>
          <p>Your teacher hasn't added any vocabulary yet. Check back after your next lesson!</p>
        </div>`;
      return;
    }

    renderVocabList(container, words, progress);

  } catch (err) {
    console.error("[Vocabulary]", err);
    container.innerHTML = `
      <div class="vocab-empty">
        <div class="vocab-empty-icon">😕</div>
        <h3>Could not load vocabulary</h3>
        <p>Please refresh and try again.</p>
      </div>`;
  }
}

// ════════════════════════════════════════════
// VOCAB LIST VIEW
// ════════════════════════════════════════════

function renderVocabList(container, words, progress) {
  const learned   = words.filter(w => (progress[w.id]?.score ?? 0) >= 70).length;
  const needReview= words.filter(w => {
    const p = progress[w.id];
    return p && p.nextReview && new Date(p.nextReview) <= new Date();
  }).length;

  // Collect unique modules for filter
  const modules = [...new Set(words.filter(w => w.moduleName).map(w => w.moduleName))];

  container.innerHTML = `
    <div class="vocab-page">

      <!-- Header -->
      <div class="vocab-page-header">
        <div class="vocab-page-title">
          <span class="vocab-page-title-icon">📖</span>
          <h1>Vocabulary</h1>
        </div>
        <div class="vocab-stats-bar">
          <div class="vocab-stat-pill vocab-stat-total">📚 ${words.length} words</div>
          <div class="vocab-stat-pill vocab-stat-learned">✅ ${learned} learned</div>
          ${needReview > 0 ? `<div class="vocab-stat-pill vocab-stat-review">🔄 ${needReview} to review</div>` : ""}
        </div>
      </div>

      <!-- Practice banner -->
      <div class="vocab-practice-banner">
        <div class="vocab-practice-banner-text">
          <h3>Ready to practice?</h3>
          <p>${words.length} words available — choose your mode</p>
        </div>
        <div class="vocab-practice-modes">
          <button class="vocab-mode-btn vocab-mode-flashcard" data-mode="flashcard">🃏 Flashcards</button>
          <button class="vocab-mode-btn vocab-mode-quiz"      data-mode="quiz">🧠 Quiz</button>
          <button class="vocab-mode-btn vocab-mode-type"      data-mode="type">⌨️ Type It</button>
          <button class="vocab-mode-btn vocab-mode-match"     data-mode="match">🔗 Match</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="vocab-controls">
        <div class="vocab-search-wrap">
          <span class="vocab-search-icon">🔍</span>
          <input class="vocab-search" id="vocab-search" type="search"
                 placeholder="Search words…" autocomplete="off" />
        </div>
        <div class="vocab-filter-group" id="vocab-filters">
          <button class="vocab-filter-btn active" data-filter="all">All</button>
          ${modules.map(m => `
            <button class="vocab-filter-btn" data-filter="module:${escapeHTML(m)}">${escapeHTML(m)}</button>
          `).join("")}
          <button class="vocab-filter-btn" data-filter="review">🔄 Review</button>
          ${PARTS_OF_SPEECH.filter(p => words.some(w => w.partOfSpeech === p.value)).map(p => `
            <button class="vocab-filter-btn" data-filter="pos:${p.value}">${p.emoji} ${p.label}</button>
          `).join("")}
        </div>
      </div>

      <!-- Grid -->
      <div class="vocab-grid" id="vocab-grid">
        ${words.map(w => buildWordCard(w, progress[w.id])).join("")}
      </div>

    </div>
  `;

  bindVocabListEvents(container, words, progress);
}

function buildWordCard(word, prog) {
  const pos    = PARTS_OF_SPEECH.find(p => p.value === word.partOfSpeech) ?? PARTS_OF_SPEECH[7];
  const score  = prog?.score ?? null;
  const seen   = prog?.seen  ?? 0;

  const circumference = 2 * Math.PI * 10;
  const offset = score !== null ? circumference * (1 - score / 100) : circumference;
  const ringClass = score === null ? "" : score >= 70 ? "high" : score >= 40 ? "mid" : "low";

  return `
    <div class="vocab-word-card" data-word-id="${word.id}"
         data-pos="${escapeHTML(word.partOfSpeech)}"
         data-module="${escapeHTML(word.moduleName || "")}"
         data-word-text="${escapeHTML(word.word.toLowerCase())}"
         data-lesson="${escapeHTML(word.lessonName || "")}">
      <div class="vocab-card-top">
        <div style="flex:1;min-width:0">
          <div class="vocab-card-word">${escapeHTML(word.word)}</div>
          ${word.pronunciation ? `<div class="vocab-card-pron">${escapeHTML(word.pronunciation)}</div>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:var(--sp-1);flex-shrink:0">
          <button class="vocab-tts-btn" data-speak="${escapeHTML(word.word)}" title="Listen" onclick="event.stopPropagation()">🔊</button>
          <span class="vocab-pos-badge pos-${escapeHTML(word.partOfSpeech)}">${pos.emoji} ${pos.label}</span>
        </div>
      </div>

      <div class="vocab-card-definition">${escapeHTML(word.definition)}</div>

      ${word.translation ? `
        <div class="vocab-card-translation">🇪🇸 ${escapeHTML(word.translation)}</div>
      ` : ""}

      <div class="vocab-card-meta">
        <div class="vocab-card-lesson-tag">
          ${word.moduleName ? `📚 ${escapeHTML(word.moduleName)}` : "🌐 General"}
        </div>
        <div class="vocab-score-ring" title="${score !== null ? score + "% mastery" : "Not practiced yet"}">
          <svg width="28" height="28" viewBox="0 0 28 28">
            <circle class="vocab-ring-bg"   cx="14" cy="14" r="10"
                    stroke-dasharray="${circumference}" />
            <circle class="vocab-ring-fill ${ringClass}" cx="14" cy="14" r="10"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${score !== null ? offset : circumference}" />
          </svg>
          <div class="vocab-score-text">${score !== null ? score : "—"}</div>
        </div>
      </div>
    </div>
  `;
}

function bindVocabListEvents(container, words, progress) {
  // Word card click → detail modal
  container.querySelectorAll(".vocab-word-card").forEach(card => {
    card.addEventListener("click", () => {
      const word = words.find(w => w.id === card.dataset.wordId);
      if (word) openWordDetail(word, progress[word.id]);
    });
  });

  // TTS buttons in grid — stop propagation so click doesn't open modal
  container.querySelectorAll(".vocab-tts-btn[data-speak]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      speakVocab(btn.dataset.speak, btn);
    });
  });

  // Practice mode buttons
  container.querySelectorAll(".vocab-mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      const filtered = getFilteredWords(container, words, progress);
      if (filtered.length < 2) {
        showToast("Need at least 2 words to practice!", "warning");
        return;
      }
      launchPractice(mode, filtered, progress, container, words);
    });
  });

  // Filter buttons
  container.querySelectorAll(".vocab-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".vocab-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterGrid(container, words, progress);
    });
  });

  // Search
  container.querySelector("#vocab-search")?.addEventListener("input", () => {
    filterGrid(container, words, progress);
  });
}

function getFilteredWords(container, words, progress) {
  const searchVal = (container.querySelector("#vocab-search")?.value ?? "").toLowerCase().trim();
  const activeFilter = container.querySelector(".vocab-filter-btn.active")?.dataset.filter ?? "all";

  return words.filter(w => {
    // Search
    if (searchVal && !w.word.toLowerCase().includes(searchVal)
        && !w.definition.toLowerCase().includes(searchVal)
        && !w.translation?.toLowerCase().includes(searchVal)) return false;

    // Filter
    if (activeFilter === "all") return true;
    if (activeFilter === "review") {
      const p = progress[w.id];
      return p && p.nextReview && new Date(p.nextReview) <= new Date();
    }
    if (activeFilter.startsWith("pos:")) return w.partOfSpeech === activeFilter.slice(4);
    if (activeFilter.startsWith("module:")) return w.moduleName === activeFilter.slice(7);
    return true;
  });
}

function filterGrid(container, words, progress) {
  const filtered = getFilteredWords(container, words, progress);
  const grid = container.querySelector("#vocab-grid");
  if (!grid) return;

  grid.innerHTML = filtered.length > 0
    ? filtered.map(w => buildWordCard(w, progress[w.id])).join("")
    : `<div class="vocab-empty" style="grid-column:1/-1">
         <div class="vocab-empty-icon">🔍</div>
         <h3>No results</h3>
         <p>Try a different search or filter.</p>
       </div>`;

  // Rebind clicks
  grid.querySelectorAll(".vocab-word-card").forEach(card => {
    card.addEventListener("click", () => {
      const word = words.find(w => w.id === card.dataset.wordId);
      if (word) openWordDetail(word, progress[word.id]);
    });
  });

  // Rebind TTS
  grid.querySelectorAll(".vocab-tts-btn[data-speak]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      speakVocab(btn.dataset.speak, btn);
    });
  });
}

// ════════════════════════════════════════════
// WORD DETAIL MODAL
// ════════════════════════════════════════════

function openWordDetail(word, prog) {
  const pos   = PARTS_OF_SPEECH.find(p => p.value === word.partOfSpeech) ?? PARTS_OF_SPEECH[7];
  const score = prog?.score ?? null;

  openModal(`
    <div class="modal-header">
      <h3>${escapeHTML(word.word)}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="word-detail">

        <!-- Header -->
        <div class="word-detail-header">
          <div style="flex:1">
            <div class="word-detail-word">${escapeHTML(word.word)}</div>
            ${word.pronunciation ? `<div class="word-detail-pron">${escapeHTML(word.pronunciation)}</div>` : ""}
            ${word.translation   ? `<div class="word-detail-translation">🇪🇸 ${escapeHTML(word.translation)}</div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:var(--sp-2);flex-shrink:0">
            <button class="word-detail-tts-btn" id="detail-tts-btn" title="Listen to pronunciation">🔊</button>
            <span class="vocab-pos-badge pos-${escapeHTML(word.partOfSpeech)}">${pos.emoji} ${pos.label}</span>
          </div>
        </div>

        <!-- Definition -->
        <div>
          <div style="font-size:var(--text-xs);font-weight:var(--weight-extrabold);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-2)">Definition</div>
          <div class="word-detail-definition">${escapeHTML(word.definition)}</div>
        </div>

        <!-- Examples -->
        ${word.examples?.length ? `
          <div>
            <div style="font-size:var(--text-xs);font-weight:var(--weight-extrabold);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-2)">Examples</div>
            <div class="word-detail-examples">
              ${word.examples.map(ex => `<div class="word-detail-example">"${escapeHTML(ex)}"</div>`).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Lesson source -->
        ${word.lessonName ? `
          <div style="font-size:var(--text-xs);color:var(--color-text-faint)">
            📚 From: ${escapeHTML(word.moduleName || "")} → ${escapeHTML(word.lessonName)}
          </div>
        ` : ""}

        <!-- Progress -->
        ${prog ? `
          <div class="word-detail-progress">
            <div class="word-progress-stat">
              <div class="word-progress-stat-value">${score}%</div>
              <div class="word-progress-stat-label">Mastery</div>
            </div>
            <div class="word-progress-stat">
              <div class="word-progress-stat-value">${prog.seen}</div>
              <div class="word-progress-stat-label">Times Seen</div>
            </div>
            <div class="word-progress-stat">
              <div class="word-progress-stat-value">${prog.correct}</div>
              <div class="word-progress-stat-label">Correct</div>
            </div>
            <div class="word-progress-stat">
              <div class="word-progress-stat-value">${prog.incorrect}</div>
              <div class="word-progress-stat-label">Incorrect</div>
            </div>
          </div>
        ` : `
          <div style="text-align:center;color:var(--color-text-faint);font-size:var(--text-sm);padding:var(--sp-3)">
            You haven't practiced this word yet. 
          </div>
        `}

      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" id="btn-practice-this">🃏 Practice this word</button>
    </div>
  `);

  document.getElementById("btn-practice-this")?.addEventListener("click", () => {
    closeModal();
    launchPractice("flashcard", [word], { [word.id]: prog }, null, [word]);
  });

  // TTS: leer la palabra al abrir el modal y con el botón
  const detailTtsBtn = document.getElementById("detail-tts-btn");
  detailTtsBtn?.addEventListener("click", function() {
    speakVocab(word.word, this);
  });
  // Auto-leer la palabra al abrir el modal (con un pequeño delay)
  setTimeout(() => speakVocab(word.word, detailTtsBtn), 350);
}

// ════════════════════════════════════════════
// PRACTICE ENGINE LAUNCHER
// ════════════════════════════════════════════

function launchPractice(mode, words, progress, parentContainer, allWords) {
  const container = parentContainer ?? document.getElementById("page-container");
  if (!container) return;

  // Shuffle words
  const shuffled = shuffle([...words]);

  switch (mode) {
    case "flashcard": launchFlashcards(shuffled, progress, container, allWords ?? words); break;
    case "quiz":      launchQuiz(shuffled, progress, container, allWords ?? words); break;
    case "type":      launchTypewriting(shuffled, progress, container, allWords ?? words); break;
    case "match":     launchMatching(shuffled, progress, container, allWords ?? words); break;
  }
}

// ════════════════════════════════════════════
// MODE 1: FLASHCARDS
// ════════════════════════════════════════════

function launchFlashcards(words, progress, container, allWords) {
  let current  = 0;
  let flipped  = false;
  const results = [];

  const render = () => {
    if (current >= words.length) {
      showPracticeResults("flashcard", results, progress, container, allWords);
      return;
    }

    const word = words[current];
    const pct  = Math.round((current / words.length) * 100);

    container.innerHTML = `
      <div class="practice-screen">
        <div class="practice-header">
          <div class="practice-mode-icon">🃏</div>
          <div class="practice-meta">
            <div class="practice-mode-name">Flashcards</div>
            <div class="practice-progress-row">
              <div class="practice-progress-track">
                <div class="practice-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="practice-progress-label">${current} / ${words.length}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-exit-practice">✕ Exit</button>
        </div>

        <!-- Flashcard -->
        <div class="flashcard-wrap" id="fc-wrap">
          <div class="flashcard" id="flashcard">
            <div class="flashcard-front">
              <button class="flashcard-tts-btn" id="fc-tts-front" title="Listen" onclick="event.stopPropagation()">🔊</button>
              <div class="flashcard-word">${escapeHTML(word.word)}</div>
              ${word.pronunciation ? `<div class="flashcard-pron">${escapeHTML(word.pronunciation)}</div>` : ""}
              <div class="flashcard-front-hint">Tap to reveal definition</div>
            </div>
            <div class="flashcard-back">
              <button class="flashcard-tts-btn" id="fc-tts-back" title="Listen again" onclick="event.stopPropagation()">🔊</button>
              <div class="flashcard-word">${escapeHTML(word.word)}</div>
              <div class="flashcard-back-def">${escapeHTML(word.definition)}</div>
              ${word.translation ? `<div class="flashcard-back-translation">🇪🇸 ${escapeHTML(word.translation)}</div>` : ""}
              ${word.examples?.[0] ? `<div class="flashcard-back-example">"${escapeHTML(word.examples[0])}"</div>` : ""}
            </div>
          </div>
        </div>

        <!-- Result buttons (hidden until flipped) -->
        <div class="flashcard-result-buttons" id="fc-result-btns" style="display:none">
          <button class="flashcard-result-btn btn-didnt-know" id="btn-didnt-know">
            😕 Didn't know it
            <small>Will review again soon</small>
          </button>
          <button class="flashcard-result-btn btn-knew-it" id="btn-knew-it">
            ✅ Knew it!
            <small>Good work</small>
          </button>
        </div>

        <div style="text-align:center;color:var(--color-text-faint);font-size:var(--text-xs)">
          Tap the card to flip • ${words.length - current} remaining
        </div>
      </div>
    `;

    // Auto-speak word when card appears
    setTimeout(() => {
      speakVocab(word.word, container.querySelector("#fc-tts-front"));
    }, 300);

    // TTS buttons (stop click propagation so they don't flip the card)
    container.querySelector("#fc-tts-front")?.addEventListener("click", function(e) {
      e.stopPropagation();
      speakVocab(word.word, this);
    });
    container.querySelector("#fc-tts-back")?.addEventListener("click", function(e) {
      e.stopPropagation();
      speakVocab(word.word, this);
    });

    // Flip on click
    const fc   = container.querySelector("#flashcard");
    const wrap = container.querySelector("#fc-wrap");
    const btns = container.querySelector("#fc-result-btns");

    wrap?.addEventListener("click", () => {
      if (flipped) return;
      flipped = true;
      fc?.classList.add("flipped");
      // Speak again on flip (reinforcement)
      setTimeout(() => {
        speakVocab(word.word, container.querySelector("#fc-tts-back"), 0.75);
      }, 300);
      setTimeout(() => {
        if (btns) btns.style.display = "grid";
      }, 250);
    });

    container.querySelector("#btn-knew-it")?.addEventListener("click", async () => {
      results.push({ word, correct: true });
      await recordWordResult(State.user.uid, word.id, true);
      current++; flipped = false; render();
    });

    container.querySelector("#btn-didnt-know")?.addEventListener("click", async () => {
      results.push({ word, correct: false });
      await recordWordResult(State.user.uid, word.id, false);
      current++; flipped = false; render();
    });

    container.querySelector("#btn-exit-practice")?.addEventListener("click", () => {
      renderVocabularyPage({}, container);
    });
  };

  render();
}

// ════════════════════════════════════════════
// MODE 2: QUIZ (multiple choice)
// ════════════════════════════════════════════

function launchQuiz(words, progress, container, allWords) {
  let current = 0;
  const results = [];

  const render = () => {
    if (current >= words.length) {
      showPracticeResults("quiz", results, progress, container, allWords);
      return;
    }

    const word    = words[current];
    const pct     = Math.round((current / words.length) * 100);
    const letters = ["A", "B", "C", "D"];

    // Generate distractors from other words
    const pool      = allWords.filter(w => w.id !== word.id);
    const distractors = shuffle(pool).slice(0, 3).map(w => w.definition);
    const options   = shuffle([word.definition, ...distractors]);
    const correct   = options.indexOf(word.definition);

    container.innerHTML = `
      <div class="practice-screen">
        <div class="practice-header">
          <div class="practice-mode-icon">🧠</div>
          <div class="practice-meta">
            <div class="practice-mode-name">Multiple Choice Quiz</div>
            <div class="practice-progress-row">
              <div class="practice-progress-track">
                <div class="practice-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="practice-progress-label">${current} / ${words.length}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-exit-practice">✕ Exit</button>
        </div>

        <div class="question-card">
          <div class="question-type-label">What does this mean?</div>
          <div class="question-text" style="font-size:var(--text-2xl);text-align:center;padding:var(--sp-4) 0">
            ${escapeHTML(word.word)}
            ${word.pronunciation ? `<div style="font-size:var(--text-sm);color:var(--color-text-muted);font-style:italic;margin-top:var(--sp-1)">${escapeHTML(word.pronunciation)}</div>` : ""}
          </div>
          <div class="mc-options">
            ${options.map((opt, i) => `
              <button class="mc-option" data-index="${i}">
                <span class="mc-option-letter">${letters[i]}</span>
                <span>${escapeHTML(opt)}</span>
              </button>
            `).join("")}
          </div>
        </div>

        <div id="quiz-feedback-area"></div>
        <div class="game-actions">
          <span></span>
          <button class="btn btn-primary" id="btn-next-quiz" style="display:none">Next →</button>
        </div>
      </div>
    `;

    let answered = false;

    container.querySelectorAll(".mc-option").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (answered) return;
        answered = true;

        const chosen = parseInt(btn.dataset.index);
        const ok     = chosen === correct;

        container.querySelectorAll(".mc-option").forEach((b, i) => {
          b.disabled = true;
          if (i === correct) b.classList.add("correct");
          else if (i === chosen && !ok) b.classList.add("wrong");
        });

        const fb = container.querySelector("#quiz-feedback-area");
        if (fb) {
          const msg = ok
            ? ["Great job! ✨", "Correct! 🎉", "Perfect! ⭐"][Math.floor(Math.random() * 3)]
            : "Not quite — the correct answer is highlighted above. 👆";
          fb.innerHTML = `<div class="feedback-banner ${ok ? "correct" : "wrong"}">${msg}</div>`;
        }

        results.push({ word, correct: ok });
        await recordWordResult(State.user.uid, word.id, ok);

        const nextBtn = container.querySelector("#btn-next-quiz");
        if (nextBtn) {
          nextBtn.style.display = "inline-flex";
          nextBtn.textContent = current + 1 < words.length ? "Next →" : "See Results →";
        }
      });
    });

    container.querySelector("#btn-next-quiz")?.addEventListener("click", () => {
      current++;
      render();
    });

    container.querySelector("#btn-exit-practice")?.addEventListener("click", () => {
      renderVocabularyPage({}, container);
    });
  };

  render();
}

// ════════════════════════════════════════════
// MODE 3: TYPEWRITING
// ════════════════════════════════════════════

function launchTypewriting(words, progress, container, allWords) {
  let current  = 0;
  const results = [];

  const render = () => {
    if (current >= words.length) {
      showPracticeResults("type", results, progress, container, allWords);
      return;
    }

    const word = words[current];
    const pct  = Math.round((current / words.length) * 100);
    let hintLevel = 0; // 0=none, 1=first letter, 2=alternating, 3=all
    let attempts  = 0;

    container.innerHTML = `
      <div class="practice-screen">
        <div class="practice-header">
          <div class="practice-mode-icon">⌨️</div>
          <div class="practice-meta">
            <div class="practice-mode-name">Type the Word</div>
            <div class="practice-progress-row">
              <div class="practice-progress-track">
                <div class="practice-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="practice-progress-label">${current} / ${words.length}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-exit-practice">✕ Exit</button>
        </div>

        <div class="typewrite-card">
          <div class="typewrite-prompt">What's the English word for…</div>
          <div class="typewrite-definition">${escapeHTML(word.definition)}</div>
          ${word.translation ? `<div class="typewrite-translation">${escapeHTML(word.translation)}</div>` : ""}

          <div class="typewrite-input-wrap">
            <input id="typewrite-input"
                   class="typewrite-input"
                   type="text"
                   autocomplete="off"
                   autocorrect="off"
                   spellcheck="false"
                   placeholder="Type the word…"
                   autofocus />
          </div>

          <div class="typewrite-hint-row">
            <button class="typewrite-hint-btn" id="btn-hint">💡 Hint</button>
            <span class="typewrite-hint-text" id="hint-text"></span>
          </div>

          <div class="typewrite-feedback" id="type-feedback"></div>

          <!-- TTS row: aparece tras respuesta correcta/incorrecta -->
          <div class="typewrite-tts-row" id="type-tts-row" style="display:none">
            <button class="vocab-tts-btn" id="type-tts-btn" title="Hear the word" style="opacity:0.7">🔊</button>
            <span style="font-size:var(--text-xs);color:var(--color-text-muted)">Tap to hear the correct pronunciation</span>
          </div>

          <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-2)">
            <button class="btn btn-primary" id="btn-check-type">Check ✓</button>
            <button class="btn btn-ghost btn-sm" id="btn-skip-type">Skip →</button>
          </div>
        </div>
      </div>
    `;

    const input    = container.querySelector("#typewrite-input");
    const fb       = container.querySelector("#type-feedback");
    const hintEl   = container.querySelector("#hint-text");
    const ttsRow   = container.querySelector("#type-tts-row");
    const ttsBtn   = container.querySelector("#type-tts-btn");

    // Bind TTS button
    ttsBtn?.addEventListener("click", function() {
      speakVocab(word.word, this);
    });

    const buildHint = (level) => {
      const w = word.word;
      if (level === 0) return "";
      if (level === 1) return w[0] + "_".repeat(w.length - 1);
      if (level === 2) return w.split("").map((c, i) => i % 2 === 0 ? c : "_").join("");
      return w;
    };

    container.querySelector("#btn-hint")?.addEventListener("click", () => {
      hintLevel = Math.min(hintLevel + 1, 3);
      if (hintEl) hintEl.textContent = buildHint(hintLevel);
    });

    const check = async () => {
      const given   = (input?.value ?? "").trim().toLowerCase();
      const expected = word.word.toLowerCase();

      if (!given) return;
      attempts++;

      const ok = given === expected || given === expected.replace(/^to /, "");

      input?.classList.add(ok ? "correct" : "wrong");
      if (fb) {
        fb.className  = `typewrite-feedback ${ok ? "correct" : "wrong"}`;
        fb.textContent = ok
          ? ["Correct! 🎉", "Nailed it! ⭐", "Perfect! ✨"][Math.floor(Math.random() * 3)]
          : `Not quite — the word is: "${word.word}"`;
      }

      // Mostrar TTS row y leer la palabra al responder
      if (ttsRow) ttsRow.style.display = "flex";
      speakVocab(word.word, ttsBtn);

      if (!ok) {
        setTimeout(() => input?.classList.remove("wrong"), 600);
        if (attempts >= 2) {
          // Show next after 2 wrong attempts
          setTimeout(async () => {
            results.push({ word, correct: false });
            await recordWordResult(State.user.uid, word.id, false);
            current++; render();
          }, 1200);
        }
        return;
      }

      results.push({ word, correct: ok && attempts === 1 });
      await recordWordResult(State.user.uid, word.id, ok && attempts === 1);

      setTimeout(() => { current++; render(); }, 900);
    };

    input?.addEventListener("keydown", e => {
      if (e.key === "Enter") check();
    });

    container.querySelector("#btn-check-type")?.addEventListener("click", check);

    container.querySelector("#btn-skip-type")?.addEventListener("click", async () => {
      results.push({ word, correct: false });
      await recordWordResult(State.user.uid, word.id, false);
      current++; render();
    });

    container.querySelector("#btn-exit-practice")?.addEventListener("click", () => {
      renderVocabularyPage({}, container);
    });

    input?.focus();
  };

  render();
}

// ════════════════════════════════════════════
// MODE 4: MATCHING
// ════════════════════════════════════════════

function launchMatching(words, progress, container, allWords) {
  // Play in rounds of up to 6 pairs at a time
  const ROUND_SIZE = 6;
  const rounds     = [];
  for (let i = 0; i < words.length; i += ROUND_SIZE) {
    rounds.push(words.slice(i, i + ROUND_SIZE));
  }

  let roundIndex   = 0;
  let totalCorrect = 0;
  let totalPairs   = 0;

  const playRound = () => {
    if (roundIndex >= rounds.length) {
      const score = Math.round((totalCorrect / totalPairs) * 100);
      showPracticeResults("match", [], progress, container, allWords, score);
      return;
    }

    const roundWords = rounds[roundIndex];
    const pairs      = roundWords;
    const rights     = shuffle(pairs.map(p => p.definition));
    totalPairs      += pairs.length;

    let selectedLeft  = null;
    let selectedRight = null;
    let matched       = 0;
    let roundCorrect  = 0;
    const pct = Math.round((roundIndex / rounds.length) * 100);

    container.innerHTML = `
      <div class="practice-screen">
        <div class="practice-header">
          <div class="practice-mode-icon">🔗</div>
          <div class="practice-meta">
            <div class="practice-mode-name">Matching${rounds.length > 1 ? ` — Round ${roundIndex + 1} of ${rounds.length}` : ""}</div>
            <div class="practice-progress-row">
              <div class="practice-progress-track">
                <div class="practice-progress-fill" style="width:${pct}%"></div>
              </div>
              <span class="practice-progress-label">Round ${roundIndex + 1} / ${rounds.length}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-exit-practice">✕ Exit</button>
        </div>

        <div style="background:var(--color-surface);border:1.5px solid var(--color-border-soft);border-radius:var(--radius-xl);padding:var(--sp-5);box-shadow:var(--shadow-sm)">
          <div style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:var(--weight-extrabold);text-transform:uppercase;letter-spacing:.06em;margin-bottom:var(--sp-4)">
            Tap a word, then tap its definition
          </div>
          <div class="match-practice-grid">
            <div>
              <div class="match-practice-col-title">Words</div>
              <div class="match-practice-items" id="col-left">
                ${pairs.map((p, i) => `
                  <button class="match-practice-item" data-left-index="${i}" data-word="${escapeHTML(p.word)}">
                    ${escapeHTML(p.word)}
                  </button>`).join("")}
              </div>
            </div>
            <div>
              <div class="match-practice-col-title">Definitions</div>
              <div class="match-practice-items" id="col-right">
                ${rights.map((def, i) => `
                  <button class="match-practice-item" data-right-def="${escapeHTML(def)}">
                    ${escapeHTML(def)}
                  </button>`).join("")}
              </div>
            </div>
          </div>
        </div>

        <div id="match-feedback-area"></div>
      </div>
    `;

    const tryMatch = async () => {
      if (!selectedLeft || !selectedRight) return;

      const leftIdx  = parseInt(selectedLeft.dataset.leftIndex);
      const expected = pairs[leftIdx].definition;
      const given    = selectedRight.dataset.rightDef;
      const ok       = given === expected;

      selectedLeft.classList.add("matched", ok ? "correct" : "wrong");
      selectedRight.classList.add("matched", ok ? "correct" : "wrong");
      selectedLeft.disabled  = true;
      selectedRight.disabled = true;

      if (ok) {
        roundCorrect++;
        totalCorrect++;
        await recordWordResult(State.user.uid, pairs[leftIdx].id, true);
        // Leer la palabra al hacer match correcto (refuerzo auditivo)
        setTimeout(() => speakVocab(pairs[leftIdx].word), 150);
      } else {
        await recordWordResult(State.user.uid, pairs[leftIdx].id, false);
        // Re-enable after a moment so they can try again
        setTimeout(() => {
          selectedLeft.classList.remove("matched","wrong");
          selectedRight.classList.remove("matched","wrong");
          selectedLeft.disabled  = false;
          selectedRight.disabled = false;
        }, 800);
      }

      selectedLeft  = null;
      selectedRight = null;
      container.querySelectorAll(".match-practice-item").forEach(b => b.classList.remove("selected"));

      matched += ok ? 1 : 0;
      if (matched === pairs.length) {
        const fb = container.querySelector("#match-feedback-area");
        if (fb) fb.innerHTML = `<div class="feedback-banner correct">
          Round complete! ${roundCorrect}/${pairs.length} correct 🎉
        </div>`;
        setTimeout(() => { roundIndex++; playRound(); }, 1200);
      }
    };

    container.querySelectorAll("[data-left-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        container.querySelectorAll("[data-left-index]").forEach(b => b.classList.remove("selected"));
        selectedLeft = btn;
        btn.classList.add("selected");
        // Leer la palabra al seleccionarla
        speakVocab(btn.dataset.word);
        tryMatch();
      });
    });

    container.querySelectorAll("[data-right-def]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        container.querySelectorAll("[data-right-def]").forEach(b => b.classList.remove("selected"));
        selectedRight = btn;
        btn.classList.add("selected");
        tryMatch();
      });
    });

    container.querySelector("#btn-exit-practice")?.addEventListener("click", () => {
      renderVocabularyPage({}, container);
    });
  };

  playRound();
}

// ════════════════════════════════════════════
// PRACTICE RESULTS SCREEN
// ════════════════════════════════════════════

function showPracticeResults(mode, results, progress, container, allWords, overrideScore = null) {
  const total   = results.length;
  const correct = results.filter(r => r.correct).length;
  const score   = overrideScore ?? (total > 0 ? Math.round((correct / total) * 100) : 0);

  const emoji = score >= 90 ? "🏆" : score >= 70 ? "⭐" : score >= 50 ? "👏" : "💪";
  const title = score >= 90 ? "Outstanding!" : score >= 70 ? "Well done!" : score >= 50 ? "Good effort!" : "Keep going!";

  const modeNames = {
    flashcard: "Flashcards",
    quiz:      "Quiz",
    type:      "Typewriting",
    match:     "Matching",
  };

  container.innerHTML = `
    <div class="practice-screen">
      <div class="practice-results">
        <div class="practice-results-emoji">${emoji}</div>
        <div class="practice-results-title">${title}</div>

        <div class="practice-results-score">
          <div class="practice-score-big">${score}</div>
          <div class="practice-score-suffix">
            %<br>
            <span style="color:var(--color-text-muted)">${modeNames[mode] || mode}</span>
          </div>
        </div>

        ${total > 0 ? `
          <div style="font-size:var(--text-sm);color:var(--color-text-muted);font-weight:var(--weight-bold)">
            ${correct} / ${total} correct answers
          </div>
          <div style="width:100%;display:flex;flex-direction:column;gap:var(--sp-2);text-align:left">
            ${results.map(r => `
              <div class="results-breakdown-row ${r.correct ? "correct-row" : "wrong-row"}"
                   style="display:flex;align-items:center;justify-content:space-between">
                <span>${escapeHTML(r.word.word)}</span>
                <div style="display:flex;align-items:center;gap:var(--sp-2)">
                  <button class="vocab-tts-btn" data-speak="${escapeHTML(r.word.word)}"
                          title="Listen" style="opacity:0.6">🔊</button>
                  <span>${r.correct ? "✅" : "❌"}</span>
                </div>
              </div>`).join("")}
          </div>
        ` : ""}

        <div class="practice-results-actions">
          <button class="btn btn-primary" id="btn-practice-again">↺ Practice Again</button>
          <button class="btn btn-ghost"   id="btn-back-to-vocab">← Back to Vocabulary</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector("#btn-back-to-vocab")?.addEventListener("click", () => {
    renderVocabularyPage({}, container);
  });

  // TTS en los resultados
  container.querySelectorAll(".vocab-tts-btn[data-speak]").forEach(btn => {
    btn.addEventListener("click", function() {
      speakVocab(this.dataset.speak, this);
    });
  });

  container.querySelector("#btn-practice-again")?.addEventListener("click", () => {
    launchPractice(mode, allWords, progress, container, allWords);
  });
}

// ════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildSkeleton() {
  return `
    <div class="vocab-page">
      <div style="height:40px;width:250px" class="skeleton-node"></div>
      <div style="height:100px" class="skeleton-node"></div>
      <div class="vocab-grid">
        ${[1,2,3,4,5,6].map(() => `<div class="skeleton-node" style="height:140px"></div>`).join("")}
      </div>
    </div>`;
}