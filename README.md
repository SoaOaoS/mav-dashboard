# Mav

Interface web de **Mav**, ton compagnon IA. Simple et chaleureuse : on lui parle,
il retient, il surveille et il agit en arrière-plan.

> ⚠️ **Mode mock** — démo statique sur GitHub Pages. Aucune donnée réelle,
> aucune authentification, aucun backend branché. À terme : accès restreint par
> VPN, branchement de l'agent réel.

## Stack

- HTML / CSS / JS vanilla, zéro dépendance, zéro build.
- Déploiement : GitHub Pages.

## Structure

```
.
├── index.html
└── assets
    ├── css/style.css
    └── js/app.js
```

## Écrans

- **Accueil** — salutation, barre de message, raccourcis, résumé du jour et automatisations.
- **Discussions** — fil de chat continu avec réponses simulées et indicateur de frappe.
- **Automatisations** — les tâches que Mav fait tout seul (planning, état).
- **Souvenirs** — ce que Mav retient d'une conversation à l'autre.
- **Surveillance** — ce que Mav surveille (web, mails, serveurs, santé), alerte seulement au changement.

## Lancer en local

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Prochaines étapes

- [ ] Brancher l'agent réel (chat + actions).
- [ ] Accès restreint par VPN.
- [ ] Réponses en streaming.
- [ ] Personnalisation finale (nom, ton, données).
