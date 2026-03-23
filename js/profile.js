// =============================================
// ENGLISH UP! — js/profile.js
// Página de perfil del estudiante:
// apodo, avatar, stats, badges, salón, logout
// =============================================

import { State, registerRoute, navigate, showToast, openModal, closeModal, escapeHTML } from "./app.js";
import { SYSTEM_BADGES, updateUserProfile, getUser } from "./db.js";
import { getAvatarSrc, emojiToDataURL, AVATARS, openAvatarPicker, updateNavbar } from "./auth.js";
import { getUserClassroom } from "./classrooms.js";

export function registerProfile() {
  registerRoute("profile", renderProfile);
}

// ════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════

async function renderProfile(_, container) {
  container.innerHTML = `<div class="profile-loading"><div class="profile-spinner"></div></div>`;

  try {
    const profile   = State.profile;
    const progress  = profile.progress ?? {};
    const completed = Object.values(progress).filter(p => p.completed).length;

    let classroom = null;
    try { classroom = await getUserClassroom(State.user.uid); } catch (_) {}

    container.innerHTML = buildProfileHTML(profile, completed, classroom);
    bindProfileEvents(container, profile);

  } catch (err) {
    console.error("[Profile]", err);
    container.innerHTML = `<p style="padding:2rem;color:var(--color-text-muted)">Could not load profile.</p>`;
  }
}

// ════════════════════════════════════════════
// HTML
// ════════════════════════════════════════════

function buildProfileHTML(profile, completed, classroom) {
  const xp       = profile.xp     ?? 0;
  const streak   = profile.streak ?? 0;
  const badges   = profile.badges ?? [];
  const nickname = profile.nickname ?? "";

  // Usar getAvatarSrc para respetar prioridad: foto dibujada > emoji > Google > iniciales
  const avatarSrc = getAvatarSrc(profile, 120);

  const level     = Math.floor(xp / 100) + 1;
  const xpInLevel = xp % 100;

  const badgesHTML    = buildBadgesSection(badges);
  const classroomHTML = classroom ? `
    <div class="profile-card">
      <div class="profile-card-title">🏫 My Classroom</div>
      <div class="classroom-info-row">
        <div class="classroom-badge-big">${escapeHTML(classroom.emoji || "🏫")}</div>
        <div>
          <div class="classroom-name-big">${escapeHTML(classroom.name)}</div>
          ${classroom.description ? `<div class="classroom-desc-sm">${escapeHTML(classroom.description)}</div>` : ""}
          <div class="classroom-members-count">👥 ${classroom.memberCount ?? 0} students</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm profile-see-classmates" id="btn-see-classmates">
        👀 See classmates
      </button>
    </div>
  ` : `
    <div class="profile-card profile-card-muted">
      <div class="profile-card-title">🏫 Classroom</div>
      <p style="color:var(--color-text-faint);font-size:var(--text-sm)">You haven't been assigned to a classroom yet.</p>
    </div>
  `;

  // Badge especial si tiene foto dibujada
  const hasDrawing = !!profile.customAvatarURL;

  return `
    <div class="profile-page">

      <!-- Hero -->
      <div class="profile-hero">
        <div class="profile-avatar-wrap">
          <img id="profile-avatar-img"
               src="${escapeHTML(avatarSrc)}"
               alt="${escapeHTML(profile.name)}"
               class="profile-avatar-lg" />
          <button class="profile-avatar-edit" id="btn-change-avatar" title="Change avatar">✏️</button>
          ${hasDrawing ? `<div class="profile-avatar-badge" title="Hand-drawn avatar!">🎨</div>` : ""}
        </div>

        <div class="profile-hero-info">
          <div class="profile-name-row">
            <h2 class="profile-name">${escapeHTML(nickname || profile.name)}</h2>
            ${nickname ? `<span class="profile-realname">(${escapeHTML(profile.name)})</span>` : ""}
          </div>
          <div class="profile-email">${escapeHTML(profile.email)}</div>

          <div class="profile-nickname-row" id="nickname-row">
            ${nickname
              ? `<button class="btn btn-ghost btn-xs" id="btn-edit-nickname">✏️ Edit nickname</button>`
              : `<button class="btn btn-ghost btn-xs" id="btn-edit-nickname">🏷️ Add a nickname</button>`
            }
          </div>

          <div class="profile-level-row">
            <span class="profile-level-badge">⭐ Level ${level}</span>
            <div class="profile-xp-bar-wrap">
              <div class="profile-xp-bar-fill" style="width:${xpInLevel}%"></div>
            </div>
            <span class="profile-xp-label">${xpInLevel}/100 XP</span>
          </div>
        </div>
      </div>

      <!-- Stats grid -->
      <div class="profile-stats-grid">
        <div class="profile-stat-card">
          <div class="profile-stat-icon">⚡</div>
          <div class="profile-stat-value">${xp.toLocaleString()}</div>
          <div class="profile-stat-label">Total XP</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">🔥</div>
          <div class="profile-stat-value">${streak}</div>
          <div class="profile-stat-label">Day Streak</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">✅</div>
          <div class="profile-stat-value">${completed}</div>
          <div class="profile-stat-label">Lessons Done</div>
        </div>
        <div class="profile-stat-card">
          <div class="profile-stat-icon">🏅</div>
          <div class="profile-stat-value">${badges.length}</div>
          <div class="profile-stat-label">Badges</div>
        </div>
      </div>

      <!-- Badges -->
      ${badgesHTML}

      <!-- Classroom -->
      ${classroomHTML}

      <!-- Sign out -->
      <div class="profile-footer">
        <button class="btn btn-danger-outline" id="btn-profile-logout">
          🚪 Sign out
        </button>
      </div>

    </div>
  `;
}

// ── Badges section ────────────────────────────────────────────────────────────

function buildBadgesSection(earnedIds) {
  const earned = new Set(earnedIds);

  const badgeCards = SYSTEM_BADGES.map(badge => {
    const has = earned.has(badge.id);
    return `
      <div class="profile-badge-card ${has ? "earned" : "locked"}">
        <div class="profile-badge-emoji">${badge.emoji}</div>
        <div class="profile-badge-name">${escapeHTML(badge.name)}</div>
        <div class="profile-badge-desc">${escapeHTML(badge.desc)}</div>
        ${has
          ? `<div class="profile-badge-earned-tag">✅ Earned</div>`
          : `<div class="profile-badge-locked-tag">🔒 Locked</div>`}
      </div>
    `;
  }).join("");

  return `
    <div class="profile-card">
      <div class="profile-card-title">🏅 Badges (${earnedIds.length}/${SYSTEM_BADGES.length})</div>
      <div class="profile-badges-grid">
        ${badgeCards}
      </div>
    </div>
  `;
}

// ════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════

function bindProfileEvents(container, profile) {

  // Change avatar — abre modal con tabs
  container.querySelector("#btn-change-avatar")?.addEventListener("click", () => {
    openAvatarPicker(() => {
      // Refrescar imagen tras guardar
      const img = container.querySelector("#profile-avatar-img");
      if (img) img.src = getAvatarSrc(State.profile, 120);

      // Mostrar/ocultar badge de dibujo
      const badge = container.querySelector(".profile-avatar-badge");
      if (State.profile.customAvatarURL && !badge) {
        const wrap = container.querySelector(".profile-avatar-wrap");
        const b = document.createElement("div");
        b.className = "profile-avatar-badge";
        b.title = "Hand-drawn avatar!";
        b.textContent = "🎨";
        wrap?.appendChild(b);
      } else if (!State.profile.customAvatarURL && badge) {
        badge.remove();
      }
    });
  });

  // Nickname edit
  container.querySelector("#btn-edit-nickname")?.addEventListener("click", () => {
    openNicknameModal(profile.nickname ?? "", container);
  });

  // See classmates
  container.querySelector("#btn-see-classmates")?.addEventListener("click", () => {
    navigate("classmates");
  });

  // Logout
  container.querySelector("#btn-profile-logout")?.addEventListener("click", async () => {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
    const { auth }    = await import("../firebase-config.js");
    await signOut(auth);
    State.user    = null;
    State.profile = null;
    State.isAdmin = false;
    ["loading-screen","login-screen","pending-screen","app"]
      .forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle("hidden", s !== "login-screen");
      });
  });
}

// ════════════════════════════════════════════
// NICKNAME MODAL
// ════════════════════════════════════════════

function openNicknameModal(currentNickname, container) {
  openModal(`
    <div class="modal-header">
      <h3>🏷️ Your Nickname</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--color-text-muted);margin-bottom:var(--sp-4)">
        Add a fun nickname! Your classmates will see it instead of your full name.
      </p>
      <input type="text"
             id="nickname-input"
             class="form-input"
             placeholder="e.g. StarLearner, Speedy, etc."
             maxlength="24"
             value="${escapeHTML(currentNickname)}" />
      <p style="color:var(--color-text-faint);font-size:var(--text-xs);margin-top:var(--sp-2)">Max 24 characters</p>
    </div>
    <div class="modal-footer">
      ${currentNickname ? `<button class="btn btn-ghost" id="btn-remove-nickname">Remove nickname</button>` : ""}
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-nickname">Save</button>
    </div>
  `);

  document.getElementById("btn-save-nickname")?.addEventListener("click", async () => {
    const input = document.getElementById("nickname-input");
    const val   = (input?.value ?? "").trim();
    await saveNickname(val, container);
  });

  document.getElementById("btn-remove-nickname")?.addEventListener("click", async () => {
    await saveNickname("", container);
  });

  document.getElementById("nickname-input")?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const val = (e.target.value ?? "").trim();
      await saveNickname(val, container);
    }
  });
}

async function saveNickname(nickname, container) {
  try {
    await updateUserProfile(State.user.uid, { nickname });
    State.profile.nickname = nickname;
    closeModal();
    showToast(nickname ? "Nickname saved! 🎉" : "Nickname removed.", "success");
    renderProfile({}, container);
  } catch (err) {
    console.error(err);
    showToast("Could not save nickname.", "error");
  }
}