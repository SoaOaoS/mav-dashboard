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

| Méthode | Route              | Rôle                                    |
| ------- | ------------------ | --------------------------------------- |
| GET     | `/api/status`      | santé moteur, métriques, compteurs      |
| GET     | `/api/jobs`        | jobs planifiés + dernière exécution     |
| GET     | `/api/memory`      | conversations, facts, préférences       |
| GET     | `/api/watch`       | items surveillés                        |
| GET     | `/api/agents`      | agents disponibles                      |
| GET     | `/api/connections` | état des services                       |
| POST    | `/api/ask`         | envoie un prompt à la session dashboard |

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
- **Discussions** — fil de chat continu (vrai agent en live).
- **Automatisations** — jobs planifiés, planning, état.
- **Souvenirs** — ce que Mav retient (conversations, faits, préférences).
- **Surveillance** — ce que Mav surveille, alerte seulement au changement.

## Prochaines étapes

- [ ] Accès restreint par VPN (pare-feu côté hyperviseur).
- [ ] Réponses en streaming (SSE via le bus opencode).
- [ ] Actions depuis l'UI (lancer un job, éditer une surveillance).
- [ ] Personnalisation finale (nom, ton, données).
