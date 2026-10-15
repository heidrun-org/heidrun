<script setup lang="ts">
import { computed } from "vue";
import InformationCard from "./InformationCard.vue";
import { gaugeLevel } from "../lib/format";
import { locale, t } from "../i18n/index";
import type { ContextUsage } from "../lib/types";

// The context window of a coding agent, in the header of a pane, as a small ring that fills with the share of the context
// window that the coding agent used. The ring has no word and no number beside it. It has three colors: normal, warning,
// and critical, the same levels as the usage bars (`gaugeLevel`). A click on the ring opens an information card below it,
// with the percent used, the number of tokens used, and the size of the context window. A row of the card is left out when
// the program does not know its number.
const props = defineProps<{
  /** The use of the context window of the coding agent. */
  usage: ContextUsage;
}>();

/** The radius of the ring, in the units of the view box, which is 20 wide: the ring of the status bar has the same size. */
const RING_RADIUS = 7;

/** The length of the ring, which the dash of the arc is measured against. */
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The width of the information card: three short rows need less room than the usual card. */
const CARD_WIDTH = "20rem";

const level = computed(() => gaugeLevel(props.usage.percent));
const ringPercent = computed(() => Math.min(100, Math.max(0, props.usage.percent)));
const ringOffset = computed(() => RING_LENGTH * (1 - ringPercent.value / 100));
const percentText = computed(() => t("usageWheel.percentValue", { value: Math.round(props.usage.percent) }));
const label = computed(() => t("usageWheel.label", { value: Math.round(props.usage.percent) }));

/** The text of a number of tokens, with the separators of the language in use. */
function tokensText(count: number): string {
  return t("usageWheel.tokens", { value: count.toLocaleString(locale.value) });
}
</script>

<template>
  <InformationCard :label="t('usageWheel.title')" placement="bottom" :width="CARD_WIDTH">
    <svg
      class="usage-wheel d-block"
      :class="`lvl-${level}`"
      viewBox="0 0 20 20"
      width="22"
      height="22"
      role="img"
      :aria-label="label"
    >
      <circle class="track" cx="10" cy="10" :r="RING_RADIUS" />
      <circle
        class="arc"
        cx="10"
        cy="10"
        :r="RING_RADIUS"
        :stroke-dasharray="RING_LENGTH"
        :stroke-dashoffset="ringOffset"
        transform="rotate(-90 10 10)"
      />
    </svg>
    <template #card>
      <div class="list-group list-group-flush">
        <div class="list-group-item fw-medium">{{ t("usageWheel.title") }}</div>
        <div class="list-group-item d-flex justify-content-between gap-3" data-field="percent">
          <span class="text-body-secondary">{{ t("usageWheel.percentLabel") }}</span>
          <span class="mono text-nowrap" :class="`lvl-${level}`">{{ percentText }}</span>
        </div>
        <div v-if="usage.used !== undefined" class="list-group-item d-flex justify-content-between gap-3" data-field="used">
          <span class="text-body-secondary">{{ t("usageWheel.usedLabel") }}</span>
          <span class="mono text-nowrap">{{ tokensText(usage.used) }}</span>
        </div>
        <div v-if="usage.size !== undefined" class="list-group-item d-flex justify-content-between gap-3" data-field="size">
          <span class="text-body-secondary">{{ t("usageWheel.sizeLabel") }}</span>
          <span class="mono text-nowrap">{{ tokensText(usage.size) }}</span>
        </div>
      </div>
    </template>
  </InformationCard>
</template>

<style scoped>
.usage-wheel .track { fill: none; stroke: var(--faint); stroke-width: 3; }
.usage-wheel .arc { fill: none; stroke: var(--g-ok); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset 0.4s, stroke 0.4s; }
.usage-wheel.lvl-warn .arc { stroke: var(--g-warn); }
.usage-wheel.lvl-crit .arc { stroke: var(--g-crit); }
</style>
