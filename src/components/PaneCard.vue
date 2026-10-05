<script setup lang="ts">
import { computed } from "vue";
import TerminalView from "./TerminalView.vue";
import { contextFor, selectPane, state } from "../stores/session";
import { gaugeLevel, paneName } from "../lib/format";
import type { AgentInfo } from "../lib/types";

const props = defineProps<{ pane: AgentInfo }>();

const selected = computed(() => state.selectedPaneId === props.pane.pane_id);
const status = computed(() => (props.pane.agent ? props.pane.agent_status : "process"));
const ctx = computed(() => contextFor(props.pane));
const subtitle = computed(() => {
  const p = props.pane;
  const kind = p.agent ?? "shell";
  const extra = p.agent ? "" : p.terminal_title_stripped ? ` · ${p.terminal_title_stripped}` : "";
  return `${kind} · ${p.pane_id}${extra}`;
});
</script>

<template>
  <section
    class="pane"
    :class="[status, { selected }]"
    @mousedown="selectPane(pane)"
  >
    <div v-if="status === 'working'" class="sweep" aria-hidden="true"><span></span></div>
    <header class="head">
      <span class="dot" :class="[status, state.pulse[pane.pane_id] ? 'pulse' : '']"></span>
      <span class="name">{{ paneName(pane) }}</span>
      <span class="sub">{{ subtitle }}</span>
      <span class="spacer"></span>
      <template v-if="ctx">
        <span class="sub">contexte</span>
        <span class="gauge" :class="gaugeLevel(ctx.percent)" style="width: 72px">
          <span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span>
        </span>
        <span class="mono pct" :class="'lvl-' + gaugeLevel(ctx.percent)">{{ Math.round(ctx.percent) }} %</span>
      </template>
    </header>
    <TerminalView :key="pane.terminal_id" :terminal-id="pane.terminal_id" :focused="selected" />
  </section>
</template>

<style scoped>
.pane { height: 100%; display: flex; flex-direction: column; background: var(--bg); position: relative; }
.pane.blocked { box-shadow: inset 0 0 0 1px #4a3a1e; }
.pane.selected { box-shadow: inset 0 0 0 1px #33506f; }
.pane.blocked.selected { box-shadow: inset 0 0 0 1px #6b5226; }
.sweep { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; background: #12302d; z-index: 1; }
.sweep span {
  position: absolute; top: 0; left: 0; width: 40%; height: 2px;
  background: linear-gradient(90deg, rgba(63, 184, 175, 0), var(--working), rgba(63, 184, 175, 0));
  animation: sweep 2.4s ease-in-out infinite;
}
.head {
  height: 34px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 14px;
  border-bottom: 1px solid #1a1d20; font-size: 12px;
}
.pane.blocked .head { background: #15120d; border-bottom-color: #2b2418; }
.name { font-weight: 600; white-space: nowrap; }
.sub { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spacer { flex: 1; }
.pct { color: var(--text-2); }
.lvl-warn { color: var(--blocked); }
.lvl-crit { color: var(--fail); }
</style>
