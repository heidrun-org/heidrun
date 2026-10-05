# Herdr Desk

Interface graphique macOS pour [Herdr](https://herdr.dev) : les agents et les terminaux de ta session Herdr, dans une fenêtre de travail.

- **Sidebar** : file « À traiter » (agents bloqués ou terminés), workspaces, panneaux.
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

**Copier du texte** : par défaut, glisser sélectionne et **⌘C** copie (⌘V colle). Dans le menu « A » de la barre du haut, l’option « Souris pour l’app » renvoie la molette et les clics à Herdr et aux agents ; dans ce mode, **⌥ + glisser** sélectionne toujours.

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
herdr                    # démarre le serveur si besoin, puis ctrl+b q pour te détacher
npm run tauri dev
```

## Construire l’app

```sh
npm run tauri build
open src-tauri/target/release/bundle/macos/
```

Glisse `Herdr Desk.app` dans `/Applications`.

## Contexte et quotas

### Claude Code

Le script `scripts/claude-statusline.sh` sert de status line à Claude Code. Il affiche une ligne compacte et, quand Claude tourne dans un panneau Herdr, envoie les chiffres à Herdr (`herdr pane report-metadata`). Herdr Desk les lit ensuite.

Dans `~/.claude/settings.json` :

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/Projects/HerdrDesk/scripts/claude-statusline.sh"
  }
}
```

Il faut `jq` (inclus dans macOS 15, sinon `brew install jq`). Si tu as déjà une status line, garde la tienne et ajoute seulement le bloc « Report to Herdr » du script.

Les quotas 5 h et semaine n’apparaissent qu’avec un abonnement Pro ou Max, après la première réponse de la session.

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

## Limites connues

- **Un seul serveur** : la machine locale. La connexion à un VPS viendra ensuite.
- **Boutons d’approbation** : « Toujours » envoie la touche `2` du menu de Claude Code. Pour les autres agents, seuls Autoriser (Entrée) et Refuser (Échap) sont proposés.
- **Redimensionnement** : afficher un panneau dans l’app adapte sa taille à la fenêtre. Si le même panneau est ouvert dans le TUI Herdr, l’affichage peut s’y ajuster aussi.
