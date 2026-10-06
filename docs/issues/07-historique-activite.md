---
title: "Activité : historique conservé et temps passé par projet"
labels: fonctionnalité,backlog,priorité-basse,effort-M
---

## Contexte

Le fil Activité ne vit que pendant que l'app est ouverte et les éléments terminés disparaissent après un délai. Impossible de savoir ce que les agents ont fait hier, ni combien de temps a été passé sur un projet (utile pour le suivi et la facturation).

## Objectif

Un historique consultable et un cumul du temps de travail des agents par workspace.

## Comportement attendu

1. Chaque travail (début, fin, durée, workspace, onglet, agent, résumé) est enregistré localement.
2. Vue « Historique » : filtre par jour / semaine / workspace / agent.
3. Totaux par workspace sur la période ; export CSV.
4. Le délai de disparition du fil Activité reste indépendant de l'historique.

## Pistes techniques

- Les travaux existent déjà (`trackRun` dans `stores/session.ts`) ; les écrire dans un fichier local (JSON lignes) via une commande Rust, ou SQLite.
- Résumé : titre du panneau ou dernière ligne utile de la sortie au moment de la fin.

## Critères d'acceptation

- [ ] L'historique survit au redémarrage de l'app et du Mac.
- [ ] Totaux justes (pas de double comptage d'un travail repris après une autorisation).
- [ ] Export CSV.

## Hors périmètre

- Synchronisation entre machines.
