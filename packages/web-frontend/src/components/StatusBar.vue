<script setup lang="ts">
import { quotas, state } from "../stores/session";
import { claudeLink, enableClaudeLink } from "../stores/claude";
import { clockTime, gaugeLevel } from "../lib/format";
import { locale, t } from "../i18n/index";

function formatCost(cost: number) {
  const value = cost.toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return t("statusBar.costValue", { value });
}
</script>

<template>
  <footer class="status">
    <template v-for="q in quotas" :key="q.label">
      <span class="label">{{ q.label }}</span>
      <span v-for="w in q.windows" :key="w.name" class="win">
        {{ w.name }}
        <span class="gauge" :class="gaugeLevel(w.percent)" style="width: 120px"><span :style="{ width: `${Math.min(100, w.percent)}%` }"></span></span>
        <span class="mono" :class="'lvl-' + gaugeLevel(w.percent)">{{ Math.round(w.percent) }} %</span>
        <span v-if="w.resetsAt" class="muted">{{ t("statusBar.reset", { time: clockTime(w.resetsAt) }) }}</span>
      </span>
      <span v-if="q.cost" class="muted">{{ t("statusBar.estimatedCost") }} <span class="mono val">{{ formatCost(q.cost) }}</span></span>
      <span class="sep"></span>
    </template>
    <button :title="t('statusBar.enableTrackingTitle')"
      v-if="!quotas.some((q) => q.provider === 'claude') && claudeLink.loaded && !claudeLink.installed"
      class="link"
      :disabled="claudeLink.busy"
      @click="enableClaudeLink"
    >
      {{ t("statusBar.enableTracking") }}
    </button>
    <span v-else-if="!quotas.some((q) => q.provider === 'claude')" class="muted">{{ t("statusBar.waitingForData") }}</span>
    <span class="grow"></span>
    <span class="muted">{{ state.connected ? t("statusBar.connected") : t("statusBar.offline") }}</span>
  </footer>
</template>

<style scoped>
.status {
  height: 34px; flex-shrink: 0; display: flex; align-items: center; gap: 14px; padding: 0 16px;
  border-top: 1px solid var(--line); background: var(--bar); font-size: 11.5px; color: var(--muted-2);
  white-space: nowrap; overflow: hidden;
}
.label { font-weight: 600; color: var(--text-2); }
.win { display: flex; align-items: center; gap: 8px; }
.val { color: var(--text-2); }
.muted { color: var(--muted); }
.sep { width: 1px; height: 14px; background: var(--line-strong); }
.grow { flex: 1; }
.link { border: none; background: none; padding: 0; color: var(--done); font-size: 11.5px; }
.link:hover { text-decoration: underline; }
</style>
