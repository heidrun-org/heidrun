---
title: "Agents : lancer un agent préconfiguré (rôle, modèle, consigne)"
labels: fonctionnalité,backlog,priorité-moyenne,effort-M
---

## Contexte

Les projets définissent des agents (`.claude/agents/bruno.md`, `lohan.md`…) avec un rôle et un modèle. Pour en démarrer un, il faut créer un onglet, lancer `claude`, puis donner la consigne de départ.

## Objectif

Un bouton « Nouvel agent » qui fait tout en une fois.

## Comportement attendu

1. « Nouvel agent » dans la barre d'onglets et dans ⌘K.
2. Choix : agent du projet (liste lue dans `.claude/agents/`) ou agent libre ; modèle ; consigne de départ (modèles de consignes acceptés).
3. L'app crée un onglet nommé d'après l'agent, lance Claude (ou Codex) et envoie la consigne quand il est prêt.

## Pistes techniques

- `tab.create` + `pane.run` (`herdr pane run`) avec la commande `claude --model … --agent …` (vérifier les options disponibles).
- Attendre l'état « idle » de l'agent avant d'envoyer la consigne (`pane.wait_for_output` ou événement d'état).
- Lecture des agents du projet côté Rust (frontmatter `name`, `model`, `description`).

## Critères d'acceptation

- [ ] Agents du projet listés avec leur description.
- [ ] Onglet nommé, agent lancé, consigne envoyée une fois l'agent prêt.

## Hors périmètre

- Éditer les fichiers d'agents depuis l'app.
