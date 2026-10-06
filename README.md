# Herdr Desk

Interface graphique macOS pour [Herdr](https://herdr.dev) : les agents et les terminaux de ta session Herdr, dans une fenêtre de travail.

- **Sidebar** : workspaces, panneaux, puis la file « À traiter » (agents bloqués ou terminés) en bas, pour ne pas décaler la liste.
- **Vrais terminaux** : chaque panneau est affiché avec `herdr terminal attach`, donc le rendu est identique à Herdr (TUI de Claude Code, Codex, couleurs…).
- **Barre de saisie** : une consigne pour un agent, ou une commande pour un terminal.
- **Inspecteur** : Autoriser / Refuser, contexte de l’agent, « Demander à un agent de corriger », surveillance de motifs.
- **Status bar** : quotas Claude (5 h, semaine) et Codex.
- **Palette ⌘K** pour toutes les actions.
- Police du terminal au choix (Geist Mono, SF Mono, JetBrains Mono, Fira Code, Menlo, Monaco), réglable dans le bouton « A » de la barre du haut.

## Raccourcis

| Raccourci | Action |
| --- | --- |
| ⌘K | Palette de commandes |
| ⌘T | Nouveau terminal (nouvel onglet) |
| ⌥⌘← / ⌥⌘→ | Onglet précédent / suivant |
| ⌥⌘↑ / ⌥⌘↓ | Workspace précédent / suivant |
| ⌘1 … ⌘9 | Aller au workspace n° 1 à 9 (ordre de la barre latérale) |
| ⇧⌥⌘← / ⇧⌥⌘→ | Déplacer l’onglet à gauche / à droite |
| ⇧⌥⌘↑ / ⇧⌥⌘↓ | Monter / descendre le workspace |
| ⌘D / ⇧⌘D | Diviser le panneau à droite / en bas |
| ⌘W ⌘W | Fermer le panneau sélectionné (deux fois, pour éviter les accidents) |
| ⌘B / ⌥⌘B | Masquer la barre latérale gauche / le panneau de droite |
| ⌘+ / ⌘− / ⌘0 | Agrandir / réduire / réinitialiser la police |
| ⇧⌘P | Épingler le texte sélectionné dans une note |
| ⇧↵ / ⌥↵ | Nouvelle ligne (dans le terminal comme dans la barre de saisie) ; ↵ envoie |

**Jauges** : vert jusqu’à 60 %, orange de 60 à 80 %, rouge au-delà (contexte, session 5 h, semaine). Les dernières valeurs connues restent affichées entre deux réponses.

**Molette** : fait défiler l’historique du panneau (remonter dans la conversation d’un agent). **⌥ + molette** envoie ↑/↓ à la place, pour parcourir les dernières commandes ou consignes.

**Copier du texte** : par défaut, glisser sélectionne et **⌘C** copie (⌘V colle). Dans le menu « A » de la barre du haut, l’option « Souris pour l’app » renvoie la molette et les clics à Herdr et aux agents ; dans ce mode, **⌥ + glisser** sélectionne toujours.

**Notes épinglées** : sélectionne du texte dans un terminal, puis « Épingler » (ou ⇧⌘P). La note apparaît dans l’onglet **Notes** du panneau de droite, avec sa provenance ; tu peux la renommer (double-clic), la copier ou l’envoyer à un agent. Le bouton ⤢ (ou un double-clic sur le texte) l’ouvre dans une fenêtre centrale qu’on peut déplacer par son titre, redimensionner par le coin bas-droit et modifier ; sa taille est mémorisée. Les notes restent sur ce Mac, jamais dans le repo : une sortie de terminal peut contenir des secrets.

**Actions** : l’onglet **Actions** du panneau de droite liste les commandes du projet (`make dev`, `npm install`, `ngrok http 3000`…). Un clic ouvre un onglet Herdr à leur nom et lance la commande ; le bouton indique « en cours » tant qu’elle tourne, et un second clic ramène à son onglet. Les actions sont enregistrées dans `.herdr-desk.json` à la racine du repo, à versionner avec le code :

```json
{
  "version": 1,
  "actions": [
    { "id": "dev", "label": "make dev", "command": "make dev" },
    { "id": "tunnel", "label": "ngrok", "command": "ngrok http 3000" },
    { "id": "front", "label": "front", "command": "npm run dev", "cwd": "web" }
  ]
}
```

Les scripts de `package.json`, les cibles du `Makefile`, le `Procfile` et quelques commandes Flutter, Cargo ou Symfony sont proposés en suggestions. Les commandes lancées récemment apparaissent dans **Récentes**, entre les actions et les suggestions. Actions, suggestions et notes se réordonnent par glisser-déposer (l’ordre des actions est écrit dans `.herdr-desk.json`, celui des suggestions et l’historique restent sur ce Mac).

**Références colorées** : dans les terminaux, les issues (`#12`), merge requests et pull requests (`!34`, `MR !34`, `PR #5`, `groupe/app#7`) et les commits (`abc1234`) sont colorés ; **⌘-clic** sur une issue, une MR ou une PR l’ouvre dans une fenêtre de l’app (description et commentaires rendus en Markdown, Centré / Pleine largeur, ⌘+/− pour la taille, « Ouvrir sur GitLab/GitHub ↗ ») ; au survol, « ↗ Ouvrir » l’ouvre dans le navigateur et « ⧉ Aperçu » dans l’app. Les commits s’ouvrent sur GitLab ou GitHub, d’après le `git remote` du dossier du panneau (les URL s’ouvrent aussi au ⌘-clic). Le texte envoyé par l’agent n’est pas modifié : la couleur est posée par-dessus. Réglages facultatifs dans `.herdr-desk.json` :

```json
"references": {
  "forge": "gitlab",
  "repo": "https://gitlab.example.com/groupe/app",
  "tickets": { "url": "https://acme.atlassian.net/browse/{key}", "prefixes": ["ABC", "OPS"] },
  "enabled": true
}
```

`forge` force GitHub ou GitLab (un hôte inconnu est traité comme un GitLab auto-hébergé), `repo` remplace le remote, `tickets` active les tickets du type `ABC-123` (désactivés sans URL).

**Actions au survol** : dans un terminal, survoler une référence affiche « ↗ Ouvrir », une commande de Claude Code citée par l’agent (`/fin-tache`, `/compact`…) affiche « ▷ Lancer », et un point d’une liste numérotée (« 1. Ouvrir une issue… ») affiche « ▷ Faire le point 1 », qui envoie la consigne à l’agent. Une commande proposée par Claude en mode shell (`! docker builder prune -af && …`) affiche « ▷ Exécuter » : elle est remise sur une seule ligne si elle s’étale sur plusieurs (retour à la ligne, `\`, `&&`, `|`), puis envoyée dans la zone de saisie de Claude avec Entrée. ⌘-clic sur le texte fait la même chose. Seules les commandes qui existent vraiment sont proposées (intégrées, `~/.claude/commands`, `.claude/commands` du projet, skills et plugins), jamais un chemin comme `/tmp`.

**Agents de Claude** : la liste affichée sous la zone de saisie (`● main`, `○ jerome-645 …`) est cliquable : « ▷ Voir jerome-645 » envoie à Claude ↓ jusqu’à la ligne puis Entrée, comme si tu y allais avec les flèches. Cliquer sur `main` ramène à la conversation principale.

**Panneau de droite** : en haut, la **Session** du panneau sélectionné (workspace · onglet, état, contexte, coût, Remote Control) ; en dessous, **Tous les agents** : quotas du compte Claude et Codex, partagés par toutes les sessions, et le fil **Activité** (workspace · onglet, puis l’agent ; clic pour y aller).

Les éléments **terminés** (fil Activité, cartes « À traiter » terminées) disparaissent tout seuls après 15 min par défaut ; le délai se règle dans le menu « A » (5 min, 15 min, 1 h, jamais). Les agents bloqués restent affichés.

**Répondre aux menus d'un agent bloqué** : quand Claude (ou Codex) affiche un menu numéroté (« 1. Yes / 2. Yes, and don't ask again… / 3. No »), ses options apparaissent en boutons sur la carte « À traiter » et dans le panneau de droite, avec la commande ou le fichier concerné. Un clic envoie le numéro de l'option. Si le même menu est encore là un instant plus tard, l'app passe par les flèches et Entrée ; elle n'agit jamais sur un nouveau dialogue sans que tu le voies.

**Garde-fous** : avant d'envoyer une commande d'un clic (« ▷ Exécuter » sur un `!`, actions, barre de saisie, palette, réponse « Yes » à un menu d'autorisation), l'app la compare à une liste de motifs dangereux (`rm -rf`, `prune -af`, `push --force`, `reset --hard`, `DROP TABLE`, `DELETE` sans `WHERE`, fusion de MR, actions sur la prod…). En cas de correspondance, une fenêtre affiche la commande complète et demande confirmation ; « Annuler » est sélectionné par défaut. Règles du projet dans `.herdr-desk.json` :

```json
"guards": {
  "confirm": ["deploy", "make release"],
  "block": ["make prod-reset"]
}
```

`block` empêche l'envoi depuis l'app. Si le fichier est illisible, toutes les commandes demandent confirmation.

**Onglet Git** (panneau de droite) : pour le workspace sélectionné, branche, avance / retard sur le remote, fichiers modifiés, dernier commit, état de la CI de la branche, et la liste des **MR (GitLab) ou PR (GitHub)** ouvertes avec leur état (prête, CI en cours, à approuver, conflit…). Un clic ouvre la MR ; « Demander une revue » l'envoie à l'agent du workspace. L'hébergeur est déduit du remote (`references.forge` pour le forcer). L'app passe par `glab` et `gh` déjà connectés sur le Mac, en lecture seule : aucun jeton n'est stocké. Dans la barre latérale, `↑2` signale des commits pas encore poussés.

**Modèles de consignes** : le bouton ☰ de la barre de saisie liste tes modèles (« Revue de la MR », « Note de reprise »…) et ceux du projet. Un clic insère le texte, modifiable avant l'envoi ; « Enregistrer la saisie comme modèle » en crée un, sur ce Mac ou dans le projet. Ils sont aussi dans la palette ⌘K (section Consignes). Variables remplacées à l'insertion : `{workspace}`, `{onglet}`, `{agent}`, `{branche}`, `{selection}` (texte sélectionné dans un terminal), `{presse-papiers}`. Modèles du projet dans `.herdr-desk.json` :

```json
"prompts": [{ "id": "revue", "label": "Revue de la MR", "text": "Fais la revue de la MR de {branche}" }]
```

**Diffuser une consigne** : « Plusieurs agents… » dans le menu destinataire de la barre de saisie. Coche les agents (raccourcis : tous ceux du workspace, tous les Claude), écris, « Diffuser » : un récapitulatif liste les destinataires avant l'envoi. Les agents bloqués sont ignorés et signalés ; les variables des modèles sont remplies pour chaque agent ; une commande `!` passe par les garde-fous de chaque projet.

**Notifications** (menu « A ») : rappel quand un agent reste bloqué (5 min par défaut), contexte d'un agent au-delà de 80 %, quota Claude au-delà de 80 % puis 95 %, résumé de la journée à l'heure choisie (travaux terminés par workspace), heures calmes sans notification (par ex. 20:00 → 08:00, alertes reportées après).

**Questions de l'agent** : quand un agent termine sa réponse par une question (« Veux-tu que je m'attaque à #44 ? »), l'app la repère, même si l'onglet n'est pas affiché. Une carte violette **QUESTION** apparaît dans « À traiter », avec la question, et une notification « … te pose une question » remplace « a terminé ». La carte reste jusqu'à ta réponse ou jusqu'à ce que tu la fermes. Les agents **bloqués** (menu d'autorisation) sont en rouge.

Une carte « À traiter » fermée avec × reste fermée, même après un redémarrage de l’app, jusqu’au prochain changement d’état de l’agent.

**Redimensionner** : tire la bordure de la barre de gauche ou du panneau de droite ; la zone centrale s’ajuste. Double-clic sur la bordure pour revenir à la largeur par défaut. Les largeurs sont mémorisées.

**Renommer** : double-clic sur un workspace, un onglet, ou un panneau (dans la liste « Panneaux » ou dans son en-tête). Pour un panneau, un nom vide rend le nom automatique (agent ou titre du terminal). Les noms sont enregistrés dans Herdr.

**Réorganiser** : glisser-déposer les workspaces dans la barre de gauche et les onglets dans la barre d’onglets. L’ordre est enregistré dans Herdr.

Fermer un onglet : le × qui apparaît au survol de l’onglet (deux clics). Fermer un panneau : le × de son en-tête, ou ⌘W deux fois.
- Notifications macOS quand un agent passe en bloqué ou termine.

Tout passe par le serveur Herdr : fermer l’app n’arrête rien, et tu retrouves les mêmes agents depuis l’iPhone en SSH.

## Prérequis

```sh
herdr --version          # Herdr 0.9 ou plus
rustc --version          # Rust stable (rustup)
node --version           # Node 20 ou plus
xcode-select --install   # outils de compilation Apple, si besoin
```

## Lancer en développement

```sh
cd ~/Projects/HerdrDesk
npm install
npm run tauri dev
```

Pas besoin d’ouvrir `herdr` dans un terminal : si le serveur ne tourne pas, l’app le démarre en arrière-plan (option « Démarrer Herdr automatiquement »). Il reste actif quand tu fermes l’app, jusqu’à `herdr server stop` ou au redémarrage du Mac.

## Construire l’app

```sh
npm run tauri build
open src-tauri/target/release/bundle/macos/
```

Glisse `Herdr Desk.app` dans `/Applications`.

## Contexte et quotas

### Claude Code

Claude Code transmet le contexte et les quotas (5 h, semaine) à sa status line. Herdr Desk s’y branche : clique sur **« Activer le suivi Claude »** (panneau de droite d’un agent Claude, ou barre du bas). L’app :

- copie `scripts/claude-statusline.sh` dans `~/.config/herdr-desk/` ;
- garde ta status line actuelle dans `~/.config/herdr-desk/claude-statusline-next`, qui continue d’être affichée telle quelle dans le terminal ;
- pointe `statusLine.command` de `~/.claude/settings.json` vers le script (sauvegarde : `settings.json.herdr-desk-backup`).

Claude Code recharge ses réglages tout seul ; les chiffres arrivent à la réponse suivante. Pour gagner une ligne dans le terminal, décoche **« Afficher aussi la status line dans le terminal »** : le script n’affiche plus rien, mais continue d’envoyer les chiffres à l’app. « Désactiver le suivi Claude » rétablit ta status line d’origine. Il faut `jq` (inclus dans macOS 15, sinon `brew install jq`). Les quotas n’existent qu’avec un abonnement Pro ou Max.

### Remote Control (Claude Code)

Dans le panneau de droite d’un agent Claude, le bloc **Remote Control** indique si la session est connectée (badge **RC** dans la liste des panneaux) et propose **Activer Remote Control**, qui envoie `/remote-control` à l’agent. Une fois connecté, **Afficher l’URL et le QR code** ouvre une fenêtre avec le lien de la session (copier, ouvrir dans le navigateur) et un QR code à scanner avec le téléphone, généré localement par l’app. La case « Activer pour toutes les nouvelles sessions Claude » écrit `remoteControlAtStartup: true` dans `~/.claude/settings.json`. L’état est lu dans l’indicateur `/rc active` que Claude Code affiche sous la zone de saisie ; il n’apparaît pas si le terminal est trop étroit. Abonnement Pro, Max, Team ou Enterprise requis.

### Codex

Rien à configurer : Herdr Desk lit les journaux `~/.codex/sessions/**/rollout-*.jsonl` (dernier événement `token_count`). Pour relier un journal au bon panneau, installe l’intégration Herdr :

```sh
herdr integration install codex
```

Ce format n’est pas une API officielle d’OpenAI : si une mise à jour de Codex le change, la jauge Codex disparaît simplement, sans casser l’app.

## Architecture

```
src-tauri/src/
  herdr.rs   client du socket ~/.config/herdr/herdr.sock (JSON ligne par ligne),
             abonnements aux événements, reconnexion automatique
  pty.rs     pseudo-terminaux qui exécutent `herdr terminal attach <terminal_id>`
  usage.rs   lecture des journaux Codex
  lib.rs     commandes Tauri exposées au front
src/
  stores/session.ts   état : snapshot Herdr, sélection, notifications, actions
  components/         TopBar, Sidebar, TabBar, PaneGrid, PaneCard, TerminalView,
                      InputBar, Inspector, StatusBar, CommandPalette
```

Le front charge `session.snapshot` au démarrage, puis traite chaque événement Herdr comme un signal de rafraîchissement (c’est la méthode recommandée par la doc de l’API). Un rafraîchissement de secours a lieu toutes les 5 s.

Pour une session nommée, lance l’app avec `HERDR_SESSION=<nom>`.

## Pistes

Idées notées pour plus tard, pas encore faites. Chacune est détaillée dans `docs/issues/` (contexte, comportement attendu, pistes techniques, critères d'acceptation) et devient une issue GitLab avec :

```sh
sh scripts/create-gitlab-issues.sh --dry-run          # aperçu
sh scripts/create-gitlab-issues.sh --create-project   # crée didheclick/herdr-desk, pousse, ouvre les issues
```

Modèles d'issues pour la suite : `.gitlab/issue_templates/` (Fonctionnalité, Bug).

1. **Vue multiple des panneaux Herdr** (à faire en premier : c'est la plus fiable). Un « Ouvrir à côté » sur un agent : le premier ouvert divise l'écran verticalement, chaque agent suivant divise horizontalement la colonne où sont déjà les agents ouverts, pour tous les voir travailler en même temps. Repose sur ce que Herdr sait déjà faire (`pane.split`, disposition de l'onglet lue par l'app).
2. **Barre de saisie partagée, avec choix du destinataire.** En bas, un seul champ et un menu pour choisir l'agent (workspace · onglet). Envoi direct pour un panneau Herdr ; pour un sous-agent d'une session Claude, l'app bascule d'abord dessus avec les touches, puis envoie (petit délai, un seul sous-agent à la fois).
3. **Mosaïque des sous-agents d'une session Claude** (main, Bruno, jerome-645…). Ils vivent dans un seul terminal et Claude Code n'en montre qu'un à la fois : pas de vrai terminal par sous-agent. À la place, un aperçu en lecture seule des dernières lignes de chacun, rafraîchi régulièrement ; un clic sur une case bascule le vrai terminal sur ce sous-agent.

## Limites connues

- **Un seul serveur** : la machine locale. La connexion à un VPS viendra ensuite.
- **Boutons d’approbation** : « Toujours » envoie la touche `2` du menu de Claude Code. Pour les autres agents, seuls Autoriser (Entrée) et Refuser (Échap) sont proposés.
- **Redimensionnement** : afficher un panneau dans l’app adapte sa taille à la fenêtre. Si le même panneau est ouvert dans le TUI Herdr, l’affichage peut s’y ajuster aussi.
