
// =============================================
// ENGLISH UP! — firebase-config.js
// =============================================

import { initializeApp }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Credenciales de Firebase (estas SÍ pueden estar aquí, son públicas por diseño) ──
const firebaseConfig = {
  apiKey: "AIzaSyB-vZc35_PgvOOiLw10HRiOhB9Py3QDXvo",
  authDomain: "english-up-53af6.firebaseapp.com",
  projectId: "english-up-53af6",
  storageBucket: "english-up-53af6.firebasestorage.app",
  messagingSenderId: "947857843451",
  appId: "1:947857843451:web:671414c15e6429416d3c5e"
};

// ── URL de tu Cloudflare Worker (reemplaza con la tuya) ──
// Formato: https://english-up-groq.TU_USUARIO.workers.dev
export const GROQ_WORKER_URL = "https://english-up-groq.mwp.workers.dev/";

// ── Modelo de Groq a usar ──
export const GROQ_MODEL = "llama3-8b-8192";

// ── Inicializar Firebase ──
const app         = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ── Exponer globalmente ──
window.__EU_AUTH = auth;
window.__EU_DB   = db;

console.log("[EnglishUp] Firebase inicializado ✅");