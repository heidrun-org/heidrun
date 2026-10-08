---
title: "Fichiers : modifier un fichier dans l'app (éditeur CodeMirror, ⌘S, conflits avec les agents)"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

Une petite retouche (une valeur de config, une faute, une ligne) oblige à ouvrir un éditeur à côté ou à demander à l'agent.

## Objectif

Retoucher un fichier directement depuis l'explorateur, avec un vrai éditeur de code, sans tout l'écosystème de VS Code.

## Comportement attendu

1. Bouton « Modifier » (comme sur GitLab / GitHub) dans la vue d'un fichier.
2. Éditeur : coloration par langage, curseurs multiples, chercher / remplacer, indentation automatique, parenthèses.
3. ⌘S enregistre ; un point dans l'onglet signale une modification non enregistrée ; fermer avec des changements demande confirmation.
4. Option « Voir le diff avant d'enregistrer ».
5. Si le fichier a changé sur le disque depuis l'ouverture (un agent l'a modifié) : pas d'écrasement silencieux, choix entre recharger, comparer, écraser.
6. Avertissement quand un agent travaille dans ce projet au moment de l'édition.

## Pistes techniques

- CodeMirror 6 (léger, modulaire) plutôt que Monaco (plusieurs Mo).
- Rust `file_write(root, path, content, expected_mtime)` : racine connue, chemin sûr, jamais dans `.git`, refus si le fichier a changé (mtime / taille), écriture atomique (fichier temporaire puis renommage), droits conservés.

## Critères d'acceptation

- [ ] Aucune écriture hors du dossier du projet ni dans `.git`.
- [ ] Une modification de l'agent pendant l'édition n'est jamais écrasée sans le dire.
- [ ] Undo / redo, ⌘S, chercher / remplacer fonctionnent.

## Hors périmètre

- Extensions, terminal intégré, débogueur, LSP (complétion intelligente).
