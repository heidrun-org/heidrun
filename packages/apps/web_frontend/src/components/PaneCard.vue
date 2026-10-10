<script setup lang="ts">
import { computed } from "vue";
import TerminalView from "./TerminalView.vue";
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import PromptMenu from "./PromptMenu.vue";
import { closePane, contextFor, finishRename, paneFullName, selectPane, splitPane, startRename, state } from "../stores/session";
import { dockState, isDocked, toggleDock, undock } from "../stores/dock";
import { git } from "../stores/git";
import { mosaic } from "../stores/mosaic";
import { gaugeLevel, paneName, shortPath } from "../lib/format";
import { pinText } from "../stores/notes";
import type { AgentInfo } from "../lib/types";
import { t } from "../i18n/index";

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
const shellFolder = computed(() => props.pane.foreground_cwd || props.pane.cwd || "");
// The terminal title of an idle shell is `user@host:folder`. It repeats the user, the host and the folder, so the pane
// is named after its folder. When a command runs, the terminal title names that command, and the pane keeps it.
const isIdleShellTitle = computed(() => {
  const title = props.pane.terminal_title_stripped ?? "";
  const folder = shellFolder.value;
  return title === "" || title.endsWith(`:${folder}`) || title.endsWith(`:${shortPath(folder)}`);
});
const displayName = computed(() => {
  const p = props.pane;
  if (p.agent || p.label || shellFolder.value === "" || isIdleShellTitle.value === false) return paneName(p);
  return shellFolder.value.split("/").filter((part) => part !== "").pop() ?? paneName(p);
});
const subtitle = computed(() => {
  const p = props.pane;
  if (props.docked) return paneFullName(p);
  if (p.agent) return `${p.agent} · ${p.pane_id}`;
  const branch = git.branchByFolder[shellFolder.value];
  const path = shortPath(shellFolder.value) || p.pane_id;
  return branch ? `${branch} · ${path}` : path;
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
        v-if="state.renaming === `pane:${pane.pane_id}` && state.renamingPlace === 'card'"
        class="pane-rename"
        :value="pane.label || displayName"
        :label="t('paneCard.renameLabel')"
        allow-empty
        @save="(v) => finishRename('pane', pane.pane_id, v)"
        @cancel="state.renaming = null"
      />
      <span v-else class="name" :title="t('paneCard.nameTitle', { name: displayName })" @dblclick="startRename('pane', pane.pane_id, 'card')">{{ displayName }}</span>
      <span class="sub">{{ subtitle }}</span>
      <span class="spacer"></span>
      <template v-if="ctx">
        <span class="sub">{{ t("paneCard.context") }}</span>
        <span class="gauge" :class="gaugeLevel(ctx.percent)" style="width: 110px">
          <span :style="{ width: `${Math.min(100, ctx.percent)}%` }"></span>
        </span>
        <span class="mono pct" :class="'lvl-' + gaugeLevel(ctx.percent)">{{ Math.round(ctx.percent) }} %</span>
      </template>
      <span class="tools">
        <PromptMenu :pane-id="pane.pane_id" />
        <template v-if="docked">
          <button class="tool" :title="t('paneCard.goToTab')" @mousedown.stop @click="selectPane(pane)"><Icon name="box-arrow-up-right" /></button>
          <button class="tool" :aria-label="t('paneCard.undock')" :title="t('paneCard.undockTitle')" @mousedown.stop @click="undock(pane.pane_id)">
            <Icon name="x-lg" />
          </button>
        </template>
        <template v-else>
        <button
          v-if="(pane.agent ?? '').includes('claude')"
          class="tool"
          :title="t('paneCard.mosaicTitle')"
          :aria-label="t('paneCard.mosaic')"
          @mousedown.stop
          @click="mosaic.paneId = pane.pane_id"
        ><Icon name="grid-3x3-gap" /></button>
        <button
          class="tool"
          :class="{ on: pinned }"
          :aria-pressed="pinned"
          :title="pinned ? t('paneCard.unpin') : t('paneCard.pinTitle')"
          @mousedown.stop
          @click="toggleDock(pane.pane_id)"
        >
          <Icon :name="pinned ? 'pin-fill' : 'pin'" />
        </button>
        <button class="tool" :aria-label="t('paneCard.splitRight')" :title="t('paneCard.splitRightTitle')" @mousedown.stop @click="splitPane('right', pane.pane_id)">
          <Icon name="layout-split" />
        </button>
        <button class="tool" :aria-label="t('paneCard.splitDown')" :title="t('paneCard.splitDownTitle')" @mousedown.stop @click="splitPane('down', pane.pane_id)">
          <Icon name="layout-split" class="rotated" />
        </button>
        <ConfirmButton icon="x-lg" :confirm-label="t('paneCard.closeConfirm')" :question="t('paneCard.close')" @confirm="closePane(pane.pane_id)" />
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
.pane.blocked { box-shadow: inset 0 0 0 1px var(--pane-ring-blocked); }
.pane.selected { box-shadow: inset 0 0 0 1px var(--pane-ring-selected); }
.pane.blocked.selected { box-shadow: inset 0 0 0 1px var(--pane-ring-blocked-selected); }
.sweep { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; background: #12302d; z-index: 1; }
.sweep span {
  position: absolute; top: 0; left: 0; width: 40%; height: 2px;
  background: linear-gradient(90deg, rgba(63, 184, 175, 0), var(--working), rgba(63, 184, 175, 0));
  animation: sweep 2.4s ease-in-out infinite;
}
.head {
  height: 34px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 14px;
  border-bottom: 1px solid var(--pane-head-line); font-size: var(--font-size);
}
.pane.blocked .head { background: var(--tint-err); border-bottom-color: var(--pane-head-line-blocked); }
.name { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-weight: 600; white-space: nowrap; cursor: default; }
.pane-rename { width: 180px; height: 24px; }
.sub { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.spacer { flex: 1; }
.pct { color: var(--text-2); }
.tools { flex-shrink: 0; display: flex; align-items: center; gap: 2px; margin-left: 16px; opacity: 0.55; transition: opacity 0.15s; }
.pane:hover .tools, .pane.selected .tools { opacity: 1; }
.tool {
  width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover { background: var(--hover); color: var(--text); }
.tool.txt { font-size: var(--font-size); line-height: 1; }
.tool.on { color: var(--accent); }
.pane.docked .head { background: var(--bar); }
</style>
