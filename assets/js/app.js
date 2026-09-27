/* ============================================================
   MAV COMMAND INTERFACE — mock data + UI logic
   Aucune authentification. Données simulées (démo GitHub Pages).
   ============================================================ */

const MOCK = {
  jobs: [
    { name: "revue-dev-matinale", time: "08:00", days: "Lun–Ven", agent: "dev", enabled: true },
    { name: "briefing-marches-9h", time: "09:00", days: "Lun–Ven", agent: "finance", enabled: true },
    { name: "veille-infra", time: "*/30 min", days: "24/7", agent: "ops", enabled: true },
    { name: "revue-memoire-hebdo", time: "Dim 20:00", days: "Dim", agent: "writer", enabled: false },
  ],
  tasks: [
    { title: "Indexation RAG des notes", progress: 68, agent: "dev", eta: "12 min" },
    { title: "Synthèse marchés ouverture", progress: 31, agent: "finance", eta: "—" },
    { title: "Scan PRs ouvertes", progress: 100, agent: "reviewer", eta: "terminé" },
    { title: "Backup VM OPC", progress: 84, agent: "ops", eta: "4 min" },
  ],
  memory: [
    { date: "27 sep. 2026", text: "Raphaël préfère être prévenu d'un quota excédé plutôt qu'une boucle de retry.", tag: "préférence" },
    { date: "26 sep. 2026", text: "Déploiement du dashboard MAV sur GitHub Pages (mode mock).", tag: "projet" },
    { date: "24 sep. 2026", text: "Job briefing-marches-9h opérationnel via Stocktwits temps réel.", tag: "système" },
    { date: "18 août 2026", text: "Le groupe docker a été ajouté à opencode — reconnexion requise.", tag: "infra" },
  ],
  watch: [
    { type: "web", target: "mines-ales.fr / campus", state: "stable" },
    { type: "github", target: "SoaOaoS/mav-dashboard", state: "stable" },
    { type: "proxmox", target: "GAIA · VM 113 (OPC)", state: "stable" },
    { type: "health", target: "Postgres + serveur opencode", state: "stable" },
    { type: "mail", target: "gmail / réservations", state: "changement" },
  ],
  feed: [
    { t: "09:00", text: "Briefing marchés envoyé sur Telegram." },
    { t: "08:47", text: "RAG : 3 documents réindexés." },
    { t: "08:00", text: "revue-dev-matinale terminée — 2 PRs à relire." },
    { t: "07:59", text: "Backup nocturne VM OPC OK." },
    { t: "07:30", text: "Connexion Spotify : quota excédé (search)." },
  ],
  connections: [
    { name: "Proxmox · GAIA", state: "ok" },
    { name: "Postgres · mav", state: "ok" },
    { name: "Gmail · IMAP", state: "ok" },
    { name: "Spotify · quota", state: "warn" },
    { name: "Telegram bot", state: "ok" },
    { name: "Moodle · MCP", state: "err" },
  ],
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- CLOCK + UPTIME ---------- */
const boot = Date.now();
function two(n) { return String(n).padStart(2, "0"); }
function tickClock() {
  const now = new Date();
  const t = `${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
  $("#clock").textContent = t;
  $("#clockBig").textContent = t;
  $("#clockDate").textContent = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const up = Math.floor((Date.now() - boot) / 1000);
  const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60);
  $("#uptime").textContent = `${two(d)}j ${two(h)}h ${two(m)}m`;
}
setInterval(tickClock, 1000); tickClock();
$("#year").textContent = new Date().getFullYear();

/* ---------- NAV ---------- */
$$(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".nav-btn").forEach(b => b.classList.toggle("is-active", b === btn));
    const v = btn.dataset.view;
    $$(".view").forEach(el => el.classList.toggle("is-active", el.id === `view-${v}`));
  });
});
function goView(v) {
  const btn = $(`.nav-btn[data-view="${v}"]`);
  if (btn) btn.click();
}

/* ---------- REACTOR CANVAS ---------- */
(function reactor() {
  const cv = $("#reactor");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const cx = 130, cy = 130;
  let load = 0.42, target = 0.42, t = 0;
  const bars = Array.from({ length: 64 }, () => Math.random());

  function draw() {
    t += 0.02;
    load += (target - load) * 0.04;
    ctx.clearRect(0, 0, 260, 260);

    // halo
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120);
    g.addColorStop(0, "rgba(69,230,255,0.20)");
    g.addColorStop(1, "rgba(69,230,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fill();

    // outer rotating ring
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * 0.5); ctx.translate(-cx, -cy);
    ctx.strokeStyle = "rgba(69,230,255,0.55)"; ctx.lineWidth = 1.5;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const r1 = 108, r2 = r1 + (i % 4 === 0 ? 10 : 5);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();

    // mid ring
    ctx.strokeStyle = "rgba(69,230,255,0.28)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 92, 0, Math.PI * 2); ctx.stroke();

    // progress arc
    ctx.strokeStyle = "#45e6ff"; ctx.lineWidth = 4; ctx.lineCap = "round";
    ctx.shadowColor = "#45e6ff"; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 92, -Math.PI / 2, -Math.PI / 2 + load * Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // inner ring
    ctx.strokeStyle = "rgba(69,230,255,0.18)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 74, 0, Math.PI * 2); ctx.stroke();

    // equalizer
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t * 0.7);
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const amp = 6 + bars[i] * 22 * load;
      bars[i] += (Math.random() - 0.5) * 0.12;
      bars[i] = Math.max(0, Math.min(1, bars[i]));
      ctx.strokeStyle = `rgba(69,230,255,${0.25 + bars[i] * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 74, Math.sin(a) * 74);
      ctx.lineTo(Math.cos(a) * (74 - amp), Math.sin(a) * (74 - amp));
      ctx.stroke();
    }
    ctx.restore();

    requestAnimationFrame(draw);
  }
  draw();

  // live load fluctuation
  setInterval(() => {
    target = 0.25 + Math.random() * 0.55;
    $("#coreLoad").textContent = Math.round(load * 100);
  }, 1800);
  setInterval(() => { $("#coreLoad").textContent = Math.round(load * 100); }, 200);
})();

/* ---------- METRICS ---------- */
const metricState = { cpu: 34, mem: 58, disk: 47, net: 22 };
function renderMetrics() {
  const set = (id, bar, val, text) => {
    $(id).textContent = text;
    $(bar).style.width = Math.min(100, val) + "%";
  };
  set("#cpuVal", "#cpuBar", metricState.cpu, metricState.cpu + "%");
  set("#memVal", "#memBar", metricState.mem, metricState.mem + "%");
  set("#diskVal", "#diskBar", metricState.disk, metricState.disk + "%");
  set("#netVal", "#netBar", metricState.net, metricState.net + " Mb/s");
}
setInterval(() => {
  metricState.cpu = clamp(metricState.cpu + rnd(-6, 6), 8, 92);
  metricState.mem = clamp(metricState.mem + rnd(-3, 3), 30, 88);
  metricState.disk = clamp(metricState.disk + rnd(-1, 1), 40, 60);
  metricState.net = clamp(metricState.net + rnd(-8, 10), 2, 96);
  renderMetrics();
}, 2000);
renderMetrics();

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(a, b) { return a + Math.random() * (b - a); }

/* ---------- RENDER LISTS ---------- */
function renderOverviewJobs() {
  $("#overviewJobs").innerHTML = MOCK.jobs.map(j => `
    <li>
      <span class="job-time">${j.time}</span>
      <span class="job-name">${j.name}</span>
      <span class="job-state ${j.enabled ? "state-on" : "state-off"}">${j.enabled ? "ON" : "OFF"}</span>
    </li>`).join("");
}
function renderFeed() {
  $("#overviewFeed").innerHTML = MOCK.feed.map(f => `<li><span class="t">${f.t}</span><span>${f.text}</span></li>`).join("");
}
function renderTasks() {
  $("#taskGrid").innerHTML = MOCK.tasks.map(t => `
    <div class="task-card">
      <h4>${t.title}</h4>
      <div class="task-progress"><i style="width:${t.progress}%"></i></div>
      <div class="task-meta"><span>${t.agent}</span><span>${t.eta}</span></div>
    </div>`).join("");
}
function renderJobsTable() {
  const nextTimes = ["08:00", "09:00", "dans 12 min", "Dim 20:00"];
  $(".data-table tbody").innerHTML = MOCK.jobs.map((j, i) => `
    <tr>
      <td>${j.name}</td>
      <td class="mono">${j.time} · ${j.days}</td>
      <td>${j.agent}</td>
      <td><span class="badge ${j.enabled ? "badge-on" : "badge-off"}">${j.enabled ? "actif" : "inactif"}</span></td>
      <td class="mono">${nextTimes[i]}</td>
    </tr>`).join("");
}
function renderMemory() {
  $("#memoryTimeline").innerHTML = MOCK.memory.map(m => `
    <div class="mem-item">
      <div class="mem-date">${m.date}</div>
      <div><div class="mem-text">${m.text}</div><span class="mem-tag">${m.tag}</span></div>
    </div>`).join("");
}
function renderWatch() {
  $("#watchGrid").innerHTML = MOCK.watch.map(w => `
    <div class="watch-card">
      <div class="watch-type">${w.type}</div>
      <div class="watch-target">${w.target}</div>
      <div class="watch-state ${w.state === "changement" ? "changed" : ""}">${w.state === "changement" ? "▲ changement détecté" : "● stable"}</div>
    </div>`).join("");
}
function renderLiveFeed() {
  $("#liveFeed").innerHTML = MOCK.feed.map(f => `<li><span class="t">${f.t}</span><span>${f.text}</span></li>`).join("");
}

renderOverviewJobs();
renderFeed();
renderTasks();
renderJobsTable();
renderMemory();
renderWatch();
renderLiveFeed();

/* ---------- LIVE FEED SIMULATION ---------- */
const rndEvents = [
  "Heartbeat MCP Proxmox reçu.",
  "Cache RAG rafraîchi (4 entrées).",
  "Aucun incident sur la veille mail.",
  "Job scheduler : tick à l'instant.",
  "Connexion Telegram stable.",
  "Snapshot horaire Postgres OK.",
];
setInterval(() => {
  const now = new Date();
  const t = `${two(now.getHours())}:${two(now.getMinutes())}`;
  MOCK.feed.unshift({ t, text: rndEvents[Math.floor(Math.random() * rndEvents.length)] });
  MOCK.feed.pop();
  renderLiveFeed();
}, 6000);

/* ---------- CONSOLE ---------- */
const terminal = $("#terminal");
function print(text, cls = "out") {
  const l = document.createElement("div");
  l.className = `line ${cls}`;
  l.textContent = text;
  terminal.appendChild(l);
  terminal.scrollTop = terminal.scrollHeight;
  // trim
  while (terminal.children.length > 220) terminal.removeChild(terminal.firstChild);
}
const bootLines = [
  ["Initialisation du noyau MAV…", "comment"],
  ["Chargement mémoire inter-sessions… OK", "ok"],
  ["Connexion Postgres mav@127.0.0.1… OK", "ok"],
  ["Index RAG chargé (config french).", "ok"],
  ["Mode MOCK — aucune commande n'est réellement exécutée.", "sys"],
  ["Tape `aide` pour la liste des commandes.", "comment"],
];
bootLines.forEach((l, i) => setTimeout(() => print(l[0], l[1]), 220 * i));

const HELP = [
  "Commandes disponibles (mock) :",
  "  status        — état complet du système",
  "  jobs          — jobs planifiés",
  "  memoire       — derniers échanges mémorisés",
  "  veille        — items surveillés",
  "  marches       — briefing marchés",
  "  aide          — cette aide",
  "  clear         — nettoyer la console",
];

function handleCommand(cmd) {
  const c = cmd.trim().toLowerCase();
  if (!c) return;
  print(cmd, "in");
  switch (c) {
    case "aide":
    case "help":
      HELP.forEach(l => print(l, "comment"));
      break;
    case "status":
      print("Système nominal. CPU 34% · MEM 58% · DISK 47%.", "ok");
      print("Services : proxmox OK · postgres OK · gmail OK · spotify QUOTA · moodle ERR", "out");
      break;
    case "jobs":
      MOCK.jobs.forEach(j => print(`  [${j.enabled ? "x" : " "}] ${j.time.padEnd(8)} ${j.name} (${j.agent})`, j.enabled ? "ok" : "comment"));
      break;
    case "memoire":
    case "mémoire":
      MOCK.memory.forEach(m => print(`  ${m.date} — ${m.text}`, "out"));
      break;
    case "veille":
      MOCK.watch.forEach(w => print(`  [${w.type}] ${w.target} → ${w.state}`, w.state === "stable" ? "ok" : "sys"));
      break;
    case "marches":
    case "marchés":
      print("Briefing marchés (mock) : ouverture européenne prudente, indices +0.3%.", "out");
      break;
    case "clear":
      terminal.innerHTML = "";
      break;
    default:
      print(`Commande inconnue : « ${cmd} ». Tape \`aide\`.`, "err");
  }
}

$("#consoleForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = $("#consoleInput");
  handleCommand(input.value);
  input.value = "";
});
$$(".hint").forEach(h => h.addEventListener("click", () => handleCommand(h.dataset.cmd)));
$$(".quick").forEach(q => q.addEventListener("click", () => {
  handleCommand(q.dataset.cmd);
  goView("console");
}));

/* greeting rotatif */
const subs = [
  "Tous les systèmes sont nominaux. Que puis-je faire ?",
  "2 jobs exécutés ce matin. Rien à signaler.",
  "La veille mail a détecté un changement.",
  "Prêt à recevoir tes commandes.",
];
let si = 0;
setInterval(() => { si = (si + 1) % subs.length; $("#greetingSub").textContent = subs[si]; }, 7000);
