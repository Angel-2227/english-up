// =============================================
// ENGLISH UP! — js/auth.js
// Login con Google, roles, flujo de aprobación
// =============================================

import { auth, db }                  from "../firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Estado global del usuario ──
export let currentUser     = null;   // objeto Firebase Auth
export let currentProfile  = null;   // documento Firestore /users/{uid}
export let isAdmin         = false;  // true si está en /admins/{uid}

const provider = new GoogleAuthProvider();

// ── Referencias DOM ──
const loadingScreen  = document.getElementById("loading-screen");
const loginScreen    = document.getElementById("login-screen");
const pendingScreen  = document.getElementById("pending-screen");
const appEl          = document.getElementById("app");
const btnLogin       = document.getElementById("btn-google-login");
const btnLogoutNav   = document.getElementById("btn-logout");
const btnLogoutPend  = document.getElementById("btn-logout-pending");
const loginMessage   = document.getElementById("login-message");
const pendingEmail   = document.getElementById("pending-user-email");
const navAvatar      = document.getElementById("nav-avatar");
const navUsername    = document.getElementById("nav-username");
const navXP          = document.getElementById("nav-xp");

// ── Iniciar sesión con Google ──
btnLogin?.addEventListener("click", async () => {
  showLoginMessage("", "");
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged se encarga del resto
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      showLoginMessage("Could not sign in. Please try again.", "error");
      console.error("[Auth] Login error:", err);
    }
  }
});

// ── Cerrar sesión ──
async function logout() {
  await signOut(auth);
}

btnLogoutNav?.addEventListener("click",  logout);
btnLogoutPend?.addEventListener("click", logout);

// ── Observer principal de autenticación ──
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // No autenticado → mostrar login
    currentUser    = null;
    currentProfile = null;
    isAdmin        = false;
    showScreen("login");
    return;
  }

  currentUser = user;

  try {
    // 1. ¿Es admin?
    const adminSnap = await getDoc(doc(db, "admins", user.uid));
    isAdmin = adminSnap.exists();

    // 2. Obtener o crear perfil en /users
    const userRef  = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Primera vez: crear perfil con status "pending"
      const newProfile = {
        uid:       user.uid,
        name:      user.displayName || "Student",
        email:     user.email,
        photoURL:  user.photoURL  || "",
        status:    isAdmin ? "active" : "pending",
        role:      isAdmin ? "admin"  : "student",
        xp:        0,
        streak:    0,
        lastActive: serverTimestamp(),
        createdAt:  serverTimestamp()
      };
      await setDoc(userRef, newProfile);
      currentProfile = newProfile;
    } else {
      currentProfile = userSnap.data();

      // Si es admin pero el perfil dice student, actualizarlo
      if (isAdmin && currentProfile.role !== "admin") {
        await setDoc(userRef, { role: "admin", status: "active" }, { merge: true });
        currentProfile.role   = "admin";
        currentProfile.status = "active";
      }

      // Actualizar lastActive
      await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
    }

    // 3. Decidir qué pantalla mostrar
    if (isAdmin) {
      showScreen("app");
      populateNavbar();
      window.__EU_INIT_APP && window.__EU_INIT_APP("admin");
      return;
    }

    if (currentProfile.status === "pending") {
      pendingEmail && (pendingEmail.textContent = user.email);
      showScreen("pending");
      return;
    }

    if (currentProfile.status === "blocked") {
      await logout();
      showLoginMessage("Your account has been suspended. Contact your teacher.", "error");
      return;
    }

    // Estudiante activo
    showScreen("app");
    populateNavbar();
    window.__EU_INIT_APP && window.__EU_INIT_APP("student");

  } catch (err) {
    console.error("[Auth] Error loading user profile:", err);
    showLoginMessage("Connection error. Please try again.", "error");
    await logout();
  }
});

// ── Mostrar pantalla correcta ──
function showScreen(screen) {
  // Ocultar loading
  loadingScreen?.classList.add("fade-out");
  setTimeout(() => loadingScreen?.classList.add("hidden"), 400);

  loginScreen?.classList.add("hidden");
  pendingScreen?.classList.add("hidden");
  appEl?.classList.add("hidden");

  if (screen === "login")   loginScreen?.classList.remove("hidden");
  if (screen === "pending") pendingScreen?.classList.remove("hidden");
  if (screen === "app")     appEl?.classList.remove("hidden");
}

// ── Rellenar navbar con datos del usuario ──
function populateNavbar() {
  if (!currentUser) return;

  if (navAvatar) {
    navAvatar.src = currentUser.photoURL || generateAvatarUrl(currentUser.displayName);
    navAvatar.alt = currentUser.displayName;
  }

  if (navUsername) {
    const firstName = (currentUser.displayName || "Student").split(" ")[0];
    navUsername.textContent = firstName;
  }

  if (navXP && currentProfile) {
    navXP.textContent = `${currentProfile.xp || 0} XP`;
  }
}

// ── Generar avatar con inicial si no hay foto ──
function generateAvatarUrl(name) {
  const initial = (name || "S").charAt(0).toUpperCase();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=58CC02&color=fff&size=64`;
}

// ── Mostrar mensaje en pantalla de login ──
function showLoginMessage(text, type) {
  if (!loginMessage) return;
  if (!text) { loginMessage.classList.add("hidden"); return; }
  loginMessage.textContent = text;
  loginMessage.className = `login-message login-message--${type}`;
  loginMessage.classList.remove("hidden");
}

// ── Actualizar XP en navbar (llamado desde gamification.js) ──
export function refreshNavXP(xp) {
  if (navXP) navXP.textContent = `${xp} XP`;
}

// ── Exportar helpers para otros módulos ──
export function requireAuth() {
  return !!currentUser;
}

export function requireAdmin() {
  return isAdmin;
}

export function getUserId() {
  return currentUser?.uid || null;
}
