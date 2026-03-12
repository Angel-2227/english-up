// =============================================
// ENGLISH UP! — js/theme.js
// Sistema de gestión de tema (claro / oscuro).
// Se inicializa antes del resto de la app para
// evitar el "flash of wrong theme".
// =============================================

const THEME_KEY   = "eu_theme";
const VALID_THEMES = ["light", "dark"];

// ════════════════════════════════════════════
// HELPERS INTERNOS
// ════════════════════════════════════════════

function getStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (VALID_THEMES.includes(stored)) return stored;
  } catch (_) { /* storage puede estar bloqueado */ }
  return null;
}

function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Resuelve el tema efectivo a aplicar.
 * Prioridad: preferencia guardada > preferencia del sistema.
 */
export function resolveTheme() {
  return getStoredTheme() ?? getSystemTheme();
}

// ════════════════════════════════════════════
// APLICAR TEMA
// ════════════════════════════════════════════

/**
 * Aplica un tema al <html> y actualiza el botón toggle.
 * @param {"light"|"dark"} theme
 * @param {boolean} [animate=false] — usar transición suave (no en init)
 */
export function applyTheme(theme, animate = false) {
  if (!VALID_THEMES.includes(theme)) return;

  const html = document.documentElement;

  if (animate) {
    html.classList.add("theme-transitioning");
    // Quitar la clase cuando terminen las transiciones
    html.addEventListener("transitionend", () => {
      html.classList.remove("theme-transitioning");
    }, { once: true });
    // Fallback: si no hay transición, quitar en 300ms
    setTimeout(() => html.classList.remove("theme-transitioning"), 300);
  }

  html.setAttribute("data-theme", theme);

  // Persistir elección
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) { /* silenciar */ }

  // Actualizar meta theme-color del navegador
  const metaThemeColor = document.querySelector("meta[name='theme-color']");
  if (metaThemeColor) {
    metaThemeColor.content = theme === "dark" ? "#231e19" : "#e8a045";
  }

  // Sincronizar botón toggle
  syncToggleButton(theme);
}

// ════════════════════════════════════════════
// TOGGLE
// ════════════════════════════════════════════

/**
 * Alterna entre claro y oscuro con animación.
 */
export function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") ?? "light";
  const next    = current === "dark" ? "light" : "dark";
  applyTheme(next, true);
}

/**
 * Actualiza el icono y aria-label del botón toggle.
 */
function syncToggleButton(theme) {
  const btn = document.getElementById("theme-toggle-btn");
  if (!btn) return;
  btn.setAttribute("aria-label", theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  btn.title = theme === "dark" ? "Modo claro" : "Modo oscuro";
}

// ════════════════════════════════════════════
// ESCUCHAR CAMBIOS DEL SISTEMA
// ════════════════════════════════════════════

/**
 * Escucha cambios en prefers-color-scheme y los aplica
 * SOLO si el usuario no tiene una preferencia guardada.
 */
function watchSystemTheme() {
  window.matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      // Respetar siempre la preferencia guardada del usuario
      if (getStoredTheme()) return;
      applyTheme(e.matches ? "dark" : "light", true);
    });
}

// ════════════════════════════════════════════
// INIT — llamar lo antes posible (anti-flash)
// ════════════════════════════════════════════

/**
 * Inicialización temprana: aplica el tema sin animación
 * para evitar flash. Llamar desde <head> o al inicio del bundle.
 */
export function initTheme() {
  const theme = resolveTheme();
  applyTheme(theme, false);   // sin transición en el arranque
  watchSystemTheme();

  // Enlazar botón toggle cuando el DOM esté listo
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-toggle-btn");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
      syncToggleButton(theme);
    }
  });
}

// Auto-init al importar el módulo
initTheme();

// Exponer para onclick inline si fuera necesario
window.toggleTheme = toggleTheme;
