<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch, type CSSProperties } from "vue";
import {
  ChartInformationCard,
  type ChartInformationCardAnchor,
  type ChartInformationCardContent,
} from "../lib/chart_information_card";
import { t } from "../i18n/index";

// The chart information card of one bar of a chart of the Statistics window, drawn as a Bootstrap popover. It opens while the
// pointer is over the bar, so the chart shows it only while a bar is hovered, and it never takes the pointer. It sits beside
// the bar, with an arrow that points to the bar at the height of the pointer, so the developer sees which bar it is about.
// Its middle is at the height of the pointer, and it stays inside the chart. The chart that shows it is its parent, and the
// parent has the class "position-relative", because the card is placed from the corner of the chart. Every chart of the
// Statistics window uses this component for its card.
// Issue: https://github.com/heidrun-org/heidrun/issues/498

const props = defineProps<{
  /** What the card says: the title, the total, and one row for each series that has a value in the bar. */
  content: ChartInformationCardContent;
  /** Where the card sits: beside the bar, at the height of the pointer. */
  anchor: ChartInformationCardAnchor;
}>();

/** The space between the tip of the arrow and the bar, in pixels. */
const ARROW_TIP_SPACE = 2;

const popover = ref<HTMLDivElement>();

/** The distance from the top of the chart to the top of the card, in pixels. */
const top = ref(0);

/** The distance from the top of the card to the top of its arrow, in pixels. */
const arrowTop = ref(0);

/** The side of the Bootstrap popover that follows the side of the bar: a card at the end of the bar has its arrow at its start. */
const placementClass = computed(() => (props.anchor.side === "end" ? "bs-popover-end" : "bs-popover-start"));

/**
 * The style of the card: it touches the edge of the bar on its side, with the space of the arrow between them. The card
 * never takes the pointer, so the pointer stays over the bar.
 */
const style = computed<CSSProperties>(() => {
  const space = `var(--popover-arrow-height) + ${ARROW_TIP_SPACE}px`;
  const { side, edge, chartWidth } = props.anchor;
  const horizontal = side === "end" ? { left: `calc(${edge}px + ${space})` } : { right: `calc(${chartWidth - edge}px + ${space})` };
  return { ...horizontal, top: `${top.value}px`, pointerEvents: "none" };
});

/** Puts the middle of the card, and its arrow, at the height of the pointer, once the page has drawn the card. */
function place(): void {
  const element = popover.value;
  if (element === undefined) {
    return;
  }
  const height = element.offsetHeight;
  top.value = ChartInformationCard.top(props.anchor.pointerY, height, props.anchor.chartHeight);
  arrowTop.value = ChartInformationCard.arrowTop(props.anchor.pointerY, top.value, height);
}

onMounted(place);

watch(
  () => [props.anchor, props.content],
  async () => {
    await nextTick();
    place();
  },
);
</script>

<template>
  <div ref="popover" class="popover popover-instant show position-absolute" :class="placementClass" role="tooltip" :style="style">
    <div class="popover-arrow position-absolute" :style="{ top: `${arrowTop}px` }"></div>
    <div class="popover-body d-flex flex-column gap-2">
      <div class="fw-semibold">{{ content.title }}</div>
      <div v-if="content.total !== null" class="d-flex justify-content-between gap-3" data-field="total">
        <span class="text-body-secondary">{{ t("statisticsModal.cardTotal") }}</span>
        <span>{{ content.total }}</span>
      </div>
      <div v-if="content.rows.length > 0" class="d-flex flex-column gap-1" :class="{ 'border-top pt-2': content.total !== null }">
        <div v-for="row in content.rows" :key="row.key" class="d-flex justify-content-between gap-3" data-field="row">
          <span class="d-flex align-items-center">
            <span
              class="d-inline-flex me-2"
              aria-hidden="true"
              :style="{ width: '0.75em', height: '0.75em', borderRadius: '50%', background: `var(${row.colorToken})` }"
            ></span>
            {{ row.name }}
          </span>
          <span>{{ row.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The arrow is larger than the arrow of Bootstrap, so the developer sees at once which bar the card is about. */
.popover { --popover-arrow-width: 1.5rem; --popover-arrow-height: 0.75rem; }
</style>
