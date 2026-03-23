// =============================================
// ENGLISH UP! — js/auth.js
// Google login, roles, onAuthStateChanged,
// navbar updates, avatar picker + photo upload
// =============================================

import { auth, db } from "../firebase-config.js";
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
  "🦊", "🐼", "🐸", "🦁", "🐯", "🐨", "🦄", "🐙", "🦋", "🐬",
  "🌸", "🌻", "🍀", "⭐", "🌈", "🔥", "🎸", "🎨", "🚀", "🎯",
  "🏄", "🧗", "🎭", "🦸", "🧙", "🤖", "👾", "🎮", "📚", "✏️"
];

const IMGBB_API_KEY = "e06d8f96562635bde67aad98b99a868d";
const provider = new GoogleAuthProvider();

// ════════════════════════════════════════════
// SCREEN HELPERS
// ════════════════════════════════════════════

function showScreen(id) {
  ["loading-screen", "login-screen", "pending-screen", "app"]
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
  State.user = null;
  State.profile = null;
  State.isAdmin = false;
  showScreen("login-screen");
}

// ════════════════════════════════════════════
// FIRESTORE — crear o traer perfil de usuario
// ════════════════════════════════════════════

async function getOrCreateProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }

  const profile = {
    name: user.displayName || "Student",
    email: user.email,
    photoURL: user.photoURL || "",
    avatar: null,
    customAvatarURL: null,    // URL de ImgBB (foto dibujada)
    customAvatarDeleteURL: null, // URL para borrar de ImgBB
    nickname: "",
    status: "pending",
    role: "student",
    xp: 0,
    streak: 0,
    lastActive: null,
    badges: [],
    classroomId: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(ref, profile);
  return { id: user.uid, ...profile };
}

// ════════════════════════════════════════════
// IMGBB — subir imagen
// ════════════════════════════════════════════

async function uploadToImgBB(file) {
  // Comprimir antes de subir si es muy grande
  const compressed = await compressImage(file, 400, 0.82);

  const formData = new FormData();
  formData.append("image", compressed);

  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`ImgBB error ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error("ImgBB upload failed");

  return {
    url:       data.data.url,
    deleteURL: data.data.delete_url,
  };
}

/** Elimina imagen anterior de ImgBB si existe */
async function deleteFromImgBB(deleteURL) {
  if (!deleteURL) return;
  try {
    // ImgBB delete es via GET a la delete_url
    await fetch(deleteURL, { method: "GET", mode: "no-cors" });
  } catch {
    // Silencioso — no es crítico
  }
}

/** Comprime una imagen a max px y calidad dada, devuelve Blob */
function compressImage(file, maxPx = 400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                { width = Math.round(width * maxPx / height);  height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Compression failed")), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ════════════════════════════════════════════
// NAVBAR — actualizar avatar, XP, streak
// ════════════════════════════════════════════

export function updateNavbar(profile) {
  const src = getAvatarSrc(profile, 72);

  const avatarImg = document.getElementById("nav-avatar");
  if (avatarImg) { avatarImg.src = src; avatarImg.alt = profile.name; }

  const bnavAvatar = document.getElementById("bnav-avatar");
  if (bnavAvatar) { bnavAvatar.src = getAvatarSrc(profile, 56); bnavAvatar.alt = profile.name; }

  const xpEl     = document.getElementById("nav-xp");
  const streakEl = document.getElementById("nav-streak");
  if (xpEl)     xpEl.textContent    = (profile.xp ?? 0).toLocaleString();
  if (streakEl) streakEl.textContent = profile.streak ?? 0;

  const ddName  = document.getElementById("dd-name");
  const ddEmail = document.getElementById("dd-email");
  if (ddName)  ddName.textContent  = profile.nickname || profile.name || "";
  if (ddEmail) ddEmail.textContent = profile.email || "";

  document.getElementById("nav-links-student")
    ?.classList.toggle("hidden",  State.isAdmin);
  document.getElementById("nav-links-teacher")
    ?.classList.toggle("hidden", !State.isAdmin);
  document.getElementById("bnav-teacher")
    ?.classList.toggle("hidden", !State.isAdmin);
}

// ════════════════════════════════════════════
// AVATAR SOURCE RESOLVER
// Prioridad: foto dibujada > emoji > foto Google > iniciales
// ════════════════════════════════════════════

export function getAvatarSrc(profile, size = 72) {
  if (profile.customAvatarURL) return profile.customAvatarURL;
  if (profile.avatar)          return emojiToDataURL(profile.avatar, size);
  if (profile.photoURL)        return profile.photoURL;
  return makeInitialsAvatar(profile.name, size);
}

// ════════════════════════════════════════════
// AVATAR HELPERS
// ════════════════════════════════════════════

export function emojiToDataURL(emoji, size = 72) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.font = `${size * 0.65}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, size / 2, size / 2 + size * 0.04);
  return canvas.toDataURL();
}

function makeInitialsAvatar(name, size = 72) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fcd34d";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#78350f";
  ctx.font = `bold ${Math.round(size * 0.42)}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initials = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  ctx.fillText(initials, size / 2, size / 2);
  return canvas.toDataURL();
}

// ════════════════════════════════════════════
// AVATAR PICKER MODAL
// Tabs: 📸 My Drawing | 😀 Emoji | 🔵 Google
// ════════════════════════════════════════════

export function openAvatarPicker(onSaved = null) {
  const profile   = State.profile;
  const photoURL  = profile?.photoURL ?? "";
  const hasCustom = !!profile?.customAvatarURL;
  const hasEmoji  = !!profile?.avatar;

  // Determinar tab activo inicial
  const initialTab = hasCustom ? "photo" : "emoji";

  openModal(`
    <div class="modal-header">
      <h3>✏️ Change Avatar</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">

      <!-- Preview -->
      <div class="avatar-preview-row">
        <img id="avatar-picker-preview"
             src="${getAvatarSrc(profile, 60)}"
             class="avatar-preview-img" alt="preview" />
        <div>
          <div style="font-size:var(--text-sm);font-weight:var(--weight-bold);margin-bottom:var(--sp-1)">
            Your current avatar
          </div>
          <div class="avatar-preview-info">
            This is how your classmates and teacher will see you.
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="avatar-tabs">
        <button class="avatar-tab ${initialTab === "photo" ? "active" : ""}" data-tab="photo">
          📸 My Drawing
        </button>
        <button class="avatar-tab ${initialTab === "emoji" ? "active" : ""}" data-tab="emoji">
          😀 Emoji
        </button>
        ${photoURL ? `
        <button class="avatar-tab" data-tab="google">
          🔵 Google
        </button>` : ""}
      </div>

      <!-- Tab: Photo upload -->
      <div class="avatar-tab-panel ${initialTab === "photo" ? "active" : ""}" id="avpanel-photo">
        <div class="avatar-upload-zone" id="avatar-upload-zone">
          ${hasCustom ? `
            <img src="${profile.customAvatarURL}" class="avatar-upload-preview" id="avatar-upload-preview" />
          ` : `
            <div class="avatar-upload-placeholder" id="avatar-upload-placeholder">
              <div class="avatar-upload-icon">📷</div>
              <div class="avatar-upload-label">Tap to upload your drawing</div>
              <div class="avatar-upload-hint">JPG or PNG · max 5MB</div>
            </div>
          `}
          <input type="file" id="avatar-file-input" accept="image/*" style="display:none" />
        </div>
        ${hasCustom ? `
          <button class="btn btn-ghost btn-sm" id="btn-change-photo" style="margin-top:var(--sp-3)">
            📂 Choose a different photo
          </button>
        ` : ""}
        <div id="avatar-upload-status" style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--sp-2)"></div>
      </div>

      <!-- Tab: Emoji -->
      <div class="avatar-tab-panel ${initialTab === "emoji" ? "active" : ""}" id="avpanel-emoji">
        <div class="avatar-picker-grid" id="avatar-grid">
          ${AVATARS.map(em => `
            <button class="avatar-option ${em === profile?.avatar ? "selected" : ""}"
                    data-emoji="${em}" title="${em}">${em}</button>
          `).join("")}
        </div>
      </div>

      <!-- Tab: Google -->
      ${photoURL ? `
      <div class="avatar-tab-panel" id="avpanel-google">
        <div style="display:flex;align-items:center;gap:var(--sp-4);padding:var(--sp-4);background:var(--color-surface-alt);border-radius:var(--radius-lg)">
          <img src="${photoURL}" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid var(--color-border)" />
          <div>
            <div style="font-size:var(--text-sm);font-weight:var(--weight-bold)">Use your Google photo</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">Your profile picture from Google</div>
          </div>
        </div>
      </div>` : ""}

    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-avatar">💾 Save Avatar</button>
    </div>
  `);

  // ── State ───────────────────────────────
  let activeTab    = initialTab;
  let selectedEmoji = profile?.avatar ?? null;
  let pendingFile   = null;   // File object para subir
  let previewURL    = null;   // Object URL temporal

  // ── Tab switching ───────────────────────
  document.querySelectorAll(".avatar-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll(".avatar-tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".avatar-tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`avpanel-${activeTab}`)?.classList.add("active");
    });
  });

  // ── Emoji pick ──────────────────────────
  document.getElementById("avatar-grid")?.addEventListener("click", e => {
    const btn = e.target.closest(".avatar-option");
    if (!btn) return;
    selectedEmoji = btn.dataset.emoji;
    document.querySelectorAll(".avatar-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    document.getElementById("avatar-picker-preview").src = emojiToDataURL(selectedEmoji, 60);
  });

  // ── File upload zone ────────────────────
  const zone      = document.getElementById("avatar-upload-zone");
  const fileInput = document.getElementById("avatar-file-input");

  zone?.addEventListener("click", () => fileInput?.click());
  document.getElementById("btn-change-photo")?.addEventListener("click", () => fileInput?.click());

  // Drag & drop
  zone?.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone?.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone?.addEventListener("drop", e => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  });

  fileInput?.addEventListener("change", () => {
    if (fileInput.files[0]) handleFileSelected(fileInput.files[0]);
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file.", "warning");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image is too large (max 5MB).", "warning");
      return;
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
    previewURL = URL.createObjectURL(file);
    pendingFile = file;

    // Mostrar preview en zona
    zone.innerHTML = `<img src="${previewURL}" class="avatar-upload-preview" id="avatar-upload-preview" />`;

    // Mostrar preview principal
    document.getElementById("avatar-picker-preview").src = previewURL;

    document.getElementById("avatar-upload-status").textContent = `📎 ${file.name} selected`;
  }

  // ── Save ────────────────────────────────
  document.getElementById("btn-save-avatar")?.addEventListener("click", async () => {
    const saveBtn = document.getElementById("btn-save-avatar");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      if (activeTab === "photo") {
        await savePhotoAvatar(pendingFile, onSaved, saveBtn);
      } else if (activeTab === "emoji") {
        await saveEmojiAvatar(selectedEmoji, onSaved);
      } else if (activeTab === "google") {
        await saveGoogleAvatar(onSaved);
      }
    } catch (err) {
      console.error(err);
      showToast("Could not save avatar. Please try again.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "💾 Save Avatar";
    }

    if (previewURL) URL.revokeObjectURL(previewURL);
  });
}

// ────────────────────────────────────────────
// SAVE HELPERS
// ────────────────────────────────────────────

async function savePhotoAvatar(file, onSaved, saveBtn) {
  if (!file && !State.profile.customAvatarURL) {
    showToast("Please choose a photo first.", "warning");
    saveBtn.disabled = false;
    saveBtn.textContent = "💾 Save Avatar";
    return;
  }

  // Si no hay nuevo archivo, solo mantener el existente (sin cambios)
  if (!file) {
    closeModal();
    return;
  }

  if (saveBtn) saveBtn.textContent = "Uploading…";

  // Borrar imagen anterior de ImgBB si existe
  const oldDeleteURL = State.profile.customAvatarDeleteURL;
  if (oldDeleteURL) await deleteFromImgBB(oldDeleteURL);

  // Subir nueva
  const { url, deleteURL } = await uploadToImgBB(file);

  // Guardar en Firestore
  await updateDoc(doc(db, "users", State.user.uid), {
    customAvatarURL:       url,
    customAvatarDeleteURL: deleteURL,
    avatar:                null,  // limpiar emoji si había
  });

  State.profile.customAvatarURL       = url;
  State.profile.customAvatarDeleteURL = deleteURL;
  State.profile.avatar                = null;

  updateNavbar(State.profile);
  closeModal();
  showToast("Avatar updated! 🎨", "success");
  if (typeof onSaved === "function") onSaved();
}

async function saveEmojiAvatar(emoji, onSaved) {
  // Si tenía foto personalizada, borrarla de ImgBB
  const oldDeleteURL = State.profile.customAvatarDeleteURL;
  if (oldDeleteURL) await deleteFromImgBB(oldDeleteURL);

  await updateDoc(doc(db, "users", State.user.uid), {
    avatar:                emoji ?? null,
    customAvatarURL:       null,
    customAvatarDeleteURL: null,
  });

  State.profile.avatar                = emoji ?? null;
  State.profile.customAvatarURL       = null;
  State.profile.customAvatarDeleteURL = null;

  updateNavbar(State.profile);
  closeModal();
  showToast("Avatar updated! 🎉", "success");
  if (typeof onSaved === "function") onSaved();
}

async function saveGoogleAvatar(onSaved) {
  const oldDeleteURL = State.profile.customAvatarDeleteURL;
  if (oldDeleteURL) await deleteFromImgBB(oldDeleteURL);

  await updateDoc(doc(db, "users", State.user.uid), {
    avatar:                null,
    customAvatarURL:       null,
    customAvatarDeleteURL: null,
  });

  State.profile.avatar                = null;
  State.profile.customAvatarURL       = null;
  State.profile.customAvatarDeleteURL = null;

  updateNavbar(State.profile);
  closeModal();
  showToast("Avatar updated! 🎉", "success");
  if (typeof onSaved === "function") onSaved();
}

// ════════════════════════════════════════════
// onAuthStateChanged — flujo principal
// ════════════════════════════════════════════

export function initAuth() {
  return new Promise(resolve => {

    document.getElementById("btn-google-login")
      ?.addEventListener("click", loginWithGoogle);
    document.getElementById("btn-logout")
      ?.addEventListener("click", logout);
    document.getElementById("btn-logout-pending")
      ?.addEventListener("click", logout);

    document.getElementById("nav-avatar-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const dd = document.getElementById("nav-dropdown");
      dd?.classList.toggle("hidden");
    });
    document.addEventListener("click", () => {
      document.getElementById("nav-dropdown")?.classList.add("hidden");
    });

    document.getElementById("dd-avatar")
      ?.addEventListener("click", () => {
        document.getElementById("nav-dropdown")?.classList.add("hidden");
        openAvatarPicker();
      });

    document.getElementById("dd-profile")
      ?.addEventListener("click", () => {
        document.getElementById("nav-dropdown")?.classList.add("hidden");
        navigate("profile");
      });

    onAuthStateChanged(auth, async (user) => {

      if (!user) {
        State.user = null;
        State.profile = null;
        State.isAdmin = false;
        showScreen("login-screen");
        resolve();
        return;
      }

      State.user = user;
      showScreen("loading-screen");

      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        State.isAdmin   = adminSnap.exists();

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

        showScreen("app");
        updateNavbar(profile);

        const { SYSTEM_BADGES } = await import("./db.js");
        window.__SYSTEM_BADGES__ = SYSTEM_BADGES;

        const { registerDashboard } = await import("./dashboard.js");
        registerDashboard();

        if (State.isAdmin) {
          const { registerTeacher } = await import("./teacher/students.js");
          registerTeacher();
        }

        const { registerLesson }    = await import("./lesson.js");
        const { registerMissions }  = await import("./missions.js");
        const { registerVocabulary }= await import("./vocabulary.js");
        const { registerProfile }   = await import("./profile.js");
        const { registerClassmates }= await import("./classrooms.js");

        registerLesson();
        registerMissions();
        registerVocabulary();
        registerProfile();
        registerClassmates();

        const { initAI } = await import("./ai.js");
        initAI();

        const { registerCalendar } = await import("./calendar.js");
        registerCalendar();

        const { registerCurriculum } = await import("./curriculum.js");
        registerCurriculum();

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