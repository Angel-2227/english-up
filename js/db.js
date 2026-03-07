// =============================================
// ENGLISH UP! — js/db.js
// Todas las funciones CRUD de Firestore
// =============================================

import { db } from "../firebase-config.js";
import {
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
  serverTimestamp, increment, arrayUnion, arrayRemove,
  onSnapshot
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

export async function approveUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    status: "active",
    approvedAt: serverTimestamp()
  });
}

export async function blockUser(uid) {
  await updateDoc(doc(db, "users", uid), { status: "blocked" });
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export function watchUser(uid, callback) {
  return onSnapshot(doc(db, "users", uid), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}


// ════════════════════════════════════════════
// MÓDULOS
// ════════════════════════════════════════════

export async function getModules() {
  const q = query(collection(db, "modules"), orderBy("order", "asc"));
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
    ...data,
    published:  false,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp()
  });
  return ref.id;
}

export async function updateModule(moduleId, data) {
  await updateDoc(doc(db, "modules", moduleId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deleteModule(moduleId) {
  const lessonsSnap = await getDocs(
    collection(db, "modules", moduleId, "lessons")
  );
  const deletes = lessonsSnap.docs.map(d =>
    deleteDoc(doc(db, "modules", moduleId, "lessons", d.id))
  );
  await Promise.all(deletes);
  await deleteDoc(doc(db, "modules", moduleId));
}

export async function toggleModulePublished(moduleId, published) {
  await updateDoc(doc(db, "modules", moduleId), { published, updatedAt: serverTimestamp() });
}


// ════════════════════════════════════════════
// LECCIONES
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
      ...data,
      published:  false,
      createdAt:  serverTimestamp(),
      updatedAt:  serverTimestamp()
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

export async function toggleLessonPublished(moduleId, lessonId, published) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { published, updatedAt: serverTimestamp() }
  );
}


// ════════════════════════════════════════════
// PROGRESO DEL ESTUDIANTE
// ════════════════════════════════════════════

export async function getProgress(uid) {
  const snap = await getDoc(doc(db, "progress", uid));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  const empty = {
    uid,
    completedLessons: [],
    moduleProgress:   {},
    badges:           [],
    xp:               0,
    streak:           0,
    lastActive:       serverTimestamp()
  };
  await setDoc(doc(db, "progress", uid), empty);
  return empty;
}

export async function completeLesson(uid, moduleId, lessonId, xpGained = 10) {
  const lessonKey = `${moduleId}__${lessonId}`;
  const progressRef = doc(db, "progress", uid);

  await updateDoc(progressRef, {
    completedLessons:              arrayUnion(lessonKey),
    [`moduleProgress.${moduleId}`]: increment(1),
    xp:                            increment(xpGained),
    lastActive:                    serverTimestamp()
  });

  await updateDoc(doc(db, "users", uid), {
    xp:         increment(xpGained),
    lastActive: serverTimestamp()
  });

  return xpGained;
}

export async function uncompleteLesson(uid, moduleId, lessonId) {
  const lessonKey = `${moduleId}__${lessonId}`;
  await updateDoc(doc(db, "progress", uid), {
    completedLessons:              arrayRemove(lessonKey),
    [`moduleProgress.${moduleId}`]: increment(-1)
  });
}

export async function saveQuizResult(uid, quizId, score, total) {
  const resultRef = doc(db, "progress", uid);
  await updateDoc(resultRef, {
    [`quizResults.${quizId}`]: {
      score,
      total,
      percent:   Math.round((score / total) * 100),
      takenAt:   serverTimestamp()
    }
  });
}

export async function getAllProgress() {
  const snap = await getDocs(collection(db, "progress"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function watchProgress(uid, callback) {
  return onSnapshot(doc(db, "progress", uid), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

export async function updateStreak(uid) {
  const progressSnap = await getDoc(doc(db, "progress", uid));
  const progress     = progressSnap.exists() ? progressSnap.data() : {};
  const userSnap     = await getDoc(doc(db, "users", uid));
  const user         = userSnap.exists() ? userSnap.data() : {};

  const now      = new Date();
  const lastDate = user.lastActive?.toDate?.() || null;

  let newStreak = progress.streak || 0;

  if (lastDate) {
    const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
    if (diffDays === 1)      newStreak += 1;
    else if (diffDays > 1)  newStreak = 1;
  } else {
    newStreak = 1;
  }

  await updateDoc(doc(db, "progress", uid), { streak: newStreak });
  await updateDoc(doc(db, "users", uid), { streak: newStreak });

  return newStreak;
}


// ════════════════════════════════════════════
// INSIGNIAS
// ════════════════════════════════════════════

export async function getBadges() {
  const snap = await getDocs(collection(db, "badges"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createBadge(data) {
  const ref = await addDoc(collection(db, "badges"), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function awardBadge(uid, badgeId) {
  await updateDoc(doc(db, "progress", uid), {
    badges: arrayUnion(badgeId)
  });
}

export async function revokeBadge(uid, badgeId) {
  await updateDoc(doc(db, "progress", uid), {
    badges: arrayRemove(badgeId)
  });
}


// ════════════════════════════════════════════
// MISIONES
// ════════════════════════════════════════════

export async function getMissions() {
  // Sin orderBy para evitar índice compuesto
  const snap = await getDocs(collection(db, "missions"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

export async function getUserMissions(uid) {
  const q = query(
    collection(db, "missions"),
    where("assignedTo", "array-contains", uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createMission(data) {
  const ref = await addDoc(collection(db, "missions"), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

export async function updateMission(missionId, data) {
  await updateDoc(doc(db, "missions", missionId), data);
}

export async function deleteMission(missionId) {
  await deleteDoc(doc(db, "missions", missionId));
}


// ════════════════════════════════════════════
// ENTREGAS (SUBMISSIONS)
// ════════════════════════════════════════════

export async function submitMission(uid, missionId, content) {
  const ref = await addDoc(collection(db, "submissions"), {
    uid,
    missionId,
    content,
    status:      "pending",
    grade:       null,
    feedback:    "",
    submittedAt: serverTimestamp()
  });
  return ref.id;
}

export async function getMissionSubmissions(missionId) {
  const q = query(
    collection(db, "submissions"),
    where("missionId", "==", missionId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export async function getUserSubmissions(uid) {
  const q = query(
    collection(db, "submissions"),
    where("uid", "==", uid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
}

export async function reviewSubmission(submissionId, grade, feedback) {
  await updateDoc(doc(db, "submissions", submissionId), {
    grade,
    feedback,
    status:     "reviewed",
    reviewedAt: serverTimestamp()
  });
}

/**
 * getPendingSubmissions — sin índice compuesto.
 * Filtra en cliente en vez de en Firestore.
 */
export async function getPendingSubmissions() {
  const snap = await getDocs(collection(db, "submissions"));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(s => s.status === "pending")
    .sort((a, b) => (a.submittedAt?.seconds || 0) - (b.submittedAt?.seconds || 0));
}


// ════════════════════════════════════════════
// CONFIG DE LA APP
// ════════════════════════════════════════════

export async function getAppConfig() {
  const snap = await getDoc(doc(db, "config", "app"));
  return snap.exists() ? snap.data() : {};
}

export async function saveAppConfig(data) {
  await setDoc(doc(db, "config", "app"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}