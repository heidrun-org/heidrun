<script setup lang="ts">
import { quotas, state } from "../stores/session";
import { claudeLink, enableClaudeLink } from "../stores/claude";
import AgentStatusSummary from "./AgentStatusSummary.vue";
import GitStatusSummary from "./GitStatusSummary.vue";
import QuotaSummary from "./QuotaSummary.vue";
import { t } from "../i18n/index";
</script>

<template>
  <footer class="status">
    <template v-for="(q, index) in quotas" :key="q.label">
      <span v-if="index > 0" class="sep"></span>
      <QuotaSummary :quota="q" />
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
    <span class="sep"></span>
    <GitStatusSummary />
    <span class="grow"></span>
    <AgentStatusSummary />
    <span class="sep"></span>
    <span class="machine" :title="state.error || t('statusBar.connectedTitle')">
      <span class="dot" :class="state.connected ? 'working-static' : 'offline'"></span>
      {{ t("statusBar.local") }} · {{ state.snapshot ? `Herdr ${state.snapshot.version}` : t("statusBar.offline") }}
    </span>
  </footer>
</template>

<style scoped>
.status {
  height: 40px; flex-shrink: 0; display: flex; align-items: center; gap: 22px; padding: 0 16px;
  border-top: 1px solid var(--line); background: var(--bar); font-size: var(--font-size); color: var(--muted-2);
  white-space: nowrap; position: relative;
}
.muted { color: var(--muted); }
.sep { width: 1px; height: 14px; background: var(--line-strong); }
.grow { flex: 1; }
.machine { display: flex; align-items: center; gap: 8px; color: var(--muted); }
.working-static { background: var(--working); }
.offline { background: var(--fail); }
.link { border: none; background: none; padding: 0; color: var(--done); font-size: var(--font-size); }
.link:hover { text-decoration: underline; }
</style>
