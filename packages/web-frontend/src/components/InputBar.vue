<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  agentGroups,
  allPanes,
  broadcastPrompt,
  paneFullName,
  paneTarget,
  runInNewPane,
  runInPane,
  selectedPane,
  sendPrompt,
  state,
  toast,
  workspacePanes,
} from "../stores/session";
import { input } from "../stores/input";
import { VARIABLES, addPrompt, projectPrompts, prompts, removePrompt, resolvePrompt, type PromptTemplate } from "../stores/prompts";
import { currentProject } from "../stores/project";
import { paneName } from "../lib/format";
import { refreshSubagents, sendToSubagent, subagents } from "../stores/subagents";
import { dockState } from "../stores/dock";

const target = ref<string | null>(null);
const newPane = ref(true);
const notifyEnd = ref(false);
const field = ref<HTMLTextAreaElement>();
const barEl = ref<HTMLElement>();

// The field grows with its content (up to 8 lines, then it scrolls).
function autosize() {
  const t = field.value;
  if (!t) return;
  t.style.height = "auto";
  t.style.height = `${Math.min(t.scrollHeight, 8 * 20 + 20)}px`;
}
watch(() => input.text, () => nextTick(autosize));
watch(
  () => input.focusTick,
  () => nextTick(() => field.value?.focus()),
);

// ↵ sends; ⇧↵ or ⌥↵ adds a line.
function onKeydown(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.isComposing) return;
  if (e.shiftKey || e.altKey) {
    if (e.altKey) {
      // ⌥↵ does not insert a line by itself in a textarea.
      e.preventDefault();
      const t = e.target as HTMLTextAreaElement;
      t.setRangeText("\n", t.selectionStart, t.selectionEnd, "end");
      input.text = t.value;
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

// "sub:<pane>:<name>": a background agent of that Claude session.
// Looked up rather than parsed: pane ids and agent names may hold ":".
const subTargets = new Map<string, { paneId: string; name: string }>();
function subKey(paneId: string, name: string) {
  const k = `sub:${paneId}\u0000${name}`;
  subTargets.set(k, { paneId, name });
  return k;
}
const sub = computed(() => (target.value ? subTargets.get(target.value) ?? null : null));
const backToMain = ref(true);
// A click in a docked agent makes it the recipient too.
watch(
  () => dockState.focus,
  (id) => {
    if (id) target.value = id;
  },
);
const targetPane = computed(
  () => allPanes.value.find((p) => p.pane_id === (sub.value?.paneId ?? target.value)) ?? selectedPane.value,
);
const mode = computed<"agent" | "command">(() => (input.multi || targetPane.value?.agent ? "agent" : "command"));
const agents = computed(() => workspacePanes.value.filter((p) => p.agent));
// Other workspaces' agents too: write to one without going there first.
const otherGroups = computed(() =>
  agentGroups.value
    .map((g) => ({ ...g, items: g.items.filter((a) => a.pane.workspace_id !== state.selectedWorkspaceId) }))
    .filter((g) => g.items.length),
);
const subsOf = (paneId: string) => subagents.byPane[paneId] ?? [];
// The session's agent list is read when the menu is about to open.
let subsAt = 0;
function loadSubs() {
  // Reading every Claude pane is not free (Herdr serves one read at a time): not on every focus.
  if (Date.now() - subsAt < 5000) return;
  subsAt = Date.now();
  refreshSubagents();
}
watch(target, () => {
  if (target.value && !sub.value && targetPane.value?.agent?.includes("claude")) refreshSubagents([targetPane.value.pane_id]);
});
const terminals = computed(() => workspacePanes.value.filter((p) => !p.agent));

// ---- Several recipients -------------------------------------------------------
const MULTI = "__multi__";
const picker = ref(false);
const confirming = ref(false);
const chosen = computed(() => allPanes.value.filter((p) => input.targets.includes(p.pane_id)));
const blockedChosen = computed(() => chosen.value.filter((p) => p.agent_status === "blocked"));

watch(target, (v) => {
  if (v !== MULTI) return;
  // Start from the current agent, then let the user tick the others.
  const cur = selectedPane.value;
  if (!input.targets.length && cur?.agent) input.targets = [cur.pane_id];
  input.multi = true;
  picker.value = true;
  target.value = state.selectedPaneId;
});

function toggle(id: string) {
  input.targets = input.targets.includes(id) ? input.targets.filter((x) => x !== id) : [...input.targets, id];
}
function pickWorkspace() {
  input.targets = agents.value.map((p) => p.pane_id);
}
function pickAllClaude() {
  input.targets = allPanes.value.filter((p) => (p.agent ?? "").includes("claude")).map((p) => p.pane_id);
}
function single() {
  input.multi = false;
  input.targets = [];
  picker.value = false;
  confirming.value = false;
}

async function submit() {
  const value = input.text.trim();
  if (!value) return;
  // Arrow keys are being sent to a session: nothing else is typed meanwhile.
  if (subagents.busy) return toast("Bascule vers un sous-agent en cours…");
  if (input.multi) {
    if (!chosen.value.length) return toast("Choisis au moins un agent");
    // Recap first: several agents at once deserve a second look.
    picker.value = false;
    confirming.value = true;
    return;
  }
  const pane = targetPane.value;
  if (sub.value) {
    if (await sendToSubagent(sub.value.paneId, sub.value.name, value, backToMain.value)) input.text = "";
    return;
  }
  if (mode.value === "agent" && pane) {
    await sendPrompt(pane.pane_id, value);
  } else if (newPane.value || !pane) {
    await runInNewPane(value, notifyEnd.value ? "passed|failed|error|Error|✓|✗|done|Done" : undefined);
  } else {
    await runInPane(pane.pane_id, value);
  }
  input.text = "";
}

async function sendBroadcast() {
  confirming.value = false;
  const r = await broadcastPrompt(input.targets, input.text.trim(), (text, id) => resolvePrompt(text, id));
  if (!r.sent.length && !r.skipped.length && !r.failed.length) return; // refused by the guards
  const parts = [`Envoyé à ${r.sent.length} agent${r.sent.length > 1 ? "s" : ""}`];
  if (r.skipped.length) parts.push(`${r.skipped.length} ignoré${r.skipped.length > 1 ? "s" : ""} (bloqué)`);
  if (r.failed.length) parts.push(`${r.failed.length} en échec`);
  toast(parts.join(", "));
  if (r.sent.length) input.text = "";
}

// ---- Templates ------------------------------------------------------------------
const tplOpen = ref(false);
const saving = ref(false);
const newLabel = ref("");
const inProject = ref(false);

async function useTemplate(t: PromptTemplate) {
  // Several recipients: the variables stay in the text and are filled in for each
  // agent when it is sent ({agent}, {branche} differ from one to the other).
  const text = input.multi ? t.text : await resolvePrompt(t.text, targetPane.value?.pane_id ?? null);
  const f = field.value;
  if (!input.text.trim() || !f) input.text = text;
  else {
    f.setRangeText(text, f.selectionStart, f.selectionEnd, "end");
    input.text = f.value;
  }
  tplOpen.value = false;
  input.focusTick++;
}

async function saveTemplate() {
  if (!input.text.trim()) return toast("Écris d’abord la consigne à enregistrer");
  try {
    await addPrompt(newLabel.value, input.text.trim(), inProject.value);
  } catch (e) {
    return toast(String(e));
  }
  toast(inProject.value ? "Modèle ajouté au projet (.herdr-desk.json)" : "Modèle enregistré");
  saving.value = false;
  newLabel.value = "";
}

function onDocDown(e: MouseEvent) {
  if (barEl.value && !barEl.value.contains(e.target as Node)) {
    tplOpen.value = false;
    picker.value = false;
    confirming.value = false;
  }
}
onMounted(() => document.addEventListener("mousedown", onDocDown));
onBeforeUnmount(() => document.removeEventListener("mousedown", onDocDown));
</script>

<template>
  <form ref="barEl" class="bar" @submit.prevent="submit">
    <!-- Templates -->
    <div v-if="tplOpen" class="pop tpl" role="menu">
      <template v-if="projectPrompts.length">
        <div class="pop-h">Projet</div>
        <div v-for="t in projectPrompts" :key="'p' + t.id" class="tpl-row">
          <button type="button" class="tpl-item" :title="t.text" @click="useTemplate(t)">{{ t.label }}</button>
          <button type="button" class="x" :aria-label="`Supprimer ${t.label}`" @click="removePrompt(t.id, true)">×</button>
        </div>
      </template>
      <div class="pop-h">Mes modèles</div>
      <div v-for="t in prompts.personal" :key="t.id" class="tpl-row">
        <button type="button" class="tpl-item" :title="t.text" @click="useTemplate(t)">{{ t.label }}</button>
        <button type="button" class="x" :aria-label="`Supprimer ${t.label}`" @click="removePrompt(t.id, false)">×</button>
      </div>
      <div v-if="!saving" class="pop-foot">
        <button type="button" class="link" @click="saving = true">+ Enregistrer la saisie comme modèle</button>
        <span class="vars mono" title="Variables remplacées à l’insertion">{{ VARIABLES.join(" ") }}</span>
      </div>
      <div v-else class="save">
        <input v-model="newLabel" placeholder="Nom du modèle" @keydown.enter.prevent="saveTemplate" />
        <label v-if="currentProject" class="check"><input v-model="inProject" type="checkbox" />Dans le projet</label>
        <button type="button" class="btn" @click="saveTemplate">Enregistrer</button>
      </div>
    </div>

    <!-- Recipients -->
    <div v-if="picker && input.multi" class="pop picker">
      <div class="pop-tools">
        <button type="button" class="link" @click="pickWorkspace">Tous les agents de ce workspace</button>
        <button type="button" class="link" @click="pickAllClaude">Tous les Claude</button>
        <button type="button" class="link" @click="input.targets = []">Aucun</button>
      </div>
      <div v-for="g in agentGroups" :key="g.workspace" class="grp">
        <div class="pop-h">{{ g.workspace }}</div>
        <label v-for="a in g.items" :key="a.pane.pane_id" class="pick">
          <input type="checkbox" :checked="input.targets.includes(a.pane.pane_id)" @change="toggle(a.pane.pane_id)" />
          <span>{{ a.label }}</span>
          <span v-if="a.pane.agent_status === 'blocked'" class="t-blocked small">bloqué</span>
        </label>
      </div>
    </div>

    <!-- Recap before a broadcast -->
    <div v-if="confirming" class="pop recap">
      <div class="pop-h">Envoyer à {{ chosen.length - blockedChosen.length }} agent{{ chosen.length - blockedChosen.length > 1 ? "s" : "" }}</div>
      <ul>
        <li v-for="p in chosen" :key="p.pane_id" :class="{ off: p.agent_status === 'blocked' }">
          {{ paneFullName(p) }}<span v-if="p.agent_status === 'blocked'"> — bloqué, ignoré</span>
        </li>
      </ul>
      <div class="row">
        <button type="button" class="btn" @click="confirming = false">Annuler</button>
        <button type="button" class="btn primary" @click="sendBroadcast">Envoyer</button>
      </div>
    </div>

    <template v-if="input.multi">
      <button type="button" class="target multi-btn" :title="chosen.map((p) => paneName(p)).join(', ')" @click="picker = !picker">
        {{ chosen.length }} agent{{ chosen.length > 1 ? "s" : "" }} ▾
      </button>
      <button type="button" class="link solo" title="Revenir à un seul destinataire" @click="single">un seul</button>
    </template>
    <template v-else>
      <label class="sr" for="target">Destinataire</label>
      <select id="target" v-model="target" class="target" @mousedown="loadSubs" @focus="loadSubs">
        <optgroup v-if="agents.length" label="Agents">
          <template v-for="a in agents" :key="a.pane_id">
            <option :value="a.pane_id">{{ paneTarget(a) }}</option>
            <option v-for="n in subsOf(a.pane_id)" :key="a.pane_id + n" :value="subKey(a.pane_id, n)">&nbsp;&nbsp;↳ {{ n }}</option>
          </template>
        </optgroup>
        <optgroup v-for="g in otherGroups" :key="g.workspace" :label="g.workspace">
          <template v-for="a in g.items" :key="a.pane.pane_id">
            <option :value="a.pane.pane_id">{{ a.label }}</option>
            <option v-for="n in subsOf(a.pane.pane_id)" :key="a.pane.pane_id + n" :value="subKey(a.pane.pane_id, n)">&nbsp;&nbsp;↳ {{ n }}</option>
          </template>
        </optgroup>
        <optgroup v-if="terminals.length" label="Terminaux">
          <option v-for="t in terminals" :key="t.pane_id" :value="t.pane_id">{{ paneName(t) }} ({{ t.pane_id }})</option>
        </optgroup>
        <option :value="MULTI">Plusieurs agents…</option>
      </select>
    </template>
    <button type="button" class="tpl-btn" :class="{ on: tplOpen }" title="Modèles de consignes" aria-label="Modèles de consignes" @click="tplOpen = !tplOpen">
      ☰
    </button>
    <span v-if="mode === 'command'" class="prompt mono">$</span>
    <label class="sr" for="input">{{ mode === "agent" ? "Consigne pour l’agent" : "Commande à lancer" }}</label>
    <textarea
      id="input"
      ref="field"
      v-model="input.text"
      rows="1"
      :class="{ mono: mode === 'command' }"
      :placeholder="
        input.multi
          ? `Consigne pour ${chosen.length} agents…  (⇧↵ nouvelle ligne)`
          : mode === 'agent'
            ? `Envoyer une consigne à ${sub ? sub.name : targetPane ? paneTarget(targetPane) : 'l’agent'}…  (⇧↵ nouvelle ligne)`
            : 'Lancer une commande…  (⇧↵ nouvelle ligne)'
      "
      autocomplete="off"
      spellcheck="false"
      @keydown="onKeydown"
      @focus="loadSubs"
    ></textarea>
    <label v-if="sub && sub.name !== 'main'" class="check" title="Après l’envoi, Claude réaffiche la conversation principale">
      <input v-model="backToMain" type="checkbox" />Puis revenir sur main
    </label>
    <template v-if="mode === 'command'">
      <label class="check"><input v-model="newPane" type="checkbox" />Nouveau panneau</label>
      <label class="check"><input v-model="notifyEnd" type="checkbox" :disabled="!newPane" />Me notifier</label>
    </template>
    <button class="btn lg primary send" type="submit" :disabled="!!subagents.busy">{{ input.multi ? "Diffuser" : mode === "agent" ? "Envoyer" : "Lancer" }} ↵</button>
  </form>
</template>

<style scoped>
.bar {
  position: relative; flex-shrink: 0; padding: 14px 16px; border-top: 1px solid var(--line); background: var(--panel);
  display: flex; align-items: flex-end; gap: 10px;
}
.bar > .check, .bar > .prompt, .bar > .solo { align-self: center; }
.target, textarea {
  height: 40px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text); outline: none;
}
.target { padding: 0 10px; max-width: 200px; font-size: 12px; font-weight: 500; }
.multi-btn { color: #c29bf0; white-space: nowrap; }
textarea {
  flex: 1; min-width: 0; padding: 10px 14px; font: inherit; font-size: 13px; line-height: 20px;
  resize: none; overflow-y: auto; display: block;
}
textarea.mono { font-family: var(--mono, ui-monospace, monospace); }
textarea:focus { border-color: #3a4048; }
.tpl-btn {
  width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--field);
  color: var(--text-2); font-size: 15px;
}
.tpl-btn:hover, .tpl-btn.on { background: var(--hover); color: var(--text); }
.prompt { color: var(--working); font-size: 14px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); white-space: nowrap; }
.check input { accent-color: var(--working); width: 15px; height: 15px; }
.send { padding: 0 16px; }
.link { border: none; background: none; padding: 0; color: var(--done); font-size: 12px; }
.link:hover { text-decoration: underline; }
.solo { color: var(--muted); font-size: 11px; }
.pop {
  position: absolute; bottom: calc(100% + 6px); left: 16px; z-index: 20; width: min(440px, calc(100% - 32px));
  max-height: 60vh; overflow-y: auto; padding: 10px; border-radius: 12px; border: 1px solid #33383e; background: var(--field);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.55); display: flex; flex-direction: column; gap: 4px;
}
.pop-h { font-size: 10.5px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted); margin: 6px 4px 2px; }
.tpl-row { display: flex; align-items: center; gap: 4px; }
.tpl-item { flex: 1; min-width: 0; text-align: left; border: none; background: transparent; color: var(--text); padding: 7px 8px; border-radius: 7px; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tpl-item:hover { background: var(--hover); }
.x { width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--faint); opacity: 0; }
.tpl-row:hover .x { opacity: 1; }
.x:hover { background: var(--hover); color: var(--text); }
.pop-foot { display: flex; flex-direction: column; gap: 4px; padding: 8px 4px 2px; border-top: 1px solid var(--line); margin-top: 4px; }
.vars { font-size: 10.5px; color: var(--faint); }
.save { display: flex; align-items: center; gap: 8px; padding: 8px 4px 2px; border-top: 1px solid var(--line); margin-top: 4px; }
.save input:not([type="checkbox"]) { flex: 1; min-width: 0; height: 30px; padding: 0 10px; border-radius: 7px; border: 1px solid var(--line-strong); background: var(--bg); color: var(--text); outline: none; font-size: 12px; }
.pop-tools { display: flex; gap: 14px; flex-wrap: wrap; padding: 2px 4px 4px; }
.pick { display: flex; align-items: center; gap: 8px; padding: 5px 6px; border-radius: 6px; font-size: 12.5px; color: var(--text-2); }
.pick:hover { background: var(--hover); }
.pick input { accent-color: #c29bf0; }
.small { font-size: 11px; margin-left: auto; }
.recap ul { margin: 2px 0 6px; padding-left: 18px; font-size: 12.5px; color: var(--text); }
.recap li.off { color: var(--muted); }
.row { display: flex; justify-content: flex-end; gap: 8px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
