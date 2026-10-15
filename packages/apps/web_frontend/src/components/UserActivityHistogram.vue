<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, Layout } from "plotly.js-basic-dist-min";
import { ChartTheme } from "../lib/chart_theme";
import { timeOptions } from "../lib/format";
import { PlotlyLoader, type PlotlyModule } from "../lib/plotly_loader";
import type { UserActivityRangeId, UserActivitySlot } from "../lib/user_activity_slots";
import { locale, t } from "../i18n/index";
import { resolvedTheme } from "../stores/theme";

// The histogram of the user activity time: one bar for each slot, drawn with Plotly.js. The last hour has slots of five
// minutes, the last day has slots of one hour, and the last week has slots of one day. Plotly.js is loaded only when the
// window opens, so the other windows do not pay for its size.

const props = defineProps<{
  /** The slots, the oldest first. */
  slots: UserActivitySlot[];
  /** The time range of the histogram. */
  rangeId: UserActivityRangeId;
}>();

/** The keys of the texts of each range: the title, the horizontal axis, and the description for the screen reader. */
const RANGE_TEXTS = {
  hour: {
    chartTitle: "statisticsModal.hourChartTitle",
    horizontalAxis: "statisticsModal.hourHorizontalAxis",
    chartLabel: "statisticsModal.hourChartLabel",
  },
  day: {
    chartTitle: "statisticsModal.dayChartTitle",
    horizontalAxis: "statisticsModal.dayHorizontalAxis",
    chartLabel: "statisticsModal.dayChartLabel",
  },
  week: {
    chartTitle: "statisticsModal.weekChartTitle",
    horizontalAxis: "statisticsModal.weekHorizontalAxis",
    chartLabel: "statisticsModal.weekChartLabel",
  },
} as const;

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

/** The text under a bar: the start of the slot of five minutes or one hour, or the day of the slot of one day. */
function axisText(slot: UserActivitySlot): string {
  return props.rangeId === "week" ? dayText(slot.startedAt, "short") : clockText(slot.startedAt);
}

/**
 * The tooltip of the bar of a slot. A slot of five minutes or one hour gives its start and its end, and the user
 * activity time in minutes and seconds. A slot of one day gives its day, and the user activity time in hours and minutes.
 */
function tooltipText(slot: UserActivitySlot): string {
  if (props.rangeId === "week") {
    const totalMinutes = Math.round(slot.activeTimeMs / MINUTE_MS);
    return t("statisticsModal.weekTooltip", {
      day: dayText(slot.startedAt, "long"),
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    });
  }
  const totalSeconds = Math.round(slot.activeTimeMs / 1000);
  return t("statisticsModal.tooltip", {
    start: clockText(slot.startedAt),
    end: clockText(slot.endedAt),
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  });
}

/**
 * The vertical axis. The last hour goes from 0 to 5 minutes, and the last day goes from 0 to 60 minutes: the length of
 * one slot. The last week is in hours, and its top follows the longest day.
 */
function verticalAxis(lineColor: string): Partial<Layout["yaxis"]> {
  const common = { fixedrange: true, linecolor: lineColor, gridcolor: lineColor, zerolinecolor: lineColor };
  if (props.rangeId === "hour") {
    return { ...common, title: { text: t("statisticsModal.minutesAxis") }, autorange: false, range: [0, 5], dtick: 1 };
  }
  if (props.rangeId === "day") {
    return { ...common, title: { text: t("statisticsModal.minutesAxis") }, autorange: false, range: [0, 60], dtick: 10 };
  }
  return { ...common, title: { text: t("statisticsModal.hoursAxis") }, autorange: true, rangemode: "tozero" };
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
      x: props.slots.map(axisText),
      y: props.slots.map((slot) => slot.activeTimeMs / (props.rangeId === "week" ? 60 * MINUTE_MS : MINUTE_MS)),
      customdata: props.slots.map(tooltipText),
      hovertemplate: "%{customdata}<extra></extra>",
      marker: { color: ChartTheme.readColor("--primary-bg", chart.value) },
    },
  ];
  const layout: Partial<Layout> = {
    autosize: true,
    title: { text: t(RANGE_TEXTS[props.rangeId].chartTitle) },
    margin: { t: 48, r: 40, b: 64, l: 64 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: 0.15,
    xaxis: {
      type: "category",
      title: { text: t(RANGE_TEXTS[props.rangeId].horizontalAxis) },
      fixedrange: true,
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
watch([resolvedTheme, locale, () => props.slots, () => props.rangeId], async () => {
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
  <div ref="chart" class="user-activity-histogram" role="img" :aria-label="t(RANGE_TEXTS[rangeId].chartLabel)"></div>
</template>

<style scoped>
.user-activity-histogram { width: 100%; height: 100%; }
</style>
