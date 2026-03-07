// =============================================
// ENGLISH UP! — js/app.js
// Router SPA y estado global
// =============================================

import { currentUser, currentProfile, isAdmin } from "./auth.js";

// ════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════

export const State = {
  route:          "home",       // ruta actual
  moduleId:       null,         // módulo activo
  lessonId:       null,         // lección activa
  progress:       null,         // progreso del usuario cargado
  modules:        [],           // lista de módulos cacheada
  theme:          "light"       // light | dark
};

// ════════════════════════════════════════════
// TEMA (oscuro / claro)
// ════════════════════════════════════════════

const THEME_KEY = "eu_theme";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

export function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  const icon = document.getElementById("theme-icon");
  if (icon) icon.textContent = theme === "dark" ? "☀️" : "🌙";
}

export function toggleTheme() {
  applyTheme(State.theme === "dark" ? "light" : "dark");
}

document.getElementById("btn-toggle-theme")
  ?.addEventListener("click", toggleTheme);


// ════════════════════════════════════════════
// ROUTER SPA
// ════════════════════════════════════════════

/**
 * Mapa de rutas:
 * home         → dashboard del estudiante / docente
 * module/:id   → vista de módulo
 * lesson/:mid/:lid → vista de lección
 * profile      → perfil del estudiante
 * teacher      → panel docente (solo admin)
 * badges       → página de insignias
 */

const routes = {
  home:    renderHome,
  module:  renderModule,
  lesson:  renderLesson,
  profile: renderProfile,
  teacher: renderTeacher,
  badges:  renderBadges
};

export function navigate(route, params = {}) {
  State.route    = route;
  State.moduleId = params.moduleId || null;
  State.lessonId = params.lessonId || null;

  // Actualizar URL sin recargar
  const url = buildURL(route, params);
  history.pushState({ route, ...params }, "", url);

  render();
  scrollTo({ top: 0, behavior: "smooth" });
  updateNavLinks(route);
}

function buildURL(route, params) {
  if (route === "module")  return `#module/${params.moduleId}`;
  if (route === "lesson")  return `#lesson/${params.moduleId}/${params.lessonId}`;
  if (route === "profile") return "#profile";
  if (route === "teacher") return "#teacher";
  if (route === "badges")  return "#badges";
  return "#home";
}

// Manejar botón atrás del navegador
window.addEventListener("popstate", (e) => {
  if (e.state?.route) {
    State.route    = e.state.route;
    State.moduleId = e.state.moduleId || null;
    State.lessonId = e.state.lessonId || null;
    render();
    updateNavLinks(State.route);
  }
});

// Parsear hash al cargar la página
function parseHash() {
  const hash = location.hash.replace("#", "");
  if (!hash || hash === "home") return { route: "home" };

  const parts = hash.split("/");
  if (parts[0] === "module" && parts[1]) return { route: "module", moduleId: parts[1] };
  if (parts[0] === "lesson" && parts[1] && parts[2])
    return { route: "lesson", moduleId: parts[1], lessonId: parts[2] };
  if (parts[0] === "profile") return { route: "profile" };
  if (parts[0] === "teacher") return { route: "teacher" };
  if (parts[0] === "badges")  return { route: "badges" };

  return { route: "home" };
}

// ════════════════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════════════════

const mainContent = document.getElementById("main-content");

function render() {
  if (!mainContent) return;
  const fn = routes[State.route] || renderHome;
  mainContent.innerHTML = `<div class="page-loader">Loading...</div>`;
  fn();
}

// ════════════════════════════════════════════
// NAVBAR LINKS
// ════════════════════════════════════════════

function buildNavLinks(role) {
  const navLinks = document.getElementById("nav-links");
  if (!navLinks) return;

  const studentLinks = [
    { route: "home",    label: "🏠 Home"    },
    { route: "badges",  label: "🏅 Badges"  },
    { route: "profile", label: "👤 Profile" }
  ];

  const adminLinks = [
    { route: "home",    label: "🏠 Home"    },
    { route: "teacher", label: "⚙️ Panel"   },
    { route: "badges",  label: "🏅 Badges"  }
  ];

  const links = role === "admin" ? adminLinks : studentLinks;

  navLinks.innerHTML = links.map(l => `
    <button class="nav-link ${State.route === l.route ? "active" : ""}"
            data-route="${l.route}">
      ${l.label}
    </button>
  `).join("");

  navLinks.querySelectorAll("[data-route]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });
}

function updateNavLinks(activeRoute) {
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.route === activeRoute);
  });
}


// ════════════════════════════════════════════
// PÁGINAS (implementación básica — los módulos
// JS específicos inyectan el contenido real)
// ════════════════════════════════════════════

async function renderHome() {
  if (isAdmin) {
    const { renderTeacherHome } = await import("./teacher.js");
    renderTeacherHome();
  } else {
    const { renderStudentDashboard } = await import("./modules.js");
    renderStudentDashboard();
  }
}

async function renderModule() {
  const { renderModuleView } = await import("./modules.js");
  renderModuleView(State.moduleId);
}

async function renderLesson() {
  const { renderLessonView } = await import("./lesson.js");
  renderLessonView(State.moduleId, State.lessonId);
}

async function renderProfile() {
  const { renderProfilePage } = await import("./modules.js");
  renderProfilePage();
}

async function renderTeacher() {
  if (!isAdmin) { navigate("home"); return; }
  const { renderTeacherPanel } = await import("./teacher.js");
  renderTeacherPanel();
}

async function renderBadges() {
  const { renderBadgesPage } = await import("./gamification.js");
  renderBadgesPage();
}


// ════════════════════════════════════════════
// INIT — llamado desde auth.js cuando el usuario está listo
// ════════════════════════════════════════════

window.__EU_INIT_APP = async function(role) {
  initTheme();
  buildNavLinks(role);

  // Parsear hash inicial
  const parsed = parseHash();
  State.route    = parsed.route;
  State.moduleId = parsed.moduleId || null;
  State.lessonId = parsed.lessonId || null;

  // Si es estudiante e intenta ir al panel → redirigir
  if (role !== "admin" && State.route === "teacher") {
    State.route = "home";
  }

  render();

  // ✅ Iniciar chat de IA (crea el panel y enlaza eventos)
  try {
    const { initAI } = await import("./ai-assistant.js");
    await initAI();
  } catch (err) {
    console.warn("[AI] No se pudo inicializar el asistente:", err);
  }
};


// ════════════════════════════════════════════
// HELPERS GLOBALES
// ════════════════════════════════════════════

/** Mostrar toast de notificación */
export function showToast(message, type = "info", duration = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;

  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  toast.innerHTML = `<span>${icons[type] || "ℹ️"}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Abrir modal genérico */
export function openModal(htmlContent) {
  const overlay = document.getElementById("modal-overlay");
  const content = document.getElementById("modal-content");
  if (!overlay || !content) return;

  content.innerHTML = htmlContent;
  overlay.classList.remove("hidden");
}

/** Cerrar modal */
export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay?.classList.add("hidden");
}

document.getElementById("modal-close")
  ?.addEventListener("click", closeModal);

document.getElementById("modal-overlay")
  ?.addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });

/** Confirmar acción destructiva */
export function confirmAction(message) {
  return window.confirm(message);
}

/** Formatear fecha */
export function formatDate(timestamp) {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Truncar texto */
export function truncate(text, maxLen = 80) {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

/** Escapar HTML para evitar XSS */
export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Exponer navigate globalmente para usar desde HTML inline
window.navigate = navigate;
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;