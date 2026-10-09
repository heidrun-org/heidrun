<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { agentCommand, launchAgent, listAgents, newAgent, type AgentDef } from "../stores/agents";
import { selectedPane, selectedWorkspace, workspaceLabel } from "../stores/session";
import { projectPrompts, prompts } from "../stores/prompts";
import { insertIntoFocusedPane } from "../stores/input";
import { newTerminal } from "../stores/session";
import { t } from "../i18n/index";

const cwd = computed(() => selectedPane.value?.foreground_cwd || selectedPane.value?.cwd || null);
const agents = ref<AgentDef[]>([]);
const loading = ref(true);
const tool = ref<"terminal" | "claude" | "codex">("claude");
const agent = ref<string | null>(null);
const model = ref("");
const label = ref("");
const labelTouched = ref(false);
const text = ref("");
const busy = ref(false);
const first = ref<HTMLElement>();

const chosen = computed(() => agents.value.find((a) => a.name === agent.value) ?? null);
const templates = computed(() => [...projectPrompts.value, ...prompts.personal]);
const MODELS = { claude: ["opus", "sonnet", "haiku"], codex: ["gpt-5-codex", "gpt-5"], terminal: [] as string[] };
const command = computed(() => {
  if (tool.value === "terminal") return "";
  try {
    return agentCommand(tool.value, tool.value === "claude" ? agent.value : null, model.value.trim() || null);
  } catch (e) {
    return String((e as Error).message);
  }
});

// The tab is named after the agent until the user types a name.
watch([agent, tool], () => {
  if (!labelTouched.value) label.value = (tool.value === "claude" && agent.value) || tool.value;
}, { immediate: true });

onMounted(async () => {
  agents.value = await listAgents(cwd.value);
  loading.value = false;
  nextTick(() => first.value?.focus());
});

function useTemplate(e: Event) {
  const id = (e.target as HTMLSelectElement).value;
  const t = templates.value.find((x) => x.id === id);
  if (t) text.value = text.value ? `${text.value}\n\n${t.text}` : t.text;
  (e.target as HTMLSelectElement).value = "";
}

function close() {
  if (!busy.value) newAgent.open = false;
}

async function go() {
  const ws = selectedWorkspace.value;
  if (!ws || busy.value) return;
  if (tool.value === "terminal") {
    newAgent.open = false;
    newTerminal();
    return;
  }
  busy.value = true;
  const prompt = text.value;
  // The window closes right away: launching and waiting for the agent take a while.
  newAgent.open = false;
  const res = await launchAgent({
    workspaceId: ws.workspace_id,
    cwd: cwd.value,
    tool: tool.value,
    agent: tool.value === "claude" ? agent.value : null,
    model: model.value.trim() || null,
    label: label.value.trim(),
    prompt,
  });
  // Not sent: kept in the input bar so nothing is lost.
  if (res === "failed" && prompt.trim()) insertIntoFocusedPane(prompt);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  } else if (e.key === "Enter" && e.metaKey) {
    e.preventDefault();
    go();
  }
}
</script>

<template>
  <div class="overlay" @mousedown.self="close" @keydown="onKey">
    <div class="dialog" role="dialog" aria-labelledby="na-title">
      <div class="eyebrow">{{ t("newAgentModal.eyebrow") }}</div>
      <h2 id="na-title">{{ selectedWorkspace ? t("newAgentModal.titleIn", { workspace: workspaceLabel(selectedWorkspace.workspace_id) }) : t("newAgentModal.titleInWorkspace") }}</h2>
      <p class="where mono">{{ cwd ?? t("newAgentModal.workspaceFolder") }}</p>

      <div class="seg" role="radiogroup" :aria-label="t('newAgentModal.toolLabel')">
        <button :title="t('newAgentModal.useTerminal')" :class="{ on: tool === 'terminal' }" @click="tool = 'terminal'">{{ t("newAgentModal.terminal") }}</button>
        <button :title="t('newAgentModal.useClaude')" ref="first" :class="{ on: tool === 'claude' }" @click="tool = 'claude'">Claude Code</button>
        <button :title="t('newAgentModal.useCodex')" :class="{ on: tool === 'codex' }" @click="tool = 'codex'">Codex</button>
      </div>

      <template v-if="tool === 'claude'">
        <div class="field-label">{{ t("newAgentModal.agent") }}</div>
        <div class="agents" role="radiogroup" :aria-label="t('newAgentModal.agent')">
          <button :title="t('newAgentModal.freeAgentTitle')" class="agent" :class="{ on: agent === null }" @click="agent = null">
            <span class="a-name">{{ t("newAgentModal.freeAgent") }}</span><span class="a-desc">{{ t("newAgentModal.freeAgentDescription") }}</span>
          </button>
          <div v-if="loading" class="muted small">{{ t("newAgentModal.loading") }}</div>
          <button :title="t('newAgentModal.startThisAgent')" v-for="a in agents" :key="a.name" class="agent" :class="{ on: agent === a.name }" @click="agent = a.name">
            <span class="a-name">{{ a.name }}<span class="src">{{ a.source }}</span><span v-if="a.model" class="src">{{ a.model }}</span></span>
            <span class="a-desc">{{ a.description || "—" }}</span>
          </button>
          <div v-if="!loading && !agents.length" class="muted small">{{ t("newAgentModal.noAgents") }}</div>
        </div>
      </template>

      <div v-if="tool !== 'terminal'" class="grid">
        <label>
          <span class="field-label">{{ t("newAgentModal.model") }}</span>
          <input v-model="model" list="na-models" :placeholder="chosen?.model ? t('newAgentModal.agentModel', { model: chosen.model }) : t('newAgentModal.defaultModel')" spellcheck="false" />
          <datalist id="na-models"><option v-for="m in MODELS[tool]" :key="m" :value="m" /></datalist>
        </label>
        <label>
          <span class="field-label">{{ t("newAgentModal.tabName") }}</span>
          <input v-model="label" spellcheck="false" @input="labelTouched = true" />
        </label>
      </div>

      <label v-if="tool !== 'terminal'" class="block">
        <span class="field-label row-label">
          {{ t("newAgentModal.prompt") }} <span class="muted">{{ t("newAgentModal.promptHint") }}</span>
          <select v-if="templates.length" class="tpl" :aria-label="t('newAgentModal.templateLabel')" @change="useTemplate">
            <option value="">{{ t("newAgentModal.template") }}</option>
            <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.label }}</option>
          </select>
        </span>
        <textarea v-model="text" rows="4" :placeholder="t('newAgentModal.promptPlaceholder')"></textarea>
      </label>

      <p v-if="tool !== 'terminal'" class="cmd mono">$ {{ command }}</p>
      <div class="row">
        <button :title="t('newAgentModal.cancelTitle')" class="btn lg" @click="close">{{ t("newAgentModal.cancel") }}</button>
        <button :title="t('newAgentModal.startTitle')" class="btn lg go" :disabled="busy || !selectedWorkspace" @click="go">{{ tool === "terminal" ? t("newAgentModal.startTerminal") : t("newAgentModal.start") }} <kbd>⌘↵</kbd></button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No grey system background on buttons: each style below sets its own. */
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(620px, 100%); max-height: calc(100vh - 48px); overflow: auto; padding: 22px; border-radius: 14px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; gap: 10px;
}
.eyebrow { color: var(--accent); }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.where { margin: 0; font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.seg { display: inline-flex; align-self: flex-start; border: 1px solid var(--line-strong); border-radius: 8px; overflow: hidden; }
.seg button { height: 30px; padding: 0 14px; font-size: 12.5px; color: var(--text-2); }
.seg button.on { background: var(--field); color: var(--text); font-weight: 600; }
.field-label { font-size: 11.5px; color: var(--text-2); font-weight: 600; }
.row-label { display: flex; align-items: center; gap: 8px; }
.row-label .muted { font-weight: 400; }
.agents { display: flex; flex-direction: column; gap: 4px; max-height: 220px; overflow: auto; }
.agent {
  display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--line); text-align: left;
}
.agent:hover { border-color: var(--line-strong); }
.agent.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); }
.a-name { font-size: 13px; font-weight: 600; display: flex; gap: 6px; align-items: center; }
.src { font-size: 10.5px; font-weight: 500; padding: 1px 6px; border-radius: 6px; background: var(--field); color: var(--muted); }
.a-desc { font-size: 12px; color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; }
input, textarea, select {
  border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 12.5px; padding: 0 9px;
}
input { height: 32px; }
textarea { padding: 8px 9px; resize: vertical; font-family: inherit; line-height: 1.45; }
.tpl { height: 24px; margin-left: auto; font-size: 11.5px; }
.cmd { margin: 2px 0 0; font-size: 11.5px; color: var(--muted); }
.small { font-size: 12px; padding: 4px 2px; }
.muted { color: var(--muted); }
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn.go { background: var(--accent); border-color: transparent; color: #1a1206; font-weight: 600; }
.btn.go kbd { opacity: 0.7; }
</style>
