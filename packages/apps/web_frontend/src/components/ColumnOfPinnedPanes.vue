<script setup lang="ts">
import PaneCard from "./PaneCard.vue";
import { allPinnedPanes } from "../stores/pinned_panes";
import { t } from "../i18n/index";

const props = defineProps<{ zenPaneId?: string | null }>();
</script>

<template>
  <div
    class="column-of-pinned-panes"
    :class="{ 'zen-mode': props.zenPaneId !== null && props.zenPaneId !== undefined }"
    :aria-label="t('columnOfPinnedPanes.label')"
  >
    <div
      v-for="p in allPinnedPanes"
      :key="p.pane_id"
      class="cell"
      :class="{
        'zen-mode-hidden': props.zenPaneId !== null && props.zenPaneId !== undefined && p.pane_id !== props.zenPaneId,
      }"
    >
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
.column-of-pinned-panes.zen-mode-hidden {
  position: absolute; top: 0; right: 0; height: 100%; visibility: hidden; pointer-events: none;
}
.column-of-pinned-panes.zen-mode { position: relative; display: block; flex: 1; margin: 0; }
.column-of-pinned-panes.zen-mode .cell {
  position: absolute; inset: 0; width: 100%; height: 100%; flex: none; margin: 0;
}
.column-of-pinned-panes.zen-mode .cell.zen-mode-hidden { visibility: hidden; }
</style>
