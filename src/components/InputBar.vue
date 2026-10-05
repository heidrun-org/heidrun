<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { runInNewPane, runInPane, selectedPane, sendPrompt, state, workspacePanes } from "../stores/session";
import { paneName } from "../lib/format";

const text = ref("");
const target = ref<string | null>(null);
const newPane = ref(true);
const notifyEnd = ref(false);
const field = ref<HTMLTextAreaElement>();

// The field grows with its content (up to 8 lines, then it scrolls).
function autosize() {
  const t = field.value;
  if (!t) return;
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 8 * 20 + 20)}px`;
}
watch(text, () => nextTick(autosize));

// ↵ sends; ⇧↵ or ⌥↵ adds a line.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.isComposing) return;
  if (e.shiftKey || e.altKey) {
    if (e.altKey) {
      // ⌥↵ does not insert a line by itself in a textarea.
      e.preventDefault();
      const t = e.target as HTMLTextAreaElement;
      t.setRangeText("\n", t.selectionStart, t.selectionEnd, "end");
      text.value = t.value;
    }
    return;
  }
  if (e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  submit();
}

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
    <textarea
      id="input"
      ref="field"
      v-model="text"
      rows="1"
      :class="{ mono: mode === 'command' }"
      :placeholder="mode === 'agent' ? `Envoyer une consigne à ${targetPane ? paneName(targetPane) : 'l’agent'}…  (⇧↵ nouvelle ligne)` : 'Lancer une commande…  (⇧↵ nouvelle ligne)'"
      autocomplete="off"
      spellcheck="false"
      @keydown="onKeydown"
    ></textarea>
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
  display: flex; align-items: flex-end; gap: 10px;
}
.bar > .check, .bar > .prompt { align-self: center; }
.target, textarea {
  height: 40px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text); outline: none;
}
.target { padding: 0 10px; max-width: 200px; font-size: 12px; font-weight: 500; }
textarea {
  flex: 1; min-width: 0; padding: 10px 14px; font: inherit; font-size: 13px; line-height: 20px;
  resize: none; overflow-y: auto; display: block;
}
textarea.mono { font-family: var(--mono, ui-monospace, monospace); }
textarea:focus { border-color: #3a4048; }
.prompt { color: var(--working); font-size: 14px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.check input { accent-color: var(--working); width: 15px; height: 15px; }
.send { padding: 0 16px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
