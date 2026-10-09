<script setup lang="ts">
import { computed } from "vue";
import { remote, setRcStartup, toggleRemoteControl } from "../stores/claude";
import { copy } from "../lib/clipboard";
import { toast } from "../stores/session";
import type { AgentInfo } from "../lib/types";

// Claude Code's Remote Control: follow this session from claude.ai/code or the Claude app.
const props = defineProps<{ pane: AgentInfo }>();

const state = computed(() => remote.byPane[props.pane.pane_id] ?? "off");
const label = computed(() => ({ active: "Connecté", failed: "Connexion échouée", off: "Non connecté" })[state.value]);
const url = computed(() => remote.urls[props.pane.pane_id]);

async function copyUrl() {
  if (!url.value) return;
  await copy(url.value);
  toast("Lien de la session copié");
}

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
    <button v-if="state === 'active' && url" class="btn" @click="remote.openFor = pane.pane_id">Afficher l’URL et le QR code</button>
    <button v-else class="btn" :disabled="busy" :title="busy ? 'L’agent attend une décision' : ''" @click="toggleRemoteControl(pane.pane_id)">
      {{ state === "failed" ? "Reconnecter" : state === "active" ? "Ouvrir le panneau Remote Control" : "Activer Remote Control" }}
    </button>
    <div v-if="state === 'active' && url" class="url">
      <span class="mono">{{ url.replace("https://", "") }}</span>
      <button class="btn small" @click="copyUrl">Copier</button>
    </div>

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
.chip.failed { background: #301817; color: var(--blocked); }
.hint { margin: 0; font-size: 11px; color: var(--muted); line-height: 1.5; }
.btn { align-self: flex-start; }
.btn:disabled { opacity: 0.5; }
.url { display: flex; align-items: center; gap: 6px; padding: 6px 6px 6px 10px; border-radius: 8px; background: var(--field); }
.url .mono { flex: 1; min-width: 0; font-size: 11px; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: text; }
.btn.small { height: 24px; padding: 0 8px; font-size: 11px; }
.check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); }
.check input { accent-color: var(--done); width: 14px; height: 14px; }
</style>
