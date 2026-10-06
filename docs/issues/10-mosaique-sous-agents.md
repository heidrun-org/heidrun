---
title: "Claude : mosaïque des sous-agents d'une session (main, Bruno…)"
labels: fonctionnalité,backlog,priorité-basse,effort-L
---

## Contexte

Une session Claude peut lancer des sous-agents (main, Bruno, jerome-645…) affichés dans la liste sous la zone de saisie. Ils vivent dans un seul terminal et Claude Code n'en montre qu'un à la fois. La liste est déjà cliquable (« ▷ Voir … ») mais on ne voit qu'un agent à la fois.

## Objectif

Voir d'un coup d'œil ce que fait chaque sous-agent.

## Comportement attendu

1. Bouton « Mosaïque » sur un panneau Claude qui a des sous-agents.
2. Une case par sous-agent, avec ses dernières lignes, en lecture seule, rafraîchie régulièrement.
3. Clic sur une case : le vrai terminal bascule sur ce sous-agent.

## Pistes techniques

- Contrainte : pas d'API officielle pour lire un sous-agent sans l'afficher. Pistes : journaux de session Claude (`~/.claude/projects/**.jsonl`) qui contiennent les messages des sous-agents, ou bascule rapide automatique (moins fiable).
- Bascule : `switchToAgent` dans `TerminalView.vue`.

## Critères d'acceptation

- [ ] Aperçu fidèle sans perturber le terminal principal.
- [ ] Clic → bascule sur le bon sous-agent.

## Hors périmètre

- Écrire directement à un sous-agent depuis la mosaïque (voir l'issue « barre de saisie partagée »).
