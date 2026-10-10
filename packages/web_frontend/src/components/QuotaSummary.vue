<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { settings } from "../stores/settings";
import { clockTime, gaugeLevel, quotaPace, quotaRingWindow } from "../lib/format";
import { locale, t } from "../i18n/index";
import type { QuotaBlock } from "../lib/types";

// One account in the status bar: its name and a small ring that fills with the usage of its shortest window.
// Hovering or focusing it shows a card with every window, its percentage, and its reset time.
const props = defineProps<{ quota: QuotaBlock }>();

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
const planName = computed(() => props.quota.label.split(" · ")[1] ?? "");
const ringWindow = computed(() => quotaRingWindow(props.quota.windows));
const ringPercent = computed(() => Math.min(100, Math.max(0, ringWindow.value?.percent ?? 0)));
const ringOffset = computed(() => RING_LENGTH * (1 - ringPercent.value / 100));

function formatCost(cost: number) {
  const value = cost.toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t("statusBar.costValue", { value });
}
</script>

<template>
  <span class="quota" tabindex="0" :data-provider="quota.provider">
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
    <span class="card" role="tooltip">
      <span class="card-head">
        <span class="card-title">{{ accountName }}</span>
        <span v-if="planName" class="card-plan">{{ t("statusBar.plan") }} <span class="card-plan-name">{{ planName }}</span></span>
      </span>
      <span v-for="(w, index) in quota.windows" :key="w.id" class="card-window">
        <span class="card-line">
          <span>{{ w.name }}</span>
          <span class="mono" :class="'lvl-' + gaugeLevel(w.percent)">{{ Math.round(w.percent) }} %</span>
        </span>
        <span class="bar">
          <span class="gauge" :class="gaugeLevel(w.percent)"><span :style="{ width: `${Math.min(100, w.percent)}%` }"></span></span>
          <span v-if="paces[index]" class="tick" :style="{ left: `${paces[index]?.elapsedPercent}%` }" :title="t('statusBar.expectedNow')"></span>
        </span>
        <span v-if="w.resetsAt" class="card-hint card-line">
          <span>{{ t("statusBar.resetsAt", { time: clockTime(w.resetsAt) }) }}</span>
          <span v-if="paces[index]?.runsOutAt" class="runs-out">{{ t("statusBar.runsOut", { time: clockTime(paces[index]?.runsOutAt) }) }}</span>
        </span>
        <span v-if="paces[index]" class="pace" :class="'pace-' + paces[index]?.level">
          <span class="pace-title">{{ t("statusBar.pace", { value: Math.round(paces[index]?.pacePercent ?? 0) }) }}</span>
          <span>{{ paceText(paces[index]!) }}</span>
        </span>
      </span>
      <span v-if="quota.cost" class="card-line">
        <span>{{ t("statusBar.estimatedCost") }}</span>
        <span class="mono">{{ formatCost(quota.cost) }}</span>
      </span>
    </span>
  </span>
</template>

<style scoped>
.quota { position: relative; align-self: stretch; margin: 0 -11px; padding: 0 11px; display: flex; align-items: center; gap: 10px; cursor: default; outline-offset: 3px; }
.label { font-weight: 600; font-size: var(--font-size); color: var(--text-2); }
.percent { font-size: var(--font-size); }
.percent { color: var(--text-2); }
.unit { margin-left: 2px; font-size: 0.8em; color: var(--muted); }
.ring .track { fill: none; stroke: var(--gauge-track); stroke-width: 3; }
.ring .arc { fill: none; stroke: var(--done); stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset 0.4s; }
.card {
  display: flex; visibility: hidden; transition: visibility 0s linear 0.1s; position: absolute; bottom: calc(100% + 4px); left: 11px; z-index: 20; width: 340px;
  flex-direction: column; gap: 14px; padding: 16px 18px; white-space: normal;
  border: 1px solid var(--line-modal); border-radius: 8px; background: var(--panel); color: var(--text-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font-size: var(--font-size);
}
.card::after {
  content: ""; position: absolute; top: 100%; left: 18px; width: 10px; height: 10px; margin-top: -6px;
  transform: rotate(45deg); border: solid var(--line-modal); border-width: 0 1px 1px 0; background: var(--panel);
}
.quota:hover .card, .quota:focus-visible .card { visibility: visible; transition-delay: 0s; }
.card-head { display: flex; justify-content: space-between; align-items: baseline; }
.card-plan { color: var(--muted); }
.card-plan-name { color: var(--text); font-weight: 500; }
.card-title { font-weight: 600; font-size: var(--font-size); color: var(--text); }
.card-window { display: flex; flex-direction: column; gap: 5px; }
.card-line { display: flex; justify-content: space-between; }
.bar { position: relative; display: block; }
.bar .gauge { display: block; }
.tick { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--text); }
.pace { display: flex; flex-direction: column; gap: 2px; margin-top: 9px; padding: 8px 10px; border-radius: 6px; }
.pace-title { font-weight: 500; }
.pace-ok { background: rgba(95, 191, 122, 0.12); }
.pace-ok .pace-title { color: #7fd197; }
.pace-warn { background: rgba(240, 166, 58, 0.14); }
.pace-warn .pace-title { color: #f4b75a; }
.pace-crit { background: rgba(234, 106, 95, 0.15); }
.pace-crit .pace-title { color: #f07f75; }
.runs-out { color: #f07f75; font-weight: 500; }
.card-hint { font-size: var(--font-size); color: var(--muted); }
</style>
