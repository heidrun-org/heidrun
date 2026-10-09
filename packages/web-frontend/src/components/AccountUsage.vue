<script setup lang="ts">
import { computed } from "vue";
import { quotas } from "../stores/session";
import { claudeLink, disableClaudeLink, enableClaudeLink, setClaudeLineHidden } from "../stores/claude";
import { clockTime, gaugeLevel } from "../lib/format";
import { t } from "../i18n/index";

// Account limits of the agent's provider, shown next to the agent they constrain.
const props = defineProps<{ provider: "claude" | "codex" }>();

const block = computed(() => quotas.value.find((q) => q.provider === props.provider) ?? null);
const title = computed(() => (props.provider === "claude" ? t("accountUsage.claudeAccount") : block.value?.label ?? t("accountUsage.codexAccount")));
</script>

<template>
  <div class="block">
    <div class="eyebrow">{{ title }}</div>
    <template v-if="block && block.windows.length">
      <div v-for="w in block.windows" :key="w.name" class="win">
        <div class="line">
          <span class="muted">{{ w.name }}</span>
          <span class="mono" :class="'lvl-' + gaugeLevel(w.percent)">{{ t("accountUsage.percent", { value: Math.round(w.percent) }) }}</span>
        </div>
        <div class="gauge lg" :class="gaugeLevel(w.percent)"><span :style="{ width: `${Math.min(100, w.percent)}%` }"></span></div>
        <div v-if="w.resetsAt" class="hint">{{ t("accountUsage.resetsAt", { time: clockTime(w.resetsAt) }) }}</div>
      </div>
    </template>
    <template v-else-if="provider === 'claude' && claudeLink.loaded && !claudeLink.installed">
      <p class="hint">
        {{ t("accountUsage.notLinked") }}
      </p>
      <button :title="t('accountUsage.enableTitle')" class="btn" :disabled="claudeLink.busy" @click="enableClaudeLink">{{ t("accountUsage.enable") }}</button>
    </template>
    <p v-else-if="provider === 'claude'" class="hint">{{ t("accountUsage.waitingClaude") }}</p>
    <p v-else class="hint">{{ t("accountUsage.waitingCodex") }}</p>
    <label v-if="provider === 'claude' && claudeLink.installed" class="check">
      <input
        type="checkbox"
        :checked="!claudeLink.hidden"
        @change="(e) => setClaudeLineHidden(!(e.target as HTMLInputElement).checked)"
      />
      {{ t("accountUsage.showStatusLine") }}
    </label>
    <button
      v-if="provider === 'claude' && claudeLink.installed"
      class="off"
      :disabled="claudeLink.busy"
      :title="t('accountUsage.disableTitle')"
      @click="disableClaudeLink"
    >
      {{ t("accountUsage.disable") }}
    </button>
  </div>
</template>

<style scoped>
.block { display: flex; flex-direction: column; gap: 8px; }
.win { display: flex; flex-direction: column; gap: 5px; }
.line { display: flex; justify-content: space-between; font-size: 12px; }
.muted { color: var(--muted); }
.hint { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.5; }
.btn { align-self: flex-start; }
.btn:disabled { opacity: 0.5; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.check input { accent-color: var(--done); width: 14px; height: 14px; }
.off { align-self: flex-start; border: none; background: none; padding: 0; color: var(--faint); font-size: 11px; }
.off:hover { color: var(--text-2); }
</style>
