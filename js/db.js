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

/** Obtener perfil de un usuario por UID */
export async function getUser(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Obtener todos los usuarios (solo admin) */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener usuarios pendientes de aprobación */
export async function getPendingUsers() {
  const q = query(collection(db, "users"), where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Aprobar un usuario */
export async function approveUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    status: "active",
    approvedAt: serverTimestamp()
  });
}

/** Bloquear un usuario */
export async function blockUser(uid) {
  await updateDoc(doc(db, "users", uid), { status: "blocked" });
}

/** Actualizar datos del perfil */
export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

/** Escuchar cambios en perfil en tiempo real */
export function watchUser(uid, callback) {
  return onSnapshot(doc(db, "users", uid), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}


// ════════════════════════════════════════════
// MÓDULOS
// ════════════════════════════════════════════

/** Obtener todos los módulos ordenados */
export async function getModules() {
  const q = query(collection(db, "modules"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener módulos publicados (para estudiantes) */
export async function getPublishedModules() {
  const q = query(
    collection(db, "modules"),
    where("published", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener un módulo por ID */
export async function getModule(moduleId) {
  const snap = await getDoc(doc(db, "modules", moduleId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Crear módulo */
export async function createModule(data) {
  const ref = await addDoc(collection(db, "modules"), {
    ...data,
    published:  false,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp()
  });
  return ref.id;
}

/** Actualizar módulo */
export async function updateModule(moduleId, data) {
  await updateDoc(doc(db, "modules", moduleId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/** Eliminar módulo y sus clases */
export async function deleteModule(moduleId) {
  // Eliminar subcolección de lecciones primero
  const lessonsSnap = await getDocs(
    collection(db, "modules", moduleId, "lessons")
  );
  const deletes = lessonsSnap.docs.map(d =>
    deleteDoc(doc(db, "modules", moduleId, "lessons", d.id))
  );
  await Promise.all(deletes);
  // Eliminar el módulo
  await deleteDoc(doc(db, "modules", moduleId));
}

/** Publicar / despublicar módulo */
export async function toggleModulePublished(moduleId, published) {
  await updateDoc(doc(db, "modules", moduleId), { published, updatedAt: serverTimestamp() });
}


// ════════════════════════════════════════════
// LECCIONES (subcolección de módulos)
// ════════════════════════════════════════════

/** Obtener todas las lecciones de un módulo */
export async function getLessons(moduleId) {
  const q = query(
    collection(db, "modules", moduleId, "lessons"),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener lecciones publicadas de un módulo */
export async function getPublishedLessons(moduleId) {
  const q = query(
    collection(db, "modules", moduleId, "lessons"),
    where("published", "==", true),
    orderBy("order", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener una lección específica */
export async function getLesson(moduleId, lessonId) {
  const snap = await getDoc(doc(db, "modules", moduleId, "lessons", lessonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Crear lección */
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

/** Actualizar lección */
export async function updateLesson(moduleId, lessonId, data) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

/** Eliminar lección */
export async function deleteLesson(moduleId, lessonId) {
  await deleteDoc(doc(db, "modules", moduleId, "lessons", lessonId));
}

/** Publicar / despublicar lección */
export async function toggleLessonPublished(moduleId, lessonId, published) {
  await updateDoc(
    doc(db, "modules", moduleId, "lessons", lessonId),
    { published, updatedAt: serverTimestamp() }
  );
}


// ════════════════════════════════════════════
// PROGRESO DEL ESTUDIANTE
// ════════════════════════════════════════════

/** Obtener progreso de un usuario */
export async function getProgress(uid) {
  const snap = await getDoc(doc(db, "progress", uid));
  if (snap.exists()) return { id: snap.id, ...snap.data() };
  // Si no existe, crear estructura vacía
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

/** Marcar lección como completada */
export async function completeLesson(uid, moduleId, lessonId, xpGained = 10) {
  const lessonKey = `${moduleId}__${lessonId}`;
  const progressRef = doc(db, "progress", uid);

  await updateDoc(progressRef, {
    completedLessons:              arrayUnion(lessonKey),
    [`moduleProgress.${moduleId}`]: increment(1),
    xp:                            increment(xpGained),
    lastActive:                    serverTimestamp()
  });

  // También actualizar XP en /users
  await updateDoc(doc(db, "users", uid), {
    xp:         increment(xpGained),
    lastActive: serverTimestamp()
  });

  return xpGained;
}

/** Desmarcar lección (solo admin) */
export async function uncompleteLesson(uid, moduleId, lessonId) {
  const lessonKey = `${moduleId}__${lessonId}`;
  await updateDoc(doc(db, "progress", uid), {
    completedLessons:              arrayRemove(lessonKey),
    [`moduleProgress.${moduleId}`]: increment(-1)
  });
}

/** Guardar resultado de quiz */
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

/** Obtener todos los progresos (para panel docente) */
export async function getAllProgress() {
  const snap = await getDocs(collection(db, "progress"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Escuchar progreso en tiempo real */
export function watchProgress(uid, callback) {
  return onSnapshot(doc(db, "progress", uid), snap => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

/** Actualizar racha */
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
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1; // se rompió la racha
    }
    // Si diffDays === 0, mismo día, no cambiar racha
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

/** Obtener todas las insignias definidas */
export async function getBadges() {
  const snap = await getDocs(collection(db, "badges"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Crear insignia (admin) */
export async function createBadge(data) {
  const ref = await addDoc(collection(db, "badges"), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/** Otorgar insignia a usuario */
export async function awardBadge(uid, badgeId) {
  await updateDoc(doc(db, "progress", uid), {
    badges: arrayUnion(badgeId)
  });
}

/** Revocar insignia (admin) */
export async function revokeBadge(uid, badgeId) {
  await updateDoc(doc(db, "progress", uid), {
    badges: arrayRemove(badgeId)
  });
}


// ════════════════════════════════════════════
// MISIONES
// ════════════════════════════════════════════

/** Obtener todas las misiones */
export async function getMissions() {
  const q = query(collection(db, "missions"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener misiones asignadas a un usuario */
export async function getUserMissions(uid) {
  const q = query(
    collection(db, "missions"),
    where("assignedTo", "array-contains", uid)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Crear misión */
export async function createMission(data) {
  const ref = await addDoc(collection(db, "missions"), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/** Actualizar misión */
export async function updateMission(missionId, data) {
  await updateDoc(doc(db, "missions", missionId), data);
}

/** Eliminar misión */
export async function deleteMission(missionId) {
  await deleteDoc(doc(db, "missions", missionId));
}


// ════════════════════════════════════════════
// ENTREGAS (SUBMISSIONS)
// ════════════════════════════════════════════

/** Enviar entrega de misión */
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

/** Obtener entregas de una misión */
export async function getMissionSubmissions(missionId) {
  const q = query(
    collection(db, "submissions"),
    where("missionId", "==", missionId),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Obtener entregas de un usuario */
export async function getUserSubmissions(uid) {
  const q = query(
    collection(db, "submissions"),
    where("uid", "==", uid),
    orderBy("submittedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Revisar entrega (admin) */
export async function reviewSubmission(submissionId, grade, feedback) {
  await updateDoc(doc(db, "submissions", submissionId), {
    grade,
    feedback,
    status:     "reviewed",
    reviewedAt: serverTimestamp()
  });
}

/** Obtener todas las entregas pendientes */
export async function getPendingSubmissions() {
  const q = query(
    collection(db, "submissions"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}


// ════════════════════════════════════════════
// CONFIG DE LA APP
// ════════════════════════════════════════════

/** Obtener configuración de la app */
export async function getAppConfig() {
  const snap = await getDoc(doc(db, "config", "app"));
  return snap.exists() ? snap.data() : {};
}

/** Guardar configuración (admin) */
export async function saveAppConfig(data) {
  await setDoc(doc(db, "config", "app"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}
