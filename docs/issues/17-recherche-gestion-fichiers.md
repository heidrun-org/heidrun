---
title: "Fichiers : recherche dans le projet, créer / renommer / supprimer, diff du fichier"
labels: fonctionnalité,backlog,priorité-basse,effort-S
---

## Contexte

Une fois l'explorateur et l'édition en place, quelques gestes manquent pour éviter d'ouvrir un autre outil.

## Objectif

Chercher du texte dans tout le projet et gérer les fichiers simplement.

## Comportement attendu

1. Recherche dans le projet (texte ou expression régulière), résultats groupés par fichier, clic = fichier ouvert à la ligne.
2. Créer un fichier ou un dossier, renommer, supprimer (vers la Corbeille du Mac, jamais définitivement).
3. « Voir mes changements » : diff git du fichier ouvert ; lien vers la fenêtre Git pour committer.

## Pistes techniques

- `git grep -n -I` (rapide, respecte `.gitignore`), avec limite de résultats.
- Corbeille : API macOS (`trash` / NSFileManager) côté Rust.

## Critères d'acceptation

- [ ] Recherche en moins d'une seconde sur un projet moyen.
- [ ] Supprimer passe toujours par la Corbeille.

## Hors périmètre

- Rechercher-remplacer dans tout le projet.
