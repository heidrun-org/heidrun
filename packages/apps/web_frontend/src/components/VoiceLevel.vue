<script setup lang="ts">
import { computed } from "vue";
import { LEVEL_COUNT } from "../stores/voice_input";
import { t } from "../i18n/index";

// The level bars (issue 662): a row of thin vertical bars that show how loud the voice was in the last two seconds. The newest
// level is on the right. A silent moment is a dot. The row always has the same number of bars, so the row does not grow.
const props = defineProps<{
  /** The levels from 0 to 1, the newest last. There can be fewer than the bars: the bars on the left then stay dots. */
  levels: number[];
}>();

/** The smallest and the largest height of a bar, in pixels. */
const DOT_HEIGHT_PX = 4;
const BAR_MAX_HEIGHT_PX = 36;

const heights = computed(() => {
  const shown = props.levels.slice(-LEVEL_COUNT);
  const padding = new Array<number>(LEVEL_COUNT - shown.length).fill(0);
  return [...padding, ...shown].map((level) => {
    const clamped = Math.min(1, Math.max(0, level));
    return Math.round(DOT_HEIGHT_PX + clamped * (BAR_MAX_HEIGHT_PX - DOT_HEIGHT_PX));
  });
});
</script>

<template>
  <div class="voice-level d-flex align-items-center" role="img" :aria-label="t('voiceInput.levelLabel')">
    <span v-for="(height, index) in heights" :key="index" class="bar" :style="{ height: `${height}px` }"></span>
  </div>
</template>

<style scoped>
.voice-level { flex: 0 1 auto; min-width: 0; overflow: hidden; justify-content: flex-end; gap: 3px; height: 40px; color: var(--muted); }
.bar { flex: none; width: 4px; border-radius: 2px; background: currentColor; }
</style>
