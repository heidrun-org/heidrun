<script setup lang="ts">
import PaneCard from "./PaneCard.vue";
import { visiblePinnedPanes } from "../stores/pinned_panes";
import { t } from "../i18n/index";
</script>

<template>
  <div class="column-of-pinned-panes" :aria-label="t('columnOfPinnedPanes.label')">
    <div v-for="p in visiblePinnedPanes" :key="p.pane_id" class="cell">
      <PaneCard :pane="p" is-in-column-of-pinned-panes />
    </div>
  </div>
</template>

<style scoped>
.column-of-pinned-panes { flex-shrink: 0; min-width: 0; display: flex; flex-direction: column; gap: var(--pane-gap); }
.cell { flex: 1; min-height: 0; }
</style>
