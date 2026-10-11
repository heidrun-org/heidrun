<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import PaneCard from "./PaneCard.vue";
import { t } from "../i18n/index";
import { PaneSeparators, type PaneOuterEdge, type PaneOuterEdges, type PaneSeparator } from "../lib/pane_separators";
import { setSplitRatios, tabLayout, tabPanes } from "../stores/session";

// The columns of the window that sit against the panes: a corner where a line between panes reaches one of them
// also moves that column. The parent moves the column, see `outerStart` and `outerMove`.
const props = defineProps<{ outerEdges: PaneOuterEdges }>();
const emit = defineEmits<{
  /** The user starts to drag a corner that touches a column of the window. */
  outerStart: [edge: PaneOuterEdge];
  /** The pointer moved this far, in pixels, to the right since the start of the drag. */
  outerMove: [edge: PaneOuterEdge, dx: number];
  /** The column of the window that a corner under the pointer touches, or null: the column draws its line in colour. */
  outerHighlight: [edge: PaneOuterEdge | null];
}>();

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

// ---- Lines between panes, and corners where lines meet --------------------

const GAP = "var(--pane-gap)";

const separators = computed(() => {
  const layout = tabLayout.value;
  if (layout === null || layout.area.width <= 0 || layout.area.height <= 0) {
    return [];
  }
  return PaneSeparators.findSeparators(layout);
});

const separatorItems = computed(() => {
  const area = tabLayout.value?.area;
  if (area === undefined) {
    return [];
  }
  const percentX = (cells: number) => ((cells - area.x) / area.width) * 100;
  const percentY = (cells: number) => ((cells - area.y) / area.height) * 100;
  return separators.value.map((separator) => {
    // The line is as thick as the space between two panes, and stops at the edge of the panes at both ends.
    const style =
      separator.direction === "down"
        ? {
            top: `calc(${percentY(separator.position)}% - ${GAP} / 2)`,
            left: `calc(${percentX(separator.start)}% + ${GAP} / 2)`,
            width: `calc(${percentX(separator.end) - percentX(separator.start)}% - ${GAP})`,
          }
        : {
            left: `calc(${percentX(separator.position)}% - ${GAP} / 2)`,
            top: `calc(${percentY(separator.start)}% + ${GAP} / 2)`,
            height: `calc(${percentY(separator.end) - percentY(separator.start)}% - ${GAP})`,
          };
    return { separator, style };
  });
});

const cornerItems = computed(() => {
  const layout = tabLayout.value;
  if (layout === null) {
    return [];
  }
  const { area } = layout;
  return PaneSeparators.findCorners(separators.value, area, props.outerEdges).map((corner) => {
    const members = [...corner.horizontalSeparators, ...corner.verticalSeparators];
    return {
      // The key follows the lines, not the place: the corner moves with the pointer, and its element must stay.
      key: `${corner.outerEdge ?? "inside"}:${members.map((separator) => separator.splitId).join("+")}`,
      separators: members,
      edge: corner.outerEdge,
      style: {
        left: `calc(${((corner.x - area.x) / area.width) * 100}% - var(--corner-size) / 2)`,
        top: `calc(${((corner.y - area.y) / area.height) * 100}% - var(--corner-size) / 2)`,
      },
    };
  });
});

// ---- Drag -----------------------------------------------------------------

type Drag = {
  /** Which handle the user holds: the name of a split, or the key of a corner. */
  key: string;
  /** The lines that the drag moves, as they were when the drag started. */
  separators: PaneSeparator[];
  /** The side of the panes where the corner touches a column of the window, or null. */
  edge: PaneOuterEdge | null;
  tabId: string;
  startX: number;
  startY: number;
  /** Size of one terminal cell of Herdr on the screen, in pixels. */
  cellWidth: number;
  cellHeight: number;
  /** The last move, in whole cells, that was sent to Herdr. */
  sentCellsX: number;
  sentCellsY: number;
};

const gridEl = ref<HTMLElement | null>(null);
const drag = ref<Drag | null>(null);
const hoveredCornerKey = ref<string | null>(null);

// Like Visual Studio Code: a line is drawn in colour under the pointer, and a corner under the pointer or in a drag
// draws every line that meets there.
const litCorner = computed(() => cornerItems.value.find((item) => item.key === (drag.value?.key ?? hoveredCornerKey.value)));
const litIds = computed(() => {
  const dragged = drag.value?.separators ?? litCorner.value?.separators ?? [];
  return new Set(dragged.map((separator) => separator.splitId));
});
const litEdge = computed(() => drag.value?.edge ?? litCorner.value?.edge ?? null);
watch(litEdge, (edge) => emit("outerHighlight", edge));

function startDrag(e: PointerEvent, key: string, dragged: PaneSeparator[], edge: PaneOuterEdge | null) {
  const layout = tabLayout.value;
  const grid = gridEl.value;
  if (layout === null || grid === null) {
    return;
  }
  const box = grid.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) {
    return;
  }
  const hasHorizontal = dragged.some((separator) => separator.direction === "down");
  const hasVertical = dragged.some((separator) => separator.direction === "right");
  const movesBothWays = (hasHorizontal && hasVertical) || edge !== null;
  drag.value = {
    key,
    separators: dragged,
    edge,
    tabId: layout.tab_id,
    startX: e.clientX,
    startY: e.clientY,
    cellWidth: box.width / layout.area.width,
    cellHeight: box.height / layout.area.height,
    sentCellsX: 0,
    sentCellsY: 0,
  };
  // On the window, so that the drag goes on when the layout changes under the pointer and the handle is replaced.
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
  document.body.style.cursor = movesBothWays ? "move" : hasHorizontal ? "row-resize" : "col-resize";
  if (edge !== null) {
    emit("outerStart", edge);
  }
  e.preventDefault();
}

function moveDrag(e: PointerEvent) {
  const current = drag.value;
  if (current === null) {
    return;
  }
  const dx = e.clientX - current.startX;
  const dy = e.clientY - current.startY;
  if (current.edge !== null) {
    emit("outerMove", current.edge, dx);
  }
  // Herdr keeps whole cells, so a move that stays in the same cell sends nothing.
  const cellsX = Math.round(dx / current.cellWidth);
  const cellsY = Math.round(dy / current.cellHeight);
  if (cellsX === current.sentCellsX && cellsY === current.sentCellsY) {
    return;
  }
  current.sentCellsX = cellsX;
  current.sentCellsY = cellsY;
  setSplitRatios(
    current.separators.map((separator) => ({
      tabId: current.tabId,
      path: separator.path,
      ratio: PaneSeparators.moveRatio(separator, separator.direction === "down" ? cellsY : cellsX),
    })),
  );
}

function endDrag() {
  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
  if (drag.value === null) {
    return;
  }
  drag.value = null;
  document.body.style.cursor = "";
}

onBeforeUnmount(endDrag);

function resetRatio(separator: PaneSeparator) {
  const tabId = tabLayout.value?.tab_id;
  if (tabId !== undefined) {
    setSplitRatios([{ tabId, path: separator.path, ratio: 0.5 }]);
  }
}

function onKey(e: KeyboardEvent, separator: PaneSeparator) {
  const tabId = tabLayout.value?.tab_id;
  const grow = separator.direction === "down" ? "ArrowDown" : "ArrowRight";
  const shrink = separator.direction === "down" ? "ArrowUp" : "ArrowLeft";
  const step = e.shiftKey ? 4 : 1;
  if (tabId === undefined || (e.key !== grow && e.key !== shrink)) {
    return;
  }
  const ratio = PaneSeparators.moveRatio(separator, e.key === grow ? step : -step);
  setSplitRatios([{ tabId, path: separator.path, ratio }]);
  e.preventDefault();
}
</script>

<template>
  <div ref="gridEl" class="grid">
    <div v-for="item in placed" :key="item.pane.pane_id" class="cell" :style="item.style">
      <PaneCard :pane="item.pane" />
    </div>
    <div v-if="!placed.length" class="empty">{{ t("paneGrid.empty") }}</div>
    <div
      v-for="item in separatorItems"
      :key="item.separator.splitId"
      class="separator"
      :class="[item.separator.direction, { lit: litIds.has(item.separator.splitId) }]"
      :style="item.style"
      role="separator"
      :aria-orientation="item.separator.direction === 'down' ? 'horizontal' : 'vertical'"
      :aria-valuenow="Math.round(item.separator.ratio * 100)"
      aria-valuemin="10"
      aria-valuemax="90"
      :aria-label="item.separator.direction === 'down' ? t('resizer.paneHeight') : t('resizer.paneWidth')"
      tabindex="0"
      :title="t('resizer.paneTitle')"
      @pointerdown="startDrag($event, item.separator.splitId, [item.separator], null)"
      @dblclick="resetRatio(item.separator)"
      @keydown="onKey($event, item.separator)"
    ></div>
    <div
      v-for="item in cornerItems"
      :key="item.key"
      class="corner"
      :style="item.style"
      aria-hidden="true"
      :title="t('resizer.paneCornerTitle')"
      @pointerenter="hoveredCornerKey = item.key"
      @pointerleave="hoveredCornerKey = null"
      @pointerdown="startDrag($event, item.key, item.separators, item.edge)"
    ></div>
  </div>
</template>

<style scoped>
.grid {
  --corner-size: max(16px, calc(var(--pane-gap) * 2));
  flex: 1; min-height: 0; position: relative; margin: calc(var(--pane-gap) / -2);
}
.cell { position: absolute; padding: calc(var(--pane-gap) / 2); }
.empty {
  position: absolute; inset: calc(var(--pane-gap) / 2); display: flex; align-items: center; justify-content: center;
  color: var(--muted); background: var(--bg); border: 1px solid var(--line); border-radius: var(--pane-radius);
}
/* Like the sash of Visual Studio Code: the colour fills the whole space between two panes. */
.separator { position: absolute; z-index: 5; touch-action: none; background: transparent; transition: background 0.15s; }
.separator.down { height: var(--pane-gap); cursor: row-resize; }
.separator.right { width: var(--pane-gap); cursor: col-resize; }
.separator:hover, .separator.lit, .separator:focus-visible { background: var(--done); }
.separator:focus-visible { outline: none; }
/* The corner has no drawing: the lines that meet there show it. */
.corner { position: absolute; z-index: 7; width: var(--corner-size); height: var(--corner-size); cursor: move; touch-action: none; }
</style>
