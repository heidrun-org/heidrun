---
title: "Fichiers : explorateur du projet en lecture (arborescence, état git, recherche ⌘P)"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

Pour regarder un fichier pendant qu'un agent travaille, il faut ouvrir un autre éditeur. L'onglet Git ne montre que les fichiers modifiés.

## Objectif

Parcourir et lire tous les fichiers du projet depuis l'app, comme l'explorateur de VS Code, sans quitter Herdr Desk.

## Comportement attendu

1. Icône 📁 à côté de « Dossier » dans le panneau de droite, entrée « Ouvrir un fichier » dans ⌘K, raccourci dédié.
2. Grande fenêtre : arborescence à gauche (redimensionnable, masquable), fichier à droite.
3. Dossiers chargés à l'ouverture ; fichiers ignorés par `.gitignore` masqués (option pour les voir).
4. État git sur chaque fichier et dossier : modifié, ajouté, non suivi.
5. Recherche rapide par nom (fuzzy) : « ckscr/serv/user » trouve `CKScreener/services/user.ts`.
6. Affichage : coloration, numéros de ligne, thèmes et ⌘+/− de la fenêtre Git, Markdown rendu ou brut, aperçu des images, refus propre des fichiers binaires ou trop gros.
7. Onglets de fichiers ouverts, fil d'Ariane cliquable, « Copier le chemin », « Voir dans le Finder », « Ouvrir dans VS Code ».
8. « Envoyer à l'agent » : insère `@chemin` dans la barre de saisie ; une sélection de lignes peut partir avec « Explique » / « Corrige ces lignes ».
9. Dans les terminaux, `src/app.ts:42` cité par un agent est cliquable et ouvre le fichier à la ligne.

## Pistes techniques

- Rust : liste des fichiers via `git ls-files -co --exclude-standard` (suivis + non suivis non ignorés), et parcours du disque pour les dépôts non git ; mêmes protections que `git_file` (racine connue, pas de `..`, liens symboliques vérifiés).
- Lecture : réutiliser `git_file` (rev vide = disque) et l'affichage de `GitModal.vue`.
- Images : lecture en base64 côté Rust, limite de taille.

## Critères d'acceptation

- [ ] Un projet de 20 000 fichiers s'ouvre en moins d'une seconde (chargement par dossier).
- [ ] Aucun fichier hors du dossier du projet n'est lisible.
- [ ] ⌘P trouve un fichier en quelques lettres.

## Hors périmètre

- Modifier les fichiers (issue « édition »).
