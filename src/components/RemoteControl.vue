<script setup lang="ts">
import { computed } from "vue";
import { remote, setRcStartup, toggleRemoteControl } from "../stores/claude";
import type { AgentInfo } from "../lib/types";

// Claude Code's Remote Control: follow this session from claude.ai/code or the Claude app.
const props = defineProps<{ pane: AgentInfo }>();

const state = computed(() => remote.byPane[props.pane.pane_id] ?? "off");
const label = computed(() => ({ active: "Connecté", failed: "Connexion échouée", off: "Non connecté" })[state.value]);
const busy = computed(() => props.pane.agent_status === "blocked");
</script>

<template>
  <div class="block">
    <div class="eyebrow">Remote Control</div>
    <div class="row">
      <span class="chip" :class="state"><span class="dot" :class="state === 'active' ? 'working' : state === 'failed' ? 'blocked' : ''"></span>{{ label }}</span>
    </div>
    <p class="hint">
      <template v-if="state === 'active'">Session ouverte sur claude.ai/code et l’app Claude (iPhone, iPad).</template>
      <template v-else>Reprends cette session depuis claude.ai/code ou l’app Claude sur ton téléphone.</template>
    </p>
    <button class="btn" :disabled="busy" :title="busy ? 'L’agent attend une décision' : ''" @click="toggleRemoteControl(pane.pane_id)">
      {{ state === "active" ? "Afficher l’URL et le QR code" : state === "failed" ? "Reconnecter" : "Activer Remote Control" }}
    </button>
    <p v-if="state === 'active'" class="hint">Le panneau s’ouvre dans le terminal ; il permet aussi de déconnecter.</p>
    <label class="check">
      <input type="checkbox" :checked="remote.atStartup === true" @change="(e) => setRcStartup((e.target as HTMLInputElement).checked)" />
      Activer pour toutes les nouvelles sessions Claude
    </label>
  </div>
</template>

<style scoped>
.block { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 12px;
  background: #1d2024; color: var(--text-2); font-size: 12px; font-weight: 600;
}
.chip.active { background: #13282a; color: var(--working); }
.chip.failed { background: #2b2213; color: var(--blocked); }
.hint { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.5; }
.btn { align-self: flex-start; }
.btn:disabled { opacity: 0.5; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.check input { accent-color: var(--done); width: 14px; height: 14px; }
</style>
