/* ============================================================
   Mav — companion UI
   Mode LIVE : lit l'API réelle (/api/*) servie par mav_api.py.
   Fallback MOCK automatique si l'API n'est pas joignable
   (ex. ouverture statique sur GitHub Pages).
   ============================================================ */

/* ---------- Données de secours (mock) ---------- */
const MOCK = {
  connections: [
    { name: "Moteur opencode", state: "ok", label: "en ligne" },
    { name: "Base mémoire", state: "ok", label: "connectée" },
    { name: "Telegram", state: "ok", label: "pont actif" },
  ],
  jobs: [
    {
      name: "Revue du matin",
      description: "Point technique avant 8h.",
      time: "08:00",
      days: ["mon", "tue", "wed", "thu", "fri"],
      agent: "research",
      enabled: true,
    },
    {
      name: "Point marchés",
      description: "Synthèse macro et marchés.",
      time: "09:00",
      days: ["mon", "tue", "wed", "thu", "fri"],
      agent: "research",
      enabled: true,
    },
  ],
  today: [
    { t: "09:00", text: "Point marchés envoyé." },
    { t: "08:00", text: "Revue du matin terminée." },
  ],
  memory: { conversations: [], facts: [], preferences: [] },
  watch: { items: [] },
  replies: {
    statut: "Tout va bien de mon côté.",
    automatisations: "Voici tes automatisations.",
    souvenirs: "Je retiens quelques choses.",
    surveillance: "Je surveille plusieurs sources.",
    default: ["Compris, je m'en occupe.", "Bien noté.", "D'accord."],
  },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let LIVE = false;
let STATUS = null;
const api = {
  async get(path) {
    const r = await fetch(`/api/${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },
  async post(path, body) {
    const r = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(r.status);
    return r.json();
  },
};

/* ---------- Utilitaires ---------- */
function fmtDays(days) {
  if (!days || !days.length) return "";
  const map = {
    mon: "lun",
    tue: "mar",
    wed: "mer",
    thu: "jeu",
    fri: "ven",
    sat: "sam",
    sun: "dim",
  };
  const fr = days.map((d) => map[d] || d);
  return fr.join("–");
}
function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function fmtTime(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}
function fmtUptime(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}j ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------- Horloge ---------- */
function tick() {
  const n = new Date();
  $("#clock").textContent =
    `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}
setInterval(tick, 1000);
tick();

/* ---------- Salutation ---------- */
function greet() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit Raphaël";
  if (h < 12) return "Bonjour Raphaël";
  if (h < 18) return "Bon après-midi Raphaël";
  return "Bonsoir Raphaël";
}
$("#greeting").textContent = greet();

/* ---------- Navigation ---------- */
function go(view) {
  $$(".nav-item").forEach((b) =>
    b.classList.toggle("is-active", b.dataset.view === view),
  );
  $$(".view").forEach((v) =>
    v.classList.toggle("is-active", v.id === `view-${view}`),
  );
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$(".nav-item").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.view)),
);
$$("[data-goto]").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.goto)),
);

/* ---------- Rendu ---------- */
function renderStatus(st) {
  STATUS = st;
  if (!st) return;
  const online = st.agent_online;
  $("#greetingSub").textContent =
    st.mode === "mock" || st.agent_online === undefined
      ? "Aperçu de démonstration — je me connecte à l'agent quand tu m'ouvres depuis ton réseau."
      : online
        ? "Je suis en ligne. Tout est calme de mon côté."
        : "Mon moteur ne répond pas pour l'instant.";

  $("#stats").innerHTML = [
    { v: st.jobs_active ?? "—", k: "automatisations actives" },
    { v: st.conversations ?? "—", k: "échanges en mémoire" },
    { v: st.facts ?? "—", k: "faits retenus" },
    { v: st.watch_items ?? "—", k: "surveillances" },
  ]
    .map(
      (s) =>
        `<div class="stat"><div class="v">${esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`,
    )
    .join("");
}

function renderConnections(list) {
  $("#connList").innerHTML = list
    .map(
      (c) =>
        `<li><span class="st ${esc(c.state)}"></span>${esc(c.name)}<span class="lbl">${esc(c.label)}</span></li>`,
    )
    .join("");
}

function renderToday(items) {
  $("#today").innerHTML = (items || [])
    .map(
      (t) =>
        `<li><span class="t">${esc(t.t)}</span><span>${esc(t.text)}</span></li>`,
    )
    .join("");
}

function renderMiniJobs(jobs) {
  $("#homeJobs").innerHTML = (jobs || [])
    .slice(0, 3)
    .map(
      (j) => `
    <li>
      <span class="jname">${esc(j.name)}</span>
      <span class="jwhen">${esc(j.time)}</span>
      <span class="pill ${j.enabled ? "on" : "off"}">${j.enabled ? "actif" : "pause"}</span>
    </li>`,
    )
    .join("");
}

function renderJobs(jobs) {
  $("#jobsList").innerHTML = (jobs || [])
    .map(
      (j) => `
    <div class="job">
      <div class="jicon"><span class="nav-ico" data-ico="bolt"></span></div>
      <div>
        <div class="jtitle">${esc(j.name)}</div>
        <div class="jdesc">${esc(j.description || "")}${j.agent ? ` · agent ${esc(j.agent)}` : ""}</div>
      </div>
      <div class="jtime">${esc(j.time)}<small>${esc(fmtDays(j.days))} · ${j.enabled ? "active" : "en pause"}</small></div>
    </div>`,
    )
    .join("");
  const active = (jobs || []).filter((j) => j.enabled).length;
  $("#navJobsCount").textContent = active;
}

function renderMemory(mem) {
  const rows = [];
  (mem.conversations || []).forEach((c) => {
    rows.push({ date: fmtTime(c.ts), text: c.question, tag: "échange" });
  });
  (mem.facts || []).forEach((f) => {
    rows.push({ date: fmtDate(f.ts), text: f.fact, tag: "fait" });
  });
  (mem.preferences || []).forEach((p) => {
    rows.push({
      date: fmtDate(p.ts),
      text: `${p.key} : ${p.value}`,
      tag: "préférence",
    });
  });
  if (!rows.length) {
    $("#memoryList").innerHTML =
      `<li><div class="mdate"></div><div class="mtext" style="color:var(--ink-3)">Rien en mémoire pour l'instant.</div></li>`;
    return;
  }
  $("#memoryList").innerHTML = rows
    .map(
      (m) => `
    <li>
      <div class="mdate">${esc(m.date)}</div>
      <div><div class="mtext">${esc(m.text)}</div><span class="mtag">${esc(m.tag)}</span></div>
    </li>`,
    )
    .join("");
}

function renderWatch(watch) {
  const items = (watch && watch.items) || [];
  if (!items.length) {
    $("#watchList").innerHTML =
      `<div class="wcard"><div class="wtype">Veille</div><div class="wtarget">Aucune surveillance active</div><div class="wstate"><span class="st"></span>en veille</div></div>`;
    return;
  }
  $("#watchList").innerHTML = items
    .map((w) => {
      const changed = w.last_state && /chang|new|alert/i.test(w.last_state);
      return `
    <div class="wcard">
      <div class="wtype">${esc(w.kind)}</div>
      <div class="wtarget">${esc(w.target)}</div>
      <div class="wstate ${changed ? "changed" : ""}"><span class="st"></span>${changed ? "a changé" : "stable"}${w.last_checked ? ` · ${esc(fmtTime(w.last_checked))}` : ""}</div>
    </div>`;
    })
    .join("");
}

/* ---------- Chat & gestionnaire de sessions ---------- */
const messages = $("#messages");
let CURRENT_SESSION = null;
let CONVS = [];

function addMsg(text, who) {
  const el = document.createElement("div");
  el.className = `msg ${who}`;
  el.innerHTML =
    who === "mav"
      ? `<div class="avatar"></div><div class="bubble"></div>`
      : `<div class="bubble"></div>`;
  el.querySelector(".bubble").textContent = text;
  messages.appendChild(el);
  messages.scrollTop = messages.scrollHeight;
  return el;
}

function clearMessages() {
  messages.innerHTML = "";
}

function welcome() {
  clearMessages();
  addMsg("Salut Raphaël. Je suis prêt — dis-moi ce dont tu as besoin.", "mav");
}

function setChatTitle(title) {
  $("#chatTitle").textContent = title || "Nouvelle discussion";
}

/* Fait "vivre" Mav : la boule s'illumine quand il réfléchit */
function thinking(on) {
  document.body.classList.toggle("is-thinking", !!on);
}

function renderConvList() {
  if (!CONVS.length) {
    $("#convList").innerHTML =
      `<div class="conv-empty">Aucune discussion.</div>`;
    return;
  }
  $("#convList").innerHTML = CONVS.map(
    (c) => `
    <div class="conv-item ${c.id === CURRENT_SESSION ? "is-active" : ""}" data-id="${esc(c.id)}">
      <span class="ctitle">${esc(c.title)}</span>
      <button class="cdel" data-del="${esc(c.id)}" title="Supprimer">
        <span class="nav-ico" data-ico="trash"></span>
      </button>
    </div>`,
  ).join("");
}

async function loadConvs() {
  if (!LIVE) {
    CONVS = [{ id: "mock", title: "Discussion de démo" }];
    CURRENT_SESSION = "mock";
    renderConvList();
    setChatTitle("Discussion de démo");
    return;
  }
  try {
    const r = await api.get("sessions");
    CONVS = r.sessions || [];
  } catch (_) {
    CONVS = [];
  }
  renderConvList();
}

async function openSession(id) {
  CURRENT_SESSION = id;
  renderConvList();
  if (!LIVE) return;
  try {
    const s = await api.get(`session?id=${encodeURIComponent(id)}`);
    setChatTitle(s.title);
    clearMessages();
    if (!s.messages || !s.messages.length) {
      welcome();
    } else {
      s.messages.forEach((m) => addMsg(m.text, m.role));
    }
  } catch (_) {
    welcome();
  }
}

async function newSession() {
  if (!LIVE) {
    CURRENT_SESSION = "mock";
    setChatTitle("Nouvelle discussion");
    welcome();
    go("chat");
    return;
  }
  try {
    const s = await api.post("session/new", {});
    CURRENT_SESSION = s.id;
    setChatTitle(s.title);
    welcome();
    await loadConvs();
    renderConvList();
    go("chat");
  } catch (_) {
    welcome();
  }
}

async function deleteSession(id) {
  if (!LIVE) return;
  try {
    await api.post("session/delete", { id });
    if (CURRENT_SESSION === id) {
      CURRENT_SESSION = null;
      setChatTitle("");
    }
    await loadConvs();
    if (!CURRENT_SESSION && CONVS.length) {
      await openSession(CONVS[0].id);
    } else if (!CONVS.length) {
      newSession();
    } else {
      renderConvList();
    }
  } catch (_) {}
}

async function renameSession() {
  if (!LIVE || !CURRENT_SESSION) return;
  const current = ($("#chatTitle").textContent || "").trim();
  const name = prompt("Renommer la discussion :", current);
  if (!name || !name.trim()) return;
  try {
    await api.post("session/rename", {
      id: CURRENT_SESSION,
      title: name.trim(),
    });
    setChatTitle(name.trim());
    await loadConvs();
  } catch (_) {}
}

$("#newConv").addEventListener("click", () => newSession());
$("#renameBtn").addEventListener("click", () => renameSession());
$("#convList").addEventListener("click", (e) => {
  const del = e.target.closest(".cdel");
  if (del) {
    e.stopPropagation();
    deleteSession(del.dataset.del);
    return;
  }
  const item = e.target.closest(".conv-item");
  if (item) openSession(item.dataset.id);
});

async function send(raw, cmd) {
  const text = (raw || "").trim();
  if (!text && !cmd) return;
  const shown = text || cmd;
  addMsg(shown, "me");

  const typing = $("#typing");
  typing.hidden = false;
  thinking(true);
  messages.scrollTop = messages.scrollHeight;

  if (LIVE) {
    try {
      const res = await api.post("ask", {
        prompt: text || cmd,
        session: CURRENT_SESSION || "",
      });
      typing.hidden = true;
      thinking(false);
      addMsg(res.answer || "…", "mav");
      // Rafraîchit les titres (le premier échange peut auto-titrer côté moteur)
      await loadConvs();
      return;
    } catch (e) {
      typing.hidden = true;
      thinking(false);
      addMsg(
        "Je n'ai pas réussi à joindre mon moteur. Réessaie dans un instant.",
        "mav",
      );
      return;
    }
  }

  // Mode mock
  const key = (cmd || text || "").trim().toLowerCase();
  const pool = MOCK.replies[key] || MOCK.replies.default;
  const reply = Array.isArray(pool)
    ? pool[Math.floor(Math.random() * pool.length)]
    : pool;
  setTimeout(
    () => {
      typing.hidden = true;
      thinking(false);
      addMsg(reply, "mav");
    },
    700 + Math.random() * 500,
  );
}

$("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const i = $("#chatInput");
  send(i.value);
  i.value = "";
});
$("#heroForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const i = $("#heroInput");
  send(i.value);
  i.value = "";
  go("chat");
});
$$(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    go("chat");
    send("", c.dataset.cmd);
  }),
);

welcome();

/* ---------- Chargement ---------- */
async function loadLive() {
  try {
    const [status, conns, jobs, mem, watch] = await Promise.all([
      api.get("status"),
      api.get("connections"),
      api.get("jobs"),
      api.get("memory"),
      api.get("watch"),
    ]);
    LIVE = true;
    document.body.dataset.mode = "live";
    renderStatus(status);
    renderConnections(conns.connections || []);
    renderJobs(jobs.jobs || []);
    renderMiniJobs(jobs.jobs || []);
    renderMemory(mem);
    renderWatch(watch);
    renderToday([{ t: "—", text: "Connecté au moteur de l'agent en direct." }]);

    await loadConvs();
    if (CONVS.length) {
      await openSession(CONVS[0].id);
    } else {
      await newSession();
    }
  } catch (e) {
    LIVE = false;
    document.body.dataset.mode = "mock";
    renderStatus({
      mode: "mock",
      agent_online: false,
      jobs_active: MOCK.jobs.filter((j) => j.enabled).length,
      conversations: "—",
      facts: "—",
      watch_items: "—",
    });
    renderConnections(MOCK.connections);
    renderJobs(MOCK.jobs);
    renderMiniJobs(MOCK.jobs);
    renderMemory(MOCK.memory);
    renderWatch(MOCK.watch);
    renderToday(MOCK.today);
    CURRENT_SESSION = "mock";
    renderConvList();
  }
}
loadLive();

/* Rafraîchit le statut en direct */
setInterval(async () => {
  if (!LIVE) return;
  try {
    const st = await api.get("status");
    renderStatus(st);
  } catch (_) {}
}, 15000);
