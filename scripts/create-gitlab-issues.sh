#!/bin/sh
# Crée le projet GitLab de Herdr Desk (si besoin), pousse le dépôt, puis ouvre une
# issue par fichier de docs/issues/ (titre et labels dans l'en-tête du fichier).
#
#   sh scripts/create-gitlab-issues.sh --dry-run          # montre ce qui serait fait
#   sh scripts/create-gitlab-issues.sh --create-project   # crée didheclick/herdr-desk, pousse, ouvre les issues
#   sh scripts/create-gitlab-issues.sh                    # ouvre seulement les issues manquantes
#
# Prérequis : glab connecté à gitlab.com (`glab auth status`). Relançable sans
# doublon : une issue dont le titre existe déjà est ignorée.

set -eu
export GITLAB_HOST=gitlab.com
GROUP=${GROUP:-didheclick}
NAME=${NAME:-herdr-desk}
PROJECT="$GROUP/$NAME"
ASSIGNEE=${ASSIGNEE:-edefiez}
DRY=0
CREATE=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --create-project) CREATE=1 ;;
    *) echo "option inconnue : $a" >&2; exit 2 ;;
  esac
done
cd "$(dirname "$0")/.."
run() { if [ "$DRY" = 1 ]; then echo "  [simulation] $*"; else "$@"; fi; }

command -v glab >/dev/null || { echo "glab introuvable : brew install glab" >&2; exit 1; }
# Only gitlab.com matters here: another configured instance (a self-hosted GitLab
# that is unreachable right now) must not block the script.
glab auth status --hostname gitlab.com >/dev/null 2>&1 || { echo "glab n'est pas connecté à gitlab.com : glab auth login --hostname gitlab.com" >&2; exit 1; }

# ---- 1. Projet et push --------------------------------------------------------
if [ "$CREATE" = 1 ]; then
  echo "Projet $PROJECT"
  if glab repo view "$PROJECT" >/dev/null 2>&1; then
    echo "  existe déjà"
  else
    run glab repo create "$NAME" --group "$GROUP" --private \
      --description "Interface graphique macOS pour Herdr (agents IA en terminal)"
  fi
  if ! git remote get-url origin >/dev/null 2>&1; then
    run git remote add origin "git@gitlab.com:$PROJECT.git"
  fi
  run git push -u origin "$(git rev-parse --abbrev-ref HEAD)"
fi

# ---- 2. Labels ------------------------------------------------------------------
echo "Labels"
label() {
  if glab label list -R "$PROJECT" 2>/dev/null | grep -Fq -- "$1"; then return; fi
  run glab label create -R "$PROJECT" --name "$1" --color "$2" --description "$3" >/dev/null || true
}
label "fonctionnalité"   "#6699cc" "Nouvelle fonction"
label "bug"              "#d9534f" "Défaut à corriger"
label "backlog"          "#8e8e8e" "À planifier"
label "en-cours"         "#3fb8af" "En cours de réalisation"
label "bloqué"           "#f2a93b" "En attente d'une décision ou d'une dépendance"
label "sécurité"         "#c0392b" "Sujet de sécurité"
label "priorité-haute"   "#e74c3c" "À faire en premier"
label "priorité-moyenne" "#f39c12" "Ensuite"
label "priorité-basse"   "#95a5a6" "Plus tard"
label "effort-S"         "#7ec699" "Moins d'une journée"
label "effort-M"         "#f6c06a" "Quelques jours"
label "effort-L"         "#e58a8a" "Une semaine ou plus"

# ---- 3. Issues ------------------------------------------------------------------
echo "Issues"
existing=$(glab issue list -R "$PROJECT" --all --per-page 100 2>/dev/null || true)
for f in docs/issues/*.md; do
  title=$(sed -n 's/^title: "\(.*\)"$/\1/p' "$f" | head -1)
  labels=$(sed -n 's/^labels: //p' "$f" | head -1)
  body=$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2' "$f")
  if printf '%s\n' "$existing" | grep -Fq -- "$title"; then
    echo "  déjà ouverte : $title"
    continue
  fi
  echo "  + $title  [$labels]"
  run glab issue create -R "$PROJECT" --title "$title" --description "$body" \
    --label "$labels" --assignee "$ASSIGNEE" --yes >/dev/null
done
echo "Terminé : https://gitlab.com/$PROJECT/-/issues"
