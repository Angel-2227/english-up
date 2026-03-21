// =============================================
// ENGLISH UP! — sw.js (Service Worker)
// PWA: caché offline + base para notificaciones push
// =============================================

const CACHE_NAME = "english-up-v1";

// Archivos a cachear para funcionar offline
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

// ── INSTALL: cachear archivos esenciales ──
self.addEventListener("install", event => {
  console.log("[SW] Instalando...");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpiar cachés viejos ──
self.addEventListener("activate", event => {
  console.log("[SW] Activado ✅");
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estrategia Network-first con fallback a caché ──
self.addEventListener("fetch", event => {
  // Solo manejar requests GET del mismo origen
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Guardar copia fresca en caché
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => {
        // Sin red → servir desde caché
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback a index.html para rutas SPA
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// ── PUSH: recibir notificaciones (listo para el futuro) ──
self.addEventListener("push", event => {
  let data = { title: "English Up!", body: "Tienes una novedad 📚", icon: "/icons/icon-192.png" };

  if (event.data) {
    try { data = { ...data, ...event.data.json() }; }
    catch { data.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  data.icon || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag:   data.tag || "english-up-notif",
      data:  data.url ? { url: data.url } : {}
    })
  );
});

// ── NOTIFICATION CLICK: abrir la app al tocar la notificación ──
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
