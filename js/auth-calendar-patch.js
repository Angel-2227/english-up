// =============================================
// ENGLISH UP! — auth-calendar-patch.js
// Instrucciones de integración del calendario
// en auth.js (onAuthStateChanged)
// =============================================

/*
  PASO 1 — En auth.js, dentro del bloque onAuthStateChanged,
  DESPUÉS de la línea:  const { initAI } = await import("./ai.js");
  AÑADE estas líneas:

  // Calendar
  const { registerCalendar, initCalendarFAB } = await import("./calendar.js");
  registerCalendar();
  initCalendarFAB();

  Ejemplo completo del bloque (al final de onAuthStateChanged, antes de navigate("home")):

        // AI widget
        const { initAI } = await import("./ai.js");
        initAI();

        // *** NUEVO: Calendar ***
        const { registerCalendar, initCalendarFAB } = await import("./calendar.js");
        registerCalendar();
        initCalendarFAB();

        // Navegar a home
        navigate("home");


  PASO 2 — En index.html, añade el link al CSS del calendario
  dentro del <head>, junto a los demás links de CSS:

  <link rel="stylesheet" href="css/calendar.css" />


  PASO 3 — (Opcional pero recomendado)
  Añade un botón de calendario en el bottom nav (index.html).
  Busca tu bottom-nav y añade un ítem como este:

  <button class="bottom-nav-item" data-route="calendar" title="Schedule">
    📅
    <span>Schedule</span>
  </button>

  Y en el top navbar (para estudiantes):
  <button class="nav-link" data-route="calendar">📅 Schedule</button>

  Para el teacher, también puedes añadirlo en sus nav-links.


  PASO 4 — Índices de Firestore necesarios (Firebase Console):
  Ve a Firestore → Índices → Añadir los siguientes índices compuestos:

  Colección: schedules
    - date ASC, startTime ASC     (ya cubre el query de rango de fechas)

  Colección: scheduleRequests
    - preferredDate ASC           (para el query por mes)
    - studentUid ASC, createdAt DESC  (para watchMyRequests)
    - status ASC, createdAt ASC   (para getPendingRequests)

  Firebase normalmente los sugiere automáticamente en la consola
  cuando falla el primer query — solo haz clic en el link del error.


  PASO 5 — Reglas de Firestore (firestore.rules):
  Añade estas reglas para las nuevas colecciones:

  match /schedules/{scheduleId} {
    allow read: if request.auth != null;
    allow write: if request.auth != null
                 && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
  }

  match /scheduleRequests/{reqId} {
    allow read: if request.auth != null
                && (
                  resource.data.studentUid == request.auth.uid
                  || exists(/databases/$(database)/documents/admins/$(request.auth.uid))
                );
    allow create: if request.auth != null
                  && request.resource.data.studentUid == request.auth.uid;
    allow update: if request.auth != null
                  && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
  }

*/

// ── RESUMEN DE ARCHIVOS NUEVOS ─────────────────────────────────────────────
// css/calendar.css       → estilos del calendario
// js/calendar-db.js     → helpers de Firestore
// js/calendar.js        → lógica UI + rutas del calendario
// js/auth-calendar-patch.js → este archivo (instrucciones)
