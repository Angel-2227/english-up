// =============================================
// ENGLISH UP! — js/calendar-db.js
// Firestore helpers para el calendario de clases
//
// Colecciones Firestore:
//   /schedules/{id}        → clases agendadas por el teacher
//   /scheduleRequests/{id} → solicitudes de cambio del estudiante
// =============================================

import { db } from "../firebase-config.js";
import {
  collection, doc,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ════════════════════════════════════════════
// SCHEDULES (clases agendadas)
// ════════════════════════════════════════════

/**
 * Crea o actualiza una clase en el calendario.
 * @param {object} data
 *   title, date (YYYY-MM-DD), startTime, endTime,
 *   description, classroomId (optional), color (optional)
 */
export async function createSchedule(data) {
  const ref = await addDoc(collection(db, "schedules"), {
    title:       data.title       || "Class",
    date:        data.date,                         // "YYYY-MM-DD"
    startTime:   data.startTime   || "",
    endTime:     data.endTime     || "",
    description: data.description || "",
    classroomId: data.classroomId || null,          // null = todos
    color:       data.color       || "teal",
    createdAt:   serverTimestamp(),
    createdBy:   data.createdBy   || null,
  });
  return ref.id;
}

export async function updateSchedule(scheduleId, data) {
  await updateDoc(doc(db, "schedules", scheduleId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSchedule(scheduleId) {
  await deleteDoc(doc(db, "schedules", scheduleId));
}

/**
 * Obtiene todas las clases de un rango de fechas.
 * @param {string} fromDate YYYY-MM-DD
 * @param {string} toDate   YYYY-MM-DD
 */
export async function getSchedulesInRange(fromDate, toDate) {
  const q = query(
    collection(db, "schedules"),
    where("date", ">=", fromDate),
    where("date", "<=", toDate),
    orderBy("date", "asc"),
    orderBy("startTime", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time listener para schedules de un mes.
 * @param {string} yearMonth "YYYY-MM"
 * @param {string|null} classroomId Filtrar por salón (null = todos)
 * @param {Function} callback
 */
export function watchMonthSchedules(yearMonth, classroomId, callback) {
  const from = `${yearMonth}-01`;
  const to   = `${yearMonth}-31`;

  let q = query(
    collection(db, "schedules"),
    where("date", ">=", from),
    where("date", "<=", to),
    orderBy("date", "asc")
  );

  return onSnapshot(q, snap => {
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Filtrar por salón si aplica
    if (classroomId) {
      results = results.filter(s => !s.classroomId || s.classroomId === classroomId);
    }
    callback(results);
  });
}

// ════════════════════════════════════════════
// SCHEDULE REQUESTS (solicitudes del estudiante)
// ════════════════════════════════════════════

/**
 * Estudiante crea una solicitud de cambio.
 */
export async function createScheduleRequest(data) {
  const ref = await addDoc(collection(db, "scheduleRequests"), {
    studentUid:       data.studentUid,
    studentName:      data.studentName   || "Student",
    classroomId:      data.classroomId   || null,
    preferredDate:    data.preferredDate,            // "YYYY-MM-DD"
    preferredTime:    data.preferredTime  || "",
    note:             data.note           || "",
    status:           "pending",                     // pending | approved | rejected
    createdAt:        serverTimestamp(),
    reviewedAt:       null,
    reviewedBy:       null,
    reviewNote:       "",
  });
  return ref.id;
}

/**
 * Teacher aprueba o rechaza una solicitud.
 */
export async function reviewScheduleRequest(requestId, status, reviewNote = "") {
  await updateDoc(doc(db, "scheduleRequests", requestId), {
    status,
    reviewNote,
    reviewedAt: serverTimestamp(),
  });
}

/**
 * Obtiene solicitudes pendientes (para el teacher).
 */
export async function getPendingRequests() {
  const q = query(
    collection(db, "scheduleRequests"),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Obtiene solicitudes del estudiante.
 */
export async function getMyRequests(studentUid) {
  const q = query(
    collection(db, "scheduleRequests"),
    where("studentUid", "==", studentUid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Real-time para solicitudes del mes (teacher).
 */
export function watchMonthRequests(yearMonth, callback) {
  const from = `${yearMonth}-01`;
  const to   = `${yearMonth}-31`;

  const q = query(
    collection(db, "scheduleRequests"),
    where("preferredDate", ">=", from),
    where("preferredDate", "<=", to),
    orderBy("preferredDate", "asc")
  );

  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/**
 * Real-time para solicitudes del estudiante actual.
 */
export function watchMyRequests(studentUid, callback) {
  const q = query(
    collection(db, "scheduleRequests"),
    where("studentUid", "==", studentUid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════
// HELPERS DE FECHA
// ════════════════════════════════════════════

/** YYYY-MM-DD de hoy */
export function todayStr() {
  const d = new Date();
  return fmtDate(d);
}

/** YYYY-MM de hoy */
export function currentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Date → "YYYY-MM-DD" */
export function fmtDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" → Date local */
export function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Nombre del mes en español/inglés */
export function monthName(year, month, lang = "en") {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { month: "long", year: "numeric" });
}

/** Nombre corto del día "Mon" etc */
export function shortDay(dateStr, lang = "en") {
  const d = parseDate(dateStr);
  return d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { weekday: "short" });
}

/** Formatea hora "14:30" → "2:30 PM" */
export function fmtTime(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "YYYY-MM-DD" → "March 15" style */
export function fmtDateDisplay(dateStr) {
  if (!dateStr) return "";
  const d = parseDate(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/** "YYYY-MM-DD" → "Sat, Mar 15" */
export function fmtDateShort(dateStr) {
  if (!dateStr) return "";
  const d = parseDate(dateStr);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
