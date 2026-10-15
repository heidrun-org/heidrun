<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, Layout } from "plotly.js-basic-dist-min";
import { ChartTheme } from "../lib/chart_theme";
import { PlotlyLoader, type PlotlyModule } from "../lib/plotly_loader";
import type { StackedBarSeries, StackedBarUnit } from "../lib/stacked_bar_chart";
import { locale } from "../i18n/index";
import { resolvedTheme } from "../stores/theme";

// A bar chart with one bar for each label, and in each bar one color for each series, one on top of the other. The tab "Work
// of one person" uses it for the commits and the pull requests of each day, and for the AI cost of each day. Plotly.js is
// loaded only when the window opens, so the other windows do not pay for its size.

const props = defineProps<{
  /** The text under each bar, the same number as the values of each series. */
  labels: string[];
  /** The colors of the bars, from the bottom of a bar to its top. */
  series: StackedBarSeries[];
  /** The title of the chart. */
  title: string;
  /** The title of the horizontal axis. */
  horizontalAxisTitle: string;
  /** The title of the vertical axis. */
  verticalAxisTitle: string;
  /** The unit of the vertical axis: whole numbers, or US dollars. */
  verticalAxisUnit: StackedBarUnit;
  /** The text that a screen reader reads for the chart. */
  chartLabel: string;
}>();

/** The highest bar for which a vertical axis of whole numbers goes up one by one. A higher bar lets Plotly.js choose the step. */
const LAST_BAR_COUNTED_ONE_BY_ONE = 8;

const chart = ref<HTMLDivElement>();
let plotly: PlotlyModule | null = null;
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;

/** Gives the settings of the vertical axis that depend on its unit. */
function unitAxis(highestBar: number): Partial<Layout["yaxis"]> {
  if (props.verticalAxisUnit === "dollars") {
    return { tickprefix: "$", tickformat: ",.2~f" };
  }
  return { tickformat: "d", ...(highestBar <= LAST_BAR_COUNTED_ONE_BY_ONE ? { dtick: 1 } : {}) };
}

/** Draws the bars again, with the colors of the theme in use. */
function draw(): void {
  const element = chart.value;
  if (plotly === null || element === undefined) {
    return;
  }
  const textColor = ChartTheme.readColor("--fg-body", element);
  const lineColor = ChartTheme.readColor("--border-color", element);
  const highestBar = Math.max(1, ...props.labels.map((_, index) => props.series.reduce((sum, one) => sum + one.values[index], 0)));
  const data: Data[] = props.series.map((one) => ({
    type: "bar",
    name: one.name,
    x: props.labels,
    y: one.values,
    customdata: one.tooltips,
    hovertemplate: "%{customdata}<extra></extra>",
    marker: { color: ChartTheme.readColor(one.colorToken, element) },
  }));
  const layout: Partial<Layout> = {
    autosize: true,
    barmode: "stack",
    title: { text: props.title },
    margin: { t: 72, r: 40, b: 80, l: 64 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: 0.15,
    legend: { orientation: "h", x: 0, y: 1.1, traceorder: "normal" },
    xaxis: {
      type: "category",
      title: { text: props.horizontalAxisTitle },
      automargin: true,
      fixedrange: true,
      linecolor: lineColor,
      gridcolor: lineColor,
    },
    yaxis: {
      title: { text: props.verticalAxisTitle },
      fixedrange: true,
      linecolor: lineColor,
      gridcolor: lineColor,
      zerolinecolor: lineColor,
      rangemode: "tozero",
      ...unitAxis(highestBar),
    },
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
watch(
  [resolvedTheme, locale, () => props.labels, () => props.series, () => props.title, () => props.verticalAxisUnit],
  async () => {
    await nextTick();
    draw();
  },
);

onBeforeUnmount(() => {
  isUnmounted = true;
  resizeObserver?.disconnect();
  if (plotly !== null && chart.value !== undefined) {
    plotly.purge(chart.value);
  }
});
</script>

<template>
  <div ref="chart" class="stacked-bar-chart" role="img" :aria-label="chartLabel"></div>
</template>

<style scoped>
.stacked-bar-chart { width: 100%; height: 100%; }
</style>
