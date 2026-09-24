// ---------- Setup ----------
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let user = null;
let habits = [];               // [{id, name, created_at}]
let logs = new Set();          // "habitId|YYYY-MM-DD"
let weekOffset = 0;            // 0 = this week, -1 = last week, ...
let editingId = null;
let authMode = "login";        // "login" | "register"

// ---------- Date helpers (local time, not UTC) ----------
function ymd(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function startOfWeek(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday + offset * 7);
  return d;
}
function weekDays(offset) {
  const start = startOfWeek(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}
const todayStr = () => ymd(new Date());

// ---------- Messages ----------
function say(el, text, ok = false) {
  el.textContent = text || "";
  el.classList.toggle("ok", ok);
}

// ---------- Auth ----------
function setAuthMode(mode) {
  authMode = mode;
  $("tab-login").classList.toggle("active", mode === "login");
  $("tab-register").classList.toggle("active", mode === "register");
  $("auth-submit").textContent = mode === "login" ? "Log in" : "Create account";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  say($("auth-message"), "");
}

async function submitAuth() {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || password.length < 6) {
    say($("auth-message"), "Enter an email and a password of at least 6 characters.");
    return;
  }
  $("auth-submit").disabled = true;
  say($("auth-message"), "");

  const { data, error } =
    authMode === "login"
      ? await sb.auth.signInWithPassword({ email, password })
      : await sb.auth.signUp({ email, password });

  $("auth-submit").disabled = false;
  if (error) {
    say($("auth-message"), error.message);
    return;
  }
  // If email confirmation is on, signUp returns no session.
  if (authMode === "register" && !data.session) {
    say($("auth-message"), "Account created. Check your email to confirm, then log in.", true);
    setAuthMode("login");
  }
  // On success, onAuthStateChange shows the app.
}

async function logout() {
  await sb.auth.signOut();
}

sb.auth.onAuthStateChange((_event, session) => {
  user = session ? session.user : null;
  showView();
});

async function showView() {
  $("auth-view").hidden = !!user;
  $("app-view").hidden = !user;
  if (user) {
    $("user-email").textContent = user.email;
    await loadData();
  } else {
    habits = [];
    logs = new Set();
    $("password").value = "";
  }
}

// ---------- Read ----------
async function loadData() {
  say($("app-message"), "");
  const [h, l] = await Promise.all([
    sb.from("habits").select("id, name, created_at").order("created_at", { ascending: true }),
    sb.from("habit_logs").select("habit_id, log_date"),
  ]);
  if (h.error || l.error) {
    say($("app-message"), (h.error || l.error).message);
    return;
  }
  habits = h.data;
  logs = new Set(l.data.map((r) => `${r.habit_id}|${r.log_date}`));
  render();
}

// ---------- Create ----------
async function addHabit() {
  const input = $("new-habit");
  const name = input.value.trim();
  if (!name) return;
  const { data, error } = await sb
    .from("habits")
    .insert({ name, user_id: user.id })
    .select("id, name, created_at")
    .single();
  if (error) return say($("app-message"), error.message);
  habits.push(data);
  input.value = "";
  say($("app-message"), "");
  render();
}

// ---------- Update ----------
async function renameHabit(id, name) {
  name = name.trim();
  editingId = null;
  const habit = habits.find((h) => h.id === id);
  if (!name || name === habit.name) return render();
  const { error } = await sb.from("habits").update({ name }).eq("id", id);
  if (error) say($("app-message"), error.message);
  else habit.name = name;
  render();
}

// Ticking a day on/off creates or deletes a log row.
async function toggleDay(habitId, dateStr) {
  const key = `${habitId}|${dateStr}`;
  if (logs.has(key)) {
    logs.delete(key); // optimistic
    render();
    const { error } = await sb.from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", dateStr);
    if (error) { logs.add(key); say($("app-message"), error.message); render(); }
  } else {
    logs.add(key);
    render();
    const { error } = await sb.from("habit_logs").insert({ habit_id: habitId, user_id: user.id, log_date: dateStr });
    if (error) { logs.delete(key); say($("app-message"), error.message); render(); }
  }
}

// ---------- Delete ----------
async function deleteHabit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!confirm(`Delete "${habit.name}" and all its history?`)) return;
  const { error } = await sb.from("habits").delete().eq("id", id); // logs cascade
  if (error) return say($("app-message"), error.message);
  habits = habits.filter((h) => h.id !== id);
  for (const k of [...logs]) if (k.startsWith(id + "|")) logs.delete(k);
  render();
}

// ---------- Streak ----------
function currentStreak(habitId) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // If today isn't ticked yet, the streak can still be alive from yesterday.
  if (!logs.has(`${habitId}|${ymd(d)}`)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (logs.has(`${habitId}|${ymd(d)}`)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// ---------- Render ----------
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text; // textContent avoids XSS
  return e;
}

function render() {
  const days = weekDays(weekOffset);
  const fmt = { month: "short", day: "numeric" };
  $("week-label").textContent =
    weekOffset === 0
      ? "This week"
      : `${days[0].toLocaleDateString(undefined, fmt)} – ${days[6].toLocaleDateString(undefined, fmt)}`;
  $("next-week").disabled = weekOffset >= 0;

  const list = $("habit-list");
  list.replaceChildren();
  $("empty").hidden = habits.length > 0;
  const today = todayStr();

  for (const h of habits) {
    const row = el("article", "habit");

    // Name / streak (or rename input)
    const nameBox = el("div", "habit-name");
    if (editingId === h.id) {
      const input = el("input");
      input.type = "text";
      input.value = h.name;
      input.maxLength = 60;
      input.setAttribute("aria-label", "Habit name");
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") renameHabit(h.id, input.value);
        if (e.key === "Escape") { editingId = null; render(); }
      });
      input.addEventListener("blur", () => renameHabit(h.id, input.value));
      nameBox.append(input);
      setTimeout(() => input.focus(), 0);
    } else {
      const s = currentStreak(h.id);
      nameBox.append(
        el("div", "title", h.name),
        el("div", "streak", s === 0 ? "No streak yet" : `${s}-day streak`)
      );
    }
    row.append(nameBox);

    // Seven day dots
    days.forEach((d, i) => {
      const dateStr = ymd(d);
      const cell = el("div", "day");
      cell.append(el("span", "dow", DOW[i]));
      const btn = el("button", "dot");
      btn.type = "button";
      const done = logs.has(`${h.id}|${dateStr}`);
      if (done) btn.classList.add("done");
      if (dateStr === today) btn.classList.add("today");
      if (dateStr > today) btn.disabled = true;
      btn.setAttribute("aria-pressed", String(done));
      btn.setAttribute("aria-label", `${h.name}, ${DOW[i]} ${d.toLocaleDateString(undefined, fmt)}`);
      btn.addEventListener("click", () => toggleDay(h.id, dateStr));
      cell.append(btn);
      row.append(cell);
    });

    // Edit / delete
    const actions = el("div", "row-actions");
    const edit = el("button", "icon-btn", "Rename");
    edit.type = "button";
    edit.addEventListener("click", () => { editingId = h.id; render(); });
    const del = el("button", "icon-btn delete", "Delete");
    del.type = "button";
    del.addEventListener("click", () => deleteHabit(h.id));
    actions.append(edit, del);
    row.append(actions);

    list.append(row);
  }
}

// ---------- Wire up events ----------
$("tab-login").addEventListener("click", () => setAuthMode("login"));
$("tab-register").addEventListener("click", () => setAuthMode("register"));
$("auth-submit").addEventListener("click", submitAuth);
$("password").addEventListener("keydown", (e) => { if (e.key === "Enter") submitAuth(); });
$("logout").addEventListener("click", logout);
$("add-habit").addEventListener("click", addHabit);
$("new-habit").addEventListener("keydown", (e) => { if (e.key === "Enter") addHabit(); });
$("prev-week").addEventListener("click", () => { weekOffset--; render(); });
$("next-week").addEventListener("click", () => { if (weekOffset < 0) { weekOffset++; render(); } });
$("this-week").addEventListener("click", () => { weekOffset = 0; render(); });

// Initial state: check for an existing session
sb.auth.getSession().then(({ data }) => {
  user = data.session ? data.session.user : null;
  showView();
});
