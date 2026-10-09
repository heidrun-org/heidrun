<script setup lang="ts">
import { quotas, state } from "../stores/session";
import { claudeLink, enableClaudeLink } from "../stores/claude";
import { clockTime, gaugeLevel } from "../lib/format";
</script>

<template>
  <footer class="status">
    <template v-for="q in quotas" :key="q.label">
      <span class="label">{{ q.label }}</span>
      <span v-for="w in q.windows" :key="w.name" class="win">
        {{ w.name }}
        <span class="gauge" :class="gaugeLevel(w.percent)" style="width: 120px"><span :style="{ width: `${Math.min(100, w.percent)}%` }"></span></span>
        <span class="mono" :class="'lvl-' + gaugeLevel(w.percent)">{{ Math.round(w.percent) }} %</span>
        <span v-if="w.resetsAt" class="muted">· reset {{ clockTime(w.resetsAt) }}</span>
      </span>
      <span v-if="q.cost" class="muted">coût estimé <span class="mono val">{{ q.cost.toFixed(2).replace(".", ",") }} $</span></span>
      <span class="sep"></span>
    </template>
    <button
      v-if="!quotas.some((q) => q.provider === 'claude') && claudeLink.loaded && !claudeLink.installed"
      class="link"
      :disabled="claudeLink.busy"
      @click="enableClaudeLink"
    >
      Claude : activer le suivi des quotas
    </button>
    <span v-else-if="!quotas.some((q) => q.provider === 'claude')" class="muted">Claude : en attente de données</span>
    <span class="grow"></span>
    <span class="muted">{{ state.connected ? "connecté" : "hors ligne" }}</span>
  </footer>
</template>

<style scoped>
.status {
  height: 34px; flex-shrink: 0; display: flex; align-items: center; gap: 14px; padding: 0 16px;
  border-top: 1px solid var(--line); background: var(--bar); font-size: 11.5px; color: #9aa0a6;
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
