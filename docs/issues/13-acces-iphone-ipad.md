---
title: "Mobile : suivre et piloter les agents depuis l'iPhone / l'iPad"
labels: fonctionnalité,backlog,priorité-basse,effort-L
---

## Contexte

C'était l'objectif de départ : garder la main hors du bureau. Remote Control de Claude couvre une session à la fois, pas la vue d'ensemble (« À traiter », plusieurs workspaces, Codex).

## Objectif

Depuis le téléphone : voir ce qui attend une décision, autoriser / refuser, envoyer une consigne, lire la fin de la sortie d'un agent.

## Comportement attendu

1. L'app expose une petite interface web, désactivée par défaut.
2. Accès : réseau local, ou tunnel (Tailscale recommandé) ; appairage par QR code.
3. Écrans : « À traiter », liste des agents, détail d'un agent (dernières lignes, boutons), saisie.

## Pistes techniques

- Serveur HTTP + WebSocket dans le processus Rust, au-dessus du client Herdr existant.
- Sécurité : jeton d'appairage, HTTPS (ou tunnel chiffré), aucune exposition publique par défaut.
- Interface : réutiliser les composants Vue en version responsive, ou PWA dédiée.

## Critères d'acceptation

- [ ] Désactivé par défaut ; activation explicite avec QR d'appairage.
- [ ] Aucun accès sans jeton ; révocation possible.
- [ ] Autoriser / refuser / envoyer une consigne fonctionnent depuis l'iPhone.

## Hors périmètre

- Terminal complet sur mobile.
