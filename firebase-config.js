// =============================================
// ENGLISH UP! — firebase-config.js
// Credenciales + exports de Firebase
// =============================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase credentials ──────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyB-vZc35_PgvOOiLw10HRiOhB9Py3QDXvo",
  authDomain:        "english-up-53af6.firebaseapp.com",
  projectId:         "english-up-53af6",
  storageBucket:     "english-up-53af6.firebasestorage.app",
  messagingSenderId: "947857843451",
  appId:             "1:947857843451:web:671414c15e6429416d3c5e"
};

// ── Cloudflare Worker proxy para Groq ─────────────────────────────────────────
// Reemplaza con la URL exacta de tu Worker (sin trailing slash)
export const GROQ_WORKER_URL = "https://english-up-groq.mwp.workers.dev";

// ── Modelo Groq ───────────────────────────────────────────────────────────────
export const GROQ_MODEL = "llama-3.1-8b-instant";

// ── Init ──────────────────────────────────────────────────────────────────────
const app        = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Exponer globalmente para scripts legacy si fuera necesario
window.__EU_AUTH = auth;
window.__EU_DB   = db;

console.log("[EnglishUp] Firebase ✅");
