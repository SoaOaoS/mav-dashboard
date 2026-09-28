/* ============================================================
   Mav — companion UI
   Mode LIVE : API réelle (/api/*) servie par mav_api.py, avec streaming SSE.
   Fallback MOCK automatique si l'API n'est pas joignable (GitHub Pages).
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
  agents: ["research", "dev", "finance", "ops", "writer"],
  today: [
    { t: "09:00", text: "Point marchés envoyé." },
    { t: "08:00", text: "Revue du matin terminée." },
  ],
  memory: { conversations: [], facts: [], preferences: [] },
  watch: { items: [] },
  proxmox: {
    available: true,
    nodes: [
      {
        name: "GAIA",
        status: "online",
        cpu: 7,
        mem_pct: 12,
        disk_used: 9460129792,
        disk_total: 100861726720,
        uptime: 662853,
      },
    ],
    vms: [
      {
        vmid: 113,
        name: "OPC",
        status: "running",
        cpu: 12,
        mem: 4e9,
        maxmem: 16e9,
        node: "GAIA",
      },
      {
        vmid: 100,
        name: "NGINX-PROXY-MANAGER",
        status: "running",
        cpu: 3,
        mem: 1e9,
        maxmem: 1e9,
        node: "GAIA",
      },
    ],
    running: 2,
    total: 2,
  },
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
      body: JSON.stringify(body || {}),
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
  return days.map((d) => map[d] || d).join("–");
}
function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}
function fmtTime(ts) {
  if (ts && ts > 1e12) ts = Math.floor(ts / 1000);
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
function fmtBytes(b) {
  if (!b) return "—";
  const g = b / 1e9;
  return g >= 1 ? `${g.toFixed(1)} Go` : `${Math.round(b / 1e6)} Mo`;
}
function fmtUptime(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}j ${h}h` : `${h}h`;
}
let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
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
  if (view === "system") loadInfra();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$$(".nav-item").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.view)),
);
$$("[data-goto]").forEach((b) =>
  b.addEventListener("click", () => go(b.dataset.goto)),
);

/* ---------- Thème ---------- */
function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  $("#themeToggle").classList.toggle("is-on", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? "#0e1418" : "#2f6f5e";
}
let darkPref =
  localStorage.getItem("mav-theme") === "dark" ||
  (!localStorage.getItem("mav-theme") &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);
applyTheme(darkPref);
$("#themeToggle").addEventListener("click", () => {
  darkPref = !document.body.classList.contains("dark");
  localStorage.setItem("mav-theme", darkPref ? "dark" : "light");
  applyTheme(darkPref);
});

/* ---------- Rendu ---------- */
function renderStatus(st) {
  STATUS = st;
  if (!st) return;
  $("#greetingSub").textContent =
    st.mode === "mock" || st.agent_online === undefined
      ? "Aperçu de démonstration — je me connecte à l'agent quand tu m'ouvres depuis ton réseau."
      : st.agent_online
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
      <span class="jwhen">${j.every_minutes ? `${j.every_minutes} min` : esc(j.time)}</span>
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
      <div class="job-actions">
        <div class="jtime">${j.every_minutes ? `${j.every_minutes} min` : esc(j.time)}<small>${esc(fmtDays(j.days))}${j.last_run ? ` · ${esc(j.last_run)}` : ""}</small></div>
        <button class="job-act" data-run="${esc(j.name)}">Lancer</button>
        <button class="job-act ${j.enabled ? "" : "off"}" data-toggle="${esc(j.name)}" data-enabled="${j.enabled ? "1" : "0"}">${j.enabled ? "Actif" : "Pause"}</button>
      </div>
    </div>`,
    )
    .join("");
  $("#navJobsCount").textContent = (jobs || []).filter((j) => j.enabled).length;
}

function renderMemory(mem) {
  const rows = [];
  (mem.conversations || []).forEach((c) =>
    rows.push({ date: fmtTime(c.ts), text: c.question, tag: "échange" }),
  );
  (mem.facts || []).forEach((f) =>
    rows.push({ date: fmtDate(f.ts), text: f.fact, tag: "fait" }),
  );
  (mem.preferences || []).forEach((p) =>
    rows.push({
      date: fmtDate(p.ts),
      text: `${p.key} : ${p.value}`,
      tag: "préférence",
    }),
  );
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
      <button class="watch-rm" data-rm="${w.id}">Retirer</button>
    </div>`;
    })
    .join("");
}

function renderInfra(px) {
  if (!px || !px.available) {
    $("#infraNodes").innerHTML =
      `<div class="node-card"><h3>Proxmox</h3><div class="node-row">Indisponible</div></div>`;
    $("#infraVms").innerHTML = "";
    return;
  }
  $("#infraNodes").innerHTML = (px.nodes || [])
    .map(
      (n) => `
    <div class="node-card">
      <h3>${esc(n.name)} <span class="vm-dot ${n.status === "online" ? "running" : "stopped"}"></span></h3>
      <div class="node-row"><span>CPU</span><span>${n.cpu}%</span></div>
      <div class="mini-bar"><i style="width:${Math.min(100, n.cpu)}%"></i></div>
      <div class="node-row"><span>Mémoire</span><span>${n.mem_pct}% · ${fmtBytes(n.mem_used)}/${fmtBytes(n.mem_total)}</span></div>
      <div class="mini-bar"><i style="width:${Math.min(100, n.mem_pct)}%"></i></div>
      <div class="node-row"><span>Uptime</span><span>${fmtUptime(n.uptime)}</span></div>
    </div>`,
    )
    .join("");
  const vms = px.vms || [];
  $("#infraVms").innerHTML = vms
    .map(
      (v) => `
    <div class="vm-card">
      <h4><span class="vm-dot ${v.status}"></span>${esc(v.name || "VM " + v.vmid)}</h4>
      <div class="node-row"><span>#${v.vmid} · ${esc(v.node || "")}</span><span>${esc(v.status)}</span></div>
      ${v.status === "running" ? `<div class="node-row"><span>CPU ${v.cpu}%</span><span>${fmtBytes(v.mem)}/${fmtBytes(v.maxmem)}</span></div>` : ""}
    </div>`,
    )
    .join("");
}

/* ---------- Actions jobs ---------- */
$("#jobsList").addEventListener("click", async (e) => {
  const run = e.target.closest("[data-run]");
  if (run) {
    if (!LIVE) return toast("Disponible sur le live uniquement.");
    try {
      const r = await api.post("job/run", { name: run.dataset.run });
      toast(`Job lancé dans « ${r.title} »`);
      await loadConvs();
      openSession(r.session);
    } catch (_) {
      toast("Échec du lancement.");
    }
    return;
  }
  const tog = e.target.closest("[data-toggle]");
  if (tog) {
    if (!LIVE) return toast("Disponible sur le live uniquement.");
    const enabled = tog.dataset.enabled !== "1";
    try {
      await api.post("job/toggle", { name: tog.dataset.toggle, enabled });
      const j = await api.get("jobs");
      renderJobs(j.jobs || []);
      renderMiniJobs(j.jobs || []);
      toast(enabled ? "Automatisation activée." : "Automatisation en pause.");
    } catch (_) {
      toast("Échec.");
    }
  }
});

/* ---------- Surveillance : ajout / retrait ---------- */
$("#watchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!LIVE) return toast("Disponible sur le live uniquement.");
  const kind = $("#watchKind").value;
  const target = $("#watchTarget").value.trim();
  if (!target) return;
  try {
    await api.post("watch/add", { kind, target });
    $("#watchTarget").value = "";
    const w = await api.get("watch");
    renderWatch(w);
    toast("Surveillance ajoutée.");
  } catch (_) {
    toast("Échec de l'ajout.");
  }
});
$("#watchList").addEventListener("click", async (e) => {
  const rm = e.target.closest("[data-rm]");
  if (!rm) return;
  try {
    await api.post("watch/remove", { id: Number(rm.dataset.rm) });
    renderWatch(await api.get("watch"));
    toast("Surveillance retirée.");
  } catch (_) {}
});

/* ---------- Recherche (mémoire) ---------- */
let searchTimer = null;
$("#memorySearch").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    if (!q) return renderMemory(CACHED_MEMORY);
    if (!LIVE) return;
    try {
      const r = await api.get(`search?q=${encodeURIComponent(q)}`);
      renderSearchResults(r);
    } catch (_) {}
  }, 300);
});
function renderSearchResults(r) {
  const rows = [];
  (r.documents || []).forEach((d) =>
    rows.push({
      date: fmtDate(d.ts),
      text: d.excerpt || d.title,
      tag: "document",
    }),
  );
  (r.conversations || []).forEach((c) =>
    rows.push({ date: fmtTime(c.ts), text: c.question, tag: "échange" }),
  );
  (r.facts || []).forEach((f) =>
    rows.push({ date: fmtDate(f.ts), text: f.fact, tag: "fait" }),
  );
  $("#memoryList").innerHTML = rows.length
    ? rows
        .map(
          (m) => `
      <li><div class="mdate">${esc(m.date)}</div>
      <div><div class="mtext">${esc(m.text)}</div><span class="mtag">${esc(m.tag)}</span></div></li>`,
        )
        .join("")
    : `<li><div class="mdate"></div><div class="mtext" style="color:var(--ink-3)">Aucun résultat.</div></li>`;
}

/* ---------- Infra ---------- */
async function loadInfra() {
  if (!LIVE) return renderInfra(MOCK.proxmox);
  try {
    renderInfra(await api.get("proxmox"));
  } catch (_) {
    renderInfra(null);
  }
}

/* ---------- Agents (sélecteur) ---------- */
let AGENTS = [];
let CURRENT_AGENT = "";
function renderAgentSelect() {
  const label = $("#chatAgentLabel");
  if (!label) return;
  label.innerHTML = `agent <select id="agentSelect">${AGENTS.map((a) => `<option value="${esc(a)}"${a === CURRENT_AGENT ? " selected" : ""}>${esc(a)}</option>`).join("")}</select>`;
  $("#agentSelect").addEventListener("change", (e) => {
    CURRENT_AGENT = e.target.value;
    localStorage.setItem("mav-agent", CURRENT_AGENT);
  });
}

/* ---------- Chat & gestionnaire de sessions ---------- */
const messages = $("#messages");
let CURRENT_SESSION = null;
let CONVS = [];
let CACHED_MEMORY = { conversations: [], facts: [], preferences: [] };
let streaming = false;
let abortController = null;
let pendingFiles = [];

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
  return el.querySelector(".bubble");
}
function addToolNote(text) {
  const el = document.createElement("div");
  el.className = "tool-note";
  el.textContent = text;
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
      <button class="cdel" data-del="${esc(c.id)}" title="Supprimer"><span class="nav-ico" data-ico="trash"></span></button>
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
    CONVS = (await api.get("sessions")).sessions || [];
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
    if (!s.messages || !s.messages.length) welcome();
    else s.messages.forEach((m) => addMsg(m.text, m.role));
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
    const s = await api.post("session/new", { agent: CURRENT_AGENT });
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
    if (!CURRENT_SESSION && CONVS.length) await openSession(CONVS[0].id);
    else if (!CONVS.length) newSession();
    else renderConvList();
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

/* ---------- Export & résumé ---------- */
$("#exportBtn").addEventListener("click", () => {
  if (!LIVE || !CURRENT_SESSION) return toast("Rien à exporter.");
  window.location.href = `/api/session/export?id=${encodeURIComponent(CURRENT_SESSION)}`;
});
$("#summaryBtn").addEventListener("click", async () => {
  if (!LIVE || !CURRENT_SESSION) return;
  toast("Je résume…");
  try {
    const r = await api.post("session/summary", { id: CURRENT_SESSION });
    addMsg("## Résumé\n" + (r.summary || "…"), "mav");
  } catch (_) {
    toast("Échec du résumé.");
  }
});

/* ---------- Pièces jointes ---------- */
function bindAttach(inputSel) {
  $(inputSel).addEventListener("change", async (e) => {
    for (const f of e.target.files) {
      const reader = new FileReader();
      reader.onload = async () => {
        const b64 = String(reader.result).split(",")[1];
        if (LIVE) {
          try {
            const up = await api.post("upload", {
              name: f.name,
              data: b64,
              mime: f.type,
            });
            pendingFiles.push(up);
          } catch (_) {
            toast("Upload échoué.");
          }
        } else {
          pendingFiles.push({ filename: f.name, mime: f.type, url: "" });
        }
        renderAttachments();
      };
      reader.readAsDataURL(f);
    }
    e.target.value = "";
  });
}
function renderAttachments() {
  const box = $("#chatAttachments");
  if (!pendingFiles.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML = pendingFiles
    .map(
      (f, i) =>
        `<span class="att-chip">${esc(f.filename)} <button data-rm-att="${i}">×</button></span>`,
    )
    .join("");
}
$("#chatAttachments").addEventListener("click", (e) => {
  const rm = e.target.closest("[data-rm-att]");
  if (rm) {
    pendingFiles.splice(Number(rm.dataset.rmAtt), 1);
    renderAttachments();
  }
});
bindAttach("#chatFileInput");
bindAttach("#heroFile");

/* ---------- Envoi (streaming) ---------- */
function setStreaming(on) {
  streaming = on;
  thinking(on);
  $("#sendBtn").hidden = on;
  $("#stopBtn").hidden = !on;
  if (!on) $("#typing").hidden = true;
}

async function send(raw, cmd) {
  const text = (raw || "").trim();
  if (!text && !cmd && !pendingFiles.length) return;
  const shown = text || cmd;
  if (shown) addMsg(shown, "me");

  if (!LIVE) {
    $("#typing").hidden = false;
    const key = (cmd || text || "").trim().toLowerCase();
    const pool = MOCK.replies[key] || MOCK.replies.default;
    const reply = Array.isArray(pool)
      ? pool[Math.floor(Math.random() * pool.length)]
      : pool;
    setTimeout(() => {
      $("#typing").hidden = true;
      addMsg(reply, "mav");
    }, 700);
    pendingFiles = [];
    renderAttachments();
    return;
  }

  const files = pendingFiles.slice();
  pendingFiles = [];
  renderAttachments();

  setStreaming(true);
  $("#typing").hidden = false;
  let bubble = null;
  let acc = "";

  const qs = new URLSearchParams({
    prompt: text || cmd || "(pièce jointe)",
    session: CURRENT_SESSION || "",
    agent: CURRENT_AGENT || "",
  });
  if (files.length)
    qs.set("files", JSON.stringify(files.map((f) => f.url).filter(Boolean)));

  try {
    await new Promise((resolve, reject) => {
      const es = new EventSource(`/api/stream?${qs.toString()}`);
      let sessionFromServer = null;
      es.addEventListener("start", (e) => {
        try {
          sessionFromServer = JSON.parse(e.data).session;
        } catch (_) {}
      });
      es.addEventListener("delta", (e) => {
        const d = JSON.parse(e.data).delta || "";
        acc += d;
        if (!bubble) {
          $("#typing").hidden = true;
          bubble = addMsg("", "mav");
        }
        bubble.textContent = acc;
        messages.scrollTop = messages.scrollHeight;
      });
      es.addEventListener("tool", (e) => {
        try {
          addToolNote("› " + (JSON.parse(e.data).tool || "outil"));
        } catch (_) {}
      });
      es.addEventListener("done", (e) => {
        es.close();
        try {
          const d = JSON.parse(e.data);
          if (!sessionFromServer && d.session) sessionFromServer = d.session;
        } catch (_) {}
        if (sessionFromServer && sessionFromServer !== CURRENT_SESSION) {
          CURRENT_SESSION = sessionFromServer;
        }
        if (!acc) addMsg("(pas de réponse)", "mav");
        resolve();
      });
      es.addEventListener("error", (e) => {
        es.close();
        let msg = "Je n'ai pas pu joindre mon moteur.";
        try {
          if (e.data) msg = "Erreur : " + JSON.parse(e.data).message;
        } catch (_) {}
        addMsg(msg, "mav");
        resolve();
      });
      es.onerror = () => {
        es.close();
        resolve();
      };
    });
  } catch (_) {
    addMsg("Connexion interrompue.", "mav");
  } finally {
    setStreaming(false);
    if (S.shouldSpeak) speak(acc);
    await loadConvs();
  }
}

$("#stopBtn").addEventListener("click", async () => {
  if (!LIVE || !CURRENT_SESSION) return;
  try {
    await api.post("session/abort", { id: CURRENT_SESSION });
  } catch (_) {}
  setStreaming(false);
  toast("Stoppé.");
});

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

/* ---------- Voix (dictée + lecture) ---------- */
const S = { shouldSpeak: false, recog: null };
function setupVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.continuous = false;
    S.recog = rec;
  }
}
setupVoice();

function startDictation(btn, inputSel) {
  if (!S.recog) return toast("Dictée non supportée par ce navigateur.");
  const input = $(inputSel);
  S.recog.onresult = (e) => {
    input.value = (input.value + " " + e.results[0][0].transcript).trim();
  };
  S.recog.onend = () => btn.classList.remove("is-rec");
  try {
    S.recog.start();
    btn.classList.add("is-rec");
  } catch (_) {
    btn.classList.remove("is-rec");
  }
}
$("#chatMic").addEventListener("click", () =>
  startDictation($("#chatMic"), "#chatInput"),
);
$("#heroMic").addEventListener("click", () =>
  startDictation($("#heroMic"), "#heroInput"),
);

function speak(text) {
  if (!text || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text.slice(0, 600));
  u.lang = "fr-FR";
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
$("#voiceToggle").addEventListener("click", () => {
  S.shouldSpeak = !S.shouldSpeak;
  $("#voiceToggle").classList.toggle("is-on", S.shouldSpeak);
  if (!S.shouldSpeak) speechSynthesis.cancel();
  toast(
    S.shouldSpeak ? "Lecture vocale activée." : "Lecture vocale désactivée.",
  );
});

/* ---------- Notifications (Web Push) ---------- */
const N = { enabled: false };
function urlB64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
$("#notifyToggle").addEventListener("click", async () => {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return toast("Notifications non supportées.");
  }
  if (N.enabled) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    } catch (_) {}
    N.enabled = false;
    $("#notifyToggle").classList.remove("is-on");
    return toast("Notifications désactivées.");
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return toast("Permission refusée.");
    const { key } = await api.get("push/key");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key),
    });
    await api.post("push/subscribe", sub.toJSON());
    N.enabled = true;
    $("#notifyToggle").classList.add("is-on");
    toast("Notifications activées.");
  } catch (_) {
    toast("Échec de l'activation.");
  }
});

/* ---------- Palette de commandes (⌘K) ---------- */
const palette = $("#palette");
function openPalette() {
  palette.hidden = false;
  $("#paletteInput").value = "";
  $("#paletteResults").innerHTML =
    `<div class="pal-item" data-pal-action="new-chat"><span class="pal-kind">Action</span><span class="pal-text">Nouvelle discussion</span></div>
    <div class="pal-item" data-pal-view="jobs"><span class="pal-kind">Aller</span><span class="pal-text">Automatisations</span></div>
    <div class="pal-item" data-pal-view="memory"><span class="pal-kind">Aller</span><span class="pal-text">Souvenirs</span></div>
    <div class="pal-item" data-pal-view="watch"><span class="pal-kind">Aller</span><span class="pal-text">Surveillance</span></div>
    <div class="pal-item" data-pal-view="system"><span class="pal-kind">Aller</span><span class="pal-text">Infra</span></div>`;
  $("#paletteInput").focus();
}
function closePalette() {
  palette.hidden = true;
}
$("#searchOpen").addEventListener("click", openPalette);
palette.addEventListener("click", (e) => {
  if (e.target === palette) closePalette();
});
window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    palette.hidden ? openPalette() : closePalette();
  }
  if (e.key === "Escape") closePalette();
});

let palTimer = null;
$("#paletteInput").addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(palTimer);
  palTimer = setTimeout(async () => {
    if (!q) return openPalette();
    const items = [];
    CONVS.filter((c) =>
      c.title.toLowerCase().includes(q.toLowerCase()),
    ).forEach((c) =>
      items.push({
        kind: "Discussion",
        text: c.title,
        action: "open",
        id: c.id,
      }),
    );
    if (LIVE) {
      try {
        const r = await api.get(`search?q=${encodeURIComponent(q)}`);
        (r.facts || []).forEach((f) =>
          items.push({ kind: "Souvenir", text: f.fact }),
        );
        (r.documents || []).forEach((d) =>
          items.push({ kind: "Document", text: d.title }),
        );
      } catch (_) {}
    }
    $("#paletteResults").innerHTML = items.length
      ? items
          .slice(0, 20)
          .map(
            (i) =>
              `<div class="pal-item" ${i.action === "open" ? `data-pal-open="${esc(i.id)}"` : ""}><span class="pal-kind">${esc(i.kind)}</span><span class="pal-text">${esc(i.text)}</span></div>`,
          )
          .join("")
      : `<div class="pal-empty">Aucun résultat.</div>`;
  }, 250);
});
$("#paletteResults").addEventListener("click", (e) => {
  const open = e.target.closest("[data-pal-open]");
  if (open) {
    closePalette();
    go("chat");
    openSession(open.dataset.palOpen);
    return;
  }
  const view = e.target.closest("[data-pal-view]");
  if (view) {
    closePalette();
    go(view.dataset.palView);
    return;
  }
  const act = e.target.closest("[data-pal-action]");
  if (act) {
    closePalette();
    newSession();
  }
});

welcome();

/* ---------- Chargement ---------- */
async function loadLive() {
  try {
    const [status, conns, jobs, mem, watch, agents] = await Promise.all([
      api.get("status"),
      api.get("connections"),
      api.get("jobs"),
      api.get("memory"),
      api.get("watch"),
      api.get("agents"),
    ]);
    LIVE = true;
    document.body.dataset.mode = "live";
    renderStatus(status);
    renderConnections(conns.connections || []);
    renderJobs(jobs.jobs || []);
    renderMiniJobs(jobs.jobs || []);
    CACHED_MEMORY = mem;
    renderMemory(mem);
    renderWatch(watch);
    renderToday([{ t: "—", text: "Connecté au moteur de l'agent en direct." }]);
    AGENTS = agents.agents || [];
    CURRENT_AGENT = localStorage.getItem("mav-agent") || AGENTS[0] || "";
    renderAgentSelect();

    await loadConvs();
    if (CONVS.length) await openSession(CONVS[0].id);
    else await newSession();
  } catch (e) {
    LIVE = false;
    document.body.dataset.mode = "mock";
    renderStatus({
      mode: "mock",
      jobs_active: MOCK.jobs.filter((j) => j.enabled).length,
      conversations: "—",
      facts: "—",
      watch_items: "—",
    });
    renderConnections(MOCK.connections);
    renderJobs(MOCK.jobs);
    renderMiniJobs(MOCK.jobs);
    CACHED_MEMORY = MOCK.memory;
    renderMemory(MOCK.memory);
    renderWatch(MOCK.watch);
    renderToday(MOCK.today);
    AGENTS = MOCK.agents;
    CURRENT_AGENT = AGENTS[0];
    renderAgentSelect();
    CURRENT_SESSION = "mock";
    renderConvList();
  }
}
loadLive();

/* ---------- PWA : service worker + installation ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
let deferredPrompt = null;
const banner = $("#installBanner");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (localStorage.getItem("mav-install-dismissed") !== "1")
    banner.hidden = false;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try {
    await deferredPrompt.userChoice;
  } catch (_) {}
  deferredPrompt = null;
  banner.hidden = true;
});
$("#installClose").addEventListener("click", () => {
  banner.hidden = true;
  localStorage.setItem("mav-install-dismissed", "1");
});
window.addEventListener("appinstalled", () => {
  banner.hidden = true;
});
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;
if (
  isIOS &&
  !isStandalone &&
  localStorage.getItem("mav-install-dismissed") !== "1"
) {
  const s = banner.querySelector(".install-text span");
  if (s) s.textContent = "Appuie sur Partager puis « Sur l'écran d'accueil ».";
  $("#installBtn").textContent = "Compris";
  $("#installBtn").addEventListener(
    "click",
    () => {
      banner.hidden = true;
      localStorage.setItem("mav-install-dismissed", "1");
    },
    { once: true },
  );
  banner.hidden = false;
}

/* Rafraîchit le statut */
setInterval(async () => {
  if (!LIVE) return;
  try {
    renderStatus(await api.get("status"));
  } catch (_) {}
}, 20000);
