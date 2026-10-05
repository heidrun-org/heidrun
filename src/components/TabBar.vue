<script setup lang="ts">
import ConfirmButton from "./ConfirmButton.vue";
import Icon from "./Icon.vue";
import InlineRename from "./InlineRename.vue";
import { closeTab, finishRename, newTerminal, selectTab, splitPane, startRename, state, tabs } from "../stores/session";
</script>

<template>
  <div class="tabs">
    <div
      v-for="t in tabs"
      :key="t.tab_id"
      class="tab"
      :class="{ active: t.tab_id === state.selectedTabId }"
    >
      <InlineRename
        v-if="state.renaming === `tab:${t.tab_id}`"
        class="tab-rename"
        :value="t.label"
        label="Nouveau nom de l’onglet"
        @save="(v) => finishRename('tab', t.tab_id, v)"
        @cancel="state.renaming = null"
      />
      <button
        v-else
        class="tab-main"
        title="Double-clic pour renommer · ⌥⌘← / ⌥⌘→ pour changer d’onglet"
        @click="selectTab(t.tab_id)"
        @dblclick="startRename('tab', t.tab_id)"
      >
        <span v-if="t.agent_status !== 'idle'" class="dot" :class="t.agent_status"></span>
        {{ t.label || `onglet ${t.number}` }}
      </button>
      <ConfirmButton
        class="tab-close"
        label="×"
        :aria-label="`Fermer l’onglet ${t.label || t.number} (${t.pane_count} panneau${t.pane_count > 1 ? 'x' : ''})`"
        @confirm="closeTab(t.tab_id)"
      />
    </div>
    <button class="tab-add" aria-label="Nouvel onglet" title="Nouvel onglet (⌘T)" @click="newTerminal()">+</button>
    <div class="spacer"></div>
    <button class="btn" @click="newTerminal()">Nouveau terminal <kbd>⌘T</kbd></button>
    <button class="btn" title="Diviser à droite" @click="splitPane('right')"><Icon name="split-right" /> <kbd>⌘D</kbd></button>
    <button class="btn" title="Diviser en bas" @click="splitPane('down')"><Icon name="split-down" /> <kbd>⇧⌘D</kbd></button>
  </div>
</template>

<style scoped>
.tabs {
  height: 44px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 16px;
  border-bottom: 1px solid var(--line); overflow-x: auto;
}
.tab { display: flex; align-items: center; border-radius: 7px; color: #9aa0a6; }
.tab:hover { color: var(--text-2); background: #16191c; }
.tab.active { background: var(--hover); color: var(--text); }
.tab-main {
  height: 30px; padding: 0 4px 0 12px; border: none; background: transparent; color: inherit;
  font-weight: 500; display: flex; align-items: center; gap: 8px; white-space: nowrap;
}
.tab-rename { width: 140px; margin: 0 4px; }
.tab-close { margin-right: 4px; opacity: 0; }
.tab:hover .tab-close, .tab.active .tab-close, .tab-close.armed, .tab-close:focus-visible { opacity: 1; }
.tab-add {
  width: 30px; height: 30px; border: none; border-radius: 7px; background: transparent;
  color: #9aa0a6; font-size: 16px;
}
.tab-add:hover { background: var(--hover); color: var(--text); }
.spacer { flex: 1; }
.btn + .btn { margin-left: 4px; }
</style>
