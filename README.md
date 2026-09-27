# MAV — Command Interface

Interface web de pilotage de **Mav**, l'agent IA. Style HUD/JARVIS : réacteur central,
métriques système, console de commande, jobs, mémoire et veille.

> ⚠️ **Mode mock** — cette version est une démo statique déployée sur GitHub Pages.
> Aucune donnée réelle, aucune authentification, aucune commande exécutée.
> Le backend (agent, Postgres, actions réelles) sera branché plus tard.

## Stack

- HTML / CSS / JS vanilla, zéro dépendance, zéro build.
- Canvas 2D pour le réacteur animé.
- Déploiement : GitHub Pages.

## Structure

```
.
├── index.html
└── assets
    ├── css/style.css
    └── js/app.js
```

## Vues

- **Overview** — réacteur, métriques, jobs, flux, tâches actives.
- **Console** — terminal simulé avec commandes (`aide`, `status`, `jobs`, `mémoire`, `veille`, `clear`).
- **Jobs** — table des jobs planifiés.
- **Mémoire** — timeline des échanges mémorisés.
- **Veille** — items surveillés (web, mail, github, proxmox, health).

## Lancer en local

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Prochaines étapes

- [ ] Brancher l'API réelle de l'agent.
- [ ] Auth / accès restreint (VPN).
- [ ] Streaming des réponses de la console.
- [ ] Thème et branding définitifs (couleurs, voix, nom).
