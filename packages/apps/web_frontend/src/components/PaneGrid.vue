<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import EmptyTabScreen from "./EmptyTabScreen.vue";
import PaneCard from "./PaneCard.vue";
import { t } from "../i18n/index";
import { PaneSeparators, type PaneOuterEdge, type PaneOuterEdges, type PaneSeparator } from "../lib/pane_separators";
import { setSplitRatios } from "../stores/session";
import { PaneMoveDrag } from "../stores/pane_move";
import { gridLayout, keptTabs } from "../stores/pinned_panes";
import type { AgentInfo, PaneLayoutSnapshot } from "../lib/types";

// The columns of the window that sit against the panes: a corner where a line between panes reaches one of them
// also moves that column. The parent moves the column, see `outerStart` and `outerMove`.
const props = withDefaults(
  defineProps<{ outerEdges: PaneOuterEdges; zenPaneId?: string | null }>(),
  { zenPaneId: null },
);
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
// A pane that has a neighbour on its left, or above it, starts 1 pixel early, so that its border covers the border of the
// neighbour: two panes that touch have one line between them, and no gap. The right edge and the bottom edge of a pane stay
// exactly at the edge of its share.
const BORDER = "1px";
const ZEN_PANE_STYLE = {
  left: "0",
  top: "0",
  width: "100%",
  height: "100%",
};

/**
 * Gives the start and the size of a pane along one axis.
 *
 * @param start The share of the start of the pane, in percent.
 * @param size The share of the size of the pane, in percent.
 * @returns The start and the size, as CSS values. A pane that does not start at the edge goes 1 pixel over its neighbour.
 */
function overlapNeighbour(start: number, size: number) {
  if (start <= 0) {
    return { start: "0", size: `${size}%` };
  }
  return { start: `calc(${start}% - ${BORDER})`, size: `calc(${size}% + ${BORDER})` };
}

/**
 * Gives the place of each pane of one tab.
 *
 * @param layout The layout of the tab without the pinned panes, or null when Herdr sent none.
 * @param panes The panes of the tab that the grid draws.
 * @returns The panes with their place, as CSS values.
 */
function placePanes(layout: PaneLayoutSnapshot | null, panes: AgentInfo[]) {
  if (!layout || !layout.area.width || !layout.area.height) {
    return panes.map((p, i) => {
      const horizontal = overlapNeighbour((i / panes.length) * 100, 100 / panes.length);
      return {
        pane: p,
        style: { left: horizontal.start, top: "0", width: horizontal.size, height: "100%" },
      };
    });
  }
  const { area } = layout;
  const rects = new Map(layout.panes.map((lp) => [lp.pane_id, lp.rect]));
  return panes
    .filter((p) => rects.has(p.pane_id))
    .map((p) => {
      const r = rects.get(p.pane_id)!;
      const horizontal = overlapNeighbour(((r.x - area.x) / area.width) * 100, (r.width / area.width) * 100);
      const vertical = overlapNeighbour(((r.y - area.y) / area.height) * 100, (r.height / area.height) * 100);
      return {
        pane: p,
        style: { left: horizontal.start, top: vertical.start, width: horizontal.size, height: vertical.size },
      };
    });
}

// The panes of every tab that the developer opened sit in one list, so that a pane keeps its element, and its terminal, when
// its tab is selected or not. A tab that is not selected is hidden, and its terminal stays alive with its screen.
const placed = computed(() =>
  keptTabs.value.flatMap((tab) =>
    placePanes(tab.layout, tab.panes).map((cell) => {
      const isZenPane = props.zenPaneId === cell.pane.pane_id;
      return {
        ...cell,
        isShown: tab.isSelected && (props.zenPaneId === null || isZenPane),
        style: isZenPane ? ZEN_PANE_STYLE : cell.style,
      };
    }),
  ),
);

const isGridEmpty = computed(() => placed.value.some((cell) => cell.isShown) === false);

// ---- Lines between panes, and corners where lines meet --------------------

const GAP = "var(--pane-gap)";

const separators = computed(() => {
  if (props.zenPaneId !== null) {
    return [];
  }
  const layout = gridLayout.value;
  if (layout === null || layout.area.width <= 0 || layout.area.height <= 0) {
    return [];
  }
  return PaneSeparators.findSeparators(layout);
});

const separatorItems = computed(() => {
  const area = gridLayout.value?.area;
  if (area === undefined) {
    return [];
  }
  const percentX = (cells: number) => ((cells - area.x) / area.width) * 100;
  const percentY = (cells: number) => ((cells - area.y) / area.height) * 100;
  return separators.value.map((separator) => {
    // The place to grab the line is as thick as the space that Visual Studio Code gives its sash. At each end it reaches
    // the middle of the place where it meets another line.
    const style =
      separator.direction === "down"
        ? {
            top: `calc(${percentY(separator.position)}% - ${GAP} / 2 - ${BORDER} / 2)`,
            left: `${percentX(separator.start)}%`,
            width: `${percentX(separator.end) - percentX(separator.start)}%`,
          }
        : {
            left: `calc(${percentX(separator.position)}% - ${GAP} / 2 - ${BORDER} / 2)`,
            top: `${percentY(separator.start)}%`,
            height: `${percentY(separator.end) - percentY(separator.start)}%`,
          };
    return { separator, style };
  });
});

const cornerItems = computed(() => {
  const layout = gridLayout.value;
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

// While the developer drags a pane header over another pane, the grid shows the half of that pane where the dragged pane goes.
const movePreviewStyle = computed(() => {
  const box = PaneMoveDrag.state.previewBox;
  const grid = gridEl.value;
  if (box === null || grid === null) {
    return null;
  }
  const gridBox = grid.getBoundingClientRect();
  return {
    left: `${box.left - gridBox.left}px`,
    top: `${box.top - gridBox.top}px`,
    width: `${box.right - box.left}px`,
    height: `${box.bottom - box.top}px`,
  };
});
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
  const layout = gridLayout.value;
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
  // One cursor over every element for the whole drag: a line or a column resizer under the pointer has its own cursor.
  document.documentElement.dataset.paneDragCursor = movesBothWays ? "move" : hasHorizontal ? "row-resize" : "col-resize";
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
  delete document.documentElement.dataset.paneDragCursor;
}

onBeforeUnmount(endDrag);

function resetRatio(separator: PaneSeparator) {
  const tabId = gridLayout.value?.tab_id;
  if (tabId !== undefined) {
    setSplitRatios([{ tabId, path: separator.path, ratio: 0.5 }]);
  }
}

function onKey(e: KeyboardEvent, separator: PaneSeparator) {
  const tabId = gridLayout.value?.tab_id;
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
    <div
      v-for="item in placed"
      :key="item.pane.pane_id"
      class="cell"
      :class="{ 'is-hidden': item.isShown === false }"
      :style="item.style"
    >
      <PaneCard :pane="item.pane" />
    </div>
    <div v-if="isGridEmpty" class="empty"><EmptyTabScreen /></div>
    <div v-if="movePreviewStyle !== null" class="move-preview" :style="movePreviewStyle" aria-hidden="true"></div>
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
  flex: 1; min-height: 0; position: relative;
}
.cell { position: absolute; }
/* The pane of a tab that is not selected: it keeps its place and its size, so that its terminal does not change size. */
.cell.is-hidden { visibility: hidden; }
.empty {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: var(--muted); background: var(--bg); border: 1px solid var(--line); overflow: hidden;
}
/* Like the sash of Visual Studio Code: the line between two panes is the border of the panes. This element, as wide as the space
   that the sash of Visual Studio Code has, is the place where the pointer grabs the line, and it shows a colour under the pointer. */
.separator {
  position: absolute; z-index: 5; touch-action: none; background: transparent; transition: background 0.15s;
}
.separator.down { height: var(--pane-gap); cursor: row-resize; }
.separator.right { width: var(--pane-gap); cursor: col-resize; }
.separator:hover, .separator.lit, .separator:focus-visible { background: var(--done); }
.separator:focus-visible { outline: none; }
/* The half of the destination pane where the dragged pane goes. It has the look of the layer of a drop of images, and it lets the pointer
   through, so that the pane under it keeps receiving the pointer. */
.move-preview {
  position: absolute; z-index: 8; pointer-events: none; box-sizing: border-box;
  border: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
}
/* The corner has no drawing: the lines that meet there show it. */
.corner { position: absolute; z-index: 7; width: var(--corner-size); height: var(--corner-size); cursor: move; touch-action: none; }
</style>
