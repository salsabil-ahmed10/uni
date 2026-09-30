/* ===== 1. DATA ===== */
const STORAGE_KEY = "studyDashboard.v1";
const DEFAULT_TYPES = ["Quizzes", "Assignments", "Projects", "Practicals", "Exams"];

let state;                  // all saved data lives here
let page = "home";          // "home" | "subjects" | "tasks" | "subject:<id>" | "type:<name>"
let taskTab = "day";        // Tasks page tab: "day" | "pending" | "done"
let selectedDay = null;     // day open in Tasks > By day
let query = "";

const $ = (id) => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Days are stored as "YYYY-MM-DD" text (local time)
const toKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => toKey(new Date());
const dayLabel = (key) => new Date(key + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

function defaultData() {
  const names = ["Computer Graphics", "Advanced Networks", "Communication", "Embedded Systems", "Selected Lab Software"];
  return {
    theme: "light",
    types: [...DEFAULT_TYPES],  // assessment sections (you can add your own)
    subjects: names.map((name) => ({ id: uid(), name, lectures: Array(20).fill(false) })),
    assessments: [],            // {id, name, subjectId, type, date, done}
    tasks: [],                  // {id, text, day, done}
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    state = saved ? JSON.parse(saved) : defaultData();
  } catch (e) {
    state = defaultData();
  }
  migrateOldData();
  selectedDay = today();
}

// Makes data saved by older versions work with this version
function migrateOldData() {
  const renamed = { Quiz: "Quizzes", Assignment: "Assignments", Practical: "Practicals", Exam: "Exams" };
  if (!state.types) state.types = [...DEFAULT_TYPES];
  state.assessments.forEach((a) => {
    if (renamed[a.type]) a.type = renamed[a.type];
    if (!state.types.includes(a.type)) state.types.push(a.type);
  });
  state.tasks.forEach((t) => { if (!t.day) t.day = t.date || today(); });
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ===== 2. HELPERS ===== */
const findSubject = (id) => state.subjects.find((s) => s.id === id);
const subjectName = (id) => (findSubject(id) ? findSubject(id).name : "Deleted subject");
const emptyState = (msg) => `<li class="empty">${msg}</li>`;
const currentType = () => (page.startsWith("type:") ? page.slice(5) : state.types[0]);
const currentSubject = () => (page.startsWith("subject:") ? findSubject(page.slice(8)) : null);

function progress(subject) {
  const done = subject.lectures.filter(Boolean).length;
  const total = subject.lectures.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Assessments with a deadline first (soonest on top), completed ones last
function byDeadline(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (a.date && b.date) return a.date.localeCompare(b.date);
  return a.date ? -1 : b.date ? 1 : 0;
}

/* ===== 3. NAVIGATION (page is kept in the URL hash, so Back and Refresh work) ===== */
function go(to) {
  if (location.hash.slice(1) === encodeURIComponent(to)) render();
  else location.hash = encodeURIComponent(to);   // triggers "hashchange" → render()
}
window.addEventListener("hashchange", () => { readHash(); render(); window.scrollTo(0, 0); });
function readHash() { page = decodeURIComponent(location.hash.slice(1)) || "home"; }

/* ===== 4. RENDER FUNCTIONS (each page returns an HTML string) ===== */
function render() {
  document.documentElement.dataset.theme = state.theme;
  $("themeBtn").textContent = state.theme === "dark" ? "Light" : "Dark";

  // If the page points at something deleted, fall back safely
  if (page.startsWith("subject:") && !currentSubject()) page = "subjects";
  if (page.startsWith("type:") && !state.types.includes(currentType())) page = "home";

  renderNav();
  let html;
  if (page === "subjects") html = renderSubjects();
  else if (page === "tasks") html = renderTasks();
  else if (page.startsWith("type:")) html = renderAssessments(currentType());
  else if (page.startsWith("subject:")) html = renderLectures(currentSubject());
  else html = renderHome();
  $("view").innerHTML = html;
}

function renderNav() {
  const items = [["Home", "home"], ["Subjects", "subjects"], ["Tasks", "tasks"], ...state.types.map((t) => [t, "type:" + t])];
  const active = page.startsWith("subject:") ? "subjects" : page;
  $("nav").innerHTML = items.map(([label, to]) =>
    `<button class="chip ${to === active ? "active" : ""}" data-action="go" data-to="${esc(to)}">${esc(label)}</button>`).join("")
    + `<button class="chip" data-action="add-type">+ New section</button>`;
}

function renderHome() {
  const h = new Date().getHours();
  const hello = h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
  const total = state.subjects.reduce((n, s) => n + s.lectures.length, 0);
  const done = state.subjects.reduce((n, s) => n + progress(s).done, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const stats = [
    [state.subjects.length, "Subjects"], [done, "Lectures completed"],
    [state.assessments.length, "Assessments"], [state.assessments.filter((a) => a.done).length, "Assessments done"],
  ];
  const cards = [
    ["Subjects", `${state.subjects.length} subjects`, "subjects"],
    ["Tasks", `${state.tasks.filter((t) => !t.done).length} not completed`, "tasks"],
    ...state.types.map((t) => [t, `${state.assessments.filter((a) => a.type === t).length} items`, "type:" + t]),
  ];
  return `
    <section class="hero"><h1>${hello}</h1><p>Let's stay on track.</p>
      <div class="overall"><div class="bar"><span style="width:${pct}%"></span></div><b>${pct}%</b> <small>overall progress</small></div></section>
    <section class="stats">${stats.map(([n, l]) => `<div class="stat"><b>${n}</b>${l}</div>`).join("")}</section>
    <section><div class="section-head"><h2>Sections</h2></div>
      <div class="grid">${cards.map(([title, sub, to]) => `
        <article class="subject" data-action="go" data-to="${esc(to)}"><h3>${esc(title)}</h3><small>${sub}</small></article>`).join("")}</div></section>`;
}

function renderSubjects() {
  const list = state.subjects.filter((s) => s.name.toLowerCase().includes(query));
  const cards = list.length ? list.map((s) => {
    const p = progress(s);
    return `<article class="subject" data-action="go" data-to="subject:${s.id}">
      <h3>${esc(s.name)}</h3>
      <small>${p.done} of ${p.total} lectures completed</small>
      <div class="bar"><span style="width:${p.pct}%"></span></div>
      <small>Progress: ${p.pct}%</small></article>`;
  }).join("") : `<p class="empty">No subjects found. Add one with "+ Add Subject".</p>`;
  return `<section><div class="section-head"><h2>Subjects</h2>
    <button class="btn" data-action="open-modal" data-type="subject">+ Add Subject</button></div>
    <div class="grid">${cards}</div></section>`;
}

function assessmentItem(a, showSubject = true, showType = false) {
  const date = a.date ? `<span class="meta">Due ${a.date}</span>` : "";
  return `<li class="item ${a.done ? "done" : ""}">
    <input type="checkbox" id="a${a.id}" data-action="toggle-assessment" data-id="${a.id}" ${a.done ? "checked" : ""}>
    <label for="a${a.id}">${showSubject ? esc(subjectName(a.subjectId)) + " — " : ""}${esc(a.name)} ${date}</label>
    ${showType ? `<span class="tag">${esc(a.type)}</span>` : ""}
    <button class="del" data-action="delete-assessment" data-id="${a.id}" aria-label="Delete">✕</button></li>`;
}

function renderAssessments(type) {
  const shown = state.assessments
    .filter((a) => a.type === type && (a.name + " " + subjectName(a.subjectId)).toLowerCase().includes(query))
    .sort(byDeadline);
  return `<section><div class="section-head"><h2>${esc(type)}</h2>
      <button class="btn" data-action="open-modal" data-type="assessment">+ Add to ${esc(type)}</button></div>
    <ul class="list card">${shown.length ? shown.map((a) => assessmentItem(a)).join("") : emptyState(`Nothing in ${esc(type)} yet.`)}</ul>
    <p class="foot"><button class="btn ghost" data-action="delete-type">Delete this section</button></p></section>`;
}

function taskItem(t, showDay = false) {
  return `<li class="item ${t.done ? "done" : ""}">
    <input type="checkbox" id="t${t.id}" data-action="toggle-task" data-id="${t.id}" ${t.done ? "checked" : ""}>
    <label for="t${t.id}">${esc(t.text)} ${showDay ? `<span class="meta">${dayLabel(t.day)}</span>` : ""}</label>
    <button class="del" data-action="delete-task" data-id="${t.id}" aria-label="Delete">✕</button></li>`;
}

function renderTasks() {
  const pending = state.tasks.filter((t) => !t.done).sort((a, b) => a.day.localeCompare(b.day)); // oldest first
  const done = state.tasks.filter((t) => t.done).sort((a, b) => b.day.localeCompare(a.day));      // newest first
  const tabs = [["day", "By day"], ["pending", `Not completed (${pending.length})`], ["done", `Completed (${done.length})`]];

  let body;
  if (taskTab === "pending") {
    body = `<ul class="list card">${pending.length ? pending.map((t) => taskItem(t, true)).join("") : emptyState("No unfinished tasks.")}</ul>`;
  } else if (taskTab === "done") {
    body = `<ul class="list card">${done.length ? done.map((t) => taskItem(t, true)).join("") : emptyState("Nothing completed yet.")}</ul>`;
  } else {
    const list = state.tasks.filter((t) => t.day === selectedDay);
    const n = list.filter((t) => t.done).length;
    // Log of every day that has tasks, newest first. Click a row to open that day.
    const days = [...new Set(state.tasks.map((t) => t.day))].sort().reverse();
    body = `
      <div class="day-nav">
        <button class="btn ghost" data-action="prev-day" aria-label="Previous day">‹</button>
        <input type="date" id="dayPicker" value="${selectedDay}" aria-label="Choose day">
        <button class="btn ghost" data-action="next-day" aria-label="Next day">›</button>
        <button class="btn ghost" data-action="today-day">Today</button>
      </div>
      <h3>${selectedDay === today() ? "Today · " : ""}${dayLabel(selectedDay)}</h3>
      <p class="muted">${list.length ? `${n} of ${list.length} done` : ""}</p>
      <ul class="list card">${list.length ? list.map((t) => taskItem(t)).join("") : emptyState("Nothing logged for this day yet.")}</ul>
      <h3 style="margin-top:1.6rem">Previous days</h3>
      <ul class="list card">${days.length ? days.map((d) => {
        const ts = state.tasks.filter((t) => t.day === d);
        return `<li class="log-row ${d === selectedDay ? "active" : ""}" data-action="go-day" data-day="${d}">
          <span>${dayLabel(d)}</span><small>${ts.filter((t) => t.done).length} / ${ts.length} done</small></li>`;
      }).join("") : emptyState("Your past days will show up here.")}</ul>`;
  }

  return `<section><div class="section-head"><h2>My Tasks</h2>
      <button class="btn" data-action="open-modal" data-type="task">+ Add Task</button></div>
    <div class="chips">${tabs.map(([k, l]) => `<button class="chip ${k === taskTab ? "active" : ""}" data-action="task-tab" data-tab="${k}">${l}</button>`).join("")}</div>
    ${body}</section>`;
}

function renderLectures(subject) {
  const p = progress(subject);
  const related = state.assessments.filter((a) => a.subjectId === subject.id).sort(byDeadline);
  return `
    <button class="btn ghost" data-action="go" data-to="subjects">← Subjects</button>
    <section class="hero"><h1>${esc(subject.name)}</h1>
      <p>${p.done} / ${p.total} lectures completed</p>
      <div class="overall"><div class="bar"><span style="width:${p.pct}%"></span></div><b>${p.pct}%</b></div></section>
    <section><div class="section-head"><h2>Lectures</h2>
      <span><button class="btn" data-action="add-lecture">+ Lecture</button>
      <button class="btn ghost" data-action="remove-lecture">− Last</button></span></div>
      <ul class="list card lectures">${subject.lectures.map((done, i) => `
        <li class="item ${done ? "done" : ""}">
          <input type="checkbox" id="l${i}" data-action="toggle-lecture" data-index="${i}" ${done ? "checked" : ""}>
          <label for="l${i}">Lecture ${i + 1}</label></li>`).join("")}</ul></section>
    <section><div class="section-head"><h2>Assessments</h2>
      <button class="btn" data-action="open-modal" data-type="assessment">+ Add Assessment</button></div>
      <ul class="list card">${related.length ? related.map((a) => assessmentItem(a, false, true)).join("") : emptyState("No assessments for this subject yet.")}</ul></section>
    <section><button class="btn danger" data-action="delete-subject">Delete this subject</button></section>`;
}

/* ===== 5. ACTIONS (change data → save → re-render) ===== */
function update() { saveData(); render(); }

function toggleLecture(index) { const s = currentSubject(); s.lectures[index] = !s.lectures[index]; update(); }
function toggleTask(id) { const t = state.tasks.find((x) => x.id === id); t.done = !t.done; update(); }
function toggleAssessment(id) { const a = state.assessments.find((x) => x.id === id); a.done = !a.done; update(); }

function addTask(text, day) {
  state.tasks.push({ id: uid(), text, day, done: false });
  selectedDay = day;
  update();
}
function addAssessment(name, subjectId, type, date) {
  state.assessments.push({ id: uid(), name, subjectId, type, date, done: false });
  update();
}
function addSubject(name, count) { state.subjects.push({ id: uid(), name, lectures: Array(count).fill(false) }); update(); }

function addType() {
  const name = (prompt("Name of the new section (e.g. Labs, Reports):") || "").trim();
  if (!name) return;
  if (!state.types.includes(name)) state.types.push(name);
  saveData();
  go("type:" + name);
}
function deleteType() {
  const type = currentType();
  if (state.types.length <= 1) return alert("You need at least one section.");
  confirmDelete(`the section "${type}" and everything inside it`, () => {
    state.assessments = state.assessments.filter((a) => a.type !== type);
    state.types = state.types.filter((t) => t !== type);
    saveData(); go("home");
  });
}

function shiftDay(n) {
  const d = new Date(selectedDay + "T00:00:00");
  d.setDate(d.getDate() + n);
  selectedDay = toKey(d);
  render();
}

function confirmDelete(what, fn) {
  if (confirm(`Delete ${what}? This can't be undone.`)) fn();
}

/* ===== 6. MODAL FORMS ===== */
function openModal(type) {
  if (type === "assessment" && !state.subjects.length) return alert("Add a subject first.");
  const subj = currentSubject();
  const subjectOptions = state.subjects.map((s) =>
    `<option value="${s.id}" ${subj && s.id === subj.id ? "selected" : ""}>${esc(s.name)}</option>`).join("");
  const typeOptions = state.types.map((t) =>
    `<option ${t === currentType() ? "selected" : ""}>${esc(t)}</option>`).join("");
  const taskDay = page === "tasks" && taskTab === "day" ? selectedDay : today();
  const forms = {
    subject: `<h3>New subject</h3>
      <label>Subject name<input name="name" required></label>
      <label>Number of lectures<input name="count" type="number" min="0" max="100" value="20"></label>`,
    assessment: `<h3>New assessment</h3>
      <label>Name<input name="name" placeholder="Quiz 1" required></label>
      <label>Subject<select name="subject">${subjectOptions}</select></label>
      <label>Section<select name="type">${typeOptions}</select></label>
      <label>Deadline (optional)<input name="date" type="date"></label>`,
    task: `<h3>New task</h3>
      <label>Task<input name="text" placeholder="Review Lecture 4" required></label>
      <label>Day<input name="day" type="date" value="${taskDay}" required></label>`,
  };
  $("modalForm").dataset.type = type;
  $("modalForm").innerHTML = forms[type] +
    `<div class="row"><button type="button" class="btn ghost" data-action="close-modal">Cancel</button><button class="btn">Save</button></div>`;
  $("overlay").hidden = false;
  $("modalForm").querySelector("input, select").focus();
}
const closeModal = () => { $("overlay").hidden = true; };

$("modalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const type = e.target.dataset.type;
  if (type === "task") addTask(f.get("text").trim(), f.get("day") || today());
  if (type === "assessment") addAssessment(f.get("name").trim(), f.get("subject"), f.get("type"), f.get("date"));
  if (type === "subject") addSubject(f.get("name").trim(), Number(f.get("count")) || 0);
  closeModal();
});

/* ===== 7. EVENTS (one listener handles every button/checkbox) ===== */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) { if (e.target === $("overlay")) closeModal(); return; }
  const { action, id, index, type, day, to, tab } = el.dataset;

  const actions = {
    go: () => go(to),
    theme: () => { state.theme = state.theme === "dark" ? "light" : "dark"; update(); },
    "open-modal": () => openModal(type),
    "close-modal": closeModal,
    "add-type": addType,
    "delete-type": deleteType,
    "task-tab": () => { taskTab = tab; render(); },
    "prev-day": () => shiftDay(-1),
    "next-day": () => shiftDay(1),
    "today-day": () => { selectedDay = today(); render(); },
    "go-day": () => { selectedDay = day; render(); },
    "toggle-lecture": () => toggleLecture(Number(index)),
    "toggle-task": () => toggleTask(id),
    "toggle-assessment": () => toggleAssessment(id),
    "add-lecture": () => { currentSubject().lectures.push(false); update(); },
    "remove-lecture": () => confirmDelete("the last lecture", () => { currentSubject().lectures.pop(); update(); }),
    "delete-task": () => confirmDelete("this task", () => { state.tasks = state.tasks.filter((t) => t.id !== id); update(); }),
    "delete-assessment": () => confirmDelete("this assessment", () => { state.assessments = state.assessments.filter((a) => a.id !== id); update(); }),
    "delete-subject": () => confirmDelete("this subject and its assessments", () => {
      const sid = currentSubject().id;
      state.assessments = state.assessments.filter((a) => a.subjectId !== sid);
      state.subjects = state.subjects.filter((s) => s.id !== sid);
      saveData(); go("subjects");
    }),
  };
  if (actions[action]) actions[action]();
});

// The date box is re-created on every render, so listen on the whole document
document.addEventListener("change", (e) => {
  if (e.target.id === "dayPicker") { selectedDay = e.target.value || today(); render(); }
});
$("search").addEventListener("input", (e) => {
  query = e.target.value.trim().toLowerCase();
  if (page === "subjects" || page.startsWith("type:")) render();
  else go("subjects");
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ===== 8. START ===== */
loadData();
readHash();
render();