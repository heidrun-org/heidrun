<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, Layout, PlotHoverEvent, PlotlyHTMLElement } from "plotly.js-basic-dist-min";
import { ChartTheme } from "../lib/chart_theme";
import { timeOptions } from "../lib/format";
import { PlotlyLoader, type PlotlyModule } from "../lib/plotly_loader";
import { UserActivitySlotLengthText } from "../lib/user_activity_slot_length_text";
import {
  USER_ACTIVITY_SLOT_LENGTHS,
  UserActivitySlots,
  type UserActivityRangeId,
  type UserActivitySlot,
  type UserActivitySlotLengthId,
} from "../lib/user_activity_slots";
import type { UserActivityWorkspaceSlots } from "../lib/user_activity_workspaces";
import { locale, t } from "../i18n/index";
import { resolvedTheme } from "../stores/theme";

// The histogram of the user activity time: one bar for each slot, drawn with Plotly.js. Each bar is stacked: it has one
// part of one color for each chosen workspace, and a legend above the bars gives the name of each color. The slot length is
// a choice of the developer, so the vertical axis, the labels under the bars, and the tooltips follow the slot length. The
// tooltip of a bar is an HTML popover of Bootstrap, because a tooltip of Plotly.js takes only a few tags of markup. Plotly.js
// is loaded only when the window opens, so the other windows do not pay for its size.
// Issue: https://github.com/heidrun-org/heidrun/issues/498

const props = defineProps<{
  /** The slots of all the chosen workspaces together, the oldest first. They give the labels and the total of each bar. */
  slots: UserActivitySlot[];
  /** The slots of each chosen workspace, in the order of the colors. Each one is one part of each bar. */
  workspaceSlots: UserActivityWorkspaceSlots[];
  /** The time range of the histogram. */
  rangeId: UserActivityRangeId;
  /** The length of one slot. */
  slotLengthId: UserActivitySlotLengthId;
}>();

/** The keys of the texts of each range: the title, and the description for the screen reader. */
const RANGE_TEXTS = {
  hour: { chartTitle: "statisticsModal.hourChartTitle", chartLabel: "statisticsModal.hourChartLabel" },
  day: { chartTitle: "statisticsModal.dayChartTitle", chartLabel: "statisticsModal.dayChartLabel" },
  week: { chartTitle: "statisticsModal.weekChartTitle", chartLabel: "statisticsModal.weekChartLabel" },
} as const;

/** The unit of the height of the bars. */
type HeightUnit = "seconds" | "minutes" | "hours";

/**
 * The vertical axis of each slot length: the unit, the top, and the space between two lines. A slot of one minute goes
 * from 0 to 60 seconds. A slot of 5 minutes to one hour goes from 0 to the length of the slot, in minutes. A slot of six
 * hours goes from 0 to 6 hours. The top is `null` for a slot of one day, which follows the longest day.
 */
const VERTICAL_AXES: Record<UserActivitySlotLengthId, { unit: HeightUnit; top: number | null; step: number | null }> = {
  one_minute: { unit: "seconds", top: 60, step: 10 },
  five_minutes: { unit: "minutes", top: 5, step: 1 },
  ten_minutes: { unit: "minutes", top: 10, step: 2 },
  fifteen_minutes: { unit: "minutes", top: 15, step: 5 },
  thirty_minutes: { unit: "minutes", top: 30, step: 5 },
  one_hour: { unit: "minutes", top: 60, step: 10 },
  six_hours: { unit: "hours", top: 6, step: 1 },
  one_day: { unit: "hours", top: null, step: null },
};

/** The length of a unit of height, in milliseconds. */
const UNIT_MS: Record<HeightUnit, number> = { seconds: 1000, minutes: 60_000, hours: 3_600_000 };

/** The key of the title of the vertical axis, for each unit of height. */
const AXIS_TITLE_KEYS: Record<HeightUnit, string> = {
  seconds: "statisticsModal.secondsAxis",
  minutes: "statisticsModal.minutesAxis",
  hours: "statisticsModal.hoursAxis",
};

/** One minute, in milliseconds. */
const MINUTE_MS = 60_000;

/** The color of the bars when no workspace is chosen yet, as the name of a CSS variable of the theme. */
const NO_WORKSPACE_COLOR_TOKEN = "--primary-bg";

/** The space between the pointer and the tooltip, in pixels. */
const TOOLTIP_OFFSET = 12;

/** Where the tooltip of a bar sits in the chart: the sides that it touches, and the distance to each side, in pixels. */
type TooltipPlacement = { left?: string; right?: string; top?: string; bottom?: string };

/** The tooltip as the page shows it: the slot, the total, and one row for each workspace that has time in the slot. */
type TooltipContent = {
  title: string;
  total: string;
  rows: { folder: string; name: string; colorToken: string; time: string }[];
};

const chart = ref<HTMLDivElement>();
let plotly: PlotlyModule | null = null;
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;
let hasHoverListeners = false;

/** The index of the slot under the pointer and the place of its tooltip, or `null` while the pointer is not over a bar. */
const hovered = ref<{ index: number; placement: TooltipPlacement } | null>(null);

/** The text of a time of the clock, following the language and the time format of the settings. */
function clockText(time: number): string {
  return new Date(time).toLocaleTimeString(locale.value, timeOptions());
}

/** The text of the day of a slot of one day: the short form for the axis, the long form for the tooltip. */
function dayText(time: number, form: "short" | "long"): string {
  return new Date(time).toLocaleDateString(locale.value, { weekday: form, day: "numeric", month: form });
}

/** True when the slots are slots of one day: the label of a slot is then its day. */
function isDaySlot(): boolean {
  return USER_ACTIVITY_SLOT_LENGTHS[props.slotLengthId].unit === "day";
}

/** The minutes since midnight, on the clock of the computer, at the start of a slot. */
function minutesSinceMidnight(time: number): number {
  const date = new Date(time);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The tick of the horizontal axis. A slot has a label when it starts at a multiple of the label step since midnight. A
 * label that sits on a midnight is the day, and any other label is the time of the clock.
 */
function ticks(): { values: number[]; texts: string[] } {
  const step = UserActivitySlots.labelStepInMinutes(props.rangeId, props.slotLengthId);
  const values: number[] = [];
  const texts: string[] = [];
  props.slots.forEach((slot, index) => {
    if (minutesSinceMidnight(slot.startedAt) % step !== 0) {
      return;
    }
    values.push(index);
    texts.push(step >= 1440 ? dayText(slot.startedAt, "short") : clockText(slot.startedAt));
  });
  return { values, texts };
}

/**
 * The length of a user activity time, in the unit that follows the slot length. A slot of one hour or less gives minutes
 * and seconds. A slot of six hours or of one day gives hours and minutes.
 */
function durationText(activeTimeMs: number): string {
  const length = USER_ACTIVITY_SLOT_LENGTHS[props.slotLengthId];
  if (length.unit === "day" || (length.unit === "hour" && length.amount > 1)) {
    const totalMinutes = Math.round(activeTimeMs / MINUTE_MS);
    return t("statisticsModal.durationHoursMinutes", { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 });
  }
  const totalSeconds = Math.round(activeTimeMs / 1000);
  return t("statisticsModal.durationMinutesSeconds", { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 });
}

/** Writes a text of a user into the markup of the name of a trace of Plotly.js, so a name with a sign "<" is shown as it is. */
function escapeMarkup(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * The first line of the tooltip of a slot. A slot of one day gives its day. Any other slot gives its start and its end. In
 * the last week, the start of a slot that is shorter than one day also gives its day.
 */
function slotTitleText(slot: UserActivitySlot): string {
  if (USER_ACTIVITY_SLOT_LENGTHS[props.slotLengthId].unit === "day") {
    return dayText(slot.startedAt, "long");
  }
  const start = props.rangeId === "week" ? `${dayText(slot.startedAt, "long")}, ${clockText(slot.startedAt)}` : clockText(slot.startedAt);
  return t("statisticsModal.tooltip", { start, end: clockText(slot.endedAt) });
}

/**
 * The content of the tooltip of the slot under the pointer, or `null` while the pointer is not over a bar. It has the slot,
 * the total of all the chosen workspaces, and, when two or more workspaces are chosen, one row for each workspace that has
 * user activity time in the slot, in the order of the colors.
 */
const tooltip = computed<TooltipContent | null>(() => {
  if (hovered.value === null) {
    return null;
  }
  const { index } = hovered.value;
  const slot = props.slots[index];
  if (slot === undefined) {
    return null;
  }
  const rows: TooltipContent["rows"] = [];
  if (props.workspaceSlots.length > 1) {
    for (const workspace of props.workspaceSlots) {
      const { activeTimeMs } = workspace.slots[index];
      if (activeTimeMs > 0) {
        rows.push({ folder: workspace.folder, name: workspace.name, colorToken: workspace.colorToken, time: durationText(activeTimeMs) });
      }
    }
  }
  return { title: slotTitleText(slot), total: durationText(slot.activeTimeMs), rows };
});

/**
 * Gives the place of the tooltip from the place of the pointer. The tooltip stays on the side of the pointer that has the
 * most room, so it never leaves the chart: at the right of the pointer in the left half, at the left in the right half, below
 * the pointer in the top half, and above it in the bottom half.
 */
function placementOf(x: number, y: number, width: number, height: number): TooltipPlacement {
  return {
    ...(x > width / 2 ? { right: `${width - x + TOOLTIP_OFFSET}px` } : { left: `${x + TOOLTIP_OFFSET}px` }),
    ...(y > height / 2 ? { bottom: `${height - y + TOOLTIP_OFFSET}px` } : { top: `${y + TOOLTIP_OFFSET}px` }),
  };
}

/** Shows the tooltip of the bar under the pointer. */
function onHover(event: PlotHoverEvent): void {
  const point = event.points[0];
  const element = chart.value;
  if (point === undefined || element === undefined) {
    return;
  }
  const box = element.getBoundingClientRect();
  const placement = placementOf(event.event.clientX - box.left, event.event.clientY - box.top, box.width, box.height);
  hovered.value = { index: point.pointNumber, placement };
}

/** Hides the tooltip when the pointer leaves a bar. */
function onUnhover(): void {
  hovered.value = null;
}

/** The parts of each bar, from the bottom to the top: one for each chosen workspace, or one empty part when none is chosen. */
function parts(): { name: string; colorToken: string; slots: UserActivitySlot[] }[] {
  if (props.workspaceSlots.length > 0) {
    return props.workspaceSlots;
  }
  return [{ name: "", colorToken: NO_WORKSPACE_COLOR_TOKEN, slots: props.slots }];
}

/**
 * The vertical axis. A slot that is shorter than one day goes from 0 to the length of the slot, so the bars of two slot
 * lengths of the same unit have the same scale. A slot of one day is in hours, and its top follows the longest day.
 */
function verticalAxis(lineColor: string): Partial<Layout["yaxis"]> {
  const { unit, top, step } = VERTICAL_AXES[props.slotLengthId];
  const common = { fixedrange: true, linecolor: lineColor, gridcolor: lineColor, zerolinecolor: lineColor, title: { text: t(AXIS_TITLE_KEYS[unit]) } };
  if (top === null || step === null) {
    return { ...common, autorange: true, rangemode: "tozero" };
  }
  return { ...common, autorange: false, range: [0, top], dtick: step };
}

/** Draws the bars again, with the colors of the theme in use. */
function draw(): void {
  const element = chart.value;
  if (plotly === null || element === undefined) {
    return;
  }
  const textColor = ChartTheme.readColor("--fg-body", chart.value);
  const lineColor = ChartTheme.readColor("--border-color", chart.value);
  const unitMs = UNIT_MS[VERTICAL_AXES[props.slotLengthId].unit];
  const data: Data[] = parts().map((part) => ({
    type: "bar",
    name: escapeMarkup(part.name),
    x: props.slots.map((_slot, index) => index),
    y: part.slots.map((slot) => slot.activeTimeMs / unitMs),
    hoverinfo: "none",
    marker: { color: ChartTheme.readColor(part.colorToken, element) },
  }));
  const { values: tickValues, texts: tickTexts } = ticks();
  const layout: Partial<Layout> = {
    autosize: true,
    title: { text: t(RANGE_TEXTS[props.rangeId].chartTitle) },
    margin: { t: 72, r: 40, b: 64, l: 64 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: 0.15,
    barmode: "stack",
    showlegend: props.workspaceSlots.length > 0,
    legend: { orientation: "h", x: 0, y: 1.1, traceorder: "normal", itemclick: false, itemdoubleclick: false },
    xaxis: {
      type: "linear",
      title: { text: t(isDaySlot() === true ? "statisticsModal.dayAxis" : "statisticsModal.slotStartAxis") },
      fixedrange: true,
      range: [-0.5, props.slots.length - 0.5],
      tickmode: "array",
      tickvals: tickValues,
      ticktext: tickTexts,
      linecolor: lineColor,
      gridcolor: lineColor,
    },
    yaxis: verticalAxis(lineColor),
  };
  plotly.react(element, data, layout, { displayModeBar: false });
  if (hasHoverListeners === false) {
    const plotElement = element as unknown as PlotlyHTMLElement;
    plotElement.on("plotly_hover", onHover);
    plotElement.on("plotly_unhover", onUnhover);
    hasHoverListeners = true;
  }
}

onMounted(async () => {
  const loaded = await PlotlyLoader.load();
  if (isUnmounted === true) {
    return;
  }
  plotly = loaded;
  draw();
  resizeObserver = new ResizeObserver(() => {
    if (plotly !== null && chart.value !== undefined) {
      plotly.Plots.resize(chart.value);
    }
  });
  if (chart.value !== undefined) {
    resizeObserver.observe(chart.value);
  }
});

// The theme sets its attributes on the page in its own watcher, so the colors are read on the next tick.
watch([resolvedTheme, locale, () => props.slots, () => props.workspaceSlots, () => props.rangeId, () => props.slotLengthId], async () => {
  hovered.value = null;
  await nextTick();
  draw();
});

onBeforeUnmount(() => {
  isUnmounted = true;
  resizeObserver?.disconnect();
  if (plotly !== null && chart.value !== undefined) {
    plotly.purge(chart.value);
  }
});
</script>

<template>
  <div class="user-activity-histogram-box position-relative">
    <div
      ref="chart"
      class="user-activity-histogram"
      role="img"
      :aria-label="t(RANGE_TEXTS[rangeId].chartLabel, { slotLength: UserActivitySlotLengthText.of(slotLengthId) })"
    ></div>
    <div v-if="tooltip !== null" class="popover show position-absolute" role="tooltip" :style="{ ...hovered?.placement, pointerEvents: 'none' }">
      <div class="popover-body d-flex flex-column gap-2">
        <div class="fw-semibold">{{ tooltip.title }}</div>
        <div class="d-flex justify-content-between gap-3" data-field="total">
          <span class="text-body-secondary">{{ t("statisticsModal.tooltipTotal") }}</span>
          <span>{{ tooltip.total }}</span>
        </div>
        <div v-if="tooltip.rows.length > 0" class="d-flex flex-column gap-1 border-top pt-2">
          <div v-for="row in tooltip.rows" :key="row.folder" class="d-flex justify-content-between gap-3" data-field="workspace">
            <span class="d-flex align-items-center">
              <span
                class="d-inline-flex me-2"
                aria-hidden="true"
                :style="{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: `var(${row.colorToken})` }"
              ></span>
              {{ row.name }}
            </span>
            <span>{{ row.time }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-activity-histogram-box { width: 100%; height: 100%; }
.user-activity-histogram { width: 100%; height: 100%; }
</style>
