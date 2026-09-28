# Mav

Interface web de **Mav**, ton compagnon IA. Simple et chaleureuse : on lui parle,
il retient, il surveille et il agit en arrière-plan.

Deux modes :

- **LIVE** — servi par la VM, branchée sur l'agent réel : jobs, mémoire (Postgres),
  veille, état des services, et un vrai chat qui passe par une session dédiée.
- **MOCK** — repli automatique si l'API n'est pas joignable (ex. GitHub Pages) :
  l'UI reste consultable avec des données simulées.

## Architecture

```
Navigateur (VPN)
      │
      ▼
mav_api.py  ── HTTP :8787 ──►  sert l'UI + /api/*
      │
      ├──► opencode serve :4096  (moteur, agents, sessions)
      └──► Postgres mav (Docker)  (conversations, facts, watch_items…)
```

Le dashboard utilise **sa propre session opencode** (`dashboard`), distincte de la
session Telegram, pour ne jamais perturber le bot qui tourne en parallèle.

## Stack

- Front : HTML / CSS / JS vanilla, zéro dépendance, zéro build.
- Back : Python stdlib (`http.server`) + `psycopg2` (déjà dans le venv du bot).
- Déploiement : GitHub Pages (mock) ou VM privée (live, via VPN).

## Structure

```
.
├── index.html
├── assets
│   ├── css/style.css
│   └── js/app.js          # mode live + fallback mock
└── server
    ├── mav_api.py         # backend lecture + /api/ask
    └── run.sh             # lanceur (watchdog cron)
```

## API

| Méthode | Route                 | Rôle                                |
| ------- | --------------------- | ----------------------------------- |
| GET     | `/api/status`         | santé moteur, métriques, compteurs  |
| GET     | `/api/jobs`           | jobs planifiés + dernière exécution |
| GET     | `/api/memory`         | conversations, facts, préférences   |
| GET     | `/api/watch`          | items surveillés                    |
| GET     | `/api/agents`         | agents disponibles                  |
| GET     | `/api/connections`    | état des services                   |
| GET     | `/api/sessions`       | liste des discussions du dashboard  |
| GET     | `/api/session?id=`    | messages + titre d'une discussion   |
| POST    | `/api/ask`            | envoie un prompt (param. `session`) |
| POST    | `/api/session/new`    | crée une discussion                 |
| POST    | `/api/session/rename` | renomme une discussion              |
| POST    | `/api/session/delete` | supprime une discussion             |

### Sessions

Les discussions du dashboard sont des sessions opencode dont le titre commence
par `dash: ` — ce préfixe les distingue des sessions Telegram et des jobs, sans
registre local. Le front propose un gestionnaire type ChatGPT : créer, lister,
ouvrir, renommer, supprimer.

> ⚠️ **Pas d'authentification** : à réserver à un accès VPN. Ne pas exposer tel quel.

## Lancer en local

Front seul (mock) :

```bash
python3 -m http.server 8080
```

Avec le backend (live) :

```bash
MAV_STATIC="$PWD" BOT_DIR="$HOME/bot" \
  ~/bot/venv/bin/python server/mav_api.py
# http://localhost:8787
```

## Écrans

- **Accueil** — salutation, barre de message, raccourcis, résumé du jour, automatisations.
- **Discussions** — gestionnaire de conversations (créer, renommer, supprimer, basculer) + chat avec l'agent.
- **Automatisations** — jobs planifiés, planning, état.
- **Souvenirs** — ce que Mav retient (conversations, faits, préférences).
- **Surveillance** — ce que Mav surveille, alerte seulement au changement.

## Design

Feuilles de style « glass » façon iOS 26 : surfaces en verre dépoli
(`backdrop-filter`), halos colorés animés en fond, liserés lumineux, ombres
douces. Repli automatique sur fond opaque si `backdrop-filter` n'est pas
supporté.

## PWA (installation sur mobile)

L'app est installable comme une appli native : `manifest.webmanifest`,
service worker (`sw.js`), icônes et bandeau d'installation.

**Contrainte** : le service worker et l'installabilité exigent un **contexte
sécurisé** (HTTPS, ou `localhost`). En HTTP sur une IP, Chrome n'expose pas
`navigator.serviceWorker` et l'install n'est pas proposée.

- **Mock GitHub Pages** : déjà en HTTPS → installable directement.
- **Live sur le VLAN** : HTTP sur IP → il faut le TLS local décrit ci-dessous.

### TLS local

Le service écoute en **HTTP :80** _et_ **HTTPS :443** avec un certificat local
(`certs/`, non committé). Le dossier `certs/` n'est jamais servi, sauf la CA
publique `certs/ca.crt`.

Pour installer sur le téléphone (une fois sur le VLAN) :

1. Ouvrir `https://192.168.1.32/certs/ca.crt` et approuver le certificat.
2. Ouvrir `https://192.168.1.32/`, puis « Ajouter à l'écran d'accueil ».

Variables d'env. du serveur : `MAV_TLS_PORT`, `MAV_TLS_CERT`, `MAV_TLS_KEY`
(laisser `MAV_TLS_PORT=0` pour désactiver le TLS).

### Régénérer le certificat

```bash
python3 tools/make_icons.py          # icônes
tools/make_certs.sh                  # CA + cert serveur (SAN: IP/DNS à ajuster)
```

## Prochaines étapes

- [ ] Accès restreint par VPN (pare-feu côté hyperviseur).
- [ ] Réponses en streaming (SSE via le bus opencode).
- [ ] Actions depuis l'UI (lancer un job, éditer une surveillance).
- [ ] Personnalisation finale (nom, ton, données).
