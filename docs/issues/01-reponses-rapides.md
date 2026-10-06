---
title: "À traiter : répondre aux questions de Claude sans ouvrir l'onglet"
labels: fonctionnalité,backlog,priorité-haute,effort-S
---

## Contexte

Quand un agent Claude attend une décision, il affiche un menu numéroté (« 1. Yes / 2. Yes, and don't ask again / 3. No ») ou pose une question à choix. Aujourd'hui, la carte « À traiter » propose seulement Autoriser (Entrée), Toujours (touche 2) et Refuser (Échap), sans montrer les vraies options. Il faut ouvrir l'onglet pour lire la question.

## Objectif

Lire la question et choisir une réponse directement depuis la carte « À traiter » ou le panneau de droite, sans changer d'onglet.

## Comportement attendu

1. Un agent passe en « bloqué ».
2. La carte affiche la question (première ligne) et un bouton par option détectée à l'écran (« 1. Oui », « 2. Oui, ne plus demander », « 3. Non… »).
3. Un clic envoie la touche de l'option (ou ↓ × n puis Entrée si le menu ne prend pas les chiffres).
4. La carte se met à jour (l'agent repart) ; en cas d'échec, message clair.

## Pistes techniques

- Lire l'écran du panneau : `pane.read` (source `recent_unwrapped`), comme pour Remote Control (`stores/claude.ts`, `readRc`).
- Parser le bloc de choix : lignes `^\s*[❯>]?\s*(\d+)\.\s+(.+)$` sous la question ; repérer l'option sélectionnée (`❯`).
- Envoi : `pane.send_keys` (`["1"]`, `["2"]`…) ; repli sur flèches + Entrée.
- Composants : `Sidebar.vue` (cartes), `Inspector.vue` (bloc Autoriser / Refuser).
- Rafraîchir à chaque changement d'état (événement `pane.agent_status_changed`).

## Critères d'acceptation

- [ ] Les options affichées correspondent exactement à celles du terminal (libellés et ordre).
- [ ] Un clic choisit la bonne option, vérifié sur les menus d'autorisation de Claude Code.
- [ ] Sans option détectée, on garde Autoriser / Refuser comme aujourd'hui.
- [ ] Fonctionne aussi pour Codex quand son menu est numéroté.

## Hors périmètre

- Répondre par texte libre (c'est la barre de saisie).
