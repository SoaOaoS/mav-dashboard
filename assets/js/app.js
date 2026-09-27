/* ============================================================
   Mav — companion UI (mock)
   Données simulées, aucune auth, aucun backend branché.
   ============================================================ */

const MOCK = {
  connections: [
    { name: "Proxmox", state: "ok", label: "connecté" },
    { name: "Base mémoire", state: "ok", label: "connectée" },
    { name: "Gmail", state: "ok", label: "connecté" },
    { name: "Spotify", state: "warn", label: "quota" },
    { name: "Telegram", state: "ok", label: "connecté" },
    { name: "Moodle", state: "off", label: "hors ligne" },
  ],
  today: [
    { t: "09:00", text: "Point marchés envoyé." },
    { t: "08:47", text: "3 notes réindexées dans la mémoire." },
    { t: "08:00", text: "Revue du matin terminée, 2 choses à relire." },
    { t: "07:59", text: "Sauvegarde de la VM OK." },
  ],
  jobs: [
    {
      name: "Revue du matin",
      desc: "Préparer le point technique avant 8h.",
      time: "08:00",
      days: "lun–ven",
      enabled: true,
      icon: "heart",
    },
    {
      name: "Point marchés",
      desc: "Synthèse macro et marchés pour l'ouverture.",
      time: "09:00",
      days: "lun–ven",
      enabled: true,
      icon: "bolt",
    },
    {
      name: "Veille infra",
      desc: "Surveiller les serveurs et services toutes les 30 min.",
      time: "continu",
      days: "24/7",
      enabled: true,
      icon: "eye",
    },
    {
      name: "Récap hebdo",
      desc: "Résumé de la semaine dans la mémoire.",
      time: "20:00",
      days: "dim",
      enabled: false,
      icon: "chat",
    },
  ],
  memory: [
    {
      date: "27 sept.",
      text: "Tu préfères que je te prévienne quand un service est bloqué, plutôt que je tourne en rond.",
      tag: "préférence",
    },
    {
      date: "26 sept.",
      text: "On a lancé la nouvelle interface web de Mav.",
      tag: "projet",
    },
    {
      date: "24 sept.",
      text: "Le briefing marchés de 9h tourne bien.",
      tag: "système",
    },
    {
      date: "18 août",
      text: "Note : docker a été installé, reconnexion nécessaire.",
      tag: "infra",
    },
  ],
  watch: [
    { type: "Web", target: "Le campus en ligne", state: "stable" },
    { type: "GitHub", target: "mav-dashboard", state: "stable" },
    { type: "Serveurs", target: "VM OPC sur GAIA", state: "stable" },
    { type: "Santé", target: "Base mémoire + serveur", state: "stable" },
    { type: "Mails", target: "Réservations", state: "changement" },
  ],
  replies: {
    statut:
      "Tout va bien de mon côté. Cinq services sur six sont en ligne — seul Moodle ne répond pas, et Spotify est en quota. Rien d'urgent.",
    automatisations:
      "Je fais tourner 3 automatisations en ce moment : la revue du matin à 8h, le point marchés à 9h, et la veille infra en continu. Tu veux en ajuster une ?",
    souvenirs:
      "Je retiens 4 choses en ce moment. La plus importante : tu préfères que je te prévienne vite plutôt que de tourner en rond. C'est noté.",
    surveillance:
      "Je surveille 5 choses pour toi. Une seule a bougé : tes mails de réservation. Le reste est stable, donc je me tais.",
    marches:
      "Ouverture européenne prudente ce matin, les indices prennent +0,3 %. Je te fais un vrai point si tu veux.",
    aide: "Je peux te faire un point système, résumer tes automatisations, te dire ce que je retiens, ou te signaler des alertes. Mais tu peux surtout juste me parler naturellement.",
    default: [
      "Compris. Je m'en occupe et je te tiens au courant.",
      "Bien noté — je regarde ça et je reviens vers toi.",
      "D'accord. Je te prépare ça dans un instant.",
      "Reçu. Je m'y mets, dis-moi juste si tu veux que je te montre le détail.",
    ],
  },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- CLOCK ---------- */
function tick() {
  const n = new Date();
  $("#clock").textContent =
    `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}
setInterval(tick, 1000);
tick();

/* ---------- GREETING ---------- */
function greet() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit Raphaël";
  if (h < 12) return "Bonjour Raphaël";
  if (h < 18) return "Bon après-midi Raphaël";
  return "Bonsoir Raphaël";
}
$("#greeting").textContent = greet();
const subs = [
  "Content de te revoir. Qu'est-ce qu'on fait aujourd'hui ?",
  "Tout est calme. Une seule petite chose à te signaler.",
  "J'ai avancé sur tes automatisations ce matin.",
  "Je suis là, dis-moi.",
];
let si = 0;
setInterval(() => {
  si = (si + 1) % subs.length;
  $("#greetingSub").textContent = subs[si];
}, 8000);

/* ---------- NAV ---------- */
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

/* ---------- CONNECTIONS ---------- */
$("#connList").innerHTML = MOCK.connections
  .map(
    (c) => `
  <li><span class="st ${c.state}"></span>${c.name}<span class="lbl">${c.label}</span></li>
`,
  )
  .join("");

/* ---------- STATS ---------- */
$("#stats").innerHTML = [
  { v: "3", k: "automatisations actives" },
  { v: "4", k: "choses retenues" },
  { v: "5", k: "surveillances" },
  { v: "1", k: "alerte douce" },
]
  .map(
    (s) =>
      `<div class="stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`,
  )
  .join("");

/* ---------- TODAY ---------- */
$("#today").innerHTML = MOCK.today
  .map(
    (t) => `
  <li><span class="t">${t.t}</span><span>${t.text}</span></li>
`,
  )
  .join("");

/* ---------- JOBS (home mini + list) ---------- */
$("#homeJobs").innerHTML = MOCK.jobs
  .slice(0, 3)
  .map(
    (j) => `
  <li>
    <span class="jname">${j.name}</span>
    <span class="jwhen">${j.time}</span>
    <span class="pill ${j.enabled ? "on" : "off"}">${j.enabled ? "actif" : "pause"}</span>
  </li>
`,
  )
  .join("");

$("#jobsList").innerHTML = MOCK.jobs
  .map(
    (j) => `
  <div class="job">
    <div class="jicon"><span class="nav-ico" data-ico="${j.icon}"></span></div>
    <div>
      <div class="jtitle">${j.name}</div>
      <div class="jdesc">${j.desc}</div>
    </div>
    <div class="jtime">${j.time}<small>${j.days} · ${j.enabled ? "active" : "en pause"}</small></div>
  </div>
`,
  )
  .join("");
$("#navJobsCount").textContent = MOCK.jobs.filter((j) => j.enabled).length;

/* ---------- MEMORY ---------- */
$("#memoryList").innerHTML = MOCK.memory
  .map(
    (m) => `
  <li>
    <div class="mdate">${m.date}</div>
    <div><div class="mtext">${m.text}</div><span class="mtag">${m.tag}</span></div>
  </li>
`,
  )
  .join("");

/* ---------- WATCH ---------- */
$("#watchList").innerHTML = MOCK.watch
  .map(
    (w) => `
  <div class="wcard">
    <div class="wtype">${w.type}</div>
    <div class="wtarget">${w.target}</div>
    <div class="wstate ${w.state === "changement" ? "changed" : ""}">
      <span class="st"></span>${w.state === "changement" ? "a changé" : "stable"}
    </div>
  </div>
`,
  )
  .join("");

/* ---------- CHAT ---------- */
const messages = $("#messages");
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

// message d'accueil
addMsg(
  "Salut Raphaël. Je suis prêt — dis-moi ce dont tu as besoin, ou tape une suggestion.",
  "mav",
);

function reply(cmd, raw) {
  const key = (cmd || raw || "").trim().toLowerCase();
  let text;
  if (MOCK.replies[key]) text = MOCK.replies[key];
  else if (/^(aide|help|\?)$/.test(key)) text = MOCK.replies.aide;
  else {
    const pool = MOCK.replies.default;
    text = pool[Math.floor(Math.random() * pool.length)];
  }
  const typing = $("#typing");
  typing.hidden = false;
  messages.scrollTop = messages.scrollHeight;
  setTimeout(
    () => {
      typing.hidden = true;
      addMsg(text, "mav");
    },
    700 + Math.random() * 500,
  );
}

function send(raw, cmd) {
  const text = (raw || "").trim();
  if (!text && !cmd) return;
  if (text) addMsg(text, "me");
  reply(cmd, text);
}

// chat
$("#chatForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const i = $("#chatInput");
  send(i.value);
  i.value = "";
});
// hero
$("#heroForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const i = $("#heroInput");
  send(i.value);
  i.value = "";
  go("chat");
});
// chips
$$(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    go("chat");
    send("", c.dataset.cmd);
  }),
);

/* ---------- LIVE TOUCH ---------- */
const liveTexts = [
  "Sauvegarde horaire terminée.",
  "Mémoire rafraîchie.",
  "Rien à signaler sur tes surveillances.",
  "Petit check des services… tout est bon.",
];
setInterval(() => {
  const n = new Date();
  MOCK.today.unshift({
    t: `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`,
    text: liveTexts[Math.floor(Math.random() * liveTexts.length)],
  });
  MOCK.today.pop();
  $("#today").innerHTML = MOCK.today
    .map((t) => `<li><span class="t">${t.t}</span><span>${t.text}</span></li>`)
    .join("");
}, 9000);
