// =============================================
// ENGLISH UP! — js/theme.js
// Sistema de temas unificado:
//   - data-theme: "light" | "dark"  (brillo)
//   - data-skin:  "default" | "valentine" | ...  (temática)
//
// Prioridades de skin:
//   1. Programación activa del teacher (Firestore config/skins → scheduled)
//   2. Skin elegida por el usuario (si está en la lista habilitada)
//   3. Skin del día (autoDate local — fallback sin Firestore)
//   4. "default"
// =============================================

// ════════════════════════════════════════════
// CATÁLOGO CENTRAL DE TEMÁTICAS
// ════════════════════════════════════════════

export const SKINS = {
  default: {
    id:               "default",
    name:             "English Up!",
    emoji:            "📚",
    desc:             "El tema original",
    css:              null,
    autoDate:         null,
    teacherCanToggle: false,
  },
  valentine: {
    id:               "valentine",
    name:             "San Valentín",
    emoji:            "💕",
    desc:             "Amor y rosas para febrero",
    css:              "css/valentine.css",
    autoDate:         { month: 2, dayStart: 10, dayEnd: 14 },
    teacherCanToggle: true,
  },
  // christmas: {
  //   id: "christmas", name: "Navidad", emoji: "🎄",
  //   css: "css/christmas.css",
  //   autoDate: { month: 12, dayStart: 1, dayEnd: 31 },
  //   teacherCanToggle: true,
  // },
  // halloween: {
  //   id: "halloween", name: "Halloween", emoji: "🎃",
  //   css: "css/halloween.css",
  //   autoDate: { month: 10, dayStart: 24, dayEnd: 31 },
  //   teacherCanToggle: true,
  // },
  // jungle: {
  //   id: "jungle", name: "Jungla", emoji: "🌿",
  //   css: "css/jungle.css",
  //   autoDate: null,
  //   teacherCanToggle: true,
  // },
};

// ════════════════════════════════════════════
// KEYS DE ALMACENAMIENTO LOCAL
// ════════════════════════════════════════════

const THEME_KEY = "eu_theme";
const SKIN_KEY  = "eu_skin";

// ════════════════════════════════════════════
// ESTADO INTERNO (cache Firestore)
// ════════════════════════════════════════════

let _skinsConfig = { enabled: [], scheduled: [] };
let _unsubSkins  = null;

// ════════════════════════════════════════════
// STORAGE LOCAL
// ════════════════════════════════════════════

function store(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
}

function retrieve(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}

// ════════════════════════════════════════════
// HELPERS: FECHA Y PROGRAMACIÓN
// ════════════════════════════════════════════

function getAutoDateSkin() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  for (const skin of Object.values(SKINS)) {
    if (!skin.autoDate) continue;
    const { month: m, dayStart, dayEnd } = skin.autoDate;
    if (month === m && day >= dayStart && day <= dayEnd) return skin.id;
  }
  return null;
}

function isScheduleActive(sched) {
  if (!sched.active) return false;
  const now = new Date();

  if (sched.type === "range" && sched.startDate && sched.endDate) {
    const start = new Date(sched.startDate + "T" + (sched.startTime || "00:00") + ":00");
    const end   = new Date(sched.endDate   + "T" + (sched.endTime   || "23:59") + ":59");
    return now >= start && now <= end;
  }

  if (sched.type === "days" && Array.isArray(sched.daysOfWeek)) {
    const todayDow = now.getDay();
    if (!sched.daysOfWeek.includes(todayDow)) return false;
    if (sched.startTime && sched.endTime) {
      const [sh, sm] = sched.startTime.split(":").map(Number);
      const [eh, em] = sched.endTime.split(":").map(Number);
      const mins = now.getHours() * 60 + now.getMinutes();
      return mins >= sh * 60 + sm && mins <= eh * 60 + em;
    }
    return true;
  }

  if (sched.type === "hours" && sched.startTime && sched.endTime) {
    const [sh, sm] = sched.startTime.split(":").map(Number);
    const [eh, em] = sched.endTime.split(":").map(Number);
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= sh * 60 + sm && mins <= eh * 60 + em;
  }

  return false;
}

function getScheduledSkin() {
  for (const sched of (_skinsConfig.scheduled ?? [])) {
    if (isScheduleActive(sched) && SKINS[sched.skinId]) return sched.skinId;
  }
  return null;
}

// ════════════════════════════════════════════
// SKIN — RESOLVER
// ════════════════════════════════════════════

export function resolveActiveSkin() {
  const scheduled = getScheduledSkin();
  if (scheduled) return scheduled;

  const dateSkin = getAutoDateSkin();
  if (dateSkin) return dateSkin;

  const userSkin = retrieve(SKIN_KEY);
  const enabled  = _skinsConfig.enabled ?? [];
  if (userSkin && userSkin !== "default" && enabled.includes(userSkin)) return userSkin;

  return "default";
}

export function getAvailableSkins() {
  const enabled   = _skinsConfig.enabled ?? [];
  const dateSkin  = getAutoDateSkin();
  const scheduled = getScheduledSkin();
  const available = new Set(["default", ...enabled]);
  if (dateSkin)  available.add(dateSkin);
  if (scheduled) available.add(scheduled);
  return [...available].map(id => SKINS[id]).filter(Boolean);
}

export function getEnabledSkins() {
  return _skinsConfig.enabled ?? [];
}

export function _updateSkinsCache(config) {
  _skinsConfig = config;
  const active = resolveActiveSkin();
  applySkin(active, false);
  updateSkinUI(active);
}

// ════════════════════════════════════════════
// APLICAR SKIN
// ════════════════════════════════════════════

let _skinLink = null;

function removeSkinCSS() {
  _skinLink?.remove();
  _skinLink = null;
  document.documentElement.removeAttribute("data-skin");
}

function loadSkinCSS(skinId, cb) {
  removeSkinCSS();
  const skin = SKINS[skinId];
  if (!skin?.css) { cb?.(); return; }
  const link  = document.createElement("link");
  link.rel    = "stylesheet";
  link.href   = skin.css;
  link.onload = () => cb?.();
  document.head.appendChild(link);
  _skinLink = link;
}

export function applySkin(skinId, animate = false) {
  const id = SKINS[skinId] ? skinId : "default";

  if (animate) {
    document.documentElement.classList.add("theme-transitioning");
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 350);
  }

  if (id === "default") {
    removeSkinCSS();
  } else {
    loadSkinCSS(id, () => {
      document.documentElement.setAttribute("data-skin", id);
    });
  }

  if (!getScheduledSkin() && !getAutoDateSkin()) store(SKIN_KEY, id);
  updateSkinUI(id);
}

// ════════════════════════════════════════════
// DARK / LIGHT
// ════════════════════════════════════════════

export function resolveTheme() {
  const s = retrieve(THEME_KEY);
  if (s === "light" || s === "dark") return s;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme, animate = false) {
  if (theme !== "light" && theme !== "dark") return;
  const html = document.documentElement;
  if (animate) {
    html.classList.add("theme-transitioning");
    setTimeout(() => html.classList.remove("theme-transitioning"), 300);
  }
  html.setAttribute("data-theme", theme);
  store(THEME_KEY, theme);

  const meta = document.querySelector("meta[name='theme-color']");
  if (meta) {
    const skin = html.getAttribute("data-skin");
    if (skin === "valentine") {
      meta.content = theme === "dark" ? "#1f0d16" : "#fff5f9";
    } else {
      meta.content = theme === "dark" ? "#231e19" : "#e8a045";
    }
  }
  syncThemeBtn(theme);
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") ?? "light";
  applyTheme(cur === "dark" ? "light" : "dark", true);
}

function syncThemeBtn(theme) {
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.setAttribute("aria-label", theme === "dark" ? "Modo claro" : "Modo oscuro");
    btn.title = theme === "dark" ? "Modo claro" : "Modo oscuro";
  });
}

function watchSystemTheme() {
  window.matchMedia?.("(prefers-color-scheme: dark)")
    .addEventListener("change", e => {
      if (retrieve(THEME_KEY)) return;
      applyTheme(e.matches ? "dark" : "light", true);
    });
}

// ════════════════════════════════════════════
// UI — SELECTOR DEL ESTUDIANTE
// ════════════════════════════════════════════

function updateSkinUI(activeSkinId) {
  const skin = SKINS[activeSkinId] ?? SKINS.default;
  const el   = document.getElementById("current-skin-indicator");
  if (el) el.textContent = `${skin.emoji} ${skin.name}`;
}

export function openSkinSelector() {
  const available   = getAvailableSkins();
  const activeSkin  = resolveActiveSkin();
  const isScheduled = !!getScheduledSkin();
  const isAutoDate  = !!getAutoDateSkin();

  const items = available.map(skin => {
    const isActive = activeSkin === skin.id;
    const isAuto   = (isScheduled || isAutoDate) && activeSkin === skin.id;
    return `
      <button class="skin-option ${isActive ? "skin-option-active" : ""}"
              data-skin-id="${skin.id}"
              onclick="window._applySkinAndClose('${skin.id}')">
        <span class="skin-option-emoji">${skin.emoji}</span>
        <div class="skin-option-info">
          <span class="skin-option-name">${skin.name}</span>
          <span class="skin-option-desc">${skin.desc}</span>
          ${isAuto ? `<span class="skin-option-tag skin-option-tag-auto">✨ Activo automáticamente</span>` : ""}
          ${isActive && !isAuto ? `<span class="skin-option-tag skin-option-tag-on">Activo</span>` : ""}
        </div>
        ${isActive ? `<span class="skin-option-check">✓</span>` : ""}
      </button>`;
  }).join("");

  const emptyNote = available.length <= 1
    ? `<p class="skin-empty-note">Tu profe activará más temáticas cuando estén disponibles 🎨</p>`
    : "";

  const html = `
    <div class="modal-header">
      <h3>🎨 Temáticas</h3>
      <button class="modal-close" onclick="window.closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p class="skin-selector-hint">
        El modo oscuro se puede combinar con cualquier temática.
      </p>
      <div class="skin-options-grid">
        ${items}
        ${emptyNote}
      </div>
    </div>`;

  const overlay = document.getElementById("modal-overlay");
  const box     = document.getElementById("modal-box");
  if (overlay && box) {
    box.innerHTML = html;
    overlay.classList.remove("hidden");
    overlay.onclick = e => { if (e.target === overlay) overlay.classList.add("hidden"); };
  }
}

window._applySkinAndClose = (skinId) => {
  applySkin(skinId, true);
  document.getElementById("modal-overlay")?.classList.add("hidden");
};

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

export function initTheme() {
  const theme = resolveTheme();
  applyTheme(theme, false);
  watchSystemTheme();

  // Suscripción Firestore en tiempo real
  import("./db.js").then(({ watchSkinsConfig }) => {
    if (_unsubSkins) _unsubSkins();
    _unsubSkins = watchSkinsConfig(config => {
      _updateSkinsCache(config);
    });
  }).catch(() => {
    // Sin Firestore: fallback a autoDate local
    const skinId = resolveActiveSkin();
    if (skinId !== "default") applySkin(skinId, false);
  });

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
      btn.addEventListener("click", toggleTheme);
    });
    document.querySelectorAll("[data-skin-selector]").forEach(btn => {
      btn.addEventListener("click", openSkinSelector);
    });
    syncThemeBtn(theme);
    updateSkinUI(resolveActiveSkin());
  });
}

initTheme();

window.toggleTheme      = toggleTheme;
window.openSkinSelector = openSkinSelector;
window.applySkin        = applySkin;
window.getEnabledSkins  = getEnabledSkins;