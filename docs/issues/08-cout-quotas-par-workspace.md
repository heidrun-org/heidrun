---
title: "Quotas : consommation Claude par workspace"
labels: fonctionnalité,backlog,priorité-basse,effort-S
---

## Contexte

On voit les quotas du compte (5 h, semaine) mais pas quel projet les consomme. Avec plusieurs Claude en parallèle, savoir lequel a mangé la moitié de la session aide à arbitrer.

## Objectif

Répartir la consommation (coût estimé et évolution des quotas) par workspace.

## Comportement attendu

1. Dans « Tous les agents », un tableau : workspace, coût estimé de la journée, part de la consommation.
2. Mini-graphique sur la session 5 h en cours.
3. Survol : détail par agent.

## Pistes techniques

- La status line transmet déjà `hd_cost` par panneau ; mémoriser les deltas par panneau et les rattacher au workspace.
- Les quotas sont globaux : estimer la part par le coût relatif sur la fenêtre.

## Critères d'acceptation

- [ ] Totaux cohérents avec le coût affiché par session.
- [ ] Remise à zéro avec la fenêtre 5 h.

## Hors périmètre

- Codex (pas de coût exposé de la même manière) dans un premier temps.
