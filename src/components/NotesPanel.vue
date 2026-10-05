<script setup lang="ts">
import { computed, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import InlineRename from "./InlineRename.vue";
import { notes, removeNote, renameNote, type Note } from "../stores/notes";
import { allPanes, sendPrompt, state, toast } from "../stores/session";
import { copy } from "../lib/clipboard";
import { ago, paneName } from "../lib/format";

const list = computed(() =>
  notes.showAll ? notes.list : notes.list.filter((n) => n.workspaceId === state.selectedWorkspaceId),
);
const others = computed(() => notes.list.length - list.value.length);

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
  if (agent) toast(`Note envoyée à ${paneName(agent)}`);
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

    <article v-for="n in list" :key="n.id" class="note">
      <header>
        <InlineRename
          v-if="renaming === n.id"
          :value="n.title"
          label="Titre de la note"
          @save="(v) => { renameNote(n.id, v); renaming = null; }"
          @cancel="renaming = null"
        />
        <h3 v-else title="Double-clic pour renommer" @dblclick="renaming = n.id">{{ n.title }}</h3>
        <ConfirmButton label="×" armed-label="Supprimer ?" aria-label="Supprimer la note" @confirm="removeNote(n.id)" />
      </header>
      <div class="origin">{{ n.origin }} · {{ ago(n.createdAt) }}</div>
      <pre class="mono" :class="{ open: expanded[n.id] }" @click="expanded[n.id] = !expanded[n.id]">{{ n.text }}</pre>
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
          <option v-for="a in agents" :key="a.pane_id" :value="a.pane_id">{{ paneName(a) }}</option>
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
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
