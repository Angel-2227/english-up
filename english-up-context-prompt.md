# ENGLISH UP! — Contexto Completo para Desarrollo de Módulo 2

## QUIÉN SOY Y QUÉ ES ESTA APP

Soy el creador de **English Up!**, una plataforma web de inglés para adultos en nivel A1–A2, construida sobre Firebase + Cloudflare Pages. Yo soy el profesor y también el desarrollador. Mis estudiantes son adultas colombianas (Medellín), principalmente. La app funciona como un Duolingo personalizado pero con lecciones reales de 90–120 minutos entregadas en archivos HTML estáticos dentro de un iframe.

---

## TECH STACK

- **Frontend:** Vanilla JS ES Modules (sin framework)
- **Hosting:** Cloudflare Pages → `https://english-up.pages.dev/`
- **Base de datos:** Firebase Firestore (`english-up-53af6`)
- **Auth:** Firebase Auth (Google Login)
- **AI Chat:** Groq API vía Cloudflare Worker → `https://english-up-groq.mwp.workers.dev` modelo `llama-3.1-8b-instant`
- **Tipografía:** Fraunces + Nunito (app shell) · Playfair Display + DM Sans (lecciones HTML)
- **Colores del app shell:** Amber/honey + teal
- **Colores de lecciones HTML:** Sistema propio con variables CSS (cream, parchment, gold, rust, sage, blue, teal, violet, rose)

---

## ARQUITECTURA DE LA APP

### Rutas principales (js/app.js)
- `home` → Dashboard tipo "learning path" zigzag (js/dashboard.js)
- `lesson` → Visor de lecciones con iframe (js/lesson.js)
- `missions` → Misiones asignadas por el profe (js/missions.js)
- `vocabulary` → Banco de vocabulario + modos de práctica (js/vocabulary.js)
- `profile` → Perfil del estudiante con badges, XP, avatar
- `curriculum` → Mapa curricular interactivo
- `calendar` → Calendario de clases
- `teacher` → Panel del profesor (solo admin)

### Sistema de lecciones (js/lesson.js)
Las lecciones se guardan en Firestore en `/modules/{moduleId}/lessons/{lessonId}` con estos tipos:
- `"html"` → URL a un archivo `.html` en `/lessons/mod{N}/session{N}.html` — se carga en iframe
- `"editor"` → Contenido Quill rich-text guardado en Firestore
- `"url"` → URL externa

Los archivos HTML de lecciones se comunican con la app mediante **postMessage**:
- `ENGLISHUP_LESSON_RESPONSE` → envía respuestas del estudiante al profe
- `ENGLISHUP_GET_TEXT` / `ENGLISHUP_LESSON_TEXT` → extrae texto para el AI
- `ENGLISHUP_SAVE_WORD` → guarda una palabra al vocabulario del estudiante

### Gamificación
- **XP** se acumula al completar lecciones y misiones
- **Streaks** se calculan por actividad diaria
- **Badges** se otorgan automáticamente (first_lesson, streak_3, streak_7, xp_100, xp_500, etc.) o manualmente por el profe
- **Misiones** son actividades adicionales (quiz, gapfill, matching, unscramble, link)

### Vocabulario (js/vocabulary.js + js/vocabulary-db.js)
- Banco global en Firestore `/vocabulary`
- Estudiantes practican con: Flashcards, Quiz (multiple choice), Typewriting, Matching
- El **Word Selection Tooltip** en cada lección HTML permite seleccionar cualquier palabra → Translate (Groq) / Explain (Groq) / Save al banco personal
- Progreso por palabra con sistema SRS simple

---

## ESTRUCTURA DE UN ARCHIVO HTML DE LECCIÓN

Cada lección HTML (`/lessons/mod{N}/session{N}.html`) sigue este patrón establecido en M0–M1:

### Elementos fijos obligatorios:
1. **Print bar** (barra superior negra con botón de imprimir)
2. **Hero** (banner con gradiente oscuro, badge del módulo, título, subtítulo, tags)
3. **Objectives bar** (lista horizontal de objetivos de la sesión)
4. **Progress tracker** (panel flotante derecha, desktop only, dots verdes)
5. **Sections** con numeración circular dorada, título y tiempo estimado
6. **Cards** blancas con sombra sutil para cada actividad
7. **Send All Bar** (barra al final para enviar respuestas al profe)
8. **Next Session Banner** (preview de la siguiente clase)

### Scripts obligatorios al final:
```js
// 1. PostMessage bridge para AI context
window.addEventListener("message", function(event) { ... ENGLISHUP_GET_TEXT ... });

// 2. EnglishUp.submit() helper
window.EnglishUp = { submit(responses, options) { ... postMessage ENGLISHUP_LESSON_RESPONSE ... } };

// 3. TTS Engine (Web Speech API)
function speakWord(btn, text) { ... SpeechSynthesisUtterance ... }

// 4. Word Selection Tooltip (seleccionar → translate/explain/save)
// Llama al Groq Worker: https://english-up-groq.mwp.workers.dev
// Modelo: llama-3.1-8b-instant

// 5. markProgress(id) para el tracker
```

### Tipos de actividades implementados en M0/M1:
- **Vocab cards** (tap to reveal translation + TTS button)
- **Matching** (chip tap → definition tap)
- **Gap-fill lyrics** (word bank → blank)
- **Grammar practice** (word bank → blank, con chip selector)
- **Sentence unscramble** (chips → slots)
- **Multiple choice quiz** (con feedback automático y score)
- **True/False quiz**
- **Contenteditable write-lines** (líneas de escritura libre)
- **Survey cards** (tap to select preferences)
- **Hot Seat game** (juego de clase con timer)
- **Mini-games block** (flashcards, speed sort, verb builder, spelling bee, favourites builder — solo en Session 3)
- **Words FAB** (botón flotante izquierda con panel de vocabulario por tabs)
- **Pronunciation drill** (chips que hablan al hacer tap)

### Paleta de colores de las lecciones:
```css
--cream: #FAF6EE; --parchment: #F0E8D5; --ink: #1A1208;
--brown: #6B3F1A; --gold: #C9862A; --gold-lt: #F5D89A;
--rust: #B84A20; --sage: #3D6B4A; --sage-lt: #D1E8D8;
--blue: #2A4A7A; --blue-lt: #D4DFF0; --teal: #14697A;
--teal-lt: #D0EEF3; --violet: #5B21B6; --violet-lt: #EDE9FE;
--rose: #9D174D; --rose-lt: #FCE7F3;
--green: #166534; --green-lt: #DCFCE7;
```

---

## PLAN CURRICULAR 2026

### Estructura general
- 26 sesiones · 90–120 min · 1 sesión por semana
- Nivel entrada: A1+ → Meta: A2 sólido / inicio B1
- Filosofía: contexto primero, regla después. Canciones → personajes → conversación real ANTES de explicar gramática.

### Módulos
| # | Emoji | Nombre | Nivel | Sesiones |
|---|-------|--------|-------|----------|
| 0 | 🎬 | The Hook | A1 | — (ya hecho) |
| 1 | 🟢 | Who Are You? | A1 | 1–4 |
| 2 | 🟡 | My World | A1–A2 | 5–8 |
| 3 | 🟠 | Actions & Feelings | A2 | 9–12 |
| 4 | 🔵 | Stories & Past | A2 | 13–16 |
| 5 | 🟣 | Real World | A2+ | 17–20 |
| 6 | 🔴 | Express Yourself | A2+–B1 | 21–26 |

---

## LO QUE YA ESTÁ HECHO (Módulo 0 y Módulo 1)

### Módulo 0 — The Hook (Session 1)
**Archivo:** `lessons/mod0/session1.html`  
**Canción ancla:** "Killing Me Softly" — The Fugees (Roberta Flack)  
**Contenido:**
- Listening: escribir el chorus de memoria
- Vocabulario emocional: to strum, embarrassed, to gaze, softly, soul, stranger, flushed, crowd, to pray, fever, despair, to swear
- Matching: word → definition
- Gap-fill: letra completa de la canción (12 blanks)
- Gramática: Verb To Be — tabla completa present + past, positivo/negativo/pregunta
- Grammar practice: 8 blanks (am/is/are/was/were/isn't/wasn't/Are/Is)
- Sentence unscramble: 5 oraciones
- True/False quiz: 6 preguntas sobre la canción
- Discussion: 4 preguntas con líneas de escritura
- Preview de The Book of Life (trailer)

### Módulo 1 — Who Are You? (Sessions 1–3, con Session 4 = Quiz)

#### Session 1 — The Book of Life
**Archivo:** `lessons/mod1/session1.html`  
**Ancla:** The Book of Life (película animada, México, 2014)  
**Contenido:**
- Warm-up: trailer de la película, pause & describe
- Vocabulario de personalidad: brave, kind, funny, strong, young, tall, cheerful, determined, selfless, reckless — con TTS en cada tarjeta
- IPA & Speaking: /eɪ/, /aɪ/, /ʌ/, /ɒ/, /ɔː/, /ɜː/, /ə/, stress mark ˈ — tabla completa + drill interactivo con TTS
- Matching: adjective → definition (8 pares)
- Adjective order: Opinion → Size → Age (OSA) — 4 ejercicios de ordenar chips en slots
- Grammar: Verb To Be completo (present + past, pos/neg/question) — 8 blanks con word bank
- Song gap-fill: "I Love You Too Much" (The Book of Life) — 13 blanks
- Sentence unscramble: 5 oraciones sobre los personajes
- Multiple choice quiz: 6 preguntas
- Discussion: 4 preguntas + 5 oraciones sobre sí misma

#### Session 2 — This Is Me
**Archivo:** `lessons/mod1/session2.html`  
**Canción ancla:** "Perfect" — Ed Sheeran  
**Contenido:**
- Warm-up: "Perfect" video — detectar Verb To Be
- Bio reading: Ed Sheeran (texto real con Verb To Be marcado), 6 WH questions
- Vocabulario de descripción personal: perfect, shy, confident, hopeful, fearless, restless, in love, proud — con TTS
- Grammar: Verb To Be negativo + preguntas + short answers (tabla completa) — 7 blanks
- Sentence Transformer: positivo → negativo + pregunta (3 cards, 6 transformaciones con check automático)
- Song gap-fill: "Perfect" — 10 blanks
- Sentence sort (unscramble): 5 oraciones
- Pronunciation drill: 4 patrones (questions, past questions, negatives, short answers)
- Two Truths One Lie: 2 truths + 1 lie en Verb To Be
- Journalist role-play: journalist + celebrity
- Instagram profile builder: username, bio, posts, captions — todo en Verb To Be

#### Session 3 — My Favourites
**Archivo:** `lessons/mod1/session3.html`  
**Ancla de warm-up:** "The Bear and the Bee" (historia animada de YouTube, beginner A1)  
**Contenido:**
- Warm-up: historia animada (comprehension T/F + WH questions)
- Vocabulario del cuento: honey, beehive, annoyed, to sting, temper, to smash, to chase, trouble — con TTS
- Likes/Loves/Hates: like/love/hate + noun o -ing — tabla de patrones
- Survey interactivo: 12 tarjetas de preferencias (dogs, cats, cooking, music, etc.)
- Grammar: 3rd person -s rules (4 reglas: +s, +es, y→ies, irregular) — tabla completa + video de YouTube
- Grammar practice 1: 8 blanks (likes/loves/watches/goes/studies/has/hates/plays)
- Sentences con 3rd person: 5 write-lines
- Matching: 6 verbos → su forma correcta en 3ª persona (teach/tries, try/tries, etc.)
- Hot Seat game: 90s timer, 12 tarjetas de temas, question chips con TTS
- Sentence unscramble: 5 oraciones
- Exam Review Quiz: 8 preguntas (cubre todo M1)
- Exam Checklist: 7 items de repaso (tap to check)
- Mini-games block completo:
  - 🃏 Flashcard Flip (16 tarjetas, scored)
  - ⚡ Speed Sort (15 verbos → 3 columnas de reglas)
  - 🔨 Verb Builder (8 inputs de tipeo)
  - 🐝 Spelling Bee (12 palabras con TTS)
  - 💬 Favourites Builder (4 prompts de producción libre)
- Words FAB: panel lateral con 4 tabs (🐻 Story, 💜 Likes, 📐 Verbs, ✍️ Phrases)

#### Session 4 — Mid-Course Evaluation (Quiz)
**Archivo:** `lessons/mod1/session4-quiz.html`  
**Tipo:** Evaluación oficial M0–M3  
**Formato:** Cover screen → Exam → Results  
**Partes:**
- Part 1 · Listening (20 pts): audio "A Weekend in Medellín" — True/False x4 + MC x4 (2 plays máximo con HTML5 audio)
- Part 2 · Reading (25 pts): Texto A (Camila, "My Favourite Day") + Texto B (Valentina bio Instagram) — T/F, MC, short answer, multi-select
- Part 3 · Language Use (30 pts): Verb To Be gap-fill x8 + WH Questions x4 + Likes/Dislikes x4 + Vocabulary Matching x6
- Part 4 · Writing (25 pts): Task 1 personal profile + Task 2 character description — graded by teacher
- Results screen: band scores por sección, descriptores CEFR, teacher login para gradar writing
- Teacher login: `juanrubio2277@gmail.com` / `juan2727-evaluador`

---

## VOCABULARIO YA EN FIRESTORE (NO DUPLICAR)

```
barefoot, faith, darling, best-selling, childhood, guitarist, songwriter,
WH Questions with To Be, Verb To Be — short answers, Verb To Be — negative,
in love, proud, restless, fearless, hopeful, confident, shy, perfect, reckless,
funny, strong, adjective order (OSA), Verb To Be — past,
Verb To Be — question form, cheerful, brave, young, selfless, determined,
kind, tall, IPA — stress mark ˈ, Verb To Be — present, despair, softly,
killing me softly (idiom), Verb To Be — was/were, crowd, fever, soul,
to strum, Present Simple, stranger, to pray, flushed, embarrassed, to gaze,
to swear, honey, beehive, annoyed, to sting, temper, to smash, to chase,
trouble, like + noun/verb-ing, love + noun/verb-ing, hate + noun/verb-ing,
favourite, 3rd person -s (Present Simple), 3rd person -es rule,
3rd person y→ies rule, have→has, does/doesn't, to lose one's temper
```

---

## MÓDULO 2 — MY WORLD (Lo que viene)

**Sesiones:** 5–8 · Nivel: A1–A2  
**Meta:** Familia, hogar y rutinas diarias. Primera lectura de comprensión real. Present Simple entra al final.

### Plan según el currículo:

| Ses. | Tema | Gramática | Vocabulario | Actividades Clave |
|------|------|-----------|-------------|-------------------|
| 5 | My Family | Possessivos: my/his/her/our/their · Adj. order: opinion+size+age | Familia · descripciones físicas · relaciones | Árbol genealógico · "Who is she in your family?" · Book of Life familia de Manolo |
| 6 | My Home | There is/There are (+ neg + preguntas) · Preposiciones de lugar | Habitaciones · muebles · objetos del hogar | Plano de casa gap-fill · "Is there a...?" |
| 7 | My Day | Present Simple (rutinas) · always/usually/sometimes/never · Expresiones de tiempo | Acciones diarias · días de la semana · hora | Línea de tiempo · PRIMERA lectura real · WH questions escritas |
| 8 | Review M2 + Reading | Present Simple review · There is/are | Todo el vocab de M2 | Párrafo familia + hogar · quiz en plataforma · lectura corta con comprensión |

### Notas de diseño para M2:
- **Warm-ups:** Videos narrativos animados alineados al currículo (NO canciones, NO contenido sin relación) — preferiblemente historias beginner de YouTube en inglés
- **Book of Life:** Puede seguir apareciendo como ancla de contenido (la familia de Manolo es perfecta para Session 5)
- **Games:** Deben ser competitivos, rápidos y con score (no pasivos)
- **Audio/TTS:** En todas las tarjetas de vocabulario y en ejemplos de gramática
- **Ejercicios de escritura:** Con contenteditable + data-label para que se envíen al profe
- **Send All Bar** al final de cada sesión
- **Progress tracker** flotante (desktop)
- **Words FAB** con vocabulario relevante de la sesión organizado por tabs

---

## PREFERENCIAS DE ENTREGA

- **Archivos completos** e inmediatamente usables — sin diffs, sin confirmaciones previas, sin explicaciones antes de entregar
- **Primera versión completa** → yo reviso → pido ajustes específicos
- **Archivos grandes** → Python al output, no inline
- **Patrón de sesiones 1–3 de M1** como referencia de calidad y estilo
- Cada archivo HTML es autónomo (no depende del app shell para funcionar)
- El `title` del HTML debe seguir el formato: `Module 2 · Session 5 — My Family · 120 min`
- La URL del archivo irá en: `lessons/mod2/session5.html` (y así sucesivamente)

---

## FIRESTORE IDs DE MÓDULOS (para scripts de vocabulario)

```
pErwU3KRVuG5JZROcBoh  →  The Hook (M0)
qQumu54Mfo8YrL0l9pcc  →  Who am I? (M1)
TIb4XQDSto5CYfs2XUbK  →  My World (M2)  ← próximo módulo
gb5sZaUyztoRWBpjlxBm  →  Actions & Feelings (M3)
lmVS7SSuBvrIedcwjwCq  →  Stories & Past (M4)
NoxmKvhI2P9JdvV1lxRw  →  Places & People (M5)
T0bv88x9McAMe9sR7sAC  →  Express Yourself (M6)
```

---

## URLS DE REFERENCIA

- App: https://english-up.pages.dev/
- Groq Worker: https://english-up-groq.mwp.workers.dev
- Firebase Project: english-up-53af6

---

*Contexto generado para desarrollo de Módulo 2 — My World (Sessions 5–8)*
