<script setup lang="ts">
import { newTerminal, selectTab, splitPane, state, tabs } from "../stores/session";
</script>

<template>
  <div class="tabs">
    <button
      v-for="t in tabs"
      :key="t.tab_id"
      class="tab"
      :class="{ active: t.tab_id === state.selectedTabId }"
      @click="selectTab(t.tab_id)"
    >
      <span v-if="t.agent_status !== 'idle'" class="dot" :class="t.agent_status"></span>
      {{ t.label || `onglet ${t.number}` }}
    </button>
    <button class="tab icon" aria-label="Nouvel onglet" @click="newTerminal()">+</button>
    <div class="spacer"></div>
    <button class="btn" @click="newTerminal()">Nouveau terminal <kbd>⌘T</kbd></button>
    <button class="btn" @click="splitPane('right')">Diviser <kbd>⌘D</kbd></button>
  </div>
</template>

<style scoped>
.tabs {
  height: 44px; flex-shrink: 0; display: flex; align-items: center; gap: 4px; padding: 0 16px;
  border-bottom: 1px solid var(--line);
}
.tab {
  height: 30px; padding: 0 12px; border-radius: 7px; border: none; background: transparent;
  color: #9aa0a6; font-weight: 500; display: flex; align-items: center; gap: 8px;
}
.tab:hover { color: var(--text-2); }
.tab.active { background: var(--hover); color: var(--text); }
.tab.icon { width: 30px; padding: 0; justify-content: center; font-size: 16px; }
.spacer { flex: 1; }
.btn + .btn { margin-left: 4px; }
</style>
