<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { runInNewPane, runInPane, selectedPane, sendPrompt, state, workspacePanes } from "../stores/session";
import { paneName } from "../lib/format";

const text = ref("");
const target = ref<string | null>(null);
const newPane = ref(true);
const notifyEnd = ref(false);

// Follows the selection: an agent pane gets prompts, a terminal gets commands.
watch(
  () => state.selectedPaneId,
  (id) => {
    target.value = id;
  },
  { immediate: true },
);

const targetPane = computed(() => workspacePanes.value.find((p) => p.pane_id === target.value) ?? selectedPane.value);
const mode = computed<"agent" | "command">(() => (targetPane.value?.agent ? "agent" : "command"));
const agents = computed(() => workspacePanes.value.filter((p) => p.agent));
const terminals = computed(() => workspacePanes.value.filter((p) => !p.agent));

async function submit() {
  const value = text.value.trim();
  if (!value) return;
  const pane = targetPane.value;
  if (mode.value === "agent" && pane) {
    await sendPrompt(pane.pane_id, value);
  } else if (newPane.value || !pane) {
    await runInNewPane(value, notifyEnd.value ? "passed|failed|error|Error|✓|✗|done|Done" : undefined);
  } else {
    await runInPane(pane.pane_id, value);
  }
  text.value = "";
}
</script>

<template>
  <form class="bar" @submit.prevent="submit">
    <label class="sr" for="target">Destinataire</label>
    <select id="target" v-model="target" class="target">
      <optgroup v-if="agents.length" label="Agents">
        <option v-for="a in agents" :key="a.pane_id" :value="a.pane_id">{{ paneName(a) }}</option>
      </optgroup>
      <optgroup v-if="terminals.length" label="Terminaux">
        <option v-for="t in terminals" :key="t.pane_id" :value="t.pane_id">{{ paneName(t) }} ({{ t.pane_id }})</option>
      </optgroup>
    </select>
    <span v-if="mode === 'command'" class="prompt mono">$</span>
    <label class="sr" for="input">{{ mode === "agent" ? "Consigne pour l’agent" : "Commande à lancer" }}</label>
    <input
      id="input"
      v-model="text"
      :class="{ mono: mode === 'command' }"
      :placeholder="mode === 'agent' ? `Envoyer une consigne à ${targetPane ? paneName(targetPane) : 'l’agent'}…` : 'Lancer une commande…'"
      autocomplete="off"
      spellcheck="false"
    />
    <template v-if="mode === 'command'">
      <label class="check"><input v-model="newPane" type="checkbox" />Nouveau panneau</label>
      <label class="check"><input v-model="notifyEnd" type="checkbox" :disabled="!newPane" />Me notifier</label>
    </template>
    <button class="btn lg primary send" type="submit">{{ mode === "agent" ? "Envoyer" : "Lancer" }} ↵</button>
  </form>
</template>

<style scoped>
.bar {
  flex-shrink: 0; padding: 14px 16px; border-top: 1px solid var(--line); background: var(--panel);
  display: flex; align-items: center; gap: 10px;
}
.target, input:not([type="checkbox"]) {
  height: 40px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text); outline: none;
}
.target { padding: 0 10px; max-width: 200px; font-size: 12px; font-weight: 500; }
input:not([type="checkbox"]) { flex: 1; min-width: 0; padding: 0 14px; font-size: 13px; }
input:focus { border-color: #3a4048; }
.prompt { color: var(--working); font-size: 14px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.check input { accent-color: var(--working); width: 15px; height: 15px; }
.send { padding: 0 16px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
