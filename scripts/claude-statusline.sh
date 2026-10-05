#!/bin/sh
# Herdr Desk — status line for Claude Code.
#
# 1. Prints a compact line at the bottom of Claude Code (model · context · quotas).
# 2. When Claude runs inside a Herdr pane, reports the same numbers to Herdr as
#    pane tokens, which Herdr Desk (and Herdr's own sidebar) can display.
#
# Install: in ~/.claude/settings.json
#   "statusLine": { "type": "command", "command": "~/Projects/HerdrDesk/scripts/claude-statusline.sh" }
# Requires jq (shipped with macOS 15+, otherwise `brew install jq`).

input=$(cat)

get() {
  printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null
}

model=$(get '.model.display_name')
ctx=$(get '.context_window.used_percentage')
ctx_size=$(get '.context_window.context_window_size')
q5=$(get '.rate_limits.five_hour.used_percentage')
q5_reset=$(get '.rate_limits.five_hour.resets_at')
q7=$(get '.rate_limits.seven_day.used_percentage')
q7_reset=$(get '.rate_limits.seven_day.resets_at')
cost=$(get '.cost.total_cost_usd')

round() {
  [ -n "$1" ] && printf '%.0f' "$1" 2>/dev/null
}

# ---- Report to Herdr (in the background, never slows the status line) -------
if [ -n "$HERDR_PANE_ID" ]; then
  herdr_bin=${HERDR_BIN_PATH:-herdr}
  if command -v "$herdr_bin" >/dev/null 2>&1; then
    set -- --source user:herdr-desk --token "hd_ts=$(date +%s)"
    [ -n "$model" ] && set -- "$@" --token "hd_model=$model"
    [ -n "$ctx" ] && set -- "$@" --token "hd_ctx=$(round "$ctx")"
    [ -n "$ctx_size" ] && set -- "$@" --token "hd_ctx_size=$ctx_size"
    [ -n "$q5" ] && set -- "$@" --token "hd_q5h=$(round "$q5")"
    [ -n "$q5_reset" ] && set -- "$@" --token "hd_q5h_reset=$q5_reset"
    [ -n "$q7" ] && set -- "$@" --token "hd_q7d=$(round "$q7")"
    [ -n "$q7_reset" ] && set -- "$@" --token "hd_q7d_reset=$q7_reset"
    [ -n "$cost" ] && set -- "$@" --token "hd_cost=$cost"
    ("$herdr_bin" pane report-metadata "$HERDR_PANE_ID" "$@" >/dev/null 2>&1 &)
  fi
fi

# ---- The line shown in Claude Code -----------------------------------------
line=""
[ -n "$model" ] && line="$model"
[ -n "$ctx" ] && line="$line · contexte $(round "$ctx")%"
[ -n "$q5" ] && line="$line · 5h $(round "$q5")%"
[ -n "$q7" ] && line="$line · semaine $(round "$q7")%"
printf '%s\n' "${line# · }"
