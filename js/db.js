// =============================================
// ENGLISH UP! — js/db.js
// CRUD completo de Firestore
// =============================================

import { db } from "../firebase-config.js";
import {
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
  increment, arrayUnion, arrayRemove,
  onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ════════════════════════════════════════════
// USUARIOS
// ════════════════════════════════════════════

export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingUsers() {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getActiveStudents() {
  const q = query(collection(db, "users"), where("status", "==", "active"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    status:     "active",
    approvedAt: serverTimestamp(),
  });
}

export async function blockUser(uid) {
  await updateDoc(doc(db, "users", uid), { status: "blocked" });
}

export async function unblockUser(uid) {
  await updateDoc(doc(db, "users", uid), { status: "active" });
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

/** Escucha cambios en tiempo real en un usuario */
export function watchUser(uid, callback) {
  return onSnapshot(doc(db, "users", uid), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

/** Escucha lista completa de usuarios en tiempo real */
export function watchAllUsers(callback) {
  return onSnapshot(collection(db, "users"), snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}


// ════════════════════════════════════════════
// MÓDULOS
// ════════════════════════════════════════════

export async function getModules() {
  const q    = query(collection(db, "modules"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPublishedModules() {
  const q = query(
    collection(db, "modules"),
    where("published", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getModule(moduleId) {
  const snap = await getDoc(doc(db, "modules", moduleId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createModule(data) {
  const ref = await addDoc(collection(db, "modules"), {
    title:       data.title       || "New Module",
    description: data.description || "",
    emoji:       data.emoji       || "📚",
    color:       data.color       || "#fbbf24",
    order:       data.order       ?? 0,
    published:   data.published   ?? false,
    createdAt:   serverTimestamp(),
  });
  return ref.id;
}

export async function updateModule(moduleId, data) {
  await updateDoc(doc(db, "modules", moduleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteModule(moduleId) {
  // Borrar todas las lecciones del módulo primero
  const lessons = await getLessons(moduleId);
  const batch   = writeBatch(db);
  lessons.forEach(l => {
    batch.delete(doc(db, "modules", moduleId, "lessons", l.id));
  });
  batch.delete(doc(db, "modules", moduleId));
  await batch.commit();
}

/** Reordena módulos actualizando el campo order */
export async function reorderModules(orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, "modules", id), { order: i });
  });
  await batch.commit();
}


// ════════════════════════════════════════════
// LECCIONES (subcolección de módulo)
// ════════════════════════════════════════════

export async function getLessons(moduleId) {
  const q = query(
    collection(db, "modules", moduleId, "lessons"),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPublishedLessons(moduleId) {
  const q = query(
    collection(db, "modules", moduleId, "lessons"),
    where("published", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLesson(moduleId, lessonId) {
  const snap = await getDoc(doc(db, "modules", moduleId, "lessons", lessonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createLesson(moduleId, data) {
  const ref = await addDoc(
    collection(db, "modules", moduleId, "lessons"),
    {
      title:       data.title       || "New Lesson",
      order:       data.order       ?? 0,
      published:   data.published   ?? false,
      type:        data.type        || "url",   // "url" | "html" | "editor"
      externalURL: data.externalURL || "",
      contentBody: data.contentBody || "",
      xpReward:    data.xpReward    ?? 10,
      duration:    data.duration    ?? 60,      // minutos
      unlockedFor: data.unlockedFor || [],       // uids con acceso manual
      createdAt:   serverTimestamp(),
    }
  );
  return ref.id;
}

export async function updateLesson(moduleId, lessonId, data) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

export async function deleteLesson(moduleId, lessonId) {
  await deleteDoc(doc(db, "modules", moduleId, "lessons", lessonId));
}

export async function reorderLessons(moduleId, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, i) => {
    batch.update(doc(db, "modules", moduleId, "lessons", id), { order: i });
  });
  await batch.commit();
}

/**
 * Desbloquea una lección manualmente para un estudiante específico.
 * Agrega el uid a lesson.unlockedFor.
 */
export async function unlockLessonForUser(moduleId, lessonId, uid) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { unlockedFor: arrayUnion(uid) }
  );
}

export async function lockLessonForUser(moduleId, lessonId, uid) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { unlockedFor: arrayRemove(uid) }
  );
}


// ════════════════════════════════════════════
// PROGRESO DEL ESTUDIANTE
// ════════════════════════════════════════════

/**
 * Marca una lección como completada y actualiza XP + streak.
 * La lógica de streak se lee ANTES de escribir.
 *
 * @param {string} uid
 * @param {string} moduleId
 * @param {string} lessonId
 * @param {number} xpReward
 */
export async function completeLesson(uid, moduleId, lessonId, xpReward = 10) {
  const userRef = doc(db, "users", uid);

  // 1. Leer estado actual (ANTES de escribir, para streak correcto)
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  const userData = userSnap.data();

  const now           = new Date();
  const today         = toDateString(now);
  const lastActive    = userData.lastActive?.toDate?.() ?? null;
  const lastActiveDay = lastActive ? toDateString(lastActive) : null;

  let newStreak = userData.streak ?? 0;
  if (lastActiveDay === null) {
    newStreak = 1;
  } else if (lastActiveDay === today) {
    // Ya activo hoy, mantener streak
  } else if (dayDiff(lastActive, now) === 1) {
    newStreak += 1;
  } else {
    newStreak = 1;  // Rompió racha
  }

  // 2. Escribir en batch
  const batch = writeBatch(db);

  // Progreso de la lección
  const progressKey = `progress.${moduleId}_${lessonId}`;
  batch.update(userRef, {
    [progressKey]:   { completed: true, completedAt: serverTimestamp() },
    xp:              increment(xpReward),
    streak:          newStreak,
    lastActive:      serverTimestamp(),
  });

  await batch.commit();
}

export async function getUserProgress(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().progress ?? {}) : {};
}

function toDateString(date) {
  return date.toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  const msPerDay = 86400000;
  const da = new Date(toDateString(a));
  const db_ = new Date(toDateString(b));
  return Math.round((db_ - da) / msPerDay);
}


// ════════════════════════════════════════════
// BADGES
// ════════════════════════════════════════════

export const SYSTEM_BADGES = [
  { id: "first_lesson",   emoji: "🌟", name: "First Step",    desc: "Completed your first lesson" },
  { id: "streak_3",       emoji: "🔥", name: "On Fire",       desc: "3-day streak" },
  { id: "streak_7",       emoji: "⚡", name: "Lightning",     desc: "7-day streak" },
  { id: "xp_100",         emoji: "💯", name: "Century",       desc: "Reached 100 XP" },
  { id: "xp_500",         emoji: "🏆", name: "Champion",      desc: "Reached 500 XP" },
  { id: "module_done",    emoji: "🎓", name: "Graduate",      desc: "Completed a full module" },
  { id: "perfect_quiz",   emoji: "✨", name: "Perfect",       desc: "Perfect score on a quiz" },
  { id: "bookworm",       emoji: "📖", name: "Bookworm",      desc: "Read 5 lessons" },
  { id: "curious",        emoji: "🔍", name: "Curious",       desc: "Used the AI assistant" },
  { id: "teacher_award",  emoji: "🎖️", name: "Special Award", desc: "Awarded by your teacher" },
];

export async function awardBadge(uid, badgeId) {
  await updateDoc(doc(db, "users", uid), {
    badges: arrayUnion(badgeId),
  });
}

export async function revokeBadge(uid, badgeId) {
  await updateDoc(doc(db, "users", uid), {
    badges: arrayRemove(badgeId),
  });
}

/**
 * Comprueba si corresponde otorgar badges automáticos
 * tras completar una lección.
 */
export async function checkAutoBadges(uid) {
  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) return;
  const u = userSnap.data();

  const earned   = new Set(u.badges ?? []);
  const progress = u.progress ?? {};
  const completed= Object.values(progress).filter(p => p.completed).length;
  const xp       = u.xp ?? 0;
  const streak   = u.streak ?? 0;

  const toAward = [];

  if (completed >= 1  && !earned.has("first_lesson")) toAward.push("first_lesson");
  if (completed >= 5  && !earned.has("bookworm"))     toAward.push("bookworm");
  if (streak    >= 3  && !earned.has("streak_3"))     toAward.push("streak_3");
  if (streak    >= 7  && !earned.has("streak_7"))     toAward.push("streak_7");
  if (xp        >= 100 && !earned.has("xp_100"))      toAward.push("xp_100");
  if (xp        >= 500 && !earned.has("xp_500"))      toAward.push("xp_500");

  if (toAward.length > 0) {
    await updateDoc(doc(db, "users", uid), {
      badges: arrayUnion(...toAward),
    });
  }

  return toAward;
}


// ════════════════════════════════════════════
// CONFIGURACIÓN DE LA APP
// ════════════════════════════════════════════

export async function getAppConfig() {
  const snap = await getDoc(doc(db, "config", "app"));
  return snap.exists() ? snap.data() : {};
}

export async function updateAppConfig(data) {
  await setDoc(doc(db, "config", "app"), data, { merge: true });
}
