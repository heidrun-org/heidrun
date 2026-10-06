---
title: "Consignes : bibliothèque de modèles réutilisables avec variables"
labels: fonctionnalité,backlog,priorité-moyenne,effort-S
---

## Contexte

Les mêmes consignes reviennent tous les jours : « fais la revue de la MR », `/fin-tache`, « écris la note de reprise », « où en est Jérôme ? ». On les retape à chaque fois. Les notes épinglées servent déjà un peu à ça, mais sans variables ni accès rapide.

## Objectif

Envoyer une consigne fréquente en deux clics (ou depuis ⌘K), adaptée au workspace courant.

## Comportement attendu

1. Un onglet ou une section « Modèles » liste les consignes enregistrées.
2. Un modèle peut contenir des variables : `{workspace}`, `{onglet}`, `{branche}`, `{selection}` (texte sélectionné dans le terminal), `{presse-papiers}`.
3. Choisir un modèle remplit la barre de saisie (modifiable avant envoi) ou l'envoie directement à l'agent sélectionné.
4. Les modèles apparaissent dans la palette ⌘K (« Consigne : revue de MR »).

## Pistes techniques

- Stockage : modèles personnels en local (comme les notes) + modèles de projet dans `.herdr-desk.json` (section `prompts`), versionnés.
- Variables résolues côté front ; `{branche}` via une commande Rust `git rev-parse --abbrev-ref HEAD` dans le dossier du panneau.
- Réutiliser `InputBar.vue` (textarea multiligne) et `CommandPalette.vue`.

## Critères d'acceptation

- [ ] Créer, renommer, réordonner, supprimer un modèle.
- [ ] Les variables sont remplacées au moment de l'envoi ; une variable inconnue reste visible telle quelle.
- [ ] Modèles de projet lus dans `.herdr-desk.json` et proposés seulement dans ce projet.
- [ ] Accessible depuis ⌘K.

## Hors périmètre

- Partage des modèles entre machines (hors le fichier du projet).
