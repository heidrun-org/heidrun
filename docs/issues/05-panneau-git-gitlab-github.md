---
title: "Workspace : panneau Git et MR / PR (GitLab et GitHub)"
labels: fonctionnalité,backlog,priorité-haute,effort-M
---

## Contexte

Les agents travaillent dans des branches et ouvrent des MR. Pour savoir où en est un workspace (branche, fichiers modifiés, commits non poussés, MR ouvertes, état de la CI), il faut aujourd'hui demander à l'agent ou aller sur GitLab. La plupart des projets sont sur GitLab (`gitlab.com/didheclick/…`), certains sur GitHub (`github.com/edefiez/…`) : l'outil doit gérer les deux.

## Objectif

Voir l'état Git et les MR / PR de chaque workspace dans l'app, quel que soit l'hébergeur.

## Comportement attendu

1. Dans le panneau de droite, une section « Git » pour le workspace sélectionné : branche, en avance / en retard sur le remote, fichiers modifiés, dernier commit.
2. Liste des MR (GitLab) ou PR (GitHub) ouvertes de ce dépôt : titre, auteur, état de la CI, approbations, lien.
3. Pastille dans la barre latérale quand un workspace a des commits non poussés ou une CI en échec.
4. Clic sur une MR : ouverture dans le navigateur ; bouton « Demander une revue à <agent> ».

## Pistes techniques

- **Détection de l'hébergeur** : déjà faite pour les références (`src/lib/refs.ts`, `remoteToWeb`, `forge`) ; un hôte inconnu est traité comme un GitLab auto-hébergé ; réglage `references.forge` dans `.herdr-desk.json`.
- **Couche d'abstraction** `Forge` (GitLab / GitHub) avec les mêmes opérations : `listOpenRequests`, `pipelineStatus`, `requestUrl`.
- **Deux options d'accès, à trancher dans cette issue** :
  - via les CLI `glab` et `gh` déjà connectés sur le Mac (pas de jeton à gérer dans l'app ; `GITLAB_HOST=gitlab.com`) ;
  - via les API REST avec un jeton personnel rangé dans le trousseau macOS (plus rapide, pas de dépendance aux CLI).
- Git local : commandes Rust (`git status --porcelain=v2 --branch`, `git log -1`), rafraîchies à intervalle et au changement d'état des agents.
- Cache et limitation des appels (une requête par dépôt toutes les 60 s au plus).

## Critères d'acceptation

- [ ] Fonctionne sur un dépôt GitLab (gitlab.com et auto-hébergé) et sur un dépôt GitHub.
- [ ] Aucun jeton écrit en clair (ni dans `.herdr-desk.json`, ni dans les journaux).
- [ ] Section masquée proprement si le dossier n'est pas un dépôt Git ou sans accès à l'hébergeur.
- [ ] Pastille « non poussé » / « CI en échec » dans la barre latérale.

## Hors périmètre

- Fusionner ou approuver depuis l'app (reste une action humaine sur l'hébergeur).
