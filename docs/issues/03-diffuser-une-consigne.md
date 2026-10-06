---
title: "Saisie : envoyer la même consigne à plusieurs agents"
labels: fonctionnalité,backlog,priorité-moyenne,effort-S
---

## Contexte

En fin de journée ou avant une MEP, on demande la même chose à tous les agents actifs : « commitez et écrivez la note de reprise », « arrêtez-vous, on reprend demain ». Il faut aujourd'hui passer d'onglet en onglet.

## Objectif

Choisir plusieurs destinataires dans la barre de saisie et envoyer une seule fois.

## Comportement attendu

1. Le menu destinataire de la barre de saisie permet une sélection multiple, avec des raccourcis « Tous les agents de ce workspace », « Tous les Claude actifs ».
2. Avant l'envoi, un récapitulatif indique qui va recevoir le message.
3. L'envoi part vers chaque agent ; un agent bloqué n'est pas forcé (message « X attend une décision, non envoyé »).
4. Un toast résume : « Envoyé à 4 agents, 1 ignoré (bloqué) ».

## Pistes techniques

- `agent.prompt` en boucle (`stores/session.ts`, `sendPrompt`), avec gestion de l'erreur `agent_blocked`.
- `agentGroups` (déjà groupé par workspace) pour construire le menu.

## Critères d'acceptation

- [ ] Sélection multiple et raccourcis de groupe.
- [ ] Récapitulatif avant envoi, annulable.
- [ ] Agents bloqués ignorés et signalés.

## Hors périmètre

- Diffusion vers les sous-agents internes d'une session Claude (voir l'issue « mosaïque »).
