<script setup lang="ts">
import { computed } from "vue";
import { quotas } from "../stores/session";
import { claudeLink, disableClaudeLink, enableClaudeLink, setClaudeLineHidden } from "../stores/claude";
import { clockTime, gaugeLevel } from "../lib/format";

// Account limits of the agent's provider, shown next to the agent they constrain.
const props = defineProps<{ provider: "claude" | "codex" }>();

const block = computed(() => quotas.value.find((q) => q.provider === props.provider) ?? null);
const title = computed(() => (props.provider === "claude" ? "Compte Claude" : block.value?.label ?? "Compte Codex"));
</script>

<template>
  <div class="block">
    <div class="eyebrow">{{ title }}</div>
    <template v-if="block && block.windows.length">
      <div v-for="w in block.windows" :key="w.name" class="win">
        <div class="line">
          <span class="muted">{{ w.name }}</span>
          <span class="mono" :class="'lvl-' + gaugeLevel(w.percent)">{{ Math.round(w.percent) }} %</span>
        </div>
        <div class="gauge lg" :class="gaugeLevel(w.percent)"><span :style="{ width: `${Math.min(100, w.percent)}%` }"></span></div>
        <div v-if="w.resetsAt" class="hint">réinitialisé {{ clockTime(w.resetsAt) }}</div>
      </div>
    </template>
    <template v-else-if="provider === 'claude' && claudeLink.loaded && !claudeLink.installed">
      <p class="hint">
        Claude Code ne transmet pas encore ses chiffres à l’app. L’activation branche Herdr Desk sur sa status line,
        et ta status line actuelle reste affichée telle quelle dans le terminal.
      </p>
      <button class="btn" :disabled="claudeLink.busy" @click="enableClaudeLink">Activer le suivi Claude</button>
    </template>
    <p v-else-if="provider === 'claude'" class="hint">En attente de la prochaine réponse de Claude. Les quotas n’existent qu’avec un abonnement Pro ou Max.</p>
    <p v-else class="hint">Pas encore de données : Codex les écrit après sa première réponse.</p>
    <label v-if="provider === 'claude' && claudeLink.installed" class="check">
      <input
        type="checkbox"
        :checked="!claudeLink.hidden"
        @change="(e) => setClaudeLineHidden(!(e.target as HTMLInputElement).checked)"
      />
      Afficher aussi la status line dans le terminal
    </label>
    <button
      v-if="provider === 'claude' && claudeLink.installed"
      class="off"
      :disabled="claudeLink.busy"
      title="Rétablit ta status line d’origine dans ~/.claude/settings.json"
      @click="disableClaudeLink"
    >
      Désactiver le suivi Claude
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
