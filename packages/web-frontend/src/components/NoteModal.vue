<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import ConfirmButton from "./ConfirmButton.vue";
import InlineRename from "./InlineRename.vue";
import { notes, removeNote, renameNote, updateNoteText } from "../stores/notes";
import { agentGroups, allPanes, paneFullName, sendPrompt, toast } from "../stores/session";
import { settings } from "../stores/settings";
import { copy } from "../lib/clipboard";
import { ago } from "../lib/format";
import { t } from "../i18n/index";

const note = computed(() => notes.list.find((n) => n.id === notes.openId) ?? null);
const agents = computed(() => allPanes.value.filter((p) => p.agent));

const box = ref<HTMLElement>();
const renaming = ref(false);
const editing = ref(false);
const draft = ref("");

// Position: centred at first, then wherever the header is dragged.
const pos = ref<{ x: number; y: number } | null>(null);
let drag: { dx: number; dy: number } | null = null;

function close() {
  notes.openId = null;
}

function startDrag(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("button, input, select")) return;
  const r = box.value!.getBoundingClientRect();
  pos.value = { x: r.left, y: r.top };
  drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  e.preventDefault();
}
function onMove(e: MouseEvent) {
  if (!drag) return;
  const maxX = window.innerWidth - 120;
  const maxY = window.innerHeight - 60;
  pos.value = {
    x: Math.min(maxX, Math.max(0, e.clientX - drag.dx)),
    y: Math.min(maxY, Math.max(0, e.clientY - drag.dy)),
  };
}
function onUp() {
  drag = null;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (editing.value) editing.value = false;
    else close();
    e.stopPropagation();
  }
}

// Remember the size the user gives the window (native resize handle, bottom right).
let observer: ResizeObserver | null = null;
onMounted(() => {
  // Centre with left/top (not a transform) so the resize handle follows the cursor.
  const w = Math.min(settings.noteWidth, window.innerWidth - 40);
  const h = Math.min(settings.noteHeight, window.innerHeight - 40);
  pos.value = { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  window.addEventListener("keydown", onKey, true);
  observer = new ResizeObserver(() => {
    if (!box.value) return;
    settings.noteWidth = Math.round(box.value.offsetWidth);
    settings.noteHeight = Math.round(box.value.offsetHeight);
  });
  if (box.value) observer.observe(box.value);
});
onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onMove);
  window.removeEventListener("mouseup", onUp);
  window.removeEventListener("keydown", onKey, true);
  observer?.disconnect();
});

const style = computed(() => ({
  width: `${Math.min(settings.noteWidth, window.innerWidth - 40)}px`,
  height: `${Math.min(settings.noteHeight, window.innerHeight - 40)}px`,
  ...(pos.value ? { left: `${pos.value.x}px`, top: `${pos.value.y}px` } : {}),
}));

function startEdit() {
  if (!note.value) return;
  draft.value = note.value.text;
  editing.value = true;
}
function saveEdit() {
  if (note.value) updateNoteText(note.value.id, draft.value);
  editing.value = false;
}

async function copyNote() {
  if (!note.value) return;
  await copy(note.value.text);
  toast(t("noteModal.copied"));
}

function sendTo(paneId: string) {
  const n = note.value;
  if (!n || !paneId) return;
  sendPrompt(paneId, `${n.title}\n\n\`\`\`\n${n.text}\n\`\`\``);
  const agent = agents.value.find((a) => a.pane_id === paneId);
  if (agent) toast(t("noteModal.sentTo", { agent: paneFullName(agent) }));
}

function remove() {
  if (!note.value) return;
  removeNote(note.value.id);
  close();
}
</script>

<template>
  <div v-if="note" class="scrim" @mousedown.self="close">
    <section ref="box" class="win" :style="style" role="dialog" aria-modal="true" :aria-label="note.title">
      <header class="bar" @mousedown="startDrag">
        <InlineRename
          v-if="renaming"
          :value="note.title"
          :label="t('noteModal.noteTitle')"
          @save="(v) => { renameNote(note!.id, v); renaming = false; }"
          @cancel="renaming = false"
        />
        <div v-else class="titles">
          <h2 :title="t('noteModal.doubleClickToRename')" @dblclick="renaming = true">{{ note.title }}</h2>
          <div class="origin">{{ note.origin }} · {{ ago(note.createdAt) }}</div>
        </div>
        <button class="x" :aria-label="t('noteModal.close')" :title="t('noteModal.closeTitle')" @click="close">
          <Icon name="x-lg" />
        </button>
      </header>

      <div class="body">
        <template v-if="editing">
          <label class="sr" for="note-edit">{{ t("noteModal.noteText") }}</label>
          <textarea id="note-edit" v-model="draft" class="mono" spellcheck="false" autofocus></textarea>
        </template>
        <pre v-else class="mono" @dblclick="startEdit">{{ note.text }}</pre>
      </div>

      <footer class="foot">
        <template v-if="editing">
          <button :title="t('noteModal.cancelTitle')" class="btn" @click="editing = false">{{ t("noteModal.cancel") }}</button>
          <button :title="t('noteModal.saveTitle')" class="btn primary" @click="saveEdit">{{ t("noteModal.save") }}</button>
        </template>
        <template v-else>
          <button :title="t('noteModal.copyTitle')" class="btn" @click="copyNote">{{ t("noteModal.copy") }}</button>
          <button :title="t('noteModal.editTitle')" class="btn" @click="startEdit">{{ t("noteModal.edit") }}</button>
          <label class="sr" for="modal-send">{{ t("noteModal.sendToAgent") }}</label>
          <select
            v-if="agents.length"
            id="modal-send"
            class="send"
            @change="(e) => { sendTo((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }"
          >
            <option value="">{{ t("noteModal.sendToAgentChoice") }}</option>
            <optgroup v-for="g in agentGroups" :key="g.workspace" :label="g.workspace">
              <option v-for="a in g.items" :key="a.pane.pane_id" :value="a.pane.pane_id">{{ a.label }}</option>
            </optgroup>
          </select>
          <span class="grow"></span>
          <ConfirmButton :label="t('noteModal.delete')" :armed-label="t('noteModal.deleteArmed')" :aria-label="t('noteModal.deleteNote')" @confirm="remove" />
        </template>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 45; background: rgba(5, 6, 7, 0.5); }
.win {
  position: absolute; left: 20px; top: 20px;
  min-width: 360px; min-height: 240px; max-width: calc(100vw - 20px); max-height: calc(100vh - 20px);
  resize: both; overflow: hidden;
  display: flex; flex-direction: column; border-radius: 14px; border: 1px solid var(--line-modal);
  background: var(--field); box-shadow: 0 28px 72px rgba(0, 0, 0, 0.6);
}
.bar {
  display: flex; align-items: center; gap: 10px; padding: 14px 14px 12px 18px;
  border-bottom: 1px solid var(--line-soft); cursor: grab;
}
.bar:active { cursor: grabbing; }
.titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
h2 { margin: 0; font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.origin { font-size: 11.5px; color: var(--muted); }
.x {
  width: 28px; height: 28px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.x:hover { background: var(--hover); color: var(--text); }
.body { flex: 1; min-height: 0; display: flex; padding: 14px 18px; }
pre, textarea {
  flex: 1; margin: 0; padding: 14px 16px; border-radius: 9px; background: var(--bg); color: var(--text-2);
  font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; overflow: auto;
}
pre { user-select: text; cursor: text; }
textarea { border: 1px solid #3a5a80; outline: none; resize: none; color: var(--text); }
.foot { display: flex; align-items: center; gap: 8px; padding: 12px 18px 16px; }
.send {
  height: 30px; border-radius: 7px; border: 1px solid var(--line-strong); background: transparent;
  color: var(--text-2); font-size: 12px; padding: 0 8px;
}
.grow { flex: 1; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
