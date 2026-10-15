<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, Layout } from "plotly.js-basic-dist-min";
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
// part of one color for each chosen workspace. The slot length is a choice of the developer, so the vertical axis, the
// labels under the bars, and the tooltips follow the slot length. Plotly.js is loaded only when the window opens, so the
// other windows do not pay for its size.
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

const chart = ref<HTMLDivElement>();
let plotly: PlotlyModule | null = null;
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;

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

/** Writes a text of a user into the markup of a tooltip of Plotly.js, so a name with a sign "<" is shown as it is. */
function escapeMarkup(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * The first line of the tooltip of a slot, with the total of all the chosen workspaces. A slot of one hour or less gives
 * its start and its end, and the user activity time in minutes and seconds. A slot of six hours gives its start and its
 * end, and the user activity time in hours and minutes. A slot of one day gives its day, and the user activity time in
 * hours and minutes. In the last week, the start of a slot that is shorter than one day also gives its day.
 */
function totalTooltipText(slot: UserActivitySlot): string {
  const length = USER_ACTIVITY_SLOT_LENGTHS[props.slotLengthId];
  if (length.unit === "day") {
    return t("statisticsModal.dayTooltip", { day: dayText(slot.startedAt, "long"), time: durationText(slot.activeTimeMs) });
  }
  const start = props.rangeId === "week" ? `${dayText(slot.startedAt, "long")}, ${clockText(slot.startedAt)}` : clockText(slot.startedAt);
  return t("statisticsModal.tooltip", { start, end: clockText(slot.endedAt), time: durationText(slot.activeTimeMs) });
}

/**
 * The tooltip of the bar of the slot at an index. The first line is the total. When two or more workspaces are chosen, one
 * line follows for each workspace that has user activity time in the slot, with the name and the time of the workspace.
 */
function tooltipText(slot: UserActivitySlot, index: number): string {
  const lines = [totalTooltipText(slot)];
  if (props.workspaceSlots.length < 2) {
    return lines[0];
  }
  for (const workspace of props.workspaceSlots) {
    const { activeTimeMs } = workspace.slots[index];
    if (activeTimeMs > 0) {
      lines.push(t("statisticsModal.workspaceTooltipLine", { workspace: escapeMarkup(workspace.name), time: durationText(activeTimeMs) }));
    }
  }
  return lines.join("<br>");
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
  const customdata = props.slots.map(tooltipText);
  const data: Data[] = parts().map((part) => ({
    type: "bar",
    name: part.name,
    x: props.slots.map((_slot, index) => index),
    y: part.slots.map((slot) => slot.activeTimeMs / unitMs),
    customdata,
    hovertemplate: "%{customdata}<extra></extra>",
    marker: { color: ChartTheme.readColor(part.colorToken, element) },
  }));
  const { values: tickValues, texts: tickTexts } = ticks();
  const layout: Partial<Layout> = {
    autosize: true,
    title: { text: t(RANGE_TEXTS[props.rangeId].chartTitle) },
    margin: { t: 48, r: 40, b: 64, l: 64 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: 0.15,
    barmode: "stack",
    showlegend: false,
    hoverlabel: { bgcolor: ChartTheme.readColor("--bg-body", element), bordercolor: lineColor, font: { color: textColor } },
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
  <div
    ref="chart"
    class="user-activity-histogram"
    role="img"
    :aria-label="t(RANGE_TEXTS[rangeId].chartLabel, { slotLength: UserActivitySlotLengthText.of(slotLengthId) })"
  ></div>
</template>

<style scoped>
.user-activity-histogram { width: 100%; height: 100%; }
</style>
