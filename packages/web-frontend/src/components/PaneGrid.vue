<script setup lang="ts">
import { computed } from "vue";
import PaneCard from "./PaneCard.vue";
import { tabLayout, tabPanes } from "../stores/session";

// Herdr gives pane rectangles in terminal cells: convert them to percentages
// so the grid matches the tab's real split layout at any window size.
const placed = computed(() => {
  const layout = tabLayout.value;
  const panes = tabPanes.value;
  if (!layout || !layout.area.width || !layout.area.height) {
    return panes.map((p, i) => ({
      pane: p,
      style: { left: `${(i / panes.length) * 100}%`, top: "0", width: `${100 / panes.length}%`, height: "100%" },
    }));
  }
  const { area } = layout;
  const rects = new Map(layout.panes.map((lp) => [lp.pane_id, lp.rect]));
  return panes
    .filter((p) => rects.has(p.pane_id))
    .map((p) => {
      const r = rects.get(p.pane_id)!;
      return {
        pane: p,
        style: {
          left: `${((r.x - area.x) / area.width) * 100}%`,
          top: `${((r.y - area.y) / area.height) * 100}%`,
          width: `${(r.width / area.width) * 100}%`,
          height: `${(r.height / area.height) * 100}%`,
        },
      };
    });
});
</script>

<template>
  <div class="grid">
    <div v-for="item in placed" :key="item.pane.pane_id" class="cell" :style="item.style">
      <PaneCard :pane="item.pane" />
    </div>
    <div v-if="!placed.length" class="empty">Aucun panneau dans cet onglet.</div>
  </div>
</template>

<style scoped>
.grid { flex: 1; min-height: 0; position: relative; background: var(--line); }
.cell { position: absolute; padding: 0.5px; }
.empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--muted); background: var(--bg); }
</style>
