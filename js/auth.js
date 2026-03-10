// =============================================
// ENGLISH UP! — js/auth.js
// Google login, roles, onAuthStateChanged,
// navbar updates, avatar picker
// =============================================

import { auth, db }          from "../firebase-config.js";
import { State, navigate, showToast, openModal, closeModal, escapeHTML }
                             from "./app.js";
import {
  GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Predefined avatars (emoji) ────────────────────────────────────────────────
export const AVATARS = [
  "🦊","🐼","🐸","🦁","🐯","🐨","🦄","🐙","🦋","🐬",
  "🌸","🌻","🍀","⭐","🌈","🔥","🎸","🎨","🚀","🎯",
  "🏄","🧗","🎭","🦸","🧙","🤖","👾","🎮","📚","✏️"
];

const provider = new GoogleAuthProvider();

// ════════════════════════════════════════════
// SCREEN HELPERS
// ════════════════════════════════════════════

function showScreen(id) {
  ["loading-screen","login-screen","pending-screen","app"]
    .forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle("hidden", s !== id);
    });
}

// ════════════════════════════════════════════
// LOGIN / LOGOUT
// ════════════════════════════════════════════

async function loginWithGoogle() {
  const errEl = document.getElementById("login-error");
  if (errEl) { errEl.textContent = ""; errEl.classList.add("hidden"); }

  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged se encarga del resto
  } catch (err) {
    if (err.code === "auth/popup-closed-by-user") return;
    console.error("[Auth] login error:", err);
    if (errEl) {
      errEl.textContent = "Could not sign in. Please try again.";
      errEl.classList.remove("hidden");
    }
  }
}

async function logout() {
  await signOut(auth);
  State.user    = null;
  State.profile = null;
  State.isAdmin = false;
  showScreen("login-screen");
}

// ════════════════════════════════════════════
// FIRESTORE — crear o traer perfil de usuario
// ════════════════════════════════════════════

async function getOrCreateProfile(user) {
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  // Nuevo usuario — crear con status pending
  const profile = {
    name:        user.displayName || "Student",
    email:       user.email,
    photoURL:    user.photoURL || "",
    avatar:      null,           // emoji o null (usa foto Google)
    nickname:    "",             // apodo personalizado
    status:      "pending",
    role:        "student",
    xp:          0,
    streak:      0,
    lastActive:  null,
    badges:      [],
    classroomId: null,           // salón asignado
    createdAt:   serverTimestamp(),
  };

  await setDoc(ref, profile);
  return { id: user.uid, ...profile };
}

// ════════════════════════════════════════════
// NAVBAR — actualizar avatar, XP, streak
// ════════════════════════════════════════════

export function updateNavbar(profile) {
  // Avatar: emoji tiene prioridad sobre foto Google
  const avatarImg = document.getElementById("nav-avatar");
  if (avatarImg) {
    if (profile.avatar) {
      avatarImg.src = emojiToDataURL(profile.avatar, 72);
    } else {
      avatarImg.src = profile.photoURL || makeInitialsAvatar(profile.name);
    }
    avatarImg.alt = profile.name;
  }

  const xpEl     = document.getElementById("nav-xp");
  const streakEl = document.getElementById("nav-streak");
  if (xpEl)     xpEl.textContent    = (profile.xp     ?? 0).toLocaleString();
  if (streakEl) streakEl.textContent = profile.streak  ?? 0;

  // Dropdown info: mostrar nickname si tiene, si no nombre real
  const ddName  = document.getElementById("dd-name");
  const ddEmail = document.getElementById("dd-email");
  if (ddName)  ddName.textContent  = profile.nickname || profile.name  || "";
  if (ddEmail) ddEmail.textContent = profile.email || "";

  // Mostrar/ocultar nav links según rol
  document.getElementById("nav-links-student")
    ?.classList.toggle("hidden",  State.isAdmin);
  document.getElementById("nav-links-teacher")
    ?.classList.toggle("hidden", !State.isAdmin);
}

// ════════════════════════════════════════════
// AVATAR HELPERS
// ════════════════════════════════════════════

/** Convierte emoji a data URL */
export function emojiToDataURL(emoji, size = 72) {
  const canvas = document.createElement("canvas");
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.font = `${size * 0.65}px serif`;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return canvas.toDataURL();
}

/** Genera avatar de iniciales como data URL */
function makeInitialsAvatar(name) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 72;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fcd34d";
  ctx.fillRect(0, 0, 72, 72);
  ctx.fillStyle = "#78350f";
  ctx.font = "bold 30px Nunito, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase();
  ctx.fillText(initials, 36, 36);
  return canvas.toDataURL();
}

// ════════════════════════════════════════════
// AVATAR PICKER MODAL
// Acepta callback opcional (onSaved) para
// que el perfil pueda refrescarse.
// ════════════════════════════════════════════

export function openAvatarPicker(onSaved = null) {
  const currentAvatar = State.profile?.avatar ?? null;
  const photoURL      = State.profile?.photoURL ?? "";

  const options = AVATARS.map(em => `
    <button class="avatar-option ${em === currentAvatar ? "selected" : ""}"
            data-emoji="${em}"
            title="${em}">
      ${em}
    </button>
  `).join("");

  openModal(`
    <div class="modal-header">
      <h3>Choose your avatar</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="avatar-preview-row">
        <img id="avatar-picker-preview"
             src="${currentAvatar ? emojiToDataURL(currentAvatar, 60) : (photoURL || makeInitialsAvatar(State.profile?.name))}"
             class="avatar-preview-img" alt="preview" />
        <span class="avatar-preview-info">
          This is how your classmates and teacher will see you.
        </span>
      </div>
      <div class="avatar-section-title">Pick an emoji avatar</div>
      <div class="avatar-picker-grid" id="avatar-grid">
        ${options}
      </div>
      ${photoURL ? `
        <div class="avatar-section-title" style="margin-top:var(--sp-5)">Or use your Google photo</div>
        <div style="margin-top:var(--sp-2)">
          <button class="avatar-option ${!currentAvatar ? "selected" : ""}"
                  data-emoji="__google__" style="width:52px;height:52px;overflow:hidden;padding:0;">
            <img src="${photoURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="Google photo"/>
          </button>
        </div>
      ` : ""}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-avatar">Save avatar</button>
    </div>
  `);

  let selected = currentAvatar ?? (photoURL ? "__google__" : null);

  // Preview on pick
  document.getElementById("avatar-grid")?.addEventListener("click", e => {
    const btn = e.target.closest(".avatar-option");
    if (!btn) return;
    selected = btn.dataset.emoji;
    document.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    const preview = document.getElementById("avatar-picker-preview");
    if (preview) {
      preview.src = selected === "__google__"
        ? photoURL
        : emojiToDataURL(selected, 60);
    }
  });

  // Also handle the Google photo button outside the grid
  document.querySelector(".avatar-option[data-emoji='__google__']")?.addEventListener("click", e => {
    const btn = e.currentTarget;
    selected = "__google__";
    document.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    const preview = document.getElementById("avatar-picker-preview");
    if (preview) preview.src = photoURL;
  });

  document.getElementById("btn-save-avatar")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("btn-save-avatar");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      const newAvatar = selected === "__google__" ? null : (selected ?? null);
      await updateDoc(doc(db, "users", State.user.uid), { avatar: newAvatar });
      State.profile.avatar = newAvatar;
      updateNavbar(State.profile);
      closeModal();
      showToast("Avatar updated! 🎉", "success");

      // Callback para que la página de perfil pueda refrescarse
      if (typeof onSaved === "function") onSaved();

    } catch (err) {
      console.error(err);
      showToast("Could not save avatar.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save avatar";
    }
  });
}

// ════════════════════════════════════════════
// onAuthStateChanged — flujo principal
// ════════════════════════════════════════════

export function initAuth() {
  return new Promise(resolve => {

    // Botones login/logout
    document.getElementById("btn-google-login")
      ?.addEventListener("click", loginWithGoogle);
    document.getElementById("btn-logout")
      ?.addEventListener("click", logout);
    document.getElementById("btn-logout-pending")
      ?.addEventListener("click", logout);

    // Dropdown avatar
    document.getElementById("nav-avatar-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("nav-dropdown");
      dd?.classList.toggle("hidden");
    });
    document.addEventListener("click", () => {
      document.getElementById("nav-dropdown")?.classList.add("hidden");
    });

    // Change avatar (from dropdown)
    document.getElementById("dd-avatar")
      ?.addEventListener("click", () => {
        document.getElementById("nav-dropdown")?.classList.add("hidden");
        openAvatarPicker();
      });

    // Profile page (from dropdown)
    document.getElementById("dd-profile")
      ?.addEventListener("click", () => {
        document.getElementById("nav-dropdown")?.classList.add("hidden");
        navigate("profile");
      });

    // Observer
    onAuthStateChanged(auth, async (user) => {

      if (!user) {
        State.user    = null;
        State.profile = null;
        State.isAdmin = false;
        showScreen("login-screen");
        resolve();
        return;
      }

      State.user = user;
      showScreen("loading-screen");

      try {
        // ¿Es admin?
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        State.isAdmin   = adminSnap.exists();

        // Perfil
        const profile   = await getOrCreateProfile(user);
        State.profile   = profile;

        if (profile.status === "blocked") {
          await logout();
          resolve();
          return;
        }

        if (profile.status === "pending" && !State.isAdmin) {
          const pendingEmail = document.getElementById("pending-email");
          if (pendingEmail) pendingEmail.textContent = user.email;
          showScreen("pending-screen");
          resolve();
          return;
        }

        // Todo ok → mostrar app
        showScreen("app");
        updateNavbar(profile);

        // Exponer SYSTEM_BADGES globalmente para classmates page
        const { SYSTEM_BADGES } = await import("./db.js");
        window.__SYSTEM_BADGES__ = SYSTEM_BADGES;

        // Lazy-load módulos y rutas
        const { registerDashboard } = await import("./dashboard.js");
        registerDashboard();

        if (State.isAdmin) {
          const { registerTeacher } = await import("./teacher/students.js");
          registerTeacher();
        }

        // Ruta lesson
        const { registerLesson } = await import("./lesson.js");
        registerLesson();

        // Missions
        const { registerMissions } = await import("./missions.js");
        registerMissions();

        // Profile & classmates
        const { registerProfile }    = await import("./profile.js");
        const { registerClassmates } = await import("./classrooms.js");
        registerProfile();
        registerClassmates();

        // AI widget
        const { initAI } = await import("./ai.js");
        initAI();

        // Navegar a home
        navigate("home");

      } catch (err) {
        console.error("[Auth] init error:", err);
        showToast("Something went wrong. Please try again.", "error");
        showScreen("login-screen");
      }

      resolve();
    });
  });
}
