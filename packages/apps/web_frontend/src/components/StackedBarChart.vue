<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Data, Layout, PlotHoverEvent, PlotlyHTMLElement } from "plotly.js-basic-dist-min";
import ChartInformationCardPopover from "./ChartInformationCardPopover.vue";
import {
  CHART_BAR_GAP,
  CHART_LEGEND,
  CHART_MARGIN,
  ChartInformationCard,
  type ChartInformationCardAnchor,
  type ChartInformationCardContent,
} from "../lib/chart_information_card";
import { ChartTheme } from "../lib/chart_theme";
import { PlotlyLoader, type PlotlyModule } from "../lib/plotly_loader";
import type { StackedBarSeries, StackedBarUnit } from "../lib/stacked_bar_chart";
import { locale } from "../i18n/index";
import { resolvedTheme } from "../stores/theme";

// A bar chart with one bar for each label, and in each bar one color for each series, one on top of the other. The tab "Work
// of one person" uses it for the commits and the pull requests of each day, and for the AI cost of each day. Like every chart
// of the Statistics window, it has a legend above the bars, and a chart information card that opens beside the bar under the
// pointer. Plotly.js is loaded only when the window opens, so the other windows do not pay for its size.
// Issue: https://github.com/heidrun-org/heidrun/issues/498

const props = defineProps<{
  /** The text under each bar, the same number as the values of each series. */
  labels: string[];
  /** The colors of the bars, from the bottom of a bar to its top. */
  series: StackedBarSeries[];
  /** The first line of the chart information card of each bar, in the order of the bars. */
  titles: string[];
  /** The total of all the colors in each bar, or `null` when the colors cannot be added: the card then shows no total. */
  totals: string[] | null;
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
let hasHoverListeners = false;

/** The bar under the pointer and the place of its chart information card, or `null` while the pointer is not over a bar. */
const hovered = ref<{ index: number; anchor: ChartInformationCardAnchor } | null>(null);

/**
 * The content of the chart information card of the bar under the pointer, or `null` while the pointer is not over a bar. It
 * has the title of the bar, the total when the colors can be added, and one row for each color that has a value in the bar.
 * A chart with one color and a total has no row, because the row would repeat the total.
 */
const card = computed<ChartInformationCardContent | null>(() => {
  if (hovered.value === null) {
    return null;
  }
  const { index } = hovered.value;
  const total = props.totals === null ? null : props.totals[index];
  const rows: ChartInformationCardContent["rows"] = [];
  if (total === null || props.series.length > 1) {
    for (const one of props.series) {
      if (one.values[index] > 0) {
        rows.push({ key: one.name, name: one.name, colorToken: one.colorToken, value: one.valueTexts[index] });
      }
    }
  }
  return { title: props.titles[index], total, rows };
});

/** Shows the chart information card of the bar under the pointer. */
function onHover(event: PlotHoverEvent): void {
  const point = event.points[0];
  const element = chart.value;
  if (point === undefined || element === undefined) {
    return;
  }
  const box = element.getBoundingClientRect();
  const pointerY = event.event.clientY - box.top;
  hovered.value = {
    index: point.pointNumber,
    anchor: ChartInformationCard.anchor(point.pointNumber, props.labels.length, pointerY, box.width, box.height),
  };
}

/** Hides the chart information card when the pointer leaves a bar. */
function onUnhover(): void {
  hovered.value = null;
}

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
    hoverinfo: "none",
    marker: { color: ChartTheme.readColor(one.colorToken, element) },
  }));
  const layout: Partial<Layout> = {
    autosize: true,
    barmode: "stack",
    title: { text: props.title },
    margin: { ...CHART_MARGIN, b: 80 },
    paper_bgcolor: "rgba(0, 0, 0, 0)",
    plot_bgcolor: "rgba(0, 0, 0, 0)",
    font: { color: textColor },
    bargap: CHART_BAR_GAP,
    legend: { ...CHART_LEGEND },
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
watch(
  [resolvedTheme, locale, () => props.labels, () => props.series, () => props.title, () => props.verticalAxisUnit],
  async () => {
    hovered.value = null;
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
  <div class="stacked-bar-chart-box position-relative">
    <div ref="chart" class="stacked-bar-chart" role="img" :aria-label="chartLabel"></div>
    <ChartInformationCardPopover v-if="card !== null && hovered !== null" :content="card" :anchor="hovered.anchor" />
  </div>
</template>

<style scoped>
.stacked-bar-chart-box { width: 100%; height: 100%; }
.stacked-bar-chart { width: 100%; height: 100%; }
</style>
