// =============================================
// ENGLISH UP! — js/pwa.js
// Registro de Service Worker + banner de instalación
// =============================================

// ── Registrar el Service Worker ──
export async function registerSW() {
  if (!("serviceWorker" in navigator)) {
    console.warn("[PWA] Service Workers no soportados en este navegador.");
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("[PWA] Service Worker registrado ✅", reg.scope);
    return reg;
  } catch (err) {
    console.error("[PWA] Error registrando SW:", err);
  }
}

// ── Banner de instalación (botón "Instalar app") ──
let deferredPrompt = null;

export function initInstallBanner() {
  // Capturar el evento nativo de instalación
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  // Ocultar banner si ya se instaló
  window.addEventListener("appinstalled", () => {
    console.log("[PWA] App instalada ✅");
    hideInstallBanner();
    deferredPrompt = null;
  });
}

function showInstallBanner() {
  // Si ya existe, no duplicar
  if (document.getElementById("pwa-install-banner")) return;

  const banner = document.createElement("div");
  banner.id = "pwa-install-banner";
  banner.innerHTML = `
    <div class="pwa-banner-content">
      <span class="pwa-banner-icon">📲</span>
      <span class="pwa-banner-text">¡Instala <strong>English Up!</strong> en tu dispositivo</span>
      <button class="pwa-banner-btn" id="pwa-install-btn">Instalar</button>
      <button class="pwa-banner-close" id="pwa-banner-close" aria-label="Cerrar">✕</button>
    </div>
  `;
  document.body.appendChild(banner);

  // Estilos inline para que funcione sin depender del CSS principal
  const style = document.createElement("style");
  style.textContent = `
    #pwa-install-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--color-primary, #e8a045);
      color: #fff;
      padding: 12px 16px;
      z-index: 9999;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
      animation: slideUp 0.3s ease;
    }
    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .pwa-banner-content {
      display: flex;
      align-items: center;
      gap: 10px;
      max-width: 600px;
      margin: 0 auto;
      flex-wrap: wrap;
    }
    .pwa-banner-icon { font-size: 1.4rem; flex-shrink: 0; }
    .pwa-banner-text { flex: 1; font-size: 0.9rem; min-width: 160px; }
    .pwa-banner-btn {
      background: #fff;
      color: var(--color-primary, #e8a045);
      border: none;
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 700;
      cursor: pointer;
      font-size: 0.85rem;
      flex-shrink: 0;
    }
    .pwa-banner-close {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      padding: 4px 8px;
      opacity: 0.8;
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  document.getElementById("pwa-install-btn").addEventListener("click", triggerInstall);
  document.getElementById("pwa-banner-close").addEventListener("click", hideInstallBanner);
}

function hideInstallBanner() {
  const banner = document.getElementById("pwa-install-banner");
  if (banner) banner.remove();
}

async function triggerInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log("[PWA] Resultado instalación:", outcome);
  deferredPrompt = null;
  hideInstallBanner();
}

// ── Pedir permiso para notificaciones (llamar cuando quieras) ──
export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("[PWA] Notificaciones no soportadas.");
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  const result = await Notification.requestPermission();
  console.log("[PWA] Permiso notificaciones:", result);
  return result;
}

// ── Enviar notificación de prueba local ──
export async function sendTestNotification() {
  const perm = await requestNotificationPermission();
  if (perm !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification("English Up! 📚", {
    body: "¡La app está lista! Aquí recibirás tus recordatorios.",
    icon: "/icons/icon-192.png"
  });
}
