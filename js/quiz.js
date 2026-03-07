// =============================================
// ENGLISH UP! — js/quiz.js
// Quizzes manuales y auto-generados con Groq
// (via Cloudflare Worker — sin exponer API key)
// =============================================

import { currentUser, isAdmin } from "./auth.js";
import {
  getLesson, updateLesson,
  saveQuizResult, getProgress
} from "./db.js";
import { GROQ_WORKER_URL, GROQ_MODEL } from "../firebase-config.js";
import { showToast, openModal, closeModal, escapeHTML } from "./app.js";
import { checkAutoAwards } from "./gamification.js";

// ════════════════════════════════════════════
// AUTO-GENERAR QUIZ CON GROQ (via Worker)
// ════════════════════════════════════════════

export async function generateQuizWithGroq(lessonContent, numQuestions = 5) {
  const plainText = lessonContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const prompt = `
You are an English teacher creating a quiz for A1–A2 students.
Based on this lesson content, create exactly ${numQuestions} multiple-choice questions.

LESSON CONTENT:
${plainText.slice(0, 2000)}

Rules:
- Questions must be simple and clear (A1–A2 level)
- Each question has exactly 4 options (A, B, C, D)
- Only one correct answer per question
- Include a brief explanation for the correct answer

Respond ONLY with a valid JSON object, no extra text:
{
  "title": "Quiz: [lesson topic]",
  "questions": [
    {
      "question": "...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}`;

  const response = await fetch(GROQ_WORKER_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:       GROQ_MODEL,
      temperature: 0.4,
      max_tokens:  1500,
      messages:    [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) throw new Error(`Worker error: ${response.status}`);

  const data = await response.json();
  const raw  = data.choices?.[0]?.message?.content || "";
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ════════════════════════════════════════════
// MODAL: CREAR / EDITAR QUIZ (ADMIN)
// ════════════════════════════════════════════

export async function openQuizEditor(moduleId, lessonId) {
  const lesson = await getLesson(moduleId, lessonId);
  if (!lesson) { showToast("Lesson not found.", "error"); return; }

  const existing = lesson.quiz || null;

  openModal(`
    <div class="quiz-editor-modal" style="min-width:min(540px,90vw);">
      <h3 style="margin-bottom:var(--space-lg);">❓ Quiz Editor — ${escapeHTML(lesson.title)}</h3>

      <div style="display:flex;gap:var(--space-sm);margin-bottom:var(--space-lg);">
        <button class="btn btn-secondary btn-sm" id="btn-ai-generate">
          ✨ Auto-generate with AI
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-add-question">
          ➕ Add question manually
        </button>
      </div>

      <div id="quiz-questions-list">
        ${existing
          ? renderEditableQuestions(existing.questions)
          : `<p style="color:var(--text-muted);font-family:var(--font-ui);font-size:.9rem;">
               No questions yet. Generate or add manually.
             </p>`}
      </div>

      <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-lg);">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        ${existing
          ? `<button class="btn btn-secondary btn-sm" id="btn-delete-quiz">🗑️ Remove Quiz</button>`
          : ""}
        <button class="btn btn-primary" id="btn-save-quiz">💾 Save Quiz</button>
      </div>
    </div>
  `);

  // Auto-generate
  document.getElementById("btn-ai-generate").addEventListener("click", async () => {
    const btn = document.getElementById("btn-ai-generate");
    btn.disabled = true; btn.textContent = "✨ Generating...";
    try {
      const quiz = await generateQuizWithGroq(lesson.contentBody || lesson.title, 5);
      document.getElementById("quiz-questions-list").innerHTML =
        renderEditableQuestions(quiz.questions);
      showToast("Quiz generated! Review and save.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not generate quiz. Try again.", "error");
    } finally {
      btn.disabled = false; btn.textContent = "✨ Auto-generate with AI";
    }
  });

  // Añadir pregunta manual
  document.getElementById("btn-add-question").addEventListener("click", () => {
    const list   = document.getElementById("quiz-questions-list");
    const emptyP = list.querySelector("p");
    if (emptyP) emptyP.remove();
    list.insertAdjacentHTML("beforeend", renderNewQuestionForm(Date.now()));
  });

  // Borrar quiz
  document.getElementById("btn-delete-quiz")?.addEventListener("click", async () => {
    if (!confirm("Remove this quiz?")) return;
    await updateLesson(moduleId, lessonId, { quiz: null });
    showToast("Quiz removed.", "info");
    closeModal();
  });

  // Guardar quiz
  document.getElementById("btn-save-quiz").addEventListener("click", async () => {
    const questions = collectQuestionsFromForm();
    if (!questions.length) { showToast("Add at least one question.", "warning"); return; }

    const btn = document.getElementById("btn-save-quiz");
    btn.disabled = true; btn.textContent = "Saving...";
    try {
      await updateLesson(moduleId, lessonId, {
        quiz: { title: `Quiz: ${lesson.title}`, questions }
      });
      showToast("Quiz saved ✅", "success");
      closeModal();
    } catch (err) {
      console.error(err); showToast("Error saving quiz.", "error");
    } finally { btn.disabled = false; btn.textContent = "💾 Save Quiz"; }
  });
}

// ════════════════════════════════════════════
// HELPERS: FORMULARIO DE PREGUNTAS
// ════════════════════════════════════════════

function renderEditableQuestions(questions = []) {
  return questions.map((q, i) => `
    <div class="quiz-edit-question" data-qidx="${i}"
         style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
        <strong style="font-size:.85rem;">Q${i + 1}</strong>
        <button class="btn btn-ghost btn-sm"
                onclick="this.closest('.quiz-edit-question').remove()">🗑️</button>
      </div>
      <div class="form-group">
        <input type="text" class="form-input q-text"
          value="${escapeHTML(q.question)}" placeholder="Question text">
      </div>
      ${q.options.map((opt, oi) => `
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);">
          <input type="radio" name="correct-${i}" value="${oi}"
            ${q.correctIndex === oi ? "checked" : ""}>
          <input type="text" class="form-input q-opt"
            value="${escapeHTML(opt)}" placeholder="Option ${oi + 1}" style="flex:1">
        </div>
      `).join("")}
      <div class="form-group" style="margin-top:var(--space-sm);">
        <input type="text" class="form-input q-explain"
          value="${escapeHTML(q.explanation || "")}"
          placeholder="Explanation (optional)">
      </div>
    </div>
  `).join("");
}

function renderNewQuestionForm(uid) {
  return `
    <div class="quiz-edit-question" data-qidx="new-${uid}"
         style="background:var(--bg-secondary);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md);">
      <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
        <strong style="font-size:.85rem;">New Question</strong>
        <button class="btn btn-ghost btn-sm"
                onclick="this.closest('.quiz-edit-question').remove()">🗑️</button>
      </div>
      <div class="form-group">
        <input type="text" class="form-input q-text" placeholder="Write the question...">
      </div>
      ${[0,1,2,3].map(i => `
        <div style="display:flex;align-items:center;gap:var(--space-sm);margin-bottom:var(--space-xs);">
          <input type="radio" name="correct-new-${uid}" value="${i}">
          <input type="text" class="form-input q-opt"
            placeholder="Option ${i + 1}" style="flex:1">
        </div>
      `).join("")}
      <div class="form-group" style="margin-top:var(--space-sm);">
        <input type="text" class="form-input q-explain"
          placeholder="Explanation for the correct answer">
      </div>
    </div>
  `;
}

function collectQuestionsFromForm() {
  const questions = [];
  document.querySelectorAll(".quiz-edit-question").forEach(block => {
    const questionText = block.querySelector(".q-text")?.value?.trim();
    if (!questionText) return;
    const opts    = [...block.querySelectorAll(".q-opt")].map(el => el.value.trim());
    const checked = block.querySelector(`input[type="radio"]:checked`);
    const correct = checked ? parseInt(checked.value) : 0;
    const explain = block.querySelector(".q-explain")?.value?.trim() || "";
    if (opts.some(o => o)) {
      questions.push({
        question:     questionText,
        options:      opts.map((o, idx) => o || `Option ${idx + 1}`),
        correctIndex: correct,
        explanation:  explain
      });
    }
  });
  return questions;
}

// ════════════════════════════════════════════
// QUIZ COMPLETO DE MÓDULO (modal)
// ════════════════════════════════════════════

export async function runModuleQuiz(moduleId, quiz) {
  openModal(`
    <div style="min-width:min(500px,90vw);">
      <h3 style="margin-bottom:var(--space-sm);">📝 ${escapeHTML(quiz.title || "Module Quiz")}</h3>
      <p style="color:var(--text-muted);margin-bottom:var(--space-lg);font-family:var(--font-ui);font-size:.88rem;">
        ${quiz.questions.length} questions · Need 70% to pass
      </p>
      <div id="module-quiz-body"></div>
    </div>
  `);

  let current = 0;
  let score   = 0;
  const total = quiz.questions.length;
  const body  = document.getElementById("module-quiz-body");

  function renderQ() {
    const q = quiz.questions[current];
    body.innerHTML = `
      <div class="progress-wrap progress-wrap--sm" style="margin-bottom:var(--space-lg);">
        <div class="progress-bar" style="width:${(current/total)*100}%"></div>
      </div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:var(--space-sm);font-weight:700;">
        Question ${current + 1} of ${total}
      </div>
      <div style="font-size:1rem;font-weight:700;margin-bottom:var(--space-md);color:var(--text-primary);">
        ${escapeHTML(q.question)}
      </div>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `
          <div class="quiz-option" data-i="${i}">
            <div class="quiz-option__letter">${String.fromCharCode(65+i)}</div>
            <span>${escapeHTML(opt)}</span>
          </div>
        `).join("")}
      </div>
    `;

    body.querySelectorAll(".quiz-option").forEach(btn => {
      btn.addEventListener("click", () => {
        const chosen  = parseInt(btn.dataset.i);
        const correct = q.correctIndex;
        body.querySelectorAll(".quiz-option").forEach((b, i) => {
          b.style.pointerEvents = "none";
          if (i === correct) b.classList.add("correct");
          else if (i === chosen) b.classList.add("wrong");
        });
        if (chosen === correct) score++;
        if (q.explanation) {
          body.insertAdjacentHTML("beforeend",
            `<div style="margin-top:var(--space-md);padding:var(--space-sm) var(--space-md);
                         background:var(--accent-blue-light);border-radius:var(--radius-md);
                         font-size:.85rem;color:var(--text-primary);">
               💡 ${escapeHTML(q.explanation)}
             </div>`);
        }
        setTimeout(() => { current++; current < total ? renderQ() : finishQuiz(); }, 1200);
      });
    });
  }

  async function finishQuiz() {
    const pct  = Math.round((score / total) * 100);
    const pass = pct >= 70;

    body.innerHTML = `
      <div style="text-align:center;padding:var(--space-xl) 0;">
        <div class="quiz-result__score" style="color:${pass ? "var(--accent-green)" : "var(--accent-red)"};">
          ${pct}%
        </div>
        <div class="quiz-result__label">${pass ? "🎉 Excellent!" : "📚 Keep practicing!"}</div>
        <p style="color:var(--text-muted);margin:var(--space-md) 0;font-family:var(--font-ui);">
          ${score} out of ${total} correct
        </p>
        ${pass
          ? `<p style="color:var(--accent-green);font-weight:700;">You unlocked the module badge! 🏅</p>`
          : `<p style="color:var(--text-muted);font-size:.88rem;">You need 70% or more to earn the badge.</p>`}
        <button class="btn btn-ghost" style="margin-top:var(--space-lg);"
                onclick="closeModal()">Close</button>
      </div>
    `;

    await saveQuizResult(currentUser.uid, `module__${moduleId}`, score, total);
    await checkAutoAwards(currentUser.uid, {
      quizPercent:     pct,
      moduleCompleted: pass ? `module_${moduleId}` : null
    });
  }

  renderQ();
}