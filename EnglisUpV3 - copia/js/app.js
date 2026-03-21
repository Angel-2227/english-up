// =============================================
// ENGLISH UP! — js/app.js
// Router, estado global, init, helpers globales
// =============================================

import { initAuth } from "./auth.js";
import { registerSW, initInstallBanner } from "./pwa.js";

// ════════════════════════════════════════════
// ESTADO GLOBAL
// ════════════════════════════════════════════

export const State = {
  user:       null,   // Firebase Auth user
  profile:    null,   // Firestore /users/{uid}
  isAdmin:    false,
  route:      "home",
  routeParams: {},
};

// ════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════

const routes = {};

/**
 * Registra una ruta con su función de render.
 * @param {string}   name   - identificador de ruta (ej. "home", "lesson")
 * @param {Function} render - async (params) => void — escribe en #page-container
 */
export function registerRoute(name, render) {
  routes[name] = render;
}

/**
 * Navega a una ruta, opcionalmente con params.
 * @param {string} name
 * @param {object} [params]
 */
export async function navigate(name, params = {}) {
  State.route       = name;
  State.routeParams = params;

  // Actualizar nav-link activo (top navbar)
  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.route === name);
  });

  // Actualizar bottom nav activo (mobile)
  document.querySelectorAll(".bottom-nav-item[data-route]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.route === name);
  });
  // Profile button: active when on profile route
  const bnavProfileBtn = document.getElementById("bnav-profile-btn");
  if (bnavProfileBtn) {
    bnavProfileBtn.classList.toggle("active", name === "profile");
  }

  const container = document.getElementById("page-container");
  if (!container) return;

  if (!routes[name]) {
    container.innerHTML = `<p style="padding:2rem;color:var(--color-text-muted)">Page not found: ${name}</p>`;
    return;
  }

  // Animación de salida suave
  container.style.opacity = "0";
  container.style.transform = "translateY(6px)";

  await routes[name](params, container);

  // Animación de entrada
  container.style.transition = "opacity 200ms ease, transform 200ms ease";
  requestAnimationFrame(() => {
    container.style.opacity   = "1";
    container.style.transform = "translateY(0)";
  });
}

// ════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════

/**
 * Muestra un toast.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type]
 * @param {number} [duration] ms
 */
export function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = `${icons[type] ?? ""} ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, duration);
}

// ════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════

/**
 * Abre el modal con contenido HTML dado.
 * @param {string} html - contenido para inyectar en .modal-box
 */
export function openModal(html) {
  const overlay = document.getElementById("modal-overlay");
  const box     = document.getElementById("modal-box");
  if (!overlay || !box) return;

  box.innerHTML = html;
  overlay.classList.remove("hidden");

  // Cerrar al click en el fondo
  overlay.onclick = (e) => {
    if (e.target === overlay) closeModal();
  };
}

export function closeModal() {
  const overlay = document.getElementById("modal-overlay");
  overlay?.classList.add("hidden");
}

// ════════════════════════════════════════════
// ESCAPE HTML (prevenir XSS)
// ════════════════════════════════════════════

export function escapeHTML(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ════════════════════════════════════════════
// EXPONER HELPERS GLOBALMENTE
// (para onclick en HTML inline)
// ════════════════════════════════════════════

window.closeModal  = closeModal;
window.openModal   = openModal;
window.showToast   = showToast;
window.navigate    = navigate;

// ════════════════════════════════════════════
// NAV BUTTONS
// ════════════════════════════════════════════

function bindNavButtons() {
  // Logo → home
  document.getElementById("btn-nav-home")
    ?.addEventListener("click", () => navigate("home"));

  // Top nav links
  document.querySelectorAll(".nav-link[data-route]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });

  // Bottom nav route links
  document.querySelectorAll(".bottom-nav-item[data-route]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });

  // Bottom nav profile button
  document.getElementById("bnav-profile-btn")
    ?.addEventListener("click", () => navigate("profile"));
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

async function init() {
  bindNavButtons();
  registerSW();
  initInstallBanner();

  // La auth arranca todo lo demás a través de onAuthStateChanged
  await initAuth();
}

init();