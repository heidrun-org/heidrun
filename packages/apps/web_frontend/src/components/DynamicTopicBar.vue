<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import {
  nextTopicsScrollLeft,
  previousTopicsScrollLeft,
  scrollLeftToShow,
  type TopicChipBox,
} from "../lib/dynamic_topic_bar";
import { t } from "../i18n/index";

const props = defineProps<{
  /** The topics, the strongest first. The bar adds the button "All" before them. */
  topics: string[];
  /** For each topic, the number of chats that have it. It appears in the title of the button of the topic. */
  chatCounts: Map<string, number>;
  /** The topic that filters the chats, or null when the button "All" is selected. */
  selected: string | null;
}>();

const emit = defineEmits<{
  /** The developer clicked a button: a topic, or null for the button "All". */
  select: [topic: string | null];
}>();

/** The strip that holds the buttons. It never scrolls by itself: only the arrows move it. */
const strip = ref<HTMLElement>();

/** True when buttons are hidden before the visible part of the strip. */
const canShowPrevious = ref(false);

/** True when buttons are hidden after the visible part of the strip. */
const canShowNext = ref(false);

let resizeObserver: ResizeObserver | null = null;

/** Finds out which arrows the strip needs. */
function measure(): void {
  const element = strip.value;
  if (element === undefined) {
    return;
  }
  canShowPrevious.value = element.scrollLeft > 1;
  canShowNext.value = element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
}

/** The place of each button inside the strip. */
function chipBoxes(element: HTMLElement): TopicChipBox[] {
  return Array.from(element.children).map((child) => {
    const chip = child as HTMLElement;
    return { left: chip.offsetLeft, right: chip.offsetLeft + chip.offsetWidth };
  });
}

/** Moves the strip to a place, smoothly when the browser can. */
function scrollStripTo(left: number): void {
  const element = strip.value;
  if (element === undefined) {
    return;
  }
  if (typeof element.scrollTo === "function") {
    element.scrollTo({ left, behavior: "smooth" });
  } else {
    element.scrollLeft = left;
  }
}

/** Shows the next three topics. */
function showNext(): void {
  const element = strip.value;
  if (element !== undefined) {
    scrollStripTo(nextTopicsScrollLeft(chipBoxes(element), element.scrollLeft, element.clientWidth, element.scrollWidth));
  }
}

/** Shows the previous three topics. */
function showPrevious(): void {
  const element = strip.value;
  if (element !== undefined) {
    scrollStripTo(
      previousTopicsScrollLeft(chipBoxes(element), element.scrollLeft, element.clientWidth, element.scrollWidth),
    );
  }
}

onMounted(() => {
  measure();
  if (typeof ResizeObserver !== "undefined" && strip.value !== undefined) {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(strip.value);
  }
});
onBeforeUnmount(() => resizeObserver?.disconnect());
watch(
  () => props.topics,
  () => nextTick(measure),
);

/** Moves the strip so that the selected button is fully visible, when the selection comes from outside the bar. */
async function showSelected(): Promise<void> {
  await nextTick();
  const element = strip.value;
  const selectedChip = element?.querySelector<HTMLElement>(".topic-chip.is-selected");
  if (element === undefined || selectedChip === null || selectedChip === undefined) {
    return;
  }
  const chip = { left: selectedChip.offsetLeft, right: selectedChip.offsetLeft + selectedChip.offsetWidth };
  const left = scrollLeftToShow(chip, element.scrollLeft, element.clientWidth, element.scrollWidth);
  if (left !== element.scrollLeft) {
    scrollStripTo(left);
  }
}
watch(() => props.selected, showSelected);
</script>

<template>
  <div class="topic-bar" role="group" :aria-label="t('chatsPanel.topicBarLabel')">
    <div ref="strip" class="topic-strip d-flex gap-2" @scroll="measure">
      <button
        type="button"
        class="topic-chip"
        :class="{ 'is-selected': selected === null }"
        :aria-pressed="selected === null"
        :title="t('chatsPanel.topicAllTitle')"
        @click="emit('select', null)"
      >
        {{ t("chatsPanel.topicAll") }}
      </button>
      <button
        v-for="topic in topics"
        :key="topic"
        type="button"
        class="topic-chip"
        :class="{ 'is-selected': selected === topic }"
        :aria-pressed="selected === topic"
        :title="t('chatsPanel.topicTitle', { topic, count: chatCounts.get(topic) ?? 0 })"
        @click="emit('select', topic)"
      >
        {{ topic }}
      </button>
    </div>
    <button
      v-if="canShowPrevious"
      type="button"
      class="topic-arrow is-previous"
      :title="t('chatsPanel.topicsPreviousTitle')"
      :aria-label="t('chatsPanel.topicsPreviousTitle')"
      @click="showPrevious"
    >
      <Icon name="chevron-left" />
    </button>
    <button
      v-if="canShowNext"
      type="button"
      class="topic-arrow is-next"
      :title="t('chatsPanel.topicsNextTitle')"
      :aria-label="t('chatsPanel.topicsNextTitle')"
      @click="showNext"
    >
      <Icon name="chevron-right" />
    </button>
  </div>
</template>

<style scoped>
.topic-bar { position: relative; }
.topic-strip { position: relative; overflow: hidden; }
.topic-chip {
  flex: none; white-space: nowrap; border: 0; border-radius: var(--bs-border-radius-pill); padding: 0.2rem 0.75rem;
  background: var(--bs-secondary-bg); color: var(--bs-body-color); font-size: 0.9em;
}
.topic-chip:hover { background: var(--bs-border-color); }
.topic-chip.is-selected { background: var(--bs-body-color); color: var(--bs-body-bg); }
.topic-arrow {
  position: absolute; top: 0; bottom: 0; width: 44px; border: 0; padding: 0; color: var(--bs-body-color);
  display: flex; align-items: center;
}
.topic-arrow.is-previous { left: 0; justify-content: flex-start; background: linear-gradient(to right, var(--side) 55%, transparent); }
.topic-arrow.is-next { right: 0; justify-content: flex-end; background: linear-gradient(to left, var(--side) 55%, transparent); }
.topic-arrow:hover { color: var(--bs-emphasis-color); }
</style>
