<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import InlineRename from "./InlineRename.vue";
import { moveNote, notes, removeNote, renameNote, type Note } from "../stores/notes";
import { useReorder } from "../lib/reorder";
import { agentGroups, allPanes, paneFullName, sendPrompt, state, toast } from "../stores/session";
import { copy } from "../lib/clipboard";
import { ago } from "../lib/format";

const list = computed(() =>
  notes.showAll ? notes.list : notes.list.filter((n) => n.workspaceId === state.selectedWorkspaceId),
);
const others = computed(() => notes.list.length - list.value.length);

// Only the grip starts a drag, so text in the note stays selectable.
const armed = ref<string | null>(null);
const drag = useReorder("y", (id, at) => moveNote(list.value.map((n) => n.id), id, at));

const agents = computed(() => allPanes.value.filter((p) => p.agent));
const renaming = ref<string | null>(null);
const expanded = ref<Record<string, boolean>>({});

async function copyNote(n: Note) {
  await copy(n.text);
  toast("Copié");
}

function sendTo(n: Note, paneId: string) {
  if (!paneId) return;
  sendPrompt(paneId, `${n.title}\n\n\`\`\`\n${n.text}\n\`\`\``);
  const agent = agents.value.find((a) => a.pane_id === paneId);
  if (agent) toast(`Note envoyée à ${paneFullName(agent)}`);
}
</script>

<template>
  <div class="panel">
    <div class="head">
      <div class="eyebrow">Notes épinglées</div>
      <label class="toggle"><input v-model="notes.showAll" type="checkbox" />Tous les workspaces</label>
    </div>

    <p v-if="!list.length" class="empty">
      Sélectionne du texte dans un terminal, puis « Épingler » ou <kbd>⇧⌘P</kbd>.
      <template v-if="others">({{ others }} note{{ others > 1 ? "s" : "" }} dans d’autres workspaces.)</template>
    </p>

    <article
      v-for="(n, ni) in list"
      :key="n.id"
      class="note"
      :class="{
        dragging: drag.dragging.value === n.id,
        'drop-before': drag.gap.value === ni,
        'drop-after': drag.gap.value === ni + 1 && ni === list.length - 1,
      }"
      :draggable="armed === n.id"
      @dragstart="drag.onDragStart($event, n.id)"
      @dragover="drag.onDragOver($event, ni)"
      @drop="drag.onDrop($event, list.map((x) => x.id))"
      @dragend="drag.onDragEnd(); armed = null"
    >
      <header>
        <span class="grip" aria-hidden="true" title="Glisser pour réordonner" @mousedown="armed = n.id" @mouseup="armed = null">⋮⋮</span>
        <InlineRename
          v-if="renaming === n.id"
          :value="n.title"
          label="Titre de la note"
          @save="(v) => { renameNote(n.id, v); renaming = null; }"
          @cancel="renaming = null"
        />
        <h3 v-else title="Double-clic pour renommer" @dblclick="renaming = n.id">{{ n.title }}</h3>
        <button class="tool" aria-label="Ouvrir en grand" title="Ouvrir en grand" @click="notes.openId = n.id">
          <Icon name="arrows-angle-expand" />
        </button>
        <ConfirmButton label="×" armed-label="Supprimer ?" aria-label="Supprimer la note" @confirm="removeNote(n.id)" />
      </header>
      <div class="origin">{{ n.origin }} · {{ ago(n.createdAt) }}</div>
      <pre class="mono" :class="{ open: expanded[n.id] }" title="Clic : déplier · double-clic : ouvrir en grand" @click="expanded[n.id] = !expanded[n.id]" @dblclick="notes.openId = n.id">{{ n.text }}</pre>
      <div class="actions">
        <button class="btn" @click="copyNote(n)">Copier</button>
        <label class="sr" :for="`send-${n.id}`">Envoyer à un agent</label>
        <select
          v-if="agents.length"
          :id="`send-${n.id}`"
          class="send"
          @change="(e) => { sendTo(n, (e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }"
        >
          <option value="">Envoyer à…</option>
          <optgroup v-for="g in agentGroups" :key="g.workspace" :label="g.workspace">
            <option v-for="a in g.items" :key="a.pane.pane_id" :value="a.pane.pane_id">{{ a.label }}</option>
          </optgroup>
        </select>
      </div>
    </article>
  </div>
</template>

<style scoped>
.panel { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px; display: flex; flex-direction: column; gap: 10px; }
.head { display: flex; align-items: center; justify-content: space-between; }
.toggle { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted); }
.toggle input { accent-color: var(--done); }
.empty { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.6; }
kbd { font-family: var(--mono); color: var(--text-2); }
.note { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 10px; background: var(--field); border: 1px solid var(--line-strong); }
.note header { display: flex; align-items: center; gap: 6px; }
h3 { flex: 1; min-width: 0; margin: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: text; }
.origin { font-size: 11px; color: var(--muted); }
.tool {
  width: 22px; height: 22px; border: none; border-radius: 6px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.tool:hover { background: var(--hover); color: var(--text); }
pre {
  margin: 0; padding: 8px 10px; border-radius: 7px; background: var(--bg); color: var(--text-2);
  font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  max-height: 96px; overflow: hidden; cursor: pointer; user-select: text;
}
pre.open { max-height: none; }
.actions { display: flex; gap: 6px; }
.send {
  flex: 1; height: 30px; border-radius: 7px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-2); font-size: 12px; padding: 0 8px;
}
.dragging { opacity: 0.4; }
.drop-before, .drop-after { position: relative; }
.drop-before::before, .drop-after::after {
  content: ""; position: absolute; left: 6px; right: 6px; height: 2px; border-radius: 1px; background: var(--done);
}
.drop-before::before { top: -5px; }
.drop-after::after { bottom: -5px; }
.grip { color: var(--faint); cursor: grab; font-size: 11px; letter-spacing: -2px; padding: 0 2px; user-select: none; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
