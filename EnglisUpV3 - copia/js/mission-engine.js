// =============================================
// ENGLISH UP! — js/mission-engine.js
// Motor de juego: renderiza y evalúa cada tipo
// quiz | gapfill | matching | unscramble | link
// =============================================

import { State, escapeHTML, showToast } from "./app.js";
import { saveMissionResult } from "./db.js";
import { updateNavbar } from "./auth.js";

// ════════════════════════════════════════════
// ENTRY POINT
// ════════════════════════════════════════════

/**
 * Lanza el motor de juego de una misión.
 * @param {object}      mission   - doc de Firestore
 * @param {HTMLElement} container - donde renderizar
 * @param {Function}    onBack    - callback al salir
 */
export function launchMission(mission, container, onBack) {
  if (mission.type === "link") {
    renderLinkMission(mission, container, onBack);
    return;
  }

  const engine = new MissionEngine(mission, container, onBack);
  engine.start();
}

// ════════════════════════════════════════════
// MISSION ENGINE CLASS
// ════════════════════════════════════════════

class MissionEngine {
  constructor(mission, container, onBack) {
    this.mission   = mission;
    this.container = container;
    this.onBack    = onBack;

    this.questions  = mission.questions ?? [];
    this.current    = 0;
    this.answers    = [];          // { correct: bool, given, expected }
    this.timerSecs  = mission.timeLimit ?? null;
    this._timerInterval = null;
    this._answered  = false;
  }

  // ── Start ───────────────────────────────────
  start() {
    this.renderShell();
    this.renderQuestion(this.current);
    if (this.timerSecs) this.startTimer();
  }

  // ── Shell HTML ──────────────────────────────
  renderShell() {
    this.container.innerHTML = `
      <div class="mission-game" id="mission-game">

        <!-- Header -->
        <div class="game-header">
          <div class="game-emoji">${this.mission.emoji || "🎯"}</div>
          <div class="game-meta">
            <div class="game-title">${escapeHTML(this.mission.title)}</div>
            <div class="game-progress-row">
              <div class="game-progress-track">
                <div class="game-progress-fill" id="game-progress" style="width:0%"></div>
              </div>
              <span class="game-progress-label" id="game-progress-label">
                0 / ${this.questions.length}
              </span>
            </div>
          </div>
          ${this.timerSecs ? `
            <div class="game-timer" id="game-timer">
              ⏱ <span id="timer-display">${formatTime(this.timerSecs)}</span>
            </div>` : ""}
        </div>

        <!-- Question area -->
        <div id="question-area"></div>

        <!-- Feedback -->
        <div id="feedback-area"></div>

        <!-- Actions -->
        <div class="game-actions" id="game-actions">
          <button class="btn btn-ghost btn-sm" id="btn-game-back">✕ Exit</button>
          <button class="btn btn-primary" id="btn-next" style="display:none">
            Next →
          </button>
        </div>

      </div>
    `;

    document.getElementById("btn-game-back")
      ?.addEventListener("click", () => {
        this.stopTimer();
        this.onBack?.();
      });
  }

  // ── Update progress bar ─────────────────────
  updateProgress() {
    const pct = Math.round((this.current / this.questions.length) * 100);
    const bar = document.getElementById("game-progress");
    const lbl = document.getElementById("game-progress-label");
    if (bar) bar.style.width = pct + "%";
    if (lbl) lbl.textContent = `${this.current} / ${this.questions.length}`;
  }

  // ── Timer ───────────────────────────────────
  startTimer() {
    let remaining = this.timerSecs;
    const display = () => {
      const el = document.getElementById("timer-display");
      const wrap = document.getElementById("game-timer");
      if (el) el.textContent = formatTime(remaining);
      if (wrap) {
        wrap.classList.toggle("warning", remaining <= 30 && remaining > 10);
        wrap.classList.toggle("danger",  remaining <= 10);
      }
    };
    display();
    this._timerInterval = setInterval(() => {
      remaining--;
      display();
      if (remaining <= 0) {
        this.stopTimer();
        this.timeUp();
      }
    }, 1000);
  }

  stopTimer() {
    clearInterval(this._timerInterval);
  }

  timeUp() {
    showToast("⏱ Time's up!", "warning");
    // Fill remaining questions as wrong
    while (this.current < this.questions.length) {
      this.answers.push({ correct: false, given: null, expected: null });
      this.current++;
    }
    this.showResults();
  }

  // ── Render question ─────────────────────────
  renderQuestion(index) {
    this._answered = false;
    this.updateProgress();

    const q   = this.questions[index];
    const area = document.getElementById("question-area");
    const fb   = document.getElementById("feedback-area");
    const next = document.getElementById("btn-next");

    if (!area || !q) return;
    if (fb)   fb.innerHTML  = "";
    if (next) next.style.display = "none";

    const typeLabel = {
      quiz:       "Multiple Choice",
      gapfill:    "Fill in the Gaps",
      matching:   "Match the Columns",
      unscramble: "Unscramble the Sentence",
    }[q.type] ?? q.type;

    const questionHTML = `
      <div class="question-card">
        <div class="question-type-label">${typeLabel} · Question ${index + 1}</div>
        ${q.prompt ? `<div class="question-text">${escapeHTML(q.prompt)}</div>` : ""}
        <div id="question-body"></div>
      </div>
    `;
    area.innerHTML = questionHTML;

    const body = document.getElementById("question-body");
    if (!body) return;

    switch (q.type) {
      case "quiz":       this.renderQuiz(q, body);       break;
      case "gapfill":    this.renderGapfill(q, body);    break;
      case "matching":   this.renderMatching(q, body);   break;
      case "unscramble": this.renderUnscramble(q, body); break;
    }
  }

  // ════════════════════════════════════════════
  // QUIZ
  // ════════════════════════════════════════════
  renderQuiz(q, body) {
    const letters = ["A","B","C","D","E"];
    body.innerHTML = `
      <div class="mc-options">
        ${q.options.map((opt, i) => `
          <button class="mc-option" data-index="${i}">
            <span class="mc-option-letter">${letters[i]}</span>
            <span>${escapeHTML(opt)}</span>
          </button>
        `).join("")}
      </div>
    `;

    body.querySelectorAll(".mc-option").forEach(btn => {
      btn.addEventListener("click", () => {
        if (this._answered) return;
        this._answered = true;

        const chosen  = parseInt(btn.dataset.index);
        const correct = chosen === q.correctIndex;

        // Visual feedback
        body.querySelectorAll(".mc-option").forEach((b, i) => {
          b.disabled = true;
          if (i === q.correctIndex) b.classList.add("correct");
          else if (i === chosen && !correct) b.classList.add("wrong");
        });

        this.showFeedback(correct, q.explanation);
        this.recordAnswer(correct, q.options[chosen], q.options[q.correctIndex]);
      });
    });
  }

  // ════════════════════════════════════════════
  // GAP FILL
  // ════════════════════════════════════════════
  renderGapfill(q, body) {
    // q.sentence: "I ___ to school every day."
    // q.answers: ["go"]  (one per blank, in order)
    // q.wordBank: ["go","went","goes"] (optional)

    const blanks   = [];
    let   gapIndex = 0;
    const html = q.sentence.replace(/___/g, () => {
      const id = `gap-${gapIndex++}`;
      blanks.push(id);
      return `<input class="gap-input" id="${id}" autocomplete="off" spellcheck="false"
                     placeholder="…" size="${Math.max(6, (q.answers[blanks.length - 1] ?? "").length + 2)}" />`;
    });

    body.innerHTML = `
      ${q.wordBank?.length ? `
        <div class="gapfill-word-bank" id="word-bank">
          ${q.wordBank.map(w => `
            <button class="gapfill-chip" data-word="${escapeHTML(w)}">${escapeHTML(w)}</button>
          `).join("")}
        </div>` : ""}
      <div class="gapfill-sentence">${html}</div>
      <button class="btn btn-primary btn-sm" id="btn-check-gaps">Check ✓</button>
    `;

    // Word bank → click to fill next empty gap
    body.querySelectorAll(".gapfill-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (chip.classList.contains("used")) return;
        const firstEmpty = blanks.map(id => document.getElementById(id))
          .find(inp => inp && !inp.value.trim() && !inp.disabled);
        if (firstEmpty) {
          firstEmpty.value = chip.dataset.word;
          chip.classList.add("used");
          firstEmpty.focus();
        }
      });
    });

    document.getElementById("btn-check-gaps")?.addEventListener("click", () => {
      if (this._answered) return;
      this._answered = true;

      let allCorrect = true;
      blanks.forEach((id, i) => {
        const inp      = document.getElementById(id);
        if (!inp) return;
        inp.disabled   = true;
        const expected = (q.answers[i] ?? "").toLowerCase().trim();
        const given    = inp.value.toLowerCase().trim();
        const correct  = given === expected;
        inp.classList.add(correct ? "correct" : "wrong");
        if (!correct) {
          allCorrect = false;
          inp.title  = `✓ ${q.answers[i]}`;
        }
      });

      const given    = blanks.map(id => document.getElementById(id)?.value ?? "").join(" | ");
      const expected = q.answers.join(" | ");
      this.showFeedback(allCorrect, q.explanation);
      this.recordAnswer(allCorrect, given, expected);
      document.getElementById("btn-check-gaps")?.remove();
    });
  }

  // ════════════════════════════════════════════
  // MATCHING
  // ════════════════════════════════════════════
  renderMatching(q, body) {
    // q.pairs: [{ left, right }]
    const pairs   = q.pairs ?? [];
    const rights  = shuffle([...pairs.map(p => p.right)]);

    let selectedLeft  = null;
    let selectedRight = null;
    let matchedCount  = 0;

    body.innerHTML = `
      <div class="matching-container">
        <div>
          <div class="matching-col-title">${q.leftLabel || "Column A"}</div>
          <div class="matching-items" id="col-left">
            ${pairs.map((p, i) => `
              <button class="match-item" data-left-index="${i}" data-value="${escapeHTML(p.left)}">
                ${escapeHTML(p.left)}
              </button>`).join("")}
          </div>
        </div>
        <div>
          <div class="matching-col-title">${q.rightLabel || "Column B"}</div>
          <div class="matching-items" id="col-right">
            ${rights.map(r => `
              <button class="match-item" data-right-value="${escapeHTML(r)}">
                ${escapeHTML(r)}
              </button>`).join("")}
          </div>
        </div>
      </div>
    `;

    const tryMatch = () => {
      if (!selectedLeft || !selectedRight) return;

      const leftIndex = parseInt(selectedLeft.dataset.leftIndex);
      const expected  = pairs[leftIndex].right;
      const given     = selectedRight.dataset.rightValue;
      const correct   = given === expected;

      selectedLeft.classList.add("matched", correct ? "correct" : "wrong");
      selectedRight.classList.add("matched", correct ? "correct" : "wrong");
      selectedLeft.disabled  = true;
      selectedRight.disabled = true;

      matchedCount++;
      selectedLeft  = null;
      selectedRight = null;
      body.querySelectorAll(".match-item").forEach(b => b.classList.remove("selected"));

      if (matchedCount === pairs.length) {
        const allCorrect = body.querySelectorAll(".match-item.wrong").length === 0;
        const givenPairs = pairs.map(p => {
          const rightBtn = [...body.querySelectorAll("[data-right-value]")]
            .find(b => b.classList.contains("correct") || b.classList.contains("wrong"));
          return p.left;
        }).join(", ");
        this.showFeedback(allCorrect, q.explanation);
        this.recordAnswer(allCorrect, givenPairs, pairs.map(p => `${p.left}=${p.right}`).join(", "));
        this._answered = true;
      }
    };

    body.querySelectorAll("[data-left-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        body.querySelectorAll("[data-left-index]").forEach(b => b.classList.remove("selected"));
        selectedLeft = btn;
        btn.classList.add("selected");
        tryMatch();
      });
    });

    body.querySelectorAll("[data-right-value]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        body.querySelectorAll("[data-right-value]").forEach(b => b.classList.remove("selected"));
        selectedRight = btn;
        btn.classList.add("selected");
        tryMatch();
      });
    });
  }

  // ════════════════════════════════════════════
  // UNSCRAMBLE
  // ════════════════════════════════════════════
  renderUnscramble(q, body) {
    // q.sentence: "I go to school every day"
    const words       = q.sentence.split(" ");
    const shuffled    = shuffle([...words]);
    const placed      = [];   // words in drop zone in order

    body.innerHTML = `
      <div class="unscramble-drop-zone" id="drop-zone">
        <span class="unscramble-drop-zone-hint" id="drop-hint">Tap words to build the sentence…</span>
      </div>
      <div class="word-chips-pool" id="chips-pool">
        ${shuffled.map((w, i) => `
          <button class="word-chip" data-word="${escapeHTML(w)}" data-pool-index="${i}">
            ${escapeHTML(w)}
          </button>`).join("")}
      </div>
      <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3)">
        <button class="btn btn-ghost btn-sm" id="btn-reset-scramble">↺ Reset</button>
        <button class="btn btn-primary btn-sm" id="btn-check-scramble">Check ✓</button>
      </div>
    `;

    const zone     = document.getElementById("drop-zone");
    const hint     = document.getElementById("drop-hint");
    const pool     = document.getElementById("chips-pool");

    const updateZone = () => {
      // Remove placed chips from zone, keep hint if empty
      [...zone.querySelectorAll(".word-chip")].forEach(c => c.remove());
      if (hint) hint.style.display = placed.length ? "none" : "inline";

      placed.forEach((entry, i) => {
        const chip = document.createElement("button");
        chip.className   = "word-chip in-zone placed";
        chip.textContent = entry.word;
        chip.dataset.zoneIndex = i;
        chip.addEventListener("click", () => {
          if (this._answered) return;
          // Return to pool
          const poolChip = pool?.querySelector(`[data-pool-index="${entry.poolIndex}"]`);
          if (poolChip) poolChip.style.display = "";
          placed.splice(i, 1);
          updateZone();
        });
        zone.appendChild(chip);
      });
    };

    pool?.querySelectorAll(".word-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        if (this._answered) return;
        chip.style.display = "none";
        placed.push({ word: chip.dataset.word, poolIndex: chip.dataset.poolIndex });
        updateZone();
      });
    });

    document.getElementById("btn-reset-scramble")?.addEventListener("click", () => {
      if (this._answered) return;
      placed.length = 0;
      pool?.querySelectorAll(".word-chip").forEach(c => c.style.display = "");
      updateZone();
    });

    document.getElementById("btn-check-scramble")?.addEventListener("click", () => {
      if (this._answered || placed.length === 0) return;
      this._answered = true;

      const given   = placed.map(e => e.word).join(" ");
      const correct = given.toLowerCase() === q.sentence.toLowerCase();

      zone.classList.add(correct ? "correct" : "wrong");
      document.getElementById("btn-reset-scramble")?.remove();
      document.getElementById("btn-check-scramble")?.remove();

      this.showFeedback(correct, q.explanation, correct ? null : `Correct: "${q.sentence}"`);
      this.recordAnswer(correct, given, q.sentence);
    });
  }

  // ════════════════════════════════════════════
  // FEEDBACK + RECORD
  // ════════════════════════════════════════════

  showFeedback(correct, explanation, hint) {
    const fb = document.getElementById("feedback-area");
    if (!fb) return;

    const msg = correct
      ? ["Great job! ✨", "Correct! 🎉", "Perfect! ⭐", "Nailed it! 🔥"][Math.floor(Math.random() * 4)]
      : ["Not quite. Let's review 👀", "Keep trying! 💪", "Almost there! 🌱"][Math.floor(Math.random() * 3)];

    fb.innerHTML = `
      <div class="feedback-banner ${correct ? "correct" : "wrong"}">
        <div>
          <div>${msg}</div>
          ${explanation ? `<div class="feedback-explanation">${escapeHTML(explanation)}</div>` : ""}
          ${hint        ? `<div class="feedback-explanation">${escapeHTML(hint)}</div>`        : ""}
        </div>
      </div>
    `;

    const next = document.getElementById("btn-next");
    if (next) {
      next.style.display = "inline-flex";
      next.textContent   = this.current + 1 < this.questions.length ? "Next →" : "See Results →";
      next.onclick       = () => this.advance();
    }
  }

  recordAnswer(correct, given, expected) {
    this.answers.push({ correct, given, expected });
  }

  advance() {
    this.current++;
    if (this.current < this.questions.length) {
      this.renderQuestion(this.current);
      document.getElementById("feedback-area").innerHTML = "";
      document.getElementById("btn-next").style.display = "none";
    } else {
      this.stopTimer();
      this.showResults();
    }
  }

  // ════════════════════════════════════════════
  // RESULTS
  // ════════════════════════════════════════════

  async showResults() {
    const total   = this.answers.length;
    const correct = this.answers.filter(a => a.correct).length;
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
    const xpMax   = this.mission.xpReward ?? 20;
    const xpEarned= Math.round((pct / 100) * xpMax);

    const emoji = pct >= 90 ? "🏆" : pct >= 70 ? "⭐" : pct >= 50 ? "👏" : "💪";
    const title = pct >= 90 ? "Outstanding!" : pct >= 70 ? "Well done!" : pct >= 50 ? "Good effort!" : "Keep practicing!";

    const circumference = 2 * Math.PI * 45;
    const dashOffset    = circumference * (1 - pct / 100);

    const game = document.getElementById("mission-game");
    if (!game) return;

    game.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-results-back" style="align-self:flex-start">
        ← Back to Missions
      </button>
      <div class="results-screen">
        <div class="results-emoji">${emoji}</div>
        <div class="results-title">${title}</div>

        <div class="results-score-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle class="ring-bg" cx="60" cy="60" r="45"/>
            <circle class="ring-fill" cx="60" cy="60" r="45"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              id="ring-fill-circle"/>
          </svg>
          <div class="results-score-text">
            <div class="results-pct">${pct}%</div>
            <div class="results-pct-label">score</div>
          </div>
        </div>

        <div class="results-xp-earned">⚡ +${xpEarned} XP earned</div>

        <div class="results-breakdown">
          <div style="font-size:var(--text-xs);font-weight:var(--weight-extrabold);
                      color:var(--color-text-muted);text-transform:uppercase;
                      letter-spacing:.05em;margin-bottom:var(--sp-1)">
            Answers
          </div>
          ${this.answers.map((a, i) => {
            const q = this.questions[i];
            return `
              <div class="results-breakdown-row ${a.correct ? "correct-row" : "wrong-row"}">
                <span>${i + 1}. ${escapeHTML(q?.prompt ?? "Question")}</span>
                <span>${a.correct ? "✅" : "❌"}</span>
              </div>
            `;
          }).join("")}
        </div>

        <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" id="btn-retry">↺ Try Again</button>
          <button class="btn btn-ghost"   id="btn-done">Done</button>
        </div>
      </div>
    `;

    // Animate ring
    requestAnimationFrame(() => {
      setTimeout(() => {
        const circle = document.getElementById("ring-fill-circle");
        if (circle) circle.style.strokeDashoffset = dashOffset;
      }, 300);
    });

    // Save result
    try {
      await saveMissionResult(State.user.uid, this.mission.id, {
        score:     pct,
        xpEarned,
        attempts:  1,
        answers:   this.answers,
      });

      // Update local XP
      State.profile.xp = (State.profile.xp ?? 0) + xpEarned;
      updateNavbar(State.profile);

      if (xpEarned > 0) {
        const pop = document.createElement("div");
        pop.className   = "xp-pop";
        pop.textContent = `+${xpEarned} XP ⚡`;
        document.body.appendChild(pop);
        pop.addEventListener("animationend", () => pop.remove(), { once: true });
      }
    } catch (err) {
      console.error("[Engine] save result:", err);
    }

    document.getElementById("btn-results-back")
      ?.addEventListener("click", () => this.onBack?.());
    document.getElementById("btn-done")
      ?.addEventListener("click", () => this.onBack?.());
    document.getElementById("btn-retry")
      ?.addEventListener("click", () => {
        const engine = new MissionEngine(this.mission, this.container, this.onBack);
        engine.start();
      });
  }
}

// ════════════════════════════════════════════
// LINK MISSION
// ════════════════════════════════════════════

function renderLinkMission(mission, container, onBack) {
  const url = mission.linkURL || "";

  container.innerHTML = `
    <div class="mission-game">
      <button class="btn btn-ghost btn-sm" id="btn-link-back" style="align-self:flex-start">
        ← Back to Missions
      </button>
      <div class="mission-link-card">
        <div class="mission-link-icon">${mission.emoji || "🔗"}</div>
        <div class="mission-link-title">${escapeHTML(mission.title)}</div>
        ${mission.description
          ? `<div class="mission-link-desc">${escapeHTML(mission.description)}</div>`
          : ""}
        ${url
          ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer"
                class="btn btn-primary btn-lg">Open Mission ↗</a>
             <button class="btn btn-secondary" id="btn-mark-link-done">
               ✅ Mark as Complete
             </button>`
          : `<p style="color:var(--color-danger);font-size:var(--text-sm)">No link configured.</p>`
        }
      </div>
    </div>
  `;

  document.getElementById("btn-link-back")?.addEventListener("click", onBack);

  document.getElementById("btn-mark-link-done")?.addEventListener("click", async () => {
    const xp = mission.xpReward ?? 10;
    try {
      await saveMissionResult(State.user.uid, mission.id, {
        score: 100, xpEarned: xp, attempts: 1, answers: [],
      });
      State.profile.xp = (State.profile.xp ?? 0) + xp;
      updateNavbar(State.profile);
      showToast(`Mission complete! +${xp} XP ⚡`, "success");
      onBack?.();
    } catch { showToast("Could not save result", "error"); }
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

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
