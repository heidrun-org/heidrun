<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { settings } from "../stores/settings";
import { clockTime, gaugeLevel, quotaPace, quotaRingWindow } from "../lib/format";
import { locale, t } from "../i18n/index";
import { useStatusCard } from "../lib/status_card";
import type { QuotaBlock } from "../lib/types";

// One account in the status bar: its name and a small ring that fills with the usage of its shortest window.
// A click on it shows a Bootstrap popover with every window, its percentage, and its reset time.
const props = defineProps<{ quota: QuotaBlock }>();

const root = ref<HTMLElement | null>(null);
const { isOpen, toggle, onFocusOut } = useStatusCard(root);

// The Bootstrap classes of each level: the color of the percentage, the color of the usage bar, and the kind of notice.
const LEVEL_CLASSES = {
  ok: { text: "text-success-emphasis", bar: "bg-success", alert: "alert-success" },
  warn: { text: "text-warning-emphasis", bar: "bg-warning", alert: "alert-warning" },
  crit: { text: "text-danger-emphasis", bar: "bg-danger", alert: "alert-danger" },
};

const RING_RADIUS = 7;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const nowSeconds = ref(Date.now() / 1000);
const clock = window.setInterval(() => {
  nowSeconds.value = Date.now() / 1000;
}, 30_000);
onBeforeUnmount(() => window.clearInterval(clock));

const paces = computed(() => props.quota.windows.map((w) => quotaPace(w, nowSeconds.value, settings.workingDays)));

function paceText(pace: NonNullable<ReturnType<typeof quotaPace>>) {
  if (pace.level === "crit") {
    return t("statusBar.paceCrit", { reduce: Math.round(pace.reducePercent ?? 0) });
  }
  return t(pace.level === "warn" ? "statusBar.paceWarn" : "statusBar.paceOk", { value: Math.round(pace.projectedPercent) });
}

const accountName = computed(() => props.quota.label.split(" · ")[0]);
const ringWindow = computed(() => quotaRingWindow(props.quota.windows));
const ringPercent = computed(() => Math.min(100, Math.max(0, ringWindow.value?.percent ?? 0)));
const ringOffset = computed(() => RING_LENGTH * (1 - ringPercent.value / 100));

function formatCost(cost: number) {
  const value = cost.toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t("statusBar.costValue", { value });
}
</script>

<template>
  <div
    ref="root"
    class="quota"
    tabindex="0"
    :data-provider="quota.provider"
    @click="toggle"
    @keydown.enter.self.prevent="toggle"
    @keydown.space.self.prevent="toggle"
    @focusout="onFocusOut"
  >
    <span class="label">{{ accountName }}</span>
    <svg class="ring" viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
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
    <span v-if="ringWindow" class="mono percent">{{ Math.round(ringWindow.percent) }}<span class="unit">%</span></span>
    <div v-if="isOpen" class="popover bs-popover-top position-absolute bottom-100" role="tooltip" @click.stop>
      <div class="popover-arrow position-absolute ms-3"></div>
      <div class="popover-body d-flex flex-column gap-3">
        <div v-for="(w, index) in quota.windows" :key="w.id" class="d-flex flex-column gap-2" data-field="window">
          <div class="d-flex justify-content-between gap-3">
            <span>{{ w.name }}</span>
            <span :class="LEVEL_CLASSES[gaugeLevel(w.percent)].text">{{ Math.round(w.percent) }} %</span>
          </div>
          <div
            class="progress position-relative"
            role="progressbar"
            :aria-valuenow="Math.round(w.percent)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="progress-bar"
              :class="LEVEL_CLASSES[gaugeLevel(w.percent)].bar"
              :style="{ width: `${Math.min(100, w.percent)}%` }"
            ></div>
            <span
              v-if="paces[index]"
              class="position-absolute top-0 bottom-0 bg-body-emphasis"
              data-field="expected-usage"
              :style="{ left: `${paces[index]?.elapsedPercent}%`, width: '2px' }"
              :title="t('statusBar.expectedNow')"
            ></span>
          </div>
          <div v-if="w.resetsAt" class="d-flex justify-content-between gap-3 text-body-secondary">
            <span>{{ t("statusBar.resetsAt", { time: clockTime(w.resetsAt) }) }}</span>
            <span v-if="paces[index]?.runsOutAt" class="fw-medium text-danger-emphasis">
              {{ t("statusBar.runsOut", { time: clockTime(paces[index]?.runsOutAt) }) }}
            </span>
          </div>
          <div v-if="paces[index]" class="alert" :class="LEVEL_CLASSES[paces[index]!.level].alert" data-field="pace">
            <div class="fw-medium">{{ t("statusBar.pace", { value: Math.round(paces[index]?.pacePercent ?? 0) }) }}</div>
            <div>{{ paceText(paces[index]!) }}</div>
          </div>
        </div>
        <div v-if="quota.cost" class="d-flex justify-content-between gap-3">
          <span>{{ t("statusBar.estimatedCost") }}</span>
          <span>{{ formatCost(quota.cost) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quota { align-self: stretch; margin: 0 -11px; padding: 0 11px; display: flex; align-items: center; gap: 10px; cursor: pointer; outline-offset: 3px; }
.label { font-weight: 600; font-size: var(--font-size); color: var(--text-2); }
.percent { font-size: var(--font-size); }
.percent { color: var(--text-2); }
.unit { margin-left: 2px; font-size: 0.8em; color: var(--muted); }
.ring .track { fill: none; stroke: var(--gauge-track); stroke-width: 3; }
.ring .arc { fill: none; stroke: var(--done); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset 0.4s; }
</style>
