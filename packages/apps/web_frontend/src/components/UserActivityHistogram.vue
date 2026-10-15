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
import { locale, t } from "../i18n/index";
import { resolvedTheme } from "../stores/theme";

// The histogram of the user activity time: one bar for each slot, drawn with Plotly.js. The slot length is a choice of the
// developer, so the vertical axis, the labels under the bars, and the tooltips follow the slot length. Plotly.js is loaded
// only when the window opens, so the other windows do not pay for its size.

const props = defineProps<{
  /** The slots, the oldest first. */
  slots: UserActivitySlot[];
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
 * The tooltip of the bar of a slot. A slot of one hour or less gives its start and its end, and the user activity time in
 * minutes and seconds. A slot of six hours gives its start and its end, and the user activity time in hours and minutes.
 * A slot of one day gives its day, and the user activity time in hours and minutes. In the last week, the start of a slot
 * that is shorter than one day also gives its day.
 */
function tooltipText(slot: UserActivitySlot): string {
  const length = USER_ACTIVITY_SLOT_LENGTHS[props.slotLengthId];
  const totalMinutes = Math.round(slot.activeTimeMs / MINUTE_MS);
  if (length.unit === "day") {
    return t("statisticsModal.dayTooltip", {
      day: dayText(slot.startedAt, "long"),
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  }
  const start = props.rangeId === "week" ? `${dayText(slot.startedAt, "long")}, ${clockText(slot.startedAt)}` : clockText(slot.startedAt);
  if (length.unit === "hour" && length.amount > 1) {
    return t("statisticsModal.hoursTooltip", {
      start,
      end: clockText(slot.endedAt),
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  }
  const totalSeconds = Math.round(slot.activeTimeMs / 1000);
  return t("statisticsModal.tooltip", {
    start,
    end: clockText(slot.endedAt),
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  });
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
  const data: Data[] = [
    {
      type: "bar",
      x: props.slots.map((_slot, index) => index),
      y: props.slots.map((slot) => slot.activeTimeMs / UNIT_MS[VERTICAL_AXES[props.slotLengthId].unit]),
      customdata: props.slots.map(tooltipText),
      hovertemplate: "%{customdata}<extra></extra>",
      marker: { color: ChartTheme.readColor("--primary-bg", chart.value) },
    },
  ];
  const { values: tickValues, texts: tickTexts } = ticks();
  const layout: Partial<Layout> = {
    autosize: true,
    title: { text: t(RANGE_TEXTS[props.rangeId].chartTitle) },
    margin: { t: 48, r: 40, b: 64, l: 64 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: 0.15,
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
watch([resolvedTheme, locale, () => props.slots, () => props.rangeId, () => props.slotLengthId], async () => {
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
