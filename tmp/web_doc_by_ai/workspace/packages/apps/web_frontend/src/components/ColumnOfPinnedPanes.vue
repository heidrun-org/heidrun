<script setup lang="ts">
import PaneCard from "./PaneCard.vue";
import { allPinnedPanes } from "../stores/pinned_panes";
import { t } from "../i18n/index";
</script>

<template>
  <div class="column-of-pinned-panes" :aria-label="t('columnOfPinnedPanes.label')">
    <div v-for="p in allPinnedPanes" :key="p.pane_id" class="cell">
      <PaneCard :pane="p" is-in-column-of-pinned-panes />
    </div>
  </div>
</template>

<style scoped>
/* The pinned panes touch each other, and they touch the panes of the tab: each one starts 1 pixel over the previous one, so that
   two borders make one line. */
.column-of-pinned-panes { flex-shrink: 0; min-width: 0; display: flex; flex-direction: column; margin-left: -1px; }
.cell { flex: 1; min-height: 0; }
.cell + .cell { margin-top: -1px; }
</style>
