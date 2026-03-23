// =============================================
// ENGLISH UP! — js/classrooms.js
// Salones/grupos: DB helpers + vista compañeros
// =============================================

import { db } from "../firebase-config.js";
import {
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
  arrayUnion, arrayRemove, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { State, registerRoute, navigate, showToast, openModal, closeModal, escapeHTML } from "./app.js";
import { getAvatarSrc } from "./auth.js";

// ════════════════════════════════════════════
// DB HELPERS — exportados para uso en otros archivos
// ════════════════════════════════════════════

export async function getAllClassrooms() {
  const q = query(collection(db, "classrooms"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClassroom(classroomId) {
  const snap = await getDoc(doc(db, "classrooms", classroomId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createClassroom(data) {
  const ref = await addDoc(collection(db, "classrooms"), {
    name:        data.name        || "New Classroom",
    description: data.description || "",
    emoji:       data.emoji       || "🏫",
    color:       data.color       || "#6366f1",
    members:     [],
    createdAt:   serverTimestamp(),
  });
  return ref.id;
}

export async function updateClassroom(classroomId, data) {
  await updateDoc(doc(db, "classrooms", classroomId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClassroom(classroomId) {
  const classroom = await getClassroom(classroomId);
  if (!classroom) return;

  const batch = writeBatch(db);
  for (const uid of (classroom.members ?? [])) {
    batch.update(doc(db, "users", uid), { classroomId: null });
  }
  batch.delete(doc(db, "classrooms", classroomId));
  await batch.commit();
}

export async function addStudentToClassroom(classroomId, uid) {
  const userRef  = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const prev  = userSnap.data().classroomId;
  const batch = writeBatch(db);

  if (prev && prev !== classroomId) {
    batch.update(doc(db, "classrooms", prev), { members: arrayRemove(uid) });
  }
  batch.update(doc(db, "classrooms", classroomId), { members: arrayUnion(uid) });
  batch.update(userRef, { classroomId });
  await batch.commit();
}

export async function removeStudentFromClassroom(uid) {
  const userRef  = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;

  const classroomId = userSnap.data().classroomId;
  if (!classroomId) return;

  const batch = writeBatch(db);
  batch.update(doc(db, "classrooms", classroomId), { members: arrayRemove(uid) });
  batch.update(userRef, { classroomId: null });
  await batch.commit();
}

export async function getUserClassroom(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return null;

  const classroomId = userSnap.data().classroomId;
  if (!classroomId) return null;

  const classroom = await getClassroom(classroomId);
  if (!classroom) return null;

  return { ...classroom, memberCount: (classroom.members ?? []).length };
}

export async function getClassroomMembers(classroomId) {
  const classroom = await getClassroom(classroomId);
  if (!classroom) return [];

  const members = classroom.members ?? [];
  if (members.length === 0) return [];

  const profiles = await Promise.all(
    members.map(async uid => {
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    })
  );

  return profiles.filter(Boolean);
}

export function watchClassrooms(callback) {
  return onSnapshot(collection(db, "classrooms"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════
// RUTA: COMPAÑEROS DE CLASE
// ════════════════════════════════════════════

export function registerClassmates() {
  registerRoute("classmates", renderClassmates);
}

async function renderClassmates(_, container) {
  container.innerHTML = `<div class="profile-loading"><div class="profile-spinner"></div></div>`;

  try {
    const userClassroom = await getUserClassroom(State.user.uid);

    if (!userClassroom) {
      container.innerHTML = `
        <div class="classmates-page">
          <div class="classmates-header">
            <button class="btn btn-ghost btn-sm" id="btn-back-profile">← Back</button>
            <h2>My Classroom</h2>
          </div>
          <div class="empty-state">
            <div class="empty-state-icon">🏫</div>
            <h3>No classroom yet</h3>
            <p>Your teacher hasn't added you to a classroom. Stay tuned!</p>
          </div>
        </div>
      `;
      container.querySelector("#btn-back-profile")?.addEventListener("click", () => navigate("profile"));
      return;
    }

    const members    = await getClassroomMembers(userClassroom.id);
    const myUid      = State.user.uid;
    const me         = members.find(m => m.id === myUid);
    const classmates = members.filter(m => m.id !== myUid);

    classmates.sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));

    container.innerHTML = buildClassmatesHTML(userClassroom, me, classmates);
    container.querySelector("#btn-back-profile")?.addEventListener("click", () => navigate("profile"));

  } catch (err) {
    console.error("[Classmates]", err);
    container.innerHTML = `<p style="padding:2rem;color:var(--color-text-muted)">Could not load classmates.</p>`;
  }
}

function buildClassmatesHTML(classroom, me, classmates) {
  const memberCards = classmates.length === 0
    ? `<div class="empty-state" style="padding:var(--sp-8) 0">
         <div class="empty-state-icon">👋</div>
         <h3>You're the first one here!</h3>
         <p>No other classmates yet.</p>
       </div>`
    : classmates.map((m, i) => buildMemberCard(m, i + 1)).join("");

  return `
    <div class="classmates-page">
      <div class="classmates-header">
        <button class="btn btn-ghost btn-sm" id="btn-back-profile">← Back</button>
        <div class="classmates-classroom-info">
          <span class="classmates-classroom-emoji">${escapeHTML(classroom.emoji || "🏫")}</span>
          <div>
            <h2>${escapeHTML(classroom.name)}</h2>
            ${classroom.description ? `<p class="classmates-classroom-desc">${escapeHTML(classroom.description)}</p>` : ""}
          </div>
        </div>
      </div>

      ${me ? `
        <div class="classmates-section-title">🙋 You</div>
        ${buildMemberCard(me, null, true)}
      ` : ""}

      <div class="classmates-section-title">🏆 Leaderboard — ${classmates.length} classmate${classmates.length !== 1 ? "s" : ""}</div>
      <div class="classmates-list">
        ${memberCards}
      </div>
    </div>
  `;
}

function buildMemberCard(member, rank, isMe = false) {
  // getAvatarSrc respeta la prioridad: foto dibujada > emoji > Google > iniciales
  const avatarSrc   = getAvatarSrc(member, 80);
  const displayName = member.nickname || member.name || "Student";
  const xp          = member.xp     ?? 0;
  const streak      = member.streak ?? 0;
  const badges      = member.badges ?? [];
  const level       = Math.floor(xp / 100) + 1;

  const rankBadge = rank !== null
    ? `<div class="classmate-rank ${rank <= 3 ? "top-" + rank : ""}">
         ${rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
       </div>`
    : "";

  const topBadges = badges.slice(0, 3).map(id => {
    const def = (window.__SYSTEM_BADGES__ || []).find(b => b.id === id);
    return def ? `<span title="${def.name}">${def.emoji}</span>` : "";
  }).join("");

  return `
    <div class="classmate-card ${isMe ? "classmate-card-me" : ""}">
      ${rankBadge}
      <img class="classmate-avatar"
           src="${escapeHTML(avatarSrc)}"
           alt="${escapeHTML(displayName)}"
           onerror="this.style.display='none'" />
      <div class="classmate-info">
        <div class="classmate-name">
          ${escapeHTML(displayName)}
          ${isMe ? `<span class="classmate-me-tag">You</span>` : ""}
        </div>
        <div class="classmate-meta">⭐ Level ${level} · ⚡ ${xp.toLocaleString()} XP · 🔥 ${streak}</div>
        ${topBadges ? `<div class="classmate-badges">${topBadges}</div>` : ""}
      </div>
    </div>
  `;
}