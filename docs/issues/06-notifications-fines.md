---
title: "Notifications : agent bloqué trop longtemps, contexte plein, quota proche"
labels: fonctionnalité,backlog,priorité-moyenne,effort-S
---

## Contexte

L'app notifie aujourd'hui quand un agent passe en bloqué ou termine. On rate encore : un agent bloqué depuis 10 minutes pendant qu'on est ailleurs, un contexte qui frôle la limite, un quota 5 h qui va être atteint en pleine journée.

## Objectif

Être prévenu au bon moment, sans être noyé.

## Comportement attendu

1. Rappel quand un agent reste bloqué plus de N minutes (réglable, 5 par défaut), une seule fois.
2. Alerte quand le contexte d'un agent dépasse 80 % (« pense à /compact »).
3. Alerte quand le quota Claude 5 h dépasse 80 %, puis 95 %.
4. Option « résumé du soir » : liste des travaux terminés de la journée par workspace.
5. Réglages dans le menu « A » : activer / désactiver chaque type, heures calmes.

## Pistes techniques

- Données déjà disponibles : `state.since`, `contextFor`, `quotas` (`stores/session.ts`).
- Notifications : `lib/notify.ts` (plugin Tauri), avec anti-répétition par clé.

## Critères d'acceptation

- [ ] Chaque type de notification se déclenche une seule fois par épisode.
- [ ] Réglages persistés ; heures calmes respectées.
- [ ] Clic sur la notification : ouvre le bon panneau.

## Hors périmètre

- Notifications sur le téléphone (voir l'issue « accès iPhone / iPad »).
