// =============================================
// ENGLISH UP! — js/ai.js
// Chat AI: Groq via Cloudflare Worker proxy
// + contexto de lección activa
// =============================================

import { State } from "./app.js";
import { GROQ_WORKER_URL, GROQ_MODEL } from "../firebase-config.js";
import { getAppConfig } from "./db.js";
import { extractLessonContext } from "./lesson-context.js";  // ← NUEVO

// ════════════════════════════════════════════
// ESTADO
// ════════════════════════════════════════════

const chat = {
  open:          false,
  lang:          "en",   // "en" | "es"
  history:       [],     // { role, content }[]
  loading:       false,
  lessonContext: null,   // ← NUEVO: { title, type, text } | null
};

// ════════════════════════════════════════════
// SYSTEM PROMPT DINÁMICO  ← reemplaza SYSTEM_PROMPTS estático
// ════════════════════════════════════════════

function buildSystemPrompt() {
  // Bloque de contenido de lección (si existe)
  let lessonBlock = "";
  const lc = chat.lessonContext;
  if (lc?.text) {
    lessonBlock = `

--- CURRENT LESSON ---
Title: ${lc.title}
${lc.text}
--- END OF LESSON ---
Use the lesson content above to answer any questions the student has about it.
If they ask about something not in the lesson, help them with general English questions.`;
  } else if (lc?.type === "html_unreadable") {
    lessonBlock = `\nThe student is currently viewing the lesson "${lc.title}". Help them with any English questions related to it.`;
  }

  if (chat.lang === "es") {
    return `Eres un tutor de inglés amigable para adultos en nivel A1–A2.
El estudiante prefiere explicaciones en español, pero siempre incluye los términos en inglés también.
Usa frases cortas y ejemplos claros.
Si el estudiante comete un error gramatical, corrígelo con amabilidad al final de tu respuesta.
Nunca uses vocabulario complejo sin explicarlo.${lessonBlock}`;
  }

  return `You are a friendly English language tutor for adult learners at A1–A2 level.
Keep explanations simple and encouraging.
Use short sentences. Give examples.
If the student makes a grammar mistake in their message, gently correct it at the end of your reply.
Never use complex vocabulary without explaining it.${lessonBlock}`;
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

export async function initAI() {
  try {
    const cfg = await getAppConfig();
    if (cfg.aiEnabled === false) return;  // AI disabled by teacher
  } catch { /* proceed */ }

  showFAB();
  bindEvents();
  renderWelcome();
}

// ════════════════════════════════════════════
// FAB + PANEL VISIBILITY
// ════════════════════════════════════════════

function showFAB() {
  document.getElementById("ai-fab")?.classList.remove("hidden");
}

async function openPanel() {                          // ← ahora async
  chat.open = true;
  document.getElementById("ai-fab")?.classList.add("hidden");
  document.getElementById("ai-panel")?.classList.remove("hidden");
  document.getElementById("ai-input")?.focus();

  // Extraer contexto de la lección activa al abrir el panel
  chat.lessonContext = await extractLessonContext();

  // Actualizar subtítulo si hay lección
  const status = document.getElementById("ai-status");
  if (status && chat.lessonContext?.title && chat.lessonContext.type !== "html_unreadable") {
    status.textContent = `📖 ${chat.lessonContext.title}`;
  }
}

function closePanel() {
  chat.open = false;
  document.getElementById("ai-fab")?.classList.remove("hidden");
  document.getElementById("ai-panel")?.classList.add("hidden");
}

// ════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════

function bindEvents() {
  document.getElementById("ai-fab")
    ?.addEventListener("click", openPanel);

  document.getElementById("ai-close")
    ?.addEventListener("click", closePanel);

  document.getElementById("ai-send")
    ?.addEventListener("click", handleSend);

  document.getElementById("ai-input")
    ?.addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

  document.getElementById("ai-lang-toggle")
    ?.addEventListener("click", toggleLang);
}

function toggleLang() {
  chat.lang = chat.lang === "en" ? "es" : "en";
  const btn = document.getElementById("ai-lang-toggle");
  if (btn) btn.textContent = chat.lang === "en" ? "🌐 EN" : "🌐 ES";
  const status = document.getElementById("ai-status");
  if (status) status.textContent = chat.lang === "en"
    ? "Responding in English"
    : "Respondiendo en español";
}

// ════════════════════════════════════════════
// WELCOME MESSAGE
// ════════════════════════════════════════════

function renderWelcome() {
  const name = State.profile?.name?.split(" ")[0] || "there";
  appendBotMessage(
    `👋 Hi ${name}! I'm your English assistant. Ask me anything about today's lesson or about English in general!`,
    false
  );
  appendQuickPrompts([
    "What does 'softly' mean?",
    "How do I use 'to be'?",
    "How do I introduce myself?",
    "Explain today's lesson to me",
    "Correct my English: 'I am go to school'",
  ]);
}

function appendQuickPrompts(prompts) {
  const messages = document.getElementById("ai-messages");
  if (!messages) return;

  const wrap = document.createElement("div");
  wrap.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  `;

  prompts.forEach(p => {
    const btn = document.createElement("button");
    btn.textContent = p;
    btn.style.cssText = `
      padding: 4px 10px;
      border-radius: 999px;
      border: 1.5px solid var(--teal-200);
      background: var(--teal-50);
      color: var(--teal-700);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: var(--font-body);
      transition: background 120ms;
    `;
    btn.addEventListener("mouseenter", () => btn.style.background = "var(--teal-100)");
    btn.addEventListener("mouseleave", () => btn.style.background = "var(--teal-50)");
    btn.addEventListener("click", () => {
      const input = document.getElementById("ai-input");
      if (input) { input.value = p; input.focus(); }
      wrap.remove();
    });
    wrap.appendChild(btn);
  });

  messages.appendChild(wrap);
  scrollMessages();
}

// ════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════

async function handleSend() {
  if (chat.loading) return;

  const input = document.getElementById("ai-input");
  const text  = input?.value?.trim();
  if (!text) return;

  input.value = "";

  // Si aún no tenemos contexto de lección, intentar extraerlo ahora
  if (!chat.lessonContext) {
    chat.lessonContext = await extractLessonContext();
  }

  // Track "curious" badge trigger
  try {
    const { awardBadge } = await import("./db.js");
    const badges = State.profile?.badges ?? [];
    if (!badges.includes("curious")) {
      await awardBadge(State.user.uid, "curious");
      State.profile.badges = [...badges, "curious"];
    }
  } catch { /* non-blocking */ }

  appendUserMessage(text);
  chat.history.push({ role: "user", content: text });

  const thinkingId = appendThinking();
  setLoading(true);

  try {
    const reply = await callGroq(chat.history);
    removeThinking(thinkingId);
    appendBotMessage(reply);
    chat.history.push({ role: "assistant", content: reply });

    if (chat.history.length > 20) {
      chat.history = chat.history.slice(-20);
    }
  } catch (err) {
    console.error("[AI]", err);
    removeThinking(thinkingId);
    appendBotMessage("😕 Sorry, I couldn't get a response. Please try again in a moment.");
  } finally {
    setLoading(false);
    input?.focus();
  }
}

// ════════════════════════════════════════════
// GROQ API CALL
// ════════════════════════════════════════════

async function callGroq(history) {
  const messages = [
    { role: "system", content: buildSystemPrompt() },  // ← dinámico
    ...history,
  ];

  const res = await fetch(GROQ_WORKER_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      model:       GROQ_MODEL,
      messages,
      max_tokens:  512,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Worker error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim()
    ?? "I couldn't generate a response. Try again!";
}

// ════════════════════════════════════════════
// MESSAGE DOM HELPERS
// ════════════════════════════════════════════

function appendUserMessage(text) {
  const messages = document.getElementById("ai-messages");
  if (!messages) return;
  const div = document.createElement("div");
  div.className   = "ai-msg ai-msg-user";
  div.textContent = text;
  messages.appendChild(div);
  scrollMessages();
}

function appendBotMessage(text, animate = true) {
  const messages = document.getElementById("ai-messages");
  if (!messages) return;
  const div = document.createElement("div");
  div.className = "ai-msg ai-msg-bot";
  div.innerHTML = formatBotText(text);
  if (animate) {
    div.style.opacity   = "0";
    div.style.transform = "translateY(4px)";
    messages.appendChild(div);
    requestAnimationFrame(() => {
      div.style.transition = "opacity 200ms ease, transform 200ms ease";
      div.style.opacity    = "1";
      div.style.transform  = "translateY(0)";
    });
  } else {
    messages.appendChild(div);
  }
  scrollMessages();
}

let thinkingCounter = 0;

function appendThinking() {
  const messages = document.getElementById("ai-messages");
  if (!messages) return null;
  const id  = `thinking-${++thinkingCounter}`;
  const div = document.createElement("div");
  div.id          = id;
  div.className   = "ai-msg ai-msg-bot thinking";
  div.textContent = "Thinking…";
  messages.appendChild(div);
  scrollMessages();
  return id;
}

function removeThinking(id) {
  document.getElementById(id)?.remove();
}

function scrollMessages() {
  const messages = document.getElementById("ai-messages");
  if (messages) messages.scrollTop = messages.scrollHeight;
}

function setLoading(val) {
  chat.loading = val;
  const send  = document.getElementById("ai-send");
  const input = document.getElementById("ai-input");
  if (send)  send.disabled  = val;
  if (input) input.disabled = val;
}

function formatBotText(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, `<code style="background:var(--neutral-100);padding:1px 5px;border-radius:4px;font-family:monospace">$1</code>`);
  html = html.replace(/\n/g, "<br>");

  return html;
}