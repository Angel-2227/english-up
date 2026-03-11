// =============================================
// ENGLISH UP! — js/celebrations.js
// Animaciones de celebración:
//   · showLessonComplete(xpGained, xpBefore, xpAfter)
//   · showLevelUp(oldLevel, newLevel)
//   · Confetti canvas (interno)
// =============================================

// ════════════════════════════════════════════
// CONFETTI ENGINE (canvas-based)
// ════════════════════════════════════════════

const CONFETTI_COLORS = [
  "#f59e0b", "#fbbf24", "#fde68a",   // amber/brand
  "#14b8a6", "#2dd4bf", "#99f6e4",   // teal
  "#fb7185", "#f43f5e",               // rose
  "#4ade80", "#22c55e",               // green
  "#a78bfa", "#8b5cf6",               // purple
];

class ConfettiParticle {
  constructor(canvas) {
    this.reset(canvas);
  }

  reset(canvas) {
    this.x     = Math.random() * canvas.width;
    this.y     = -10;
    this.w     = Math.random() * 10 + 5;
    this.h     = Math.random() * 5 + 3;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.vx    = (Math.random() - 0.5) * 4;
    this.vy    = Math.random() * 4 + 2;
    this.rot   = Math.random() * Math.PI * 2;
    this.vrot  = (Math.random() - 0.5) * 0.2;
    this.shape = Math.random() > 0.5 ? "rect" : "circle";
  }

  update(canvas) {
    this.x   += this.vx;
    this.y   += this.vy;
    this.rot += this.vrot;
    this.vy  += 0.06; // gravity
    if (this.y > canvas.height + 20) {
      this.reset(canvas);
      this.y = -10;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.fillStyle = this.color;
    if (this.shape === "rect") {
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

let confettiCanvas   = null;
let confettiCtx      = null;
let confettiParticles = [];
let confettiRAF      = null;
let confettiStopAt   = 0;

function startConfetti(duration = 3000) {
  stopConfetti();

  // Create canvas if needed
  if (!confettiCanvas) {
    confettiCanvas        = document.createElement("canvas");
    confettiCanvas.id     = "celebration-canvas";
    document.body.appendChild(confettiCanvas);
  }

  confettiCanvas.style.display = "block";
  confettiCanvas.width  = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiCtx = confettiCanvas.getContext("2d");

  // Spawn burst of particles
  const COUNT = Math.min(120, Math.floor(window.innerWidth / 8));
  confettiParticles = Array.from({ length: COUNT }, () => {
    const p = new ConfettiParticle(confettiCanvas);
    // Spread initial Y so first frame looks full
    p.y = Math.random() * -300;
    return p;
  });

  confettiStopAt = Date.now() + duration - 600; // stop spawning 600ms before end

  function loop() {
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiParticles.forEach(p => {
      // After stop time, let particles fall off without resetting
      if (Date.now() > confettiStopAt) {
        p.x   += p.vx;
        p.y   += p.vy;
        p.rot += p.vrot;
        p.vy  += 0.06;
        p.draw(confettiCtx);
      } else {
        p.update(confettiCanvas);
        p.draw(confettiCtx);
      }
    });

    const allGone = confettiParticles.every(p => p.y > confettiCanvas.height + 20);
    if (allGone && Date.now() > confettiStopAt) {
      stopConfetti();
      return;
    }

    confettiRAF = requestAnimationFrame(loop);
  }

  confettiRAF = requestAnimationFrame(loop);
}

function stopConfetti() {
  if (confettiRAF) {
    cancelAnimationFrame(confettiRAF);
    confettiRAF = null;
  }
  if (confettiCanvas) {
    confettiCtx?.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiCanvas.style.display = "none";
  }
  confettiParticles = [];
}


// ════════════════════════════════════════════
// LESSON COMPLETE CELEBRATION
// Muestra overlay centrado ~2.8s con XP bar
// ════════════════════════════════════════════

/**
 * @param {number} xpGained   - XP de esta lección
 * @param {number} xpBefore   - XP total antes de completar
 * @param {number} xpAfter    - XP total después
 */
export function showLessonComplete(xpGained, xpBefore, xpAfter) {
  const DURATION = 2800;

  // XP dentro del nivel actual (0–99)
  const xpInLevelBefore = xpBefore % 100;
  const xpInLevelAfter  = xpAfter  % 100;
  const levelBefore     = Math.floor(xpBefore / 100) + 1;
  const levelAfter      = Math.floor(xpAfter  / 100) + 1;
  const leveledUp       = levelAfter > levelBefore;

  // Start confetti immediately
  startConfetti(DURATION + 200);

  // Build overlay
  const overlay = document.createElement("div");
  overlay.className = "lesson-celebration";

  overlay.innerHTML = `
    <div class="lesson-celebration-card">
      <div class="lc-emoji">🎉</div>
      <div class="lc-title">Lesson Complete!</div>
      <div class="lc-subtitle">Great work — keep it up!</div>

      <div class="lc-xp-row">
        <span style="font-size:1.1rem">⚡</span>
        <span class="lc-xp-label">+${xpGained} XP</span>
      </div>

      <div class="lc-level-row">
        <div class="lc-level-label">
          <span>⭐ Level ${levelBefore}</span>
          <span id="lc-xp-text">${xpInLevelBefore}/100 XP</span>
        </div>
        <div class="lc-bar-track">
          <div class="lc-bar-fill" id="lc-bar-fill"></div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate bar: first set to "before" position instantly, then animate to "after"
  requestAnimationFrame(() => {
    const fill = overlay.querySelector("#lc-bar-fill");
    const label = overlay.querySelector("#lc-xp-text");

    if (fill) {
      fill.style.transition = "none";
      fill.style.width      = `${xpInLevelBefore}%`;

      // Small delay then animate forward
      setTimeout(() => {
        if (leveledUp) {
          // Fill to 100% first
          fill.style.transition = `width 600ms cubic-bezier(0.22, 1, 0.36, 1)`;
          fill.style.width      = "100%";
          if (label) label.textContent = "100/100 XP";
        } else {
          fill.style.transition = `width 800ms cubic-bezier(0.22, 1, 0.36, 1)`;
          fill.style.width      = `${xpInLevelAfter}%`;
          if (label) label.textContent = `${xpInLevelAfter}/100 XP`;
        }
      }, 400);
    }
  });

  // Remove overlay after animation
  setTimeout(() => {
    overlay.remove();

    // If leveled up, show level up screen after lesson complete fades
    if (leveledUp) {
      showLevelUp(levelBefore, levelAfter);
    }
  }, DURATION);
}


// ════════════════════════════════════════════
// LEVEL UP SCREEN
// Pantalla completa oscura con rayos ~3.2s
// ════════════════════════════════════════════

/**
 * @param {number} oldLevel
 * @param {number} newLevel
 */
export function showLevelUp(oldLevel, newLevel) {
  const DURATION = 3200;

  // Heavier confetti for level up
  startConfetti(DURATION);

  // Floating particles (emojis)
  spawnFloatingParticles();

  const overlay = document.createElement("div");
  overlay.className = "levelup-overlay";

  overlay.innerHTML = `
    <div class="levelup-rays"></div>
    <div class="levelup-glow"></div>
    <div class="levelup-content">
      <div class="levelup-label">Level Up!</div>
      <div class="levelup-star">⭐</div>
      <div class="levelup-numbers">
        <div class="levelup-num-old">${oldLevel}</div>
        <div class="levelup-arrow">→</div>
        <div class="levelup-num-new">${newLevel}</div>
      </div>
      <div class="levelup-title">You reached Level ${newLevel}!</div>
      <div class="levelup-subtitle">Your English is getting stronger every day.</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Remove after animation
  setTimeout(() => {
    overlay.remove();
    stopConfetti();
    cleanupParticles();
  }, DURATION);
}


// ════════════════════════════════════════════
// FLOATING PARTICLES (emojis bursting out)
// ════════════════════════════════════════════

const PARTICLE_EMOJIS = ["⭐", "✨", "⚡", "🌟", "💫", "🎯", "🔥", "💥"];
let particleTimeouts  = [];

function spawnFloatingParticles() {
  const count = 18;
  for (let i = 0; i < count; i++) {
    const delay = Math.random() * 1200;
    const t = setTimeout(() => {
      const el = document.createElement("span");
      el.className = "lv-particle";
      el.textContent = PARTICLE_EMOJIS[Math.floor(Math.random() * PARTICLE_EMOJIS.length)];

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      el.style.left     = `${Math.random() * vw}px`;
      el.style.top      = `${Math.random() * vh * 0.8 + vh * 0.1}px`;
      el.style.fontSize = `${Math.random() * 1.2 + 0.8}rem`;
      el.style.animationDuration = `${Math.random() * 1000 + 800}ms`;
      el.style.animationDelay    = "0ms";

      document.body.appendChild(el);
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, delay);
    particleTimeouts.push(t);
  }
}

function cleanupParticles() {
  particleTimeouts.forEach(t => clearTimeout(t));
  particleTimeouts = [];
  document.querySelectorAll(".lv-particle").forEach(el => el.remove());
}
