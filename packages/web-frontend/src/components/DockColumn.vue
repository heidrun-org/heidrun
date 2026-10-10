<script setup lang="ts">
import PaneCard from "./PaneCard.vue";
import { dockVisible } from "../stores/dock";
import { t } from "../i18n/index";
</script>

<template>
  <div class="dock" :aria-label="t('dockColumn.label')">
    <div v-for="p in dockVisible" :key="p.pane_id" class="cell">
      <PaneCard :pane="p" docked />
    </div>
  </div>
</template>

<style scoped>
.dock { flex-shrink: 0; min-width: 0; display: flex; flex-direction: column; gap: 1px; background: var(--line); border-left: 1px solid var(--line); }
.cell { flex: 1; min-height: 0; }
</style>
