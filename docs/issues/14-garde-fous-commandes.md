---
title: "Sécurité : confirmation avant les commandes destructives"
labels: fonctionnalité,backlog,priorité-haute,effort-S,sécurité
---

## Contexte

L'app propose « ▷ Exécuter » sur les commandes `!` de Claude et « ▷ Lancer » sur les actions. Un clic suffit pour lancer `rm -rf`, `docker … prune -af`, `DROP TABLE` ou `git push --force`.

## Objectif

Rien de destructif ne part sans une confirmation explicite.

## Comportement attendu

1. Avant l'envoi, la commande est comparée à une liste de motifs dangereux.
2. En cas de correspondance : fenêtre de confirmation qui affiche la commande complète et le motif reconnu ; bouton « Exécuter quand même ».
3. Liste par défaut + liste du projet dans `.herdr-desk.json` (`guards.confirm`, `guards.block`) ; `block` interdit l'envoi.
4. S'applique aux commandes `!`, aux actions, à la barre de saisie en mode commande.

## Pistes techniques

- Motifs par défaut : `rm -rf`, `prune -af`, `--force`, `push -f`, `DROP`, `TRUNCATE`, `reset --hard`, `mkfs`, `dd if=`, `> /dev/`, `chmod -R 777`, commandes vers `prod`.
- Point d'entrée unique avant `sendPrompt` / `runInPane` / `runInNewPane`.

## Critères d'acceptation

- [ ] Toutes les commandes dangereuses de la liste déclenchent la confirmation, quel que soit le chemin d'envoi.
- [ ] `guards.block` empêche l'envoi et l'explique.
- [ ] Pas de faux positif sur les commandes courantes (`npm run build`, `git status`).

## Hors périmètre

- Contrôle des commandes que l'agent lance lui-même (c'est le rôle des permissions de Claude Code).
