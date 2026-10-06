---
title: "Recherche : chercher dans la sortie de tous les terminaux (⇧⌘F)"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

Avec une dizaine de workspaces, on ne sait plus quel agent a parlé de #419, de `dashmenu1` ou d'une erreur précise. Il faut ouvrir chaque onglet et faire défiler.

## Objectif

Une recherche globale dans ce que les agents et les terminaux ont affiché, avec accès direct au bon panneau.

## Comportement attendu

1. ⇧⌘F ouvre une fenêtre de recherche.
2. Les résultats sont groupés par workspace · onglet, avec la ligne trouvée et quelques lignes de contexte.
3. Un clic ouvre le panneau ; idéalement, le terminal défile jusqu'à la ligne.
4. Filtres : workspace, agents seulement, expressions régulières.

## Pistes techniques

- `pane.read` avec une profondeur suffisante (historique Herdr) sur chaque panneau, en parallèle et avec une limite.
- Option : index local léger mis à jour au fil des événements, pour éviter de tout relire.
- Défilement jusqu'au résultat : molette envoyée à Herdr (déjà utilisée dans `TerminalView.vue`) ou mode copie de Herdr si l'API le permet.

## Critères d'acceptation

- [ ] Résultats en moins de 2 s sur 30 panneaux.
- [ ] Clic sur un résultat : bon workspace, bon onglet, bon panneau.
- [ ] Recherche insensible à la casse et aux accents par défaut.

## Hors périmètre

- Recherche dans les fichiers des projets.
