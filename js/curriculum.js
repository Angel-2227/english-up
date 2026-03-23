// =============================================
// ENGLISH UP! — js/curriculum.js
// Mapa curricular interactivo
//   - Estudiante: zigzag path + modal por módulo
//   - Profe:      grid de módulos + detalle completo
// Se sincroniza con el progreso real del estudiante
// en Firestore (progress field en /users/{uid})
// =============================================

import { State, registerRoute, escapeHTML, showToast } from "./app.js";
import { getPublishedModules, getPublishedLessons, getUserProgress } from "./db.js";
import { db } from "../firebase-config.js";
import {
  collection, addDoc, getDocs, updateDoc, doc,
  query, where, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ════════════════════════════════════════════
// SUGGESTIONS — Firestore helpers
// Colección: /topicSuggestions
// ════════════════════════════════════════════

async function createSuggestion(data) {
  await addDoc(collection(db, "topicSuggestions"), {
    studentUid:   data.studentUid,
    studentName:  data.studentName || "Student",
    modId:        data.modId,
    modName:      data.modName,
    sessionN:     data.sessionN || null,
    sessionName:  data.sessionName || null,
    message:      data.message || "",
    status:       "pending",
    createdAt:    serverTimestamp(),
    seenAt:       null,
  });
}

async function getSuggestions() {
  const q = query(
    collection(db, "topicSuggestions"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function markSuggestionSeen(id) {
  await updateDoc(doc(db, "topicSuggestions", id), {
    status: "seen", seenAt: serverTimestamp(),
  });
}

async function markSuggestionDone(id) {
  await updateDoc(doc(db, "topicSuggestions", id), {
    status: "done", seenAt: serverTimestamp(),
  });
}

function watchSuggestions(callback) {
  const q = query(
    collection(db, "topicSuggestions"),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

let _unsubSuggestions = null;

// ════════════════════════════════════════════
// DATOS DEL PLAN CURRICULAR
// Fuente única de verdad del plan 2026
// ════════════════════════════════════════════

const CURRICULUM = [
  {
    id: "m0", order: 0,
    emoji: "🎬", name: "The Hook", level: "A1", sessions: "—",
    goal: "Killing Me Softly como punto de entrada. Vocabulario emocional y primer contacto con Verb To Be.",
    gram: [],
    xpReward: 50,
    badges: ["🎬 The Hook"],
    sessionsData: []
  },
  {
    id: "m1", order: 1,
    emoji: "📗", name: "Who Are You?", level: "A1", sessions: "1–4",
    goal: "Consolidar Verb To Be en todos sus usos. Al final podrás presentarte, hablar de personajes y expresar gustos con confianza.",
    gram: ["Verb To Be", "WH Questions", "Likes & Dislikes"],
    xpReward: 200,
    badges: ["🟢 Who Are You?"],
    sessionsData: [
      { n: 1, name: "Book of Life: personajes y mundo", gram: "Verb To Be: am/is/are · Was/Were intro", acts: "Draw & Describe · oral: '¿Quién es tu favorito?'", eval: false },
      { n: 2, name: "This Is Me", gram: "Verb To Be positivo · negativo · preguntas cortas", acts: "Perfil falso tipo Instagram · entrevistas en parejas", eval: false },
      { n: 3, name: "My Favorites", gram: "Like/love/hate + noun o -ing · Do you like...?", acts: "'My Top 5' list → presentar → encuesta en pizarra", eval: false },
      { n: 4, name: "Review M1 + Quiz", gram: "Verb To Be completo · WH: Who/What/Where/How old", acts: "Quiz 15 Qs · writing: 5 oraciones · autopresentación 60 seg", eval: true }
    ]
  },
  {
    id: "m2", order: 2,
    emoji: "🌍", name: "My World", level: "A1–A2", sessions: "5–8",
    goal: "Familia, hogar y rutinas diarias. Primera lectura de comprensión real. Present Simple entra al final del módulo.",
    gram: ["Possessivos", "There is / There are", "Present Simple"],
    xpReward: 200,
    badges: ["🟡 My World"],
    sessionsData: [
      { n: 5, name: "My Family", gram: "Possessivos: my/his/her/our/their", acts: "Árbol genealógico · 'Who is she in your family?'", eval: false },
      { n: 6, name: "My Home", gram: "There is / There are · preposiciones de lugar", acts: "Gap-fill plano de casa · Q&A: 'Is there a…?'", eval: false },
      { n: 7, name: "My Day", gram: "Present Simple · always/usually/sometimes/never", acts: "Línea de tiempo de un día · PRIMERA lectura real", eval: false },
      { n: 8, name: "Review M2 + Reading", gram: "Present Simple review · There is/are", acts: "Writing: párrafo familia + hogar · quiz en plataforma", eval: true }
    ]
  },
  {
    id: "m3", order: 3,
    emoji: "💪", name: "Actions & Feelings", level: "A2", sessions: "9–12",
    goal: "Present Simple en todos sus usos. Hablar de lo que hacen y sienten. Evaluación oral a mitad del curso.",
    gram: ["Present Simple completo", "Intensificadores", "Análisis de canciones"],
    xpReward: 250,
    badges: ["🟠 Actions Hero"],
    sessionsData: [
      { n: 9,  name: "What Do You Do?",        gram: "Present Simple · 3ª persona -s · Do/Does",           acts: "Entrevista simulada · bio de celebridad en PS",      eval: false },
      { n: 10, name: "How Do You Feel?",        gram: "Adjetivos de emoción · very/really/so · because",  acts: "Reaccionar a clips: 'I feel… because…'",             eval: false },
      { n: 11, name: "Song Analysis Day",       gram: "Present Simple en canciones · WH en texto",        acts: "Elegir canción → circular emociones, subrayar verbos", eval: false },
      { n: 12, name: "Review M3 + Oral ⭐",     gram: "Present Simple completo · WH + Do/Does",           acts: "EVALUACIÓN ORAL: monólogo 90 seg",                    eval: true  }
    ]
  },
  {
    id: "m4", order: 4,
    emoji: "📖", name: "Stories & Past", level: "A2", sessions: "13–16",
    goal: "Narrar eventos pasados. Verbos irregulares en contexto. Conectores narrativos. Book of Life regresa como ancla.",
    gram: ["Past Simple", "Top 20 irregulares", "Conectores narrativos"],
    xpReward: 200,
    badges: ["🔵 Storyteller"],
    sessionsData: [
      { n: 13, name: "Yesterday",            gram: "Past Simple regulares (-ed) · Negativo · preguntas",  acts: "'¿Qué hiciste este fin de semana?' · chismeo",        eval: false },
      { n: 14, name: "Irregular Verbs",      gram: "Top 20 irregulares · Did you...?",                   acts: "Historia colaborativa · memory game de pares",        eval: false },
      { n: 15, name: "Tell Me a Story",      gram: "Past Simple + conectores narrativos",                acts: "Narrar escena del Book of Life en pasado",            eval: false },
      { n: 16, name: "Review M4 + Writing",  gram: "Past Simple completo · When/Where/Why did...?",      acts: "WRITING: recontar Book of Life en 8–10 oraciones",    eval: true  }
    ]
  },
  {
    id: "m5", order: 5,
    emoji: "🗺️", name: "Real World", level: "A2+", sessions: "17–20",
    goal: "Lugares, compras, descripciones detalladas. Orden completo de adjetivos. Comparativos de forma natural.",
    gram: ["Can / Could", "Comparativos", "Adj. orden completo"],
    xpReward: 250,
    badges: ["🟣 Explorer"],
    sessionsData: [
      { n: 17, name: "Out and About",          gram: "There is/are real · Can (habilidad + solicitud)",    acts: "Mapa: dar instrucciones · role-play turista + local", eval: false },
      { n: 18, name: "Shopping & Numbers",     gram: "How much? · this/that/these/those · comparativos",  acts: "Role-play cliente + vendedor · chismeo de compras",  eval: false },
      { n: 19, name: "People & Descriptions",  gram: "Adj. orden completo · relative clauses intro",      acts: "Describir persona sin nombre — la clase adivina",     eval: false },
      { n: 20, name: "Review M5 + Speaking",   gram: "Can/can't · comparativos · adj. order",             acts: "EVALUACIÓN SPEAKING: describir persona 90 seg",       eval: true  }
    ]
  },
  {
    id: "m6", order: 6,
    emoji: "🚀", name: "Express Yourself", level: "A2+–B1", sessions: "21–26",
    goal: "Expresar planes, reflexionar sobre tu historia y presentar todo lo aprendido. La evaluación final es una celebración.",
    gram: ["Going to / Will", "Present Perfect", "Showcase final"],
    xpReward: 500,
    badges: ["🔴 Showcaser", "🏆 Graduate"],
    sessionsData: [
      { n: 21, name: "Plans & Future",      gram: "Going to · Will · Want to / would like to",          acts: "Writing: 'My Plan for This Year' (8+ oraciones)",      eval: false },
      { n: 22, name: "My Story So Far",     gram: "Present Perfect: have/has + p.p. · ever/never",     acts: "'I have always… / I have never…' chain activity",     eval: false },
      { n: 23, name: "Opinions & Discussion", gram: "I think / In my opinion · agree/disagree",        acts: "Taboo / 20 Questions / Pictionary en inglés",          eval: false },
      { n: 24, name: "Showcase Prep",       gram: "Repaso selectivo según gaps individuales",           acts: "Ensayo oral 3 min · feedback · revisión de escrituras", eval: false },
      { n: 25, name: "Dress Rehearsal",     gram: "Toda la gramática del curso en uso real",            acts: "Ensayo completo · pronunciación · Q&A simulado",       eval: false },
      { n: 26, name: "Showcase Day ⭐",     gram: "Todo el curso — estructuras en uso fluido",          acts: "Presentación 3–5 min · portfolio top 3 · ceremonia",   eval: true  }
    ]
  }
];

const TOTAL_XP_POSSIBLE = CURRICULUM.reduce((s, m) => s + m.xpReward, 0);

// ════════════════════════════════════════════
// REGISTRO DE RUTA
// ════════════════════════════════════════════

export function registerCurriculum() {
  registerRoute("curriculum", renderCurriculumPage);
}

// ════════════════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════════════════

async function renderCurriculumPage(_, container) {
  container.innerHTML = buildSkeleton();

  try {
    const isTeacher = State.isAdmin;
    const uid       = State.user?.uid;

    // Cargar progreso real del estudiante desde Firestore
    const progress = uid ? await getUserProgress(uid) : {};

    container.innerHTML = buildPage(isTeacher);
    bindRoleToggle(container, progress, isTeacher);

    // Render inicial según rol
    if (isTeacher) {
      renderTeacherView(container, progress);
    } else {
      renderStudentView(container, progress);
    }

  } catch (err) {
    console.error("[Curriculum]", err);
    container.innerHTML = `
      <div style="text-align:center;padding:4rem 2rem;color:var(--color-text-muted)">
        <p>Could not load curriculum. Please refresh.</p>
      </div>`;
  }
}

// ════════════════════════════════════════════
// PAGE SHELL
// ════════════════════════════════════════════

function buildPage(isTeacher) {
  // Profe: empieza en vista profe (student-view oculto)
  // Estudiante: solo ve su camino, sin toggle
  return `
    <div class="curriculum-page">
      <div class="curr-role-toggle" id="curr-role-toggle" ${!isTeacher ? 'style="display:none"' : ""}>
        <button class="curr-role-btn" data-role="student">Mi camino</button>
        <button class="curr-role-btn active" data-role="teacher">Vista profe</button>
      </div>
      <div id="curr-student-view" ${isTeacher ? 'style="display:none"' : ""}></div>
      <div id="curr-teacher-view" ${!isTeacher ? 'style="display:none"' : ""}></div>
    </div>
  `;
}

function bindRoleToggle(container, progress, isTeacher) {
  if (!isTeacher) return;

  let studentRendered = false;

  container.querySelectorAll(".curr-role-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".curr-role-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const role = btn.dataset.role;
      const studentView = container.querySelector("#curr-student-view");
      const teacherView = container.querySelector("#curr-teacher-view");

      studentView.style.display = role === "student" ? "" : "none";
      teacherView.style.display = role === "teacher" ? "" : "none";

      // Renderizar la vista de estudiante la primera vez que la pide el profe
      if (role === "student" && !studentRendered) {
        renderStudentView(container, progress);
        studentRendered = true;
      }
    });
  });
}

// ════════════════════════════════════════════
// PROGRESS HELPERS
// ════════════════════════════════════════════

/**
 * Determina si un módulo Firestore está completado.
 * El progreso en Firestore es: progress[`${moduleId}_${lessonId}`] = { completed: true }
 * Para los módulos del curriculum usamos una convención especial: `curriculum_m{n}`
 * También detectamos si el estudiante ha completado las lecciones del módulo en la app.
 */
function isModuleDone(currMod, progress) {
  // M0 siempre está hecho (The Hook ya existía)
  if (currMod.id === "m0") return true;
  // Check explícito: curriculum_m0 etc.
  const key = `curriculum_${currMod.id}`;
  if (progress[key]?.completed) return true;
  return false;
}

function getModuleProgress(currMod, progress) {
  if (currMod.sessionsData.length === 0) return { done: 1, total: 1 };
  const total = currMod.sessionsData.length;
  let done = 0;
  currMod.sessionsData.forEach(s => {
    const key = `curriculum_${currMod.id}_s${s.n}`;
    if (progress[key]?.completed) done++;
  });
  return { done, total };
}

function getModuleState(currMod, index, progress) {
  if (isModuleDone(currMod, progress)) return "done";
  // Desbloqueado si el anterior está hecho o es el primero real
  const prev = CURRICULUM[index - 1];
  if (!prev || isModuleDone(prev, progress)) return "active";
  return "locked";
}

function getTotalXP(progress) {
  return CURRICULUM.reduce((sum, m) => {
    if (isModuleDone(m, progress)) return sum + m.xpReward;
    return sum;
  }, 0);
}

// ════════════════════════════════════════════
// STUDENT VIEW — ZIGZAG MAP
// ════════════════════════════════════════════

function renderStudentView(container, progress) {
  const view = container.querySelector("#curr-student-view");
  if (!view) return;

  const totalXP  = getTotalXP(progress);
  const pctXP    = Math.min(100, Math.round((totalXP / TOTAL_XP_POSSIBLE) * 100));
  const doneCount = CURRICULUM.filter((m) => isModuleDone(m, progress)).length;
  // Contar sesiones hechas
  let sesDone = 0;
  let sesTotal = CURRICULUM.reduce((s, m) => s + m.sessionsData.length, 0);
  CURRICULUM.forEach(m => {
    m.sessionsData.forEach(s => {
      const key = `curriculum_${m.id}_s${s.n}`;
      if (progress[key]?.completed) sesDone++;
    });
  });

  view.innerHTML = `
    <!-- Stats header -->
    <div class="curr-stats-header">
      <div class="curr-stats-top">
        <span class="curr-level-label">Tu camino A1 → A2</span>
        <span class="curr-xp-count">⚡ ${totalXP.toLocaleString()} XP</span>
      </div>
      <div class="curr-xp-track">
        <div class="curr-xp-fill" style="width:${pctXP}%"></div>
      </div>
      <div class="curr-stats-row">
        <span class="curr-stat">✅ ${doneCount} módulos</span>
        <span class="curr-stat">📖 ${sesDone}/${sesTotal} sesiones</span>
        <span class="curr-stat">🗓 26 semanas</span>
      </div>
    </div>

    <!-- Zigzag map -->
    <div class="curr-zigzag" id="curr-zigzag-map"></div>
  `;

  buildZigzagMap(view.querySelector("#curr-zigzag-map"), progress);
}

function buildZigzagMap(mapEl, progress) {
  if (!mapEl) return;

  // SVG connector path — zigzag horizontal connectors
  // Each module alternates left/right. We'll use absolute positioned divs.
  const COLS = ["left", "right"];

  let html = "";

  CURRICULUM.forEach((mod, i) => {
    const state   = getModuleState(mod, i, progress);
    const side    = COLS[i % 2]; // even = left, odd = right
    const prog    = getModuleProgress(mod, progress);
    const pct     = mod.sessionsData.length === 0 ? 100 : Math.round((prog.done / prog.total) * 100);

    // Connector from previous node (zigzag SVG line)
    if (i > 0) {
      const prevSide   = COLS[(i - 1) % 2];
      const prevState  = getModuleState(CURRICULUM[i - 1], i - 1, progress);
      const connColor  = prevState === "done" ? "var(--color-secondary)" : "var(--color-border)";
      const connDashed = state === "locked" ? "stroke-dasharray='6 4'" : "";
      // For zigzag, connector row between nodes
      html += `
        <div class="curr-zigzag-connector" style="
          display:flex;
          justify-content:${prevSide === "left" ? "flex-start" : "flex-end"};
          padding:${prevSide === "left" ? "0 0 0 55px" : "0 55px 0 0"};
        ">
          <svg width="200" height="64" viewBox="0 0 200 64" fill="none" style="overflow:visible">
            <path
              d="${
                prevSide === "left"
                  ? "M 0 0 C 80 0, 120 64, 200 64"
                  : "M 200 0 C 120 0, 80 64, 0 64"
              }"
              stroke="${connColor}"
              stroke-width="3"
              stroke-linecap="round"
              ${connDashed}
              fill="none"
            />
          </svg>
        </div>`;
    }

    // Node row
    html += `
      <div class="curr-zigzag-node-row" style="
        display:flex;
        justify-content:${side === "left" ? "flex-start" : "flex-end"};
        padding:${side === "left" ? "0 80px 0 var(--sp-4)" : "0 var(--sp-4) 0 80px"};
      ">
        <div class="curr-node-wrap" data-mod-id="${mod.id}" style="align-items:center">

          <!-- Circle node -->
          <div class="curr-node ${state}${state === "active" ? "" : ""}" style="position:relative">
            <div class="curr-node-emoji">${mod.emoji}</div>
            ${prog.total > 0 && prog.done > 0 && state !== "done" ? `
              <div class="curr-node-mini-progress">${prog.done}/${prog.total}</div>` : ""}
            ${state === "done" ? `
              <div class="curr-node-check">
                <svg viewBox="0 0 12 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 5l3.5 3.5L11 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>` : ""}
            ${state === "locked" ? `<div class="curr-node-lock">🔒</div>` : ""}
            ${pct > 0 && pct < 100 ? `
              <svg style="position:absolute;inset:-6px;width:calc(100% + 12px);height:calc(100% + 12px);transform:rotate(-90deg)" viewBox="0 0 92 92">
                <circle cx="46" cy="46" r="42" fill="none" stroke="var(--color-border)" stroke-width="3"/>
                <circle cx="46" cy="46" r="42" fill="none"
                  stroke="var(--color-primary)"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-dasharray="${2 * Math.PI * 42}"
                  stroke-dashoffset="${2 * Math.PI * 42 * (1 - pct / 100)}"
                />
              </svg>` : ""}
          </div>

          <!-- Label -->
          <div class="curr-node-label" style="text-align:center;margin-top:var(--sp-2)">
            <div class="curr-node-name">${escapeHTML(mod.name)}</div>
            <div class="curr-node-level">${mod.level} · Ses. ${mod.sessions}</div>
          </div>

        </div>
      </div>`;
  });

  // Finish flag
  html += `
    <div style="display:flex;justify-content:center;margin-top:var(--sp-4);padding-bottom:var(--sp-4)">
      <div style="text-align:center;color:var(--color-text-faint);font-size:var(--text-xs)">
        🏆 Showcase Day — Semana 26
      </div>
    </div>`;

  mapEl.innerHTML = html;

  // Bind clicks on unlocked/done nodes
  mapEl.querySelectorAll(".curr-node-wrap").forEach(wrap => {
    const modId = wrap.dataset.modId;
    const mod   = CURRICULUM.find(m => m.id === modId);
    const state = mod ? getModuleState(mod, CURRICULUM.indexOf(mod), progress) : "locked";
    if (state === "locked") return;

    wrap.style.cursor = "pointer";
    wrap.querySelector(".curr-node")?.classList.remove("locked");

    wrap.addEventListener("click", () => openModuleModal(mod, progress, getModuleState(mod, CURRICULUM.indexOf(mod), progress)));
  });
}

// ════════════════════════════════════════════
// MODULE MODAL (slide up from bottom)
// ════════════════════════════════════════════

function openModuleModal(mod, progress, state) {
  // Remove existing modal
  document.getElementById("curr-modal-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id        = "curr-modal-overlay";
  overlay.className = "curr-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  const prog = getModuleProgress(mod, progress);
  const pct  = mod.sessionsData.length === 0 ? 100 : Math.round((prog.done / prog.total) * 100);

  const sesHtml = mod.sessionsData.length === 0
    ? `<p style="color:var(--color-text-muted);font-size:var(--text-sm);padding:var(--sp-4) 0">
         Este módulo fue la sesión de diagnóstico — ya está completado.
       </p>`
    : mod.sessionsData.map((s, idx) => {
        const sKey   = `curriculum_${mod.id}_s${s.n}`;
        const sDone  = progress[sKey]?.completed === true;
        const sActive = !sDone && idx === prog.done && state !== "locked";
        const sNext  = !sDone && !sActive && idx === prog.done + 1;
        const sState = sDone ? "done" : sActive ? "active" : sNext ? "next" : "locked";
        const dotLabel = sDone ? "✓" : s.n;
        const gramChips = s.gram.split("·").slice(0, 3).map(g =>
          `<span class="curr-ses-gram-chip">${escapeHTML(g.trim())}</span>`
        ).join("");
        return `
          <div class="curr-ses-row">
            <div class="curr-ses-dot ${sState}">${dotLabel}</div>
            <div class="curr-ses-info">
              <div class="curr-ses-name">
                ${escapeHTML(s.name)}
                ${s.eval ? `<span class="curr-ses-eval-badge">Evaluación</span>` : ""}
              </div>
              <div class="curr-ses-gram-chips" style="margin-top:var(--sp-1)">
                ${gramChips}
              </div>
            </div>
          </div>`;
      }).join("");

  const gramChipsHtml = mod.gram.map(g =>
    `<span class="curr-gram-chip">${escapeHTML(g)}</span>`
  ).join("");

  overlay.innerHTML = `
    <div class="curr-modal" role="document">
      <div class="curr-modal-handle"></div>

      <div class="curr-modal-header">
        <button class="curr-modal-close" id="curr-modal-close-btn" aria-label="Cerrar">✕</button>
        <div class="curr-modal-mod-row">
          <div class="curr-modal-emoji">${mod.emoji}</div>
          <div>
            <div class="curr-modal-title">${escapeHTML(mod.name)}</div>
            <div class="curr-modal-meta">
              <span class="curr-modal-pill curr-modal-pill-level">${mod.level}</span>
              <span class="curr-modal-pill curr-modal-pill-xp">⚡ ${mod.xpReward} XP</span>
              ${pct > 0 ? `<span class="curr-modal-pill curr-modal-pill-level">${pct}% completado</span>` : ""}
            </div>
          </div>
        </div>
        <div class="curr-modal-goal">${escapeHTML(mod.goal)}</div>
      </div>

      ${mod.gram.length > 0 ? `
        <div class="curr-modal-gram">
          ${gramChipsHtml}
        </div>` : ""}

      <div class="curr-modal-sessions">
        ${mod.sessionsData.length > 0 ? `<div class="curr-modal-ses-title">Sesiones</div>` : ""}
        ${sesHtml}
      </div>

      <div class="curr-modal-suggest-bar">
        <button class="btn btn-ghost btn-sm" id="curr-btn-suggest">
          💡 Proponer tema para mi próxima clase
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click or button
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeModuleModal();
  });
  document.getElementById("curr-modal-close-btn")
    ?.addEventListener("click", closeModuleModal);

  // Close on Escape
  const onKey = e => { if (e.key === "Escape") { closeModuleModal(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  // Suggest button
  document.getElementById("curr-btn-suggest")
    ?.addEventListener("click", () => openSuggestForm(mod));
}

function closeModuleModal() {
  const overlay = document.getElementById("curr-modal-overlay");
  if (!overlay) return;
  overlay.style.animation = "currOverlayOut 200ms var(--ease-default) forwards";
  overlay.querySelector(".curr-modal").style.animation = "currModalOut 200ms var(--ease-default) forwards";
  setTimeout(() => overlay.remove(), 220);
}

// ════════════════════════════════════════════
// TEACHER VIEW
// ════════════════════════════════════════════

let _selectedTeacherMod = CURRICULUM[1];

function renderTeacherView(container, progress) {
  const view = container.querySelector("#curr-teacher-view");
  if (!view) return;

  view.innerHTML = `
    <div class="curr-teacher-header">
      <div class="curr-teacher-title">📋 Plan Curricular 2026</div>
      <div class="curr-teacher-subtitle">A1+ → A2 sólido · 26 sesiones · 1 sesión por semana</div>
    </div>
    <div class="curr-t-tabs">
      <button class="curr-t-tab active" data-ttab="modules">📚 Módulos</button>
      <button class="curr-t-tab" data-ttab="suggestions">
        💡 Sugerencias
        <span class="curr-t-badge hidden" id="curr-suggest-badge">0</span>
      </button>
    </div>
    <div id="curr-t-panel-modules">
      <div class="curr-teacher-grid" id="curr-t-grid"></div>
      <div id="curr-t-detail"></div>
    </div>
    <div id="curr-t-panel-suggestions" style="display:none">
      <div id="curr-t-suggestions-list">
        <div style="padding:var(--sp-6);text-align:center;color:var(--color-text-faint);font-size:var(--text-sm)">
          Cargando sugerencias…
        </div>
      </div>
    </div>
  `;

  // Tab switching
  view.querySelectorAll(".curr-t-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      view.querySelectorAll(".curr-t-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.ttab;
      view.querySelector("#curr-t-panel-modules").style.display    = tab === "modules"     ? "" : "none";
      view.querySelector("#curr-t-panel-suggestions").style.display = tab === "suggestions" ? "" : "none";
    });
  });

  renderTeacherGrid(view, progress);
  renderTeacherDetail(view, _selectedTeacherMod, progress);

  // Real-time suggestions
  if (_unsubSuggestions) _unsubSuggestions();
  _unsubSuggestions = watchSuggestions(suggestions => {
    renderSuggestionsList(view, suggestions);
    const pending = suggestions.filter(s => s.status === "pending").length;
    const badge   = document.getElementById("curr-suggest-badge");
    if (badge) {
      badge.textContent = String(pending);
      badge.classList.toggle("hidden", pending === 0);
    }
  });
}

function renderTeacherGrid(view, progress) {
  const grid = view.querySelector("#curr-t-grid");
  if (!grid) return;

  grid.innerHTML = CURRICULUM.map(mod => {
    const prog = getModuleProgress(mod, progress);
    const pct  = mod.sessionsData.length === 0 ? 100 : Math.round((prog.done / prog.total) * 100);
    const isSelected = _selectedTeacherMod?.id === mod.id;
    return `
      <div class="curr-t-mod ${isSelected ? "selected" : ""}" data-t-mod="${mod.id}">
        <div class="curr-t-mod-top">
          <span style="font-size:18px">${mod.emoji}</span>
          <span class="curr-t-mod-name">${escapeHTML(mod.name)}</span>
          <span class="curr-t-level">${mod.level}</span>
        </div>
        <div class="curr-t-prog-row">
          <div class="curr-t-prog-track">
            <div class="curr-t-prog-fill" style="width:${pct}%"></div>
          </div>
          <span class="curr-t-prog-label">${pct}%</span>
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".curr-t-mod").forEach(card => {
    card.addEventListener("click", () => {
      _selectedTeacherMod = CURRICULUM.find(m => m.id === card.dataset.tMod);
      renderTeacherGrid(view, progress);
      renderTeacherDetail(view, _selectedTeacherMod, progress);
    });
  });
}

function renderTeacherDetail(view, mod, progress) {
  const panel = view.querySelector("#curr-t-detail");
  if (!panel || !mod) return;

  const gramHtml = mod.gram.map(g =>
    `<span class="curr-gram-chip">${escapeHTML(g)}</span>`
  ).join("");

  const sesHtml = mod.sessionsData.length === 0
    ? `<p style="padding:var(--sp-4) 0;color:var(--color-text-muted);font-size:var(--text-sm)">
         Módulo de diagnóstico — ya completado.
       </p>`
    : mod.sessionsData.map(s => `
        <div class="curr-t-ses-item">
          <div class="curr-t-ses-num ${s.eval ? "eval" : ""}">${s.n}</div>
          <div class="curr-t-ses-info">
            <div class="curr-t-ses-name">
              ${escapeHTML(s.name)}
              ${s.eval ? `<span class="curr-eval-tag">Evaluación</span>` : ""}
            </div>
            <div class="curr-t-ses-gram">${escapeHTML(s.gram)}</div>
            <div class="curr-t-ses-acts">${escapeHTML(s.acts)}</div>
          </div>
        </div>`).join("");

  panel.innerHTML = `
    <div class="curr-t-detail">
      <div class="curr-t-detail-header">
        <div class="curr-t-detail-emoji">${mod.emoji}</div>
        <div>
          <div class="curr-t-detail-title">${escapeHTML(mod.name)}</div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin:var(--sp-1) 0">
            <span class="curr-modal-pill curr-modal-pill-level">${mod.level}</span>
            <span class="curr-modal-pill curr-modal-pill-level">Ses. ${mod.sessions}</span>
            <span class="curr-modal-pill curr-modal-pill-xp">⚡ ${mod.xpReward} XP</span>
          </div>
          <div class="curr-t-detail-goal">${escapeHTML(mod.goal)}</div>
        </div>
      </div>
      ${mod.gram.length > 0 ? `<div class="curr-t-gram-row">${gramHtml}</div>` : ""}
      <div class="curr-t-ses-list">${sesHtml}</div>
    </div>`;
}

// ════════════════════════════════════════════
// SUGGEST FORM (student)
// ════════════════════════════════════════════

function openSuggestForm(contextMod) {
  // Remove existing modal first
  closeModuleModal();

  const overlay = document.createElement("div");
  overlay.id        = "curr-modal-overlay";
  overlay.className = "curr-modal-overlay";

  const moduleOptions = CURRICULUM.map(m =>
    `<option value="${m.id}" ${m.id === contextMod?.id ? "selected" : ""}>${m.emoji} ${m.name}</option>`
  ).join("");

  overlay.innerHTML = `
    <div class="curr-modal" role="document">
      <div class="curr-modal-handle"></div>
      <div class="curr-modal-header">
        <button class="curr-modal-close" id="curr-suggest-close">✕</button>
        <div class="curr-modal-mod-row">
          <div class="curr-modal-emoji">💡</div>
          <div>
            <div class="curr-modal-title">Proponer tema</div>
            <div class="curr-modal-goal">Cuéntame qué quieres practicar en tu próxima clase. Lo tendré en cuenta al preparar la sesión.</div>
          </div>
        </div>
      </div>
      <div class="curr-modal-sessions" style="padding-bottom:var(--sp-2)">
        <div class="curr-modal-ses-title">Módulo relacionado</div>
        <select id="curr-suggest-mod" class="form-select" style="width:100%;margin-bottom:var(--sp-4)">
          ${moduleOptions}
        </select>

        <div id="curr-suggest-ses-wrap">
          <div class="curr-modal-ses-title">Sesión (opcional)</div>
          <select id="curr-suggest-ses" class="form-select" style="width:100%;margin-bottom:var(--sp-4)">
            <option value="">— Cualquier sesión del módulo —</option>
          </select>
        </div>

        <div class="curr-modal-ses-title">Tu propuesta</div>
        <textarea id="curr-suggest-msg" class="form-textarea"
          placeholder="Ej: me gustaría practicar cómo hablar de mi trabajo, o hablar sobre una serie que estoy viendo…"
          rows="4" style="width:100%;resize:none;margin-bottom:var(--sp-4)"></textarea>
      </div>
      <div class="curr-modal-suggest-bar" style="justify-content:flex-end;gap:var(--sp-3)">
        <button class="btn btn-ghost btn-sm" id="curr-suggest-cancel">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="curr-suggest-send">Enviar propuesta</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Populate sessions when module changes
  function populateSessions(modId) {
    const mod  = CURRICULUM.find(m => m.id === modId);
    const sel  = document.getElementById("curr-suggest-ses");
    if (!sel || !mod) return;
    sel.innerHTML = `<option value="">— Cualquier sesión del módulo —</option>` +
      mod.sessionsData.map(s =>
        `<option value="${s.n}">Sesión ${s.n} — ${escapeHTML(s.name)}</option>`
      ).join("");
  }

  populateSessions(contextMod?.id || CURRICULUM[0].id);

  document.getElementById("curr-suggest-mod")?.addEventListener("change", e => {
    populateSessions(e.target.value);
  });

  const close = () => {
    overlay.style.animation = "currOverlayOut 200ms var(--ease-default) forwards";
    overlay.querySelector(".curr-modal").style.animation = "currModalOut 200ms var(--ease-default) forwards";
    setTimeout(() => overlay.remove(), 220);
  };

  document.getElementById("curr-suggest-close")?.addEventListener("click", close);
  document.getElementById("curr-suggest-cancel")?.addEventListener("click", close);
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  document.getElementById("curr-suggest-send")?.addEventListener("click", async () => {
    const modId   = document.getElementById("curr-suggest-mod")?.value;
    const sesN    = document.getElementById("curr-suggest-ses")?.value;
    const message = document.getElementById("curr-suggest-msg")?.value?.trim();
    const mod     = CURRICULUM.find(m => m.id === modId);
    const ses     = sesN ? mod?.sessionsData.find(s => String(s.n) === sesN) : null;

    if (!message) {
      document.getElementById("curr-suggest-msg")?.focus();
      return;
    }

    const btn = document.getElementById("curr-suggest-send");
    btn.disabled    = true;
    btn.textContent = "Enviando…";

    try {
      await createSuggestion({
        studentUid:  State.user.uid,
        studentName: State.profile?.nickname || State.profile?.name || "Student",
        modId,
        modName:     mod?.name || modId,
        sessionN:    sesN ? parseInt(sesN) : null,
        sessionName: ses?.name || null,
        message,
      });
      close();
      showToast("¡Propuesta enviada! Tu profe la verá pronto 💡", "success");
    } catch (err) {
      console.error("[Curriculum] suggest:", err);
      showToast("No se pudo enviar. Intenta de nuevo.", "error");
      btn.disabled    = false;
      btn.textContent = "Enviar propuesta";
    }
  });
}

function renderSuggestionsList(view, suggestions) {
  const listEl = view.querySelector("#curr-t-suggestions-list");
  if (!listEl) return;

  if (suggestions.length === 0) {
    listEl.innerHTML = `
      <div style="padding:var(--sp-10);text-align:center;color:var(--color-text-faint)">
        <div style="font-size:2rem;margin-bottom:var(--sp-3)">💡</div>
        <div style="font-size:var(--text-sm)">Aún no hay sugerencias de tus estudiantes.</div>
      </div>`;
    return;
  }

  const statusLabel = { pending: "⏳ Nueva", seen: "👀 Vista", done: "✅ Usada" };
  const statusClass = { pending: "sugg-badge-pending", seen: "sugg-badge-seen", done: "sugg-badge-done" };

  listEl.innerHTML = suggestions.map(s => {
    const mod = CURRICULUM.find(m => m.id === s.modId);
    const ts  = s.createdAt?.toDate?.()?.toLocaleDateString("es-CO", { day: "numeric", month: "short" }) || "";
    return `
      <div class="curr-sugg-card ${s.status === "pending" ? "curr-sugg-pending" : ""}" data-sid="${s.id}">
        <div class="curr-sugg-top">
          <div class="curr-sugg-who">
            <span class="curr-sugg-name">${escapeHTML(s.studentName)}</span>
            <span class="curr-sugg-date">${ts}</span>
          </div>
          <span class="curr-sugg-status-badge ${statusClass[s.status] || ""}">${statusLabel[s.status] || s.status}</span>
        </div>
        <div class="curr-sugg-mod">
          ${mod ? `${mod.emoji} ${escapeHTML(mod.name)}` : escapeHTML(s.modName)}
          ${s.sessionName ? ` · <span style="color:var(--color-text-muted)">Sesión ${s.sessionN} — ${escapeHTML(s.sessionName)}</span>` : ""}
        </div>
        <div class="curr-sugg-message">"${escapeHTML(s.message)}"</div>
        ${s.status !== "done" ? `
          <div class="curr-sugg-actions">
            ${s.status === "pending" ? `
              <button class="btn btn-ghost btn-sm curr-sugg-btn-seen" data-sid="${s.id}">👀 Marcar vista</button>` : ""}
            <button class="btn btn-ghost btn-sm curr-sugg-btn-done" data-sid="${s.id}">✅ Marcar usada</button>
          </div>` : ""}
      </div>`;
  }).join("");

  // Bind actions
  listEl.querySelectorAll(".curr-sugg-btn-seen").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await markSuggestionSeen(btn.dataset.sid);
      } catch { showToast("Error al actualizar.", "error"); }
    });
  });

  listEl.querySelectorAll(".curr-sugg-btn-done").forEach(btn => {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await markSuggestionDone(btn.dataset.sid);
      } catch { showToast("Error al actualizar.", "error"); }
    });
  });
}

// ════════════════════════════════════════════
// ════════════════════════════════════════════

function buildSkeleton() {
  return `
    <div class="curriculum-page">
      <div class="path-skeleton" style="padding:var(--sp-6) 0">
        <div class="skeleton-node" style="height:80px;max-width:300px;margin:0 auto var(--sp-4)"></div>
        <div class="skeleton-node" style="height:80px;width:80px;border-radius:50%;margin:0 auto var(--sp-4)"></div>
        <div class="skeleton-node" style="height:80px;width:80px;border-radius:50%;margin:0 auto var(--sp-4)"></div>
        <div class="skeleton-node" style="height:80px;width:80px;border-radius:50%;margin:0 auto"></div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// EXPORT HELPER para marcar sesión como completa
// Úsalo si quieres hacer el progreso del currículum
// independiente del progreso de lecciones de la app.
// ════════════════════════════════════════════

export { CURRICULUM };