// =============================================
// ENGLISH UP! — js/calendar.js
// Vista de calendario:
//   - Estudiante: ver clases agendadas + enviar solicitudes
//   - Profesor:   agendar clases (con lección vinculable) + revisar solicitudes
// =============================================

import { State, registerRoute, navigate, showToast, openModal, closeModal, escapeHTML } from "./app.js";
import {
  createSchedule, updateSchedule, deleteSchedule,
  watchMonthSchedules, watchMonthRequests,
  createScheduleRequest, reviewScheduleRequest,
  watchMyRequests, getPendingRequests,
  fmtDate, fmtTime, fmtDateDisplay, fmtDateShort,
  parseDate,
} from "./calendar-db.js";
import { getPublishedModules, getPublishedLessons } from "./db.js";

// ════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════

const Cal = {
  year:        new Date().getFullYear(),
  month:       new Date().getMonth(),   // 0-indexed
  selected:    fmtDate(new Date()),     // "YYYY-MM-DD"
  schedules:   [],
  requests:    [],
  myRequests:  [],
  // Cache de módulos+lecciones para el modal del profe
  modulesCache: null,
  unsubSchedules: null,
  unsubRequests:  null,
  unsubMyReqs:    null,
};

// ════════════════════════════════════════════
// REGISTER ROUTE
// ════════════════════════════════════════════

export function registerCalendar() {
  registerRoute("calendar", renderCalendarPage);
}

// ════════════════════════════════════════════
// MAIN RENDER
// ════════════════════════════════════════════

async function renderCalendarPage(_, container) {
  container.innerHTML = buildSkeleton();

  Cal.unsubSchedules?.();
  Cal.unsubRequests?.();
  Cal.unsubMyReqs?.();

  const isTeacher = State.isAdmin;
  const ym = yearMonth();

  Cal.unsubSchedules = watchMonthSchedules(ym, State.profile?.classroomId ?? null, schedules => {
    Cal.schedules = schedules;
    refreshCalendar(container);
  });

  if (isTeacher) {
    Cal.unsubRequests = watchMonthRequests(ym, requests => {
      Cal.requests = requests;
      refreshCalendar(container);
      updateFABBadge();
    });
  } else {
    Cal.unsubMyReqs = watchMyRequests(State.user.uid, reqs => {
      Cal.myRequests = reqs;
      refreshCalendar(container);
    });
  }

  container.innerHTML = buildPage(isTeacher);
  bindPageEvents(container, isTeacher);
  renderCalendarGrid(container);
  renderSidebar(container, isTeacher);
}

// ════════════════════════════════════════════
// PAGE SHELL
// ════════════════════════════════════════════

function buildPage(isTeacher) {
  return `
    <div class="calendar-page">

      <div class="cal-page-header">
        <div class="cal-page-title">
          <span class="cal-title-icon">📅</span>
          <h1>Class Schedule</h1>
        </div>
        <div class="cal-page-actions">
          ${isTeacher
            ? `<button class="btn btn-primary btn-sm" id="btn-cal-add">＋ Schedule Class</button>
               <button class="btn btn-ghost btn-sm" id="btn-cal-requests">
                 📥 Requests <span id="req-count-badge" class="cal-requests-count hidden"></span>
               </button>`
            : `<button class="btn btn-secondary btn-sm" id="btn-cal-request">📬 Request Change</button>`
          }
        </div>
      </div>

      <div class="cal-layout">

        <div class="cal-card" id="cal-card">
          <div class="cal-month-nav">
            <button class="cal-nav-btn" id="btn-prev-month">‹</button>
            <div class="cal-month-label" id="cal-month-label"></div>
            <button class="cal-nav-btn" id="btn-next-month">›</button>
          </div>
          <div class="cal-weekdays">
            ${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d =>
              `<div class="cal-weekday">${d}</div>`
            ).join("")}
          </div>
          <div class="cal-days-grid" id="cal-days-grid"></div>
          <div class="cal-legend">
            <div class="cal-legend-item">
              <div class="cal-legend-dot cal-dot-class"></div> Class
            </div>
            <div class="cal-legend-item">
              <div class="cal-legend-dot cal-dot-pending"></div> Pending request
            </div>
            ${isTeacher ? `
              <div class="cal-legend-item">
                <div class="cal-legend-dot cal-dot-request"></div> Student request
              </div>` : ""}
          </div>
        </div>

        <div class="cal-sidebar" id="cal-sidebar"></div>

      </div>
    </div>
  `;
}

// ════════════════════════════════════════════
// BIND EVENTS
// ════════════════════════════════════════════

function bindPageEvents(container, isTeacher) {
  container.querySelector("#btn-prev-month")?.addEventListener("click", () => {
    Cal.month--;
    if (Cal.month < 0) { Cal.month = 11; Cal.year--; }
    onMonthChange(container, isTeacher);
  });

  container.querySelector("#btn-next-month")?.addEventListener("click", () => {
    Cal.month++;
    if (Cal.month > 11) { Cal.month = 0; Cal.year++; }
    onMonthChange(container, isTeacher);
  });

  if (isTeacher) {
    container.querySelector("#btn-cal-add")?.addEventListener("click", () => {
      openScheduleModal(Cal.selected);
    });
    container.querySelector("#btn-cal-requests")?.addEventListener("click", openRequestsModal);
  } else {
    container.querySelector("#btn-cal-request")?.addEventListener("click", () => {
      openStudentRequestModal(Cal.selected);
    });
  }
}

function onMonthChange(container, isTeacher) {
  Cal.unsubSchedules?.();
  Cal.unsubRequests?.();

  const ym = yearMonth();

  Cal.unsubSchedules = watchMonthSchedules(ym, State.profile?.classroomId ?? null, s => {
    Cal.schedules = s;
    renderCalendarGrid(container);
    renderSidebar(container, isTeacher);
  });

  if (isTeacher) {
    Cal.unsubRequests = watchMonthRequests(ym, r => {
      Cal.requests = r;
      renderCalendarGrid(container);
      renderSidebar(container, isTeacher);
      updateFABBadge();
    });
  }

  renderCalendarGrid(container);
  renderSidebar(container, isTeacher);
}

// ════════════════════════════════════════════
// CALENDAR GRID
// ════════════════════════════════════════════

function renderCalendarGrid(container) {
  const label = container.querySelector("#cal-month-label");
  const grid  = container.querySelector("#cal-days-grid");
  if (!label || !grid) return;

  label.textContent = new Date(Cal.year, Cal.month, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const today       = fmtDate(new Date());
  const firstDay    = new Date(Cal.year, Cal.month, 1).getDay();
  const daysInMonth = new Date(Cal.year, Cal.month + 1, 0).getDate();

  const classMap   = {};
  const requestMap = {};

  Cal.schedules.forEach(s => {
    if (!classMap[s.date]) classMap[s.date] = [];
    classMap[s.date].push(s);
  });

  const allRequests = State.isAdmin ? Cal.requests : Cal.myRequests;
  allRequests.forEach(r => {
    if (!requestMap[r.preferredDate]) requestMap[r.preferredDate] = [];
    requestMap[r.preferredDate].push(r);
  });

  let html = "";

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day cal-day-empty"><div class="cal-day-number"></div></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${Cal.year}-${String(Cal.month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const isToday  = dateStr === today;
    const isPast   = dateStr < today;
    const isSel    = dateStr === Cal.selected;
    const classes_ = classMap[dateStr]   || [];
    const reqs     = requestMap[dateStr] || [];

    const hasClass   = classes_.length > 0;
    const hasPending = reqs.some(r => r.status === "pending");
    const hasReq     = reqs.length > 0;

    let cls = "cal-day";
    if (isPast && !isToday) cls += " cal-day-past";
    if (isToday) cls += " cal-day-today";
    if (isSel)   cls += " cal-day-selected";

    const dots = [
      hasClass   ? `<div class="cal-dot cal-dot-class"></div>` : "",
      hasPending ? `<div class="cal-dot cal-dot-pending"></div>` : "",
      (hasReq && State.isAdmin && !hasPending) ? `<div class="cal-dot cal-dot-request"></div>` : "",
    ].join("");

    html += `
      <div class="${cls}" data-date="${dateStr}" role="button" tabindex="0" aria-label="${dateStr}">
        <div class="cal-day-number">${day}</div>
        <div class="cal-day-dots">${dots}</div>
      </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day[data-date]").forEach(cell => {
    cell.addEventListener("click", () => {
      Cal.selected = cell.dataset.date;
      grid.querySelectorAll(".cal-day").forEach(c => c.classList.remove("cal-day-selected"));
      cell.classList.add("cal-day-selected");
      renderSidebar(container, State.isAdmin);
    });
    cell.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cell.click(); }
    });
  });
}

// ════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════

function renderSidebar(container, isTeacher) {
  const sidebar = container.querySelector("#cal-sidebar");
  if (!sidebar) return;

  sidebar.innerHTML = buildSelectedDayCard(isTeacher) + buildUpcomingCard();

  // Edit / Delete schedule
  sidebar.querySelectorAll("[data-action='edit-schedule']").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = Cal.schedules.find(s => s.id === btn.dataset.id);
      if (s) openScheduleModal(s.date, s);
    });
  });

  sidebar.querySelectorAll("[data-action='delete-schedule']").forEach(btn => {
    btn.addEventListener("click", () => {
      const s = Cal.schedules.find(s => s.id === btn.dataset.id);
      if (s) confirmDeleteSchedule(s.id, s.title);
    });
  });

  // Approve / reject from sidebar
  sidebar.querySelectorAll("[data-action='approve-request']").forEach(btn => {
    btn.addEventListener("click", () => reviewRequest(btn.dataset.id, "approved"));
  });
  sidebar.querySelectorAll("[data-action='reject-request']").forEach(btn => {
    btn.addEventListener("click", () => reviewRequest(btn.dataset.id, "rejected"));
  });

  // Go to lesson (student)
  sidebar.querySelectorAll("[data-action='go-lesson']").forEach(btn => {
    btn.addEventListener("click", () => {
      navigate("lesson", { moduleId: btn.dataset.moduleId, lessonId: btn.dataset.lessonId });
    });
  });

  // Add button inside sidebar (teacher)
  sidebar.querySelector("#btn-add-for-day")?.addEventListener("click", () => {
    openScheduleModal(Cal.selected);
  });

  // Request button inside sidebar (student)
  sidebar.querySelector("#btn-sidebar-request")?.addEventListener("click", () => {
    openStudentRequestModal(Cal.selected);
  });

  // Upcoming item clicks → jump to that date
  sidebar.querySelectorAll(".cal-upcoming-item[data-date]").forEach(item => {
    item.addEventListener("click", () => {
      Cal.selected = item.dataset.date;
      const grid = container.querySelector("#cal-days-grid");
      grid?.querySelectorAll(".cal-day").forEach(c => {
        c.classList.toggle("cal-day-selected", c.dataset.date === Cal.selected);
      });
      renderSidebar(container, isTeacher);
    });
  });
}

function buildSelectedDayCard(isTeacher) {
  const date     = Cal.selected;
  const dayLabel = fmtDateDisplay(date);
  const classes_ = Cal.schedules.filter(s => s.date === date);
  const allReqs  = isTeacher ? Cal.requests : Cal.myRequests;
  const reqs     = allReqs.filter(r => r.preferredDate === date);
  const today    = fmtDate(new Date());
  const isPast   = date < today;

  const eventsHTML = [
    ...classes_.map(s => buildClassEventItem(s, isTeacher)),
    ...reqs.map(r    => buildRequestEventItem(r, isTeacher)),
  ].join("");

  return `
    <div class="cal-sidebar-card">
      <div class="cal-sidebar-header">
        <div class="cal-sidebar-title">📅 ${dayLabel}</div>
        ${isTeacher
          ? `<button class="btn btn-primary btn-sm" id="btn-add-for-day"
                     style="font-size:11px;padding:4px 10px">＋ Add</button>`
          : (!isPast
              ? `<button class="btn btn-ghost btn-sm" id="btn-sidebar-request"
                         style="font-size:11px;padding:4px 10px">📬 Request</button>`
              : "")
        }
      </div>
      <div class="cal-sidebar-body">
        <div class="cal-events-list">
          ${eventsHTML || `
            <div class="cal-no-events">
              <div class="cal-no-events-icon">☀️</div>
              <div class="cal-no-events-text">
                No classes scheduled${isTeacher ? ".<br>Click + Add to schedule one." : "."}
              </div>
            </div>`}
        </div>
      </div>
    </div>`;
}

function buildClassEventItem(item, isTeacher) {
  // Chip que muestra la lección vinculada
  const lessonChip = item.lessonId ? `
    <div style="margin-top:var(--sp-2)">
      <span style="
        display:inline-flex;align-items:center;gap:4px;
        background:var(--teal-50);border:1.5px solid var(--teal-200);
        border-radius:var(--radius-full);padding:2px 10px;
        font-size:var(--text-xs);font-weight:var(--weight-extrabold);
        color:var(--teal-700);">
        📖 ${escapeHTML(item.lessonTitle || "Linked lesson")}
      </span>
    </div>` : "";

  // Botón "Go to lesson" solo para el estudiante
  const goBtn = (!isTeacher && item.lessonId) ? `
    <div class="cal-event-actions">
      <button class="btn btn-secondary btn-sm"
              data-action="go-lesson"
              data-module-id="${escapeHTML(item.moduleId || "")}"
              data-lesson-id="${escapeHTML(item.lessonId || "")}">
        📖 Go to lesson →
      </button>
    </div>` : "";

  return `
    <div class="cal-event-item cal-event-class">
      <div class="cal-event-header">
        <div class="cal-event-title">${escapeHTML(item.title)}</div>
        <span class="cal-event-badge badge-class">Class</span>
      </div>
      <div class="cal-event-meta">
        ${item.startTime
          ? `<span class="cal-event-meta-item">🕐 ${fmtTime(item.startTime)}${item.endTime ? ` – ${fmtTime(item.endTime)}` : ""}</span>`
          : ""}
      </div>
      ${lessonChip}
      ${item.description ? `<div class="cal-event-desc">${escapeHTML(item.description)}</div>` : ""}
      ${goBtn}
      ${isTeacher ? `
        <div class="cal-event-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit-schedule" data-id="${item.id}">✏️ Edit</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--rose-500)"
                  data-action="delete-schedule" data-id="${item.id}">🗑️ Delete</button>
        </div>` : ""}
    </div>`;
}

function buildRequestEventItem(item, isTeacher) {
  const badgeClass = { pending: "badge-pending", approved: "badge-approved", rejected: "badge-rejected" }[item.status] ?? "badge-pending";
  const badgeLabel = { pending: "⏳ Pending", approved: "✅ Approved", rejected: "❌ Rejected" }[item.status] ?? "Pending";

  return `
    <div class="cal-event-item cal-event-${item.status === "pending" ? "pending" : "request"}">
      <div class="cal-event-header">
        <div class="cal-event-title">
          ${isTeacher ? `📬 ${escapeHTML(item.studentName)}'s request` : "📬 Your reschedule request"}
        </div>
        <span class="cal-event-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="cal-event-meta">
        ${item.preferredTime ? `<span class="cal-event-meta-item">🕐 ${fmtTime(item.preferredTime)}</span>` : ""}
      </div>
      ${item.note ? `<div class="cal-event-desc">"${escapeHTML(item.note)}"</div>` : ""}
      ${item.reviewNote ? `<div class="cal-event-desc" style="color:var(--teal-700)">Teacher: ${escapeHTML(item.reviewNote)}</div>` : ""}
      ${isTeacher && item.status === "pending" ? `
        <div class="cal-event-actions">
          <button class="btn btn-secondary btn-sm" data-action="approve-request" data-id="${item.id}">✅ Approve</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--rose-500)"
                  data-action="reject-request" data-id="${item.id}">❌ Reject</button>
        </div>` : ""}
    </div>`;
}

function buildUpcomingCard() {
  const today  = fmtDate(new Date());
  const future = Cal.schedules.filter(s => s.date >= today).slice(0, 5);

  if (future.length === 0) {
    return `
      <div class="cal-sidebar-card">
        <div class="cal-sidebar-header">
          <div class="cal-sidebar-title">🗓 Upcoming Classes</div>
        </div>
        <div class="cal-sidebar-body">
          <div class="cal-empty-upcoming">
            <div class="cal-empty-upcoming-icon">🌿</div>
            <div class="cal-empty-upcoming-text">No upcoming classes<br>scheduled this month.</div>
          </div>
        </div>
      </div>`;
  }

  const items = future.map(s => {
    const d        = parseDate(s.date);
    const dayNum   = d.getDate();
    const monthAbb = d.toLocaleDateString("en-US", { month: "short" });
    return `
      <div class="cal-upcoming-item" data-date="${s.date}">
        <div class="cal-upcoming-date-badge">
          <div class="cal-upcoming-day">${dayNum}</div>
          <div class="cal-upcoming-month">${monthAbb}</div>
        </div>
        <div class="cal-upcoming-info">
          <div class="cal-upcoming-title">${escapeHTML(s.title)}</div>
          <div class="cal-upcoming-time">
            ${s.startTime ? fmtTime(s.startTime) : "All day"}${s.lessonTitle ? ` · 📖 ${escapeHTML(s.lessonTitle)}` : ""}
          </div>
        </div>
        <div class="cal-upcoming-dot cal-dot-class"></div>
      </div>`;
  }).join("");

  return `
    <div class="cal-sidebar-card">
      <div class="cal-sidebar-header">
        <div class="cal-sidebar-title">🗓 Upcoming Classes</div>
      </div>
      <div class="cal-sidebar-body">
        <div class="cal-upcoming-list">${items}</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// REFRESH
// ════════════════════════════════════════════

function refreshCalendar(container) {
  renderCalendarGrid(container);
  renderSidebar(container, State.isAdmin);
  if (State.isAdmin) updatePendingBadge(container);
}

function updatePendingBadge(container) {
  const pending = Cal.requests.filter(r => r.status === "pending").length;
  const badge   = container.querySelector("#req-count-badge");
  if (badge) {
    badge.textContent = pending > 0 ? String(pending) : "";
    badge.classList.toggle("hidden", pending === 0);
  }
}

function updateFABBadge() {
  const pending = Cal.requests.filter(r => r.status === "pending").length;
  const badge   = document.querySelector("#cal-fab-badge");
  if (badge) {
    badge.textContent   = String(pending);
    badge.style.display = pending > 0 ? "flex" : "none";
  }
}

// ════════════════════════════════════════════
// MODAL: SCHEDULE CLASS (teacher)
// Con selector de lección publicada
// ════════════════════════════════════════════

async function openScheduleModal(defaultDate, existing = null) {
  const isEdit = !!existing;

  // Abrir con loading mientras se cargan lecciones
  openModal(`
    <div class="modal-header">
      <h3>📅 ${isEdit ? "Edit Class" : "Schedule a Class"}</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="sch-modal-body">
      <div style="text-align:center;padding:var(--sp-8);color:var(--color-text-faint)">
        Loading lessons…
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-sch" disabled>
        ${isEdit ? "💾 Save Changes" : "📅 Schedule"}
      </button>
    </div>
  `);

  // Cargar módulos + lecciones (con cache para no re-pedir cada vez)
  if (!Cal.modulesCache) {
    try {
      const modules = await getPublishedModules();
      Cal.modulesCache = await Promise.all(
        modules.map(async m => ({
          ...m,
          lessons: await getPublishedLessons(m.id),
        }))
      );
    } catch {
      Cal.modulesCache = [];
    }
  }

  const body = document.getElementById("sch-modal-body");
  if (!body) return;

  // Opciones del select agrupadas por módulo
  const lessonOptions = Cal.modulesCache.flatMap(m =>
    (m.lessons ?? []).map(l => ({
      value:    `${m.id}||${l.id}`,
      label:    `${m.emoji || "📚"} ${m.title}  →  ${l.title}`,
      moduleId: m.id,
      lessonId: l.id,
      title:    l.title,
    }))
  );

  const currentLinked = existing?.lessonId
    ? `${existing.moduleId}||${existing.lessonId}`
    : "";

  body.innerHTML = `
    <div class="cal-form">

      <div>
        <label>Class title *</label>
        <input type="text" id="sch-title" class="form-input"
               placeholder="e.g. Grammar Workshop"
               maxlength="60"
               value="${escapeHTML(existing?.title ?? "")}" />
      </div>

      <div>
        <label>Date *</label>
        <input type="date" id="sch-date" class="form-input"
               value="${existing?.date ?? defaultDate}" />
      </div>

      <div class="cal-form-row">
        <div>
          <label>Start time</label>
          <input type="time" id="sch-start" class="form-input"
                 value="${existing?.startTime ?? ""}" />
        </div>
        <div>
          <label>End time</label>
          <input type="time" id="sch-end" class="form-input"
                 value="${existing?.endTime ?? ""}" />
        </div>
      </div>

      <div>
        <label>
          📖 Link a lesson
          <span style="font-weight:400;text-transform:none;font-size:var(--text-xs);color:var(--color-text-faint)">
            (optional)
          </span>
        </label>
        <select id="sch-lesson" class="form-input" style="cursor:pointer">
          <option value="">— No linked lesson —</option>
          ${lessonOptions.length === 0
            ? `<option disabled>No published lessons yet</option>`
            : lessonOptions.map(o => `
                <option value="${escapeHTML(o.value)}" ${o.value === currentLinked ? "selected" : ""}>
                  ${escapeHTML(o.label)}
                </option>`).join("")
          }
        </select>
        <p style="margin-top:var(--sp-1);font-size:var(--text-xs);color:var(--color-text-faint)">
          Students will see a "Go to lesson →" button on this class card.
        </p>
      </div>

      <div>
        <label>Description</label>
        <textarea id="sch-desc" class="form-input"
                  placeholder="Optional notes for students…">${escapeHTML(existing?.description ?? "")}</textarea>
      </div>

    </div>
  `;

  // Habilitar el botón save ahora que el form está listo
  const saveBtn = document.getElementById("btn-save-sch");
  if (saveBtn) saveBtn.disabled = false;

  // Auto-fill title desde la lección seleccionada (solo si el campo está vacío)
  document.getElementById("sch-lesson")?.addEventListener("change", e => {
    const titleInput = document.getElementById("sch-title");
    if (!titleInput) return;
    const opt = lessonOptions.find(o => o.value === e.target.value);
    if (opt && !titleInput.value.trim()) {
      titleInput.value = opt.title;
    }
  });

  saveBtn?.addEventListener("click", async () => {
    const titleVal  = (document.getElementById("sch-title")?.value  ?? "").trim();
    const dateVal   = (document.getElementById("sch-date")?.value   ?? "").trim();
    const startVal  = (document.getElementById("sch-start")?.value  ?? "").trim();
    const endVal    = (document.getElementById("sch-end")?.value    ?? "").trim();
    const descVal   = (document.getElementById("sch-desc")?.value   ?? "").trim();
    const lessonVal = (document.getElementById("sch-lesson")?.value ?? "").trim();

    if (!titleVal) { showToast("Please add a title.", "warning"); return; }
    if (!dateVal)  { showToast("Please pick a date.", "warning"); return; }

    // Parsear lección vinculada
    let moduleId    = null;
    let lessonId    = null;
    let lessonTitle = null;

    if (lessonVal) {
      const [mid, lid] = lessonVal.split("||");
      const opt = lessonOptions.find(o => o.value === lessonVal);
      moduleId    = mid      || null;
      lessonId    = lid      || null;
      lessonTitle = opt?.title || null;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = "Saving…";

    try {
      const payload = {
        title:       titleVal,
        date:        dateVal,
        startTime:   startVal,
        endTime:     endVal,
        description: descVal,
        moduleId,
        lessonId,
        lessonTitle,
        createdBy: State.user.uid,
      };

      if (isEdit) {
        await updateSchedule(existing.id, payload);
        showToast("Class updated! ✅", "success");
      } else {
        await createSchedule(payload);
        showToast("Class scheduled! 📅", "success");
      }
      closeModal();
    } catch (err) {
      console.error("[Calendar]", err);
      showToast("Could not save. Please try again.", "error");
      saveBtn.disabled    = false;
      saveBtn.textContent = isEdit ? "💾 Save Changes" : "📅 Schedule";
    }
  });
}

// ════════════════════════════════════════════
// CONFIRM DELETE
// ════════════════════════════════════════════

function confirmDeleteSchedule(scheduleId, title) {
  openModal(`
    <div class="modal-header">
      <h3>🗑️ Delete Class</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p>Delete <strong>${escapeHTML(title)}</strong>?</p>
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-top:var(--sp-2)">
        This action cannot be undone.
      </p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="btn-confirm-del">Yes, Delete</button>
    </div>
  `);

  document.getElementById("btn-confirm-del")?.addEventListener("click", async () => {
    const btn = document.getElementById("btn-confirm-del");
    btn.disabled    = true;
    btn.textContent = "Deleting…";
    try {
      await deleteSchedule(scheduleId);
      closeModal();
      showToast("Class deleted.", "info");
    } catch {
      showToast("Could not delete.", "error");
      btn.disabled    = false;
      btn.textContent = "Yes, Delete";
    }
  });
}

// ════════════════════════════════════════════
// MODAL: STUDENT REQUEST
// ════════════════════════════════════════════

function openStudentRequestModal(defaultDate) {
  const existing = Cal.myRequests.find(
    r => r.preferredDate === defaultDate && r.status === "pending"
  );

  if (existing) {
    showToast("You already have a pending request for this day.", "warning");
    return;
  }

  openModal(`
    <div class="modal-header">
      <h3>📬 Request a Schedule Change</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">
        Ask your teacher to schedule or reschedule a class. They'll review your request and let you know!
      </p>
      <div class="cal-form">
        <div>
          <label>Preferred date *</label>
          <input type="date" id="req-date" class="form-input" value="${defaultDate}" />
        </div>
        <div>
          <label>Preferred time (optional)</label>
          <input type="time" id="req-time" class="form-input" />
        </div>
        <div>
          <label>Message for your teacher</label>
          <textarea id="req-note" class="form-input"
                    placeholder="Why do you need to reschedule? Any details that might help…"
                    maxlength="300"></textarea>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-secondary" id="btn-send-request">📬 Send Request</button>
    </div>
  `);

  document.getElementById("btn-send-request")?.addEventListener("click", async () => {
    const dateVal = (document.getElementById("req-date")?.value ?? "").trim();
    const timeVal = (document.getElementById("req-time")?.value ?? "").trim();
    const noteVal = (document.getElementById("req-note")?.value ?? "").trim();

    if (!dateVal) { showToast("Please pick a date.", "warning"); return; }

    const btn = document.getElementById("btn-send-request");
    btn.disabled    = true;
    btn.textContent = "Sending…";

    try {
      await createScheduleRequest({
        studentUid:    State.user.uid,
        studentName:   State.profile?.nickname || State.profile?.name || "Student",
        classroomId:   State.profile?.classroomId ?? null,
        preferredDate: dateVal,
        preferredTime: timeVal,
        note:          noteVal,
      });
      closeModal();
      showToast("Request sent! Your teacher will review it. 📬", "success");
    } catch (err) {
      console.error("[Calendar]", err);
      showToast("Could not send request. Please try again.", "error");
      btn.disabled    = false;
      btn.textContent = "📬 Send Request";
    }
  });
}

// ════════════════════════════════════════════
// MODAL: ALL REQUESTS (teacher)
// ════════════════════════════════════════════

async function openRequestsModal() {
  openModal(`
    <div class="modal-header">
      <h3>📥 Student Requests</h3>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body" id="requests-modal-body">
      <div style="text-align:center;color:var(--color-text-faint);padding:var(--sp-6)">Loading…</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
    </div>
  `);

  try {
    const pending = await getPendingRequests();
    const body    = document.getElementById("requests-modal-body");
    if (!body) return;

    if (pending.length === 0) {
      body.innerHTML = `
        <div class="cal-empty-upcoming" style="padding:var(--sp-8) 0">
          <div class="cal-empty-upcoming-icon">🎉</div>
          <div class="cal-empty-upcoming-text">No pending requests!<br>You're all caught up.</div>
        </div>`;
      return;
    }

    body.innerHTML = `
      <p style="color:var(--color-text-muted);font-size:var(--text-sm);margin-bottom:var(--sp-4)">
        ${pending.length} pending request${pending.length !== 1 ? "s" : ""}
      </p>
      <div class="cal-events-list" id="requests-list">
        ${pending.map(r => `
          <div class="cal-event-item cal-event-request" data-req-id="${r.id}">
            <div class="cal-request-student">From: ${escapeHTML(r.studentName)}</div>
            <div class="cal-event-header">
              <div class="cal-event-title">
                📅 ${fmtDateShort(r.preferredDate)}${r.preferredTime ? " · " + fmtTime(r.preferredTime) : ""}
              </div>
              <span class="cal-event-badge badge-pending">⏳ Pending</span>
            </div>
            ${r.note ? `<div class="cal-request-note">"${escapeHTML(r.note)}"</div>` : ""}
            <div class="cal-event-actions" style="margin-top:var(--sp-3)">
              <button class="btn btn-secondary btn-sm" data-action="approve-modal" data-id="${r.id}">✅ Approve</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--rose-500)"
                      data-action="reject-modal" data-id="${r.id}">❌ Reject</button>
            </div>
          </div>`
        ).join("")}
      </div>`;

    body.querySelectorAll("[data-action='approve-modal']").forEach(btn => {
      btn.addEventListener("click", () => reviewRequestFromModal(btn.dataset.id, "approved", body));
    });
    body.querySelectorAll("[data-action='reject-modal']").forEach(btn => {
      btn.addEventListener("click", () => reviewRequestFromModal(btn.dataset.id, "rejected", body));
    });

  } catch (err) {
    console.error("[Calendar]", err);
    const body = document.getElementById("requests-modal-body");
    if (body) body.innerHTML = `<p style="color:var(--rose-500);padding:var(--sp-4)">Could not load requests.</p>`;
  }
}

async function reviewRequestFromModal(requestId, status, body) {
  const card = body.querySelector(`[data-req-id="${requestId}"]`);
  if (!card) return;
  try {
    await reviewScheduleRequest(requestId, status);
    const label      = status === "approved" ? "✅ Approved" : "❌ Rejected";
    const badgeClass = status === "approved" ? "badge-approved" : "badge-rejected";
    card.querySelector(".cal-event-header .cal-event-badge").className   = `cal-event-badge ${badgeClass}`;
    card.querySelector(".cal-event-header .cal-event-badge").textContent = label;
    card.querySelector(".cal-event-actions")?.remove();
    showToast(`Request ${status}!`, status === "approved" ? "success" : "info");
  } catch {
    showToast("Could not update request.", "error");
  }
}

async function reviewRequest(requestId, status) {
  try {
    await reviewScheduleRequest(requestId, status);
    showToast(
      `Request ${status === "approved" ? "approved ✅" : "rejected ❌"}!`,
      status === "approved" ? "success" : "info"
    );
  } catch {
    showToast("Could not update request.", "error");
  }
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function yearMonth() {
  return `${Cal.year}-${String(Cal.month + 1).padStart(2, "0")}`;
}

function buildSkeleton() {
  return `
    <div class="calendar-page">
      <div class="cal-skeleton">
        <div class="cal-skeleton-bar" style="height:36px;width:200px;margin-bottom:var(--sp-6)"></div>
        <div class="cal-skeleton-bar" style="height:56px;margin-bottom:4px"></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
          ${Array(35).fill(0).map(() =>
            `<div class="cal-skeleton-bar" style="height:52px;border-radius:10px"></div>`
          ).join("")}
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// FAB
// ════════════════════════════════════════════

export function initCalendarFAB() {
  let fab = document.getElementById("cal-fab");
  if (!fab) {
    fab = document.createElement("button");
    fab.id        = "cal-fab";
    fab.innerHTML = `📅<span id="cal-fab-badge" style="display:none" class="cal-requests-count"></span>`;
    fab.title     = "Open Schedule";
    document.body.appendChild(fab);
  }
  fab.classList.remove("hidden");
  fab.onclick = () => navigate("calendar");
}