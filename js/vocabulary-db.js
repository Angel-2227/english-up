// =============================================
// ENGLISH UP! — js/vocabulary-db.js
// CRUD + progress para el sistema de vocabulario
// =============================================

import { db } from "../firebase-config.js";
import {
  collection, doc,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp,
  increment, writeBatch, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ════════════════════════════════════════════
// PARTES DEL DISCURSO
// ════════════════════════════════════════════

export const PARTS_OF_SPEECH = [
  { value: "noun",        label: "Noun",        emoji: "🏷️" },
  { value: "verb",        label: "Verb",        emoji: "⚡" },
  { value: "adjective",  label: "Adjective",   emoji: "🎨" },
  { value: "adverb",     label: "Adverb",      emoji: "💨" },
  { value: "phrase",     label: "Phrase",      emoji: "💬" },
  { value: "expression", label: "Expression",  emoji: "🗣️" },
  { value: "grammar",    label: "Grammar",     emoji: "📐" },
  { value: "other",      label: "Other",       emoji: "📌" },
];

// ════════════════════════════════════════════
// VOCABULARY ITEMS
// ════════════════════════════════════════════

export async function getAllVocabulary() {
  const q = query(collection(db, "vocabulary"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getVocabularyByModule(moduleId) {
  const q = query(
    collection(db, "vocabulary"),
    where("moduleId", "==", moduleId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getVocabularyByLesson(moduleId, lessonId) {
  const q = query(
    collection(db, "vocabulary"),
    where("moduleId", "==", moduleId),
    where("lessonId", "==", lessonId),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createVocabularyItem(data) {
  const ref = await addDoc(collection(db, "vocabulary"), {
    word:          data.word          || "",
    definition:    data.definition    || "",
    translation:   data.translation   || "",
    pronunciation: data.pronunciation || "",
    partOfSpeech:  data.partOfSpeech  || "other",
    examples:      data.examples      || [],   // string[]
    tags:          data.tags          || [],   // string[]
    moduleId:      data.moduleId      || null,
    lessonId:      data.lessonId      || null,
    moduleName:    data.moduleName    || "",
    lessonName:    data.lessonName    || "",
    image:         data.image         || "",   // URL opcional
    audio:         data.audio         || "",   // URL opcional
    createdBy:     data.createdBy     || null,
    createdAt:     serverTimestamp(),
  });
  return ref.id;
}

export async function updateVocabularyItem(wordId, data) {
  await updateDoc(doc(db, "vocabulary", wordId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteVocabularyItem(wordId) {
  await deleteDoc(doc(db, "vocabulary", wordId));
}

export async function bulkCreateVocabulary(items) {
  const batch = writeBatch(db);
  const refs  = [];
  items.forEach(item => {
    const ref = doc(collection(db, "vocabulary"));
    refs.push(ref.id);
    batch.set(ref, {
      word:          item.word          || "",
      definition:    item.definition    || "",
      translation:   item.translation   || "",
      pronunciation: item.pronunciation || "",
      partOfSpeech:  item.partOfSpeech  || "other",
      examples:      item.examples      || [],
      tags:          item.tags          || [],
      moduleId:      item.moduleId      || null,
      lessonId:      item.lessonId      || null,
      moduleName:    item.moduleName    || "",
      lessonName:    item.lessonName    || "",
      image:         "",
      audio:         "",
      createdBy:     item.createdBy     || null,
      createdAt:     serverTimestamp(),
    });
  });
  await batch.commit();
  return refs;
}

export function watchVocabulary(callback) {
  const q = query(collection(db, "vocabulary"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════
// STUDENT PROGRESS PER WORD
// ════════════════════════════════════════════

/**
 * Formato del doc: /vocabularyProgress/{uid}
 * {
 *   words: {
 *     [wordId]: {
 *       seen:       number,
 *       correct:    number,
 *       incorrect:  number,
 *       score:      number (0-100),
 *       lastSeen:   timestamp,
 *       nextReview: timestamp  (simple SRS)
 *     }
 *   }
 * }
 */

export async function getVocabularyProgress(uid) {
  const snap = await getDoc(doc(db, "vocabularyProgress", uid));
  return snap.exists() ? (snap.data().words ?? {}) : {};
}

export async function recordWordResult(uid, wordId, correct) {
  const ref     = doc(db, "vocabularyProgress", uid);
  const snap    = await getDoc(ref);
  const words   = snap.exists() ? (snap.data().words ?? {}) : {};
  const current = words[wordId] ?? { seen: 0, correct: 0, incorrect: 0, score: 50 };

  const seen      = current.seen      + 1;
  const corr      = current.correct   + (correct ? 1 : 0);
  const incorr    = current.incorrect + (correct ? 0 : 1);
  const score     = Math.round((corr / seen) * 100);

  // Simple SRS: interval depends on score
  const now      = new Date();
  const interval = correct
    ? Math.min(30, Math.max(1, Math.floor(score / 20))) // 1-30 days
    : 1;
  const nextReview = new Date(now.getTime() + interval * 86400000);

  await setDoc(ref, {
    words: {
      ...words,
      [wordId]: {
        seen,
        correct:    corr,
        incorrect:  incorr,
        score,
        lastSeen:   serverTimestamp(),
        nextReview: nextReview.toISOString(),
      }
    }
  }, { merge: true });

  return score;
}

// ════════════════════════════════════════════
// AI EXTRACTION (via Anthropic API)
// ════════════════════════════════════════════

/**
 * Llama a Claude para extraer vocabulario de un texto de lección.
 * @param {string} lessonText
 * @param {string} lessonTitle
 * @returns {Promise<Array>} array de items de vocabulario
 */
export async function extractVocabularyWithAI(lessonText, lessonTitle) {
  const prompt = `You are an English language teacher. Analyze the following lesson content and extract the most important vocabulary items, phrases, grammar structures, and expressions that English learners at A1-B1 level should learn.

Lesson title: "${lessonTitle}"
Lesson content:
---
${lessonText.slice(0, 4000)}
---

Return ONLY a JSON array (no markdown, no explanation) with this exact structure:
[
  {
    "word": "to strum",
    "pronunciation": "/strʌm/",
    "partOfSpeech": "verb",
    "definition": "To sweep the fingers across the strings of a guitar",
    "translation": "rasguear",
    "examples": ["He strums the guitar softly.", "She was strumming a melody."]
  }
]

partOfSpeech must be one of: noun, verb, adjective, adverb, phrase, expression, grammar, other
Extract 8-15 items. Focus on words that appear in the lesson. Include grammar patterns as "grammar" type.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages:   [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  const text = data.content?.[0]?.text ?? "[]";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return [];
  }
}
