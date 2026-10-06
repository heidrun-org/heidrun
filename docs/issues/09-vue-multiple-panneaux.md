---
title: "Affichage : ouvrir des agents côte à côte (vue multiple)"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

On veut suivre plusieurs agents en même temps, y compris de workspaces différents, sans passer d'onglet en onglet.

## Objectif

« Ouvrir à côté » un agent : il s'ajoute à une vue partagée où tous les agents ouverts sont visibles et utilisables.

## Comportement attendu

1. Sur un agent (barre latérale, Activité, carte « À traiter ») : « Ouvrir à côté ».
2. Premier agent ouvert à côté : l'écran se divise verticalement (vue courante à gauche, agent à droite).
3. Agents suivants : la colonne de droite se divise horizontalement, un agent par ligne.
4. Chaque case est un vrai terminal (attach) avec son en-tête (workspace · onglet, état, contexte) et un ×.
5. La vue est mémorisée.

## Pistes techniques

- Vue propre à l'app (pas un onglet Herdr), composée de `TerminalView` existants ; un terminal peut être attaché plusieurs fois (attach multiple Herdr) — vérifier la taille partagée.
- Alternative : créer un vrai onglet Herdr de « suivi » avec `pane.split`, mais un panneau ne peut pas appartenir à deux onglets.
- Réutiliser `PaneCard.vue` et `Resizer.vue`.

## Critères d'acceptation

- [ ] Disposition verticale puis horizontale comme décrite.
- [ ] Fermer une case réorganise les autres.
- [ ] Saisie au clavier dans chaque case.

## Hors périmètre

- Sous-agents d'une session Claude (voir l'issue « mosaïque »).
