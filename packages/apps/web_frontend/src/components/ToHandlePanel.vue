<script setup lang="ts">
import { answerChoice, attention, dismiss, selectPane, state, tabLabel, workspaceLabel } from "../stores/session";
import { statusLabel, ago, paneName } from "../lib/format";
import Icon from "./Icon.vue";
import { isPinned, togglePinnedPane } from "../stores/pinned_panes";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

/** The line under the name of the agent: its question, the reason it is blocked, or what it finished. */
function summary(p: AgentInfo): string {
  const q = state.questions[p.pane_id];
  if (q && p.agent_status !== "blocked") return q.text;
  if (p.agent_status === "blocked") return p.state_labels?.blocked || p.title || t("toHandlePanel.waitingForDecision");
  return p.title || p.terminal_title_stripped || t("toHandlePanel.workDoneToReview");
}
</script>

<template>
  <section class="to-handle" :aria-label="t('toHandlePanel.label')">
    <p v-if="attention.length === 0" class="empty">{{ t("toHandlePanel.empty") }}</p>
    <div v-for="p in attention" :key="p.pane_id" class="card" :class="[p.agent_status, { question: p.agent_status !== 'blocked' && state.questions[p.pane_id] }]">
      <button :title="t('toHandlePanel.showPane')" class="card-main" @click="selectPane(p)">
        <span class="row">
          <span class="name">{{ workspaceLabel(p.workspace_id) }} – {{ tabLabel(p.tab_id) }}</span>
          <span v-if="p.agent_status !== 'blocked' && state.questions[p.pane_id]" class="badge t-question">{{ t("toHandlePanel.question") }}</span>
          <span v-else class="badge" :class="'t-' + p.agent_status">{{ statusLabel(p.agent_status).toUpperCase() }}</span>
        </span>
        <span class="desc"><span class="who">{{ paneName(p) }}</span> · {{ summary(p) }}</span>
        <span v-if="state.since[p.pane_id]" class="when">{{ ago(state.since[p.pane_id]) }}</span>
      </button>
      <!-- The agent's own menu: answer without opening its tab. -->
      <div v-if="p.agent_status === 'blocked' && state.choices[p.pane_id]" class="choices">
        <pre v-if="state.choices[p.pane_id].detail" class="choice-d mono">{{ state.choices[p.pane_id].detail }}</pre>
        <span v-if="state.choices[p.pane_id].question" class="choice-q">{{ state.choices[p.pane_id].question }}</span>
        <button
          v-for="o in state.choices[p.pane_id].options"
          :key="o.n"
          class="choice"
          :title="o.label"
          @click="answerChoice(p.pane_id, o.n)"
        >
          <span class="choice-n">{{ o.n }}</span><span class="choice-l">{{ o.label }}</span>
        </button>
      </div>
      <button
        class="card-pin"
        :class="{ on: isPinned(p.pane_id) }"
        :aria-label="isPinned(p.pane_id) ? t('toHandlePanel.unpinLabel', { name: paneName(p) }) : t('toHandlePanel.pinLabel', { name: paneName(p) })"
        :title="isPinned(p.pane_id) ? t('toHandlePanel.unpinTitle') : t('toHandlePanel.pinTitle')"
        @click="togglePinnedPane(p.pane_id)"
      ><Icon :name="isPinned(p.pane_id) ? 'pin-fill' : 'pin'" /></button>
      <button class="card-x" :aria-label="t('toHandlePanel.hideLabel', { name: paneName(p) })" :title="t('toHandlePanel.hideTitle')" @click="dismiss(p)">
        <Icon name="x-lg" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.to-handle { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px 6px 16px; }
.empty { margin: 0; padding: 8px; color: var(--muted); font-size: var(--font-size); }
.card { position: relative; border-radius: 10px; border: 1px solid #22344f; background: var(--tint-done); }
.card-main {
  width: 100%; text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 12px 34px 12px 12px;
  border: none; background: transparent; border-radius: 10px;
}
.card-x {
  position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px;
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-x:hover, .card-pin:hover { background: rgba(var(--wash), 0.08); color: var(--text); }
.card-pin {
  position: absolute; top: 34px; right: 8px; width: 22px; height: 22px; border: none; border-radius: 6px; font-size: var(--font-size);
  background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.card-pin.on { color: var(--accent); }
.card.blocked { border-color: var(--pane-ring-blocked); background: var(--tint-err); }
.choices { display: flex; flex-direction: column; gap: 4px; padding: 0 10px 10px; }
.choice-d {
  margin: 0 0 2px; padding: 6px 8px; border-radius: 6px; background: var(--tint-err); color: var(--text-2);
  font-size: var(--font-size); white-space: pre-wrap; word-break: break-all; max-height: 84px; overflow: hidden;
}
.choice-q { font-size: var(--font-size); color: var(--text-2); margin: 0 2px 2px; }
.choice {
  display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 8px; border-radius: 7px;
  border: 1px solid var(--choice-border); background: var(--choice-bg); color: var(--text); text-align: left;
  font-size: var(--font-size);
}
.choice:hover { background: var(--choice-hover-bg); border-color: var(--pane-ring-blocked-selected); }
.choice-n { flex-shrink: 0; width: 18px; height: 18px; border-radius: 5px; background: var(--choice-number-bg); color: var(--blocked);
  font: 600 var(--font-size) var(--mono); display: inline-flex; align-items: center; justify-content: center; }
.choice-l { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card.question { border-color: #4a3866; background: var(--tint-merged); }
.card .row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.name { font-size: var(--font-size); font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { flex-shrink: 0; }
.who { color: var(--text); font-weight: 500; }
.badge { font-size: var(--font-size); font-weight: 600; letter-spacing: 0.4px; }
.desc { font-size: var(--font-size); color: #b8bcc0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.when { font-size: var(--font-size); color: var(--muted); }
</style>
