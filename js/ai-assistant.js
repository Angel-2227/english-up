// =============================================
// ENGLISH UP! — js/ai-assistant.js
// Chat Groq — proxy seguro via Cloudflare Worker
// =============================================

import { currentProfile } from "./auth.js";
import { GROQ_WORKER_URL, GROQ_MODEL } from "../firebase-config.js";
import { State } from "./app.js";
import { getAppConfig } from "./db.js";

// ════════════════════════════════════════════
// ESTADO DEL CHAT
// ════════════════════════════════════════════

const chatState = {
  open:          false,
  lang:          "en",
  history:       [],
  loading:       false,
  moduleContext: null
};

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

export async function initAI() {
  try {
    const cfg = await getAppConfig();
    if (cfg?.aiLanguage) chatState.lang = cfg.aiLanguage;
  } catch { /* silencioso */ }

  buildWidget();
  bindEvents();
}

// ════════════════════════════════════════════
// WIDGET
// ════════════════════════════════════════════

function buildWidget() {
  if (document.getElementById("ai-panel")) return;
  injectChatPanel();
}

function injectChatPanel() {
  const panel = document.createElement("div");
  panel.id        = "ai-panel";
  panel.className = "ai-panel hidden";
  panel.innerHTML = `
    <div class="ai-panel-header">
      <div class="ai-panel-title">
        <span class="ai-avatar">🤖</span>
        <div>
          <div class="ai-name">English Up! AI</div>
          <div class="ai-subtitle" id="ai-subtitle">Ready to help</div>
        </div>
      </div>
      <div class="ai-panel-controls">
        <button class="ai-lang-btn" id="ai-lang-toggle" title="Switch language">🌐 EN</button>
        <button class="ai-close-btn" id="ai-close">✕</button>
      </div>
    </div>
    <div class="ai-messages" id="ai-messages">
      <div class="ai-welcome">
        <p>👋 Hi! I'm your English assistant. Ask me anything about English or practice with me!</p>
        <div class="ai-quick-prompts">
          <button class="ai-quick-btn" data-prompt="What does 'softly' mean?">What does 'softly' mean?</button>
          <button class="ai-quick-btn" data-prompt="Help me use 'to be'">Help me use 'to be'</button>
          <button class="ai-quick-btn" data-prompt="How do I introduce myself?">How do I introduce myself?</button>
        </div>
      </div>
    </div>
    <div class="ai-input-row">
      <textarea id="ai-input" placeholder="Ask me anything..." rows="1"></textarea>
      <button class="ai-send-btn" id="ai-send" title="Send">➤</button>
    </div>
  `;
  document.body.appendChild(panel);
  injectAIStyles();
}

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════

function bindEvents() {
  document.addEventListener("click", (e) => {
    if (e.target.id === "ai-close")          toggleChat(false);
    if (e.target.id === "ai-lang-toggle")    toggleLang();
    if (e.target.id === "ai-send")           sendMessage();
    if (e.target.id === "btn-open-ai")       toggleChat();
    if (e.target.id === "btn-ai-fab")        toggleChat();
    if (e.target.classList.contains("ai-quick-btn")) {
      const prompt = e.target.dataset.prompt;
      if (prompt) {
        const input = document.getElementById("ai-input");
        if (input) { input.value = prompt; sendMessage(); }
      }
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.id === "ai-input" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "ai-input") {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    }
  });
}

// ════════════════════════════════════════════
// TOGGLE CHAT
// ════════════════════════════════════════════

function toggleChat(forceOpen = null) {
  chatState.open = forceOpen !== null ? forceOpen : !chatState.open;

  const panel = document.getElementById("ai-panel");
  const fab   = document.getElementById("btn-ai-fab");

  if (panel) panel.classList.toggle("hidden", !chatState.open);
  if (fab)   fab.style.display = chatState.open ? "none" : "flex";

  if (chatState.open) {
    updateModuleContext();
    setTimeout(() => document.getElementById("ai-input")?.focus(), 100);
  }
}

function updateModuleContext() {
  const subtitle = document.getElementById("ai-subtitle");
  if (!subtitle) return;
  if (State.moduleId) {
    subtitle.textContent  = `Module: ${State.moduleId}`;
    chatState.moduleContext = State.moduleId;
  } else {
    subtitle.textContent  = "Ready to help";
    chatState.moduleContext = null;
  }
}

// ════════════════════════════════════════════
// TOGGLE IDIOMA
// ════════════════════════════════════════════

function toggleLang() {
  chatState.lang    = chatState.lang === "en" ? "es" : "en";
  chatState.history = [];

  const btn = document.getElementById("ai-lang-toggle");
  if (btn) btn.textContent = `🌐 ${chatState.lang.toUpperCase()}`;

  const messages = document.getElementById("ai-messages");
  if (messages) {
    const note = document.createElement("div");
    note.className   = "ai-lang-change-note";
    note.textContent = chatState.lang === "es"
      ? "🌐 Cambiado a español. ¡Hola!"
      : "🌐 Switched to English. Hello!";
    messages.appendChild(note);
    messages.scrollTop = messages.scrollHeight;
  }
}

// ════════════════════════════════════════════
// ENVIAR MENSAJE
// ════════════════════════════════════════════

async function sendMessage() {
  const input = document.getElementById("ai-input");
  const text  = input?.value?.trim();
  if (!text || chatState.loading) return;

  input.value = "";
  input.style.height = "auto";

  appendMessage("user", text);
  chatState.history.push({ role: "user", content: text });

  chatState.loading = true;
  const thinkingId  = appendThinking();

  try {
    const reply = await callGroq(text);
    removeThinking(thinkingId);
    appendMessage("assistant", reply);
    chatState.history.push({ role: "assistant", content: reply });

    // Mantener máximo 20 mensajes en historial
    if (chatState.history.length > 20) {
      chatState.history = chatState.history.slice(-20);
    }
  } catch (err) {
    console.error("[AI]", err);
    removeThinking(thinkingId);
    appendMessage("assistant", chatState.lang === "es"
      ? "Lo siento, no pude conectarme. Intenta de nuevo."
      : "Sorry, I couldn't connect. Please try again.");
  } finally {
    chatState.loading = false;
  }
}

// ════════════════════════════════════════════
// LLAMAR AL WORKER (no al key directo)
// ════════════════════════════════════════════

async function callGroq(userMessage) {
  const systemPrompt = buildSystemPrompt();

  const body = {
    model:       GROQ_MODEL,
    temperature: 0.7,
    max_tokens:  400,
    messages: [
      { role: "system", content: systemPrompt },
      ...chatState.history.slice(-10),
      { role: "user",   content: userMessage }
    ]
  };

  const response = await fetch(GROQ_WORKER_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Worker error: ${response.status}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "(no response)";
}

function buildSystemPrompt() {
  const studentName = currentProfile?.name?.split(" ")[0]
    || currentProfile?.displayName?.split(" ")[0]
    || "student";

  if (chatState.lang === "es") {
    return `Eres un asistente de inglés amigable llamado "English Up! AI".
El estudiante se llama ${studentName}.
${chatState.moduleContext ? `Está trabajando en el módulo: ${chatState.moduleContext}.` : ""}
Reglas:
- Responde siempre en español, pero los ejemplos en inglés con traducción.
- Sé amable, paciente y motivador.
- Vocabulario simple, frases cortas.
- Si el estudiante escribe en inglés con errores, corrígelo con gentileza.
- Máximo 3–4 oraciones por respuesta.`;
  }

  return `You are a friendly English teacher assistant called "English Up! AI".
The student's name is ${studentName}.
${chatState.moduleContext ? `They are studying module: ${chatState.moduleContext}.` : ""}
Rules:
- Always respond in simple English (A1–A2 level).
- Be very friendly, patient, and encouraging.
- Gently correct grammar mistakes with a brief explanation.
- Give practical real-life examples.
- Maximum 3–4 sentences per response.
- Use emojis occasionally 😊`;
}

// ════════════════════════════════════════════
// HELPERS DE MENSAJES
// ════════════════════════════════════════════

function appendMessage(role, content) {
  const messages = document.getElementById("ai-messages");
  if (!messages) return;

  const welcome = messages.querySelector(".ai-welcome");
  if (welcome) welcome.remove();

  const div = document.createElement("div");
  div.className = `ai-msg ai-msg--${role}`;
  div.innerHTML = `<div class="ai-msg-bubble">${formatAIText(content)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function appendThinking() {
  const messages = document.getElementById("ai-messages");
  if (!messages) return null;
  const id  = `thinking-${Date.now()}`;
  const div = document.createElement("div");
  div.className = "ai-msg ai-msg--assistant";
  div.id        = id;
  div.innerHTML = `
    <div class="ai-msg-bubble ai-thinking">
      <span></span><span></span><span></span>
    </div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeThinking(id) {
  if (id) document.getElementById(id)?.remove();
}

function formatAIText(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g,     "<em>$1</em>")
    .replace(/`(.*?)`/g,       "<code>$1</code>")
    .replace(/\n/g,            "<br>");
}

// ════════════════════════════════════════════
// ESTILOS
// ════════════════════════════════════════════

function injectAIStyles() {
  if (document.getElementById("ai-styles")) return;
  const s = document.createElement("style");
  s.id = "ai-styles";
  s.textContent = `
    .ai-panel{position:fixed;bottom:92px;right:24px;z-index:999;width:340px;max-height:520px;background:var(--bg-card);border-radius:20px;box-shadow:0 8px 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--border);animation:aiSlideIn .25s ease}
    @keyframes aiSlideIn{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}
    .ai-panel.hidden{display:none}
    .ai-panel-header{display:flex;align-items:center;justify-content:space-between;padding:.9rem 1rem;background:var(--accent-green);color:white}
    .ai-panel-title{display:flex;align-items:center;gap:.6rem}
    .ai-avatar{font-size:1.6rem}
    .ai-name{font-weight:700;font-size:.95rem}
    .ai-subtitle{font-size:.72rem;opacity:.85}
    .ai-panel-controls{display:flex;align-items:center;gap:.5rem}
    .ai-lang-btn{background:rgba(255,255,255,.2);border:none;color:white;border-radius:20px;padding:3px 10px;cursor:pointer;font-size:.8rem;font-weight:600}
    .ai-close-btn{background:none;border:none;color:white;font-size:1.1rem;cursor:pointer;opacity:.85}
    .ai-messages{flex:1;overflow-y:auto;padding:.75rem;display:flex;flex-direction:column;gap:.5rem}
    .ai-welcome p{color:var(--text-secondary);font-size:.88rem;margin-bottom:.75rem}
    .ai-quick-prompts{display:flex;flex-wrap:wrap;gap:.4rem}
    .ai-quick-btn{background:var(--bg-secondary);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-size:.78rem;cursor:pointer;color:var(--text-primary);transition:all .15s}
    .ai-quick-btn:hover{border-color:var(--accent-green);color:var(--accent-green)}
    .ai-msg{display:flex;max-width:90%}
    .ai-msg--user{align-self:flex-end}
    .ai-msg--assistant{align-self:flex-start}
    .ai-msg-bubble{padding:.55rem .85rem;border-radius:14px;font-size:.875rem;line-height:1.45}
    .ai-msg--user .ai-msg-bubble{background:var(--accent-green);color:white;border-bottom-right-radius:4px}
    .ai-msg--assistant .ai-msg-bubble{background:var(--bg-secondary);color:var(--text-primary);border-bottom-left-radius:4px}
    .ai-msg-bubble code{background:rgba(0,0,0,.1);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.85em}
    .ai-thinking{display:flex;align-items:center;gap:5px;padding:.65rem .85rem!important}
    .ai-thinking span{width:7px;height:7px;border-radius:50%;background:var(--text-secondary);animation:aiDot 1.2s infinite ease-in-out}
    .ai-thinking span:nth-child(2){animation-delay:.2s}
    .ai-thinking span:nth-child(3){animation-delay:.4s}
    @keyframes aiDot{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1.1);opacity:1}}
    .ai-lang-change-note{text-align:center;font-size:.75rem;color:var(--text-secondary);padding:.25rem;font-style:italic}
    .ai-input-row{display:flex;align-items:flex-end;gap:.5rem;padding:.6rem .75rem;border-top:1px solid var(--border)}
    #ai-input{flex:1;background:var(--bg-secondary);border:1px solid var(--border);border-radius:12px;padding:.5rem .75rem;font-size:.875rem;resize:none;outline:none;color:var(--text-primary);font-family:inherit;max-height:120px;transition:border-color .15s}
    #ai-input:focus{border-color:var(--accent-green)}
    .ai-send-btn{background:var(--accent-green);color:white;border:none;border-radius:12px;width:38px;height:38px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
    .ai-send-btn:hover{transform:scale(1.05)}
    @media(max-width:480px){.ai-panel{width:calc(100vw - 24px);right:12px;bottom:84px}}
  `;
  document.head.appendChild(s);
}

window.toggleAIChat = () => toggleChat();