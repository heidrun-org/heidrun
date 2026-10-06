---
title: "Saisie : choisir le destinataire, y compris un sous-agent Claude"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

La barre de saisie du bas envoie au panneau sélectionné. Avec la vue multiple et les sous-agents, on veut écrire à un agent précis sans d'abord aller dessus.

## Objectif

Un seul champ en bas et un menu pour choisir le destinataire : panneau Herdr ou sous-agent d'une session Claude.

## Comportement attendu

1. Le menu liste les panneaux (workspace · onglet) et, en dessous, les sous-agents de chaque session Claude.
2. Panneau Herdr : envoi direct.
3. Sous-agent : l'app bascule la session sur lui (touches), envoie, puis revient éventuellement sur `main`.
4. Indication pendant la bascule ; erreur claire si la liste n'est pas trouvée.

## Pistes techniques

- Liste des sous-agents : lecture de l'écran (`agentListState` dans `src/lib/refs.ts`) ou des journaux de session.
- Envoi : `switchToAgent` + `agent.prompt`.

## Critères d'acceptation

- [ ] Envoi fiable à un sous-agent, sans laisser la session sur le mauvais agent.
- [ ] Un seul sous-agent à la fois (pas de diffusion).

## Hors périmètre

- Diffusion multiple (issue dédiée).
