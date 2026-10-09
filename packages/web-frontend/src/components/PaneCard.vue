<script setup lang="ts">
import { computed } from "vue";
import TerminalView from "./TerminalView.vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { closePane, contextFor, finishRename, paneFullName, selectPane, splitPane, startRename, state } from "../stores/session";
import { dockState, isDocked, toggleDock, undock } from "../stores/dock";
import { mosaic } from "../stores/mosaic";
import { gaugeLevel, paneName } from "../lib/format";
import { pinText } from "../stores/notes";
import type { AgentInfo } from "../lib/types";

// `docked`: shown in the "à côté" column, outside its own tab.
const props = defineProps<{ pane: AgentInfo; docked?: boolean }>();

const selected = computed(() =>
  props.docked ? dockState.focus === props.pane.pane_id : state.selectedPaneId === props.pane.pane_id && !dockState.focus,
);
const pinned = computed(() => isDocked(props.pane.pane_id));
// A click in a docked pane gives it the keyboard without leaving the current tab.
function onDown() {
  if (props.docked) dockState.focus = props.pane.pane_id;
  else {
    selectPane(props.pane);
    dockState.focus = null;
  }
}
const status = computed(() => (props.pane.agent ? props.pane.agent_status : "process"));
const ctx = computed(() => contextFor(props.pane));
const subtitle = computed(() => {
  const p = props.pane;
  const kind = p.agent ?? "shell";
  const extra = p.agent ? "" : p.terminal_title_stripped ? ` · ${p.terminal_title_stripped}` : "";
  if (props.docked) return paneFullName(p);
  return `${kind} · ${p.pane_id}${extra}`;
});
</script>

<template>
  <section
    class="pane"
    :class="[status, { selected, docked }]"
    @mousedown="onDown"
  >
    <div v-if="status === 'working'" class="sweep" aria-hidden="true"><span></span></div>
    <header class="head">
      <span class="dot" :class="[status, state.pulse[pane.pane_id] ? 'pulse' : '']"></span>
      <InlineRename
        v-if="state.renaming === `pane:${pane.pane_id}`"
        class="pane-rename"
        :value="pane.label || paneName(pane)"
        label="Nouveau nom du panneau (vide pour revenir au nom automatique)"
        allow-empty
        @save="(v) => finishRename('pane', pane.pane_id, v)"
        @cancel="state.renaming = null"
      />
      <span v-else class="name" title="Double-clic pour renommer" @dblclick="startRename('pane', pane.pane_id)">{{ paneName(pane) }}</span>
      <span class="sub">{{ subtitle }}</span>
      <span class="spacer"></span>
      <template v-if="ctx">
        <span class="sub">contexte</span>
        <span class="gauge" :class="gaugeLevel(ctx.percent)" style="width: 110px">
          <span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span>
        </span>
        <span class="mono pct" :class="'lvl-' + gaugeLevel(ctx.percent)">{{ Math.round(ctx.percent) }} %</span>
      </template>
      <span class="tools">
        <template v-if="docked">
          <button class="tool txt" title="Aller à son onglet" @mousedown.stop @click="selectPane(pane)">↗</button>
          <button class="tool" aria-label="Retirer de la vue à côté" title="Retirer de la vue à côté (l’agent continue)" @mousedown.stop @click="undock(pane.pane_id)">
            <Icon name="close" />
          </button>
        </template>
        <template v-else>
        <button
          v-if="(pane.agent ?? '').includes('claude')"
          class="tool txt"
          title="Mosaïque : ce que fait chaque agent de cette session (main, sous-agents)"
          aria-label="Mosaïque des agents de la session"
          @mousedown.stop
          @click="mosaic.paneId = pane.pane_id"
        >▦</button>
        <button
          class="tool"
          :class="{ on: pinned }"
          :aria-pressed="pinned"
          :title="pinned ? 'Ne plus garder à côté' : 'Garder à côté : reste visible quand tu changes d’onglet ou de workspace'"
          @mousedown.stop
          @click="toggleDock(pane.pane_id)"
        >
          <Icon :name="pinned ? 'pin-fill' : 'pin'" />
        </button>
        <button class="tool" aria-label="Diviser à droite" title="Diviser à droite (⌘D)" @mousedown.stop @click="splitPane('right', pane.pane_id)">
          <Icon name="split-right" />
        </button>
        <button class="tool" aria-label="Diviser en bas" title="Diviser en bas (⇧⌘D)" @mousedown.stop @click="splitPane('down', pane.pane_id)">
          <Icon name="split-down" />
        </button>
        <ConfirmButton label="×" aria-label="Fermer le panneau (⌘W)" @confirm="closePane(pane.pane_id)" />
        </template>
      </span>
    </header>
    <TerminalView
      :key="pane.terminal_id"
      :terminal-id="pane.terminal_id"
      :pane-id="pane.pane_id"
      :cwd="pane.foreground_cwd || pane.cwd"
      :agent="pane.agent"
      :focused="selected"
      @pin="(text) => pinText(text, pane)"
    />
  </section>
</template>

<style scoped>
.pane { height: 100%; display: flex; flex-direction: column; background: var(--bg); position: relative; }
.pane.blocked { box-shadow: inset 0 0 0 1px #5c2826; }
.pane.selected { box-shadow: inset 0 0 0 1px #33506f; }
.pane.blocked.selected { box-shadow: inset 0 0 0 1px #7d3330; }
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
.pane.blocked .head { background: #170f0f; border-bottom-color: #2f1b1a; }
.name { font-weight: 600; white-space: nowrap; cursor: default; }
.pane-rename { width: 180px; height: 24px; }
.sub { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spacer { flex: 1; }
.pct { color: var(--text-2); }
.tools { display: flex; align-items: center; gap: 2px; margin-left: 6px; opacity: 0.55; transition: opacity 0.15s; }
.pane:hover .tools, .pane.selected .tools { opacity: 1; }
.tool {
  width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover { background: var(--hover); color: var(--text); }
.tool.txt { font-size: 13px; line-height: 1; }
.tool.on { color: var(--accent); }
.pane.docked .head { background: #101317; }
</style>
