<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import groups from "../lib/shortcuts.json";
import { state } from "../stores/session";
import { fold } from "../stores/search";

const q = ref("");
const input = ref<HTMLInputElement>();
onMounted(() => nextTick(() => input.value?.focus()));

const shown = computed(() => {
  const f = fold(q.value.trim());
  if (!f) return groups;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => fold(`${i.keys} ${i.action} ${g.group}`).includes(f)) }))
    .filter((g) => g.items.length);
});

function close() {
  state.shortcutsOpen = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
// "⇧⌘T / ⌘D" → ⇧ ⌘ T, a "/" separator, ⌘ D. Words ("Double-clic sur une bordure",
// "Molette") stay in one cap.
function caps(keys: string): { t: string; sep: boolean }[] {
  const out: { t: string; sep: boolean }[] = [];
  const combo = (w: string) => {
    const m = /^([⇧⌥⌃⌘]+)(\S+)$/.exec(w);
    if (m) for (const c of [...m[1], m[2]]) out.push({ t: c, sep: false });
    else out.push({ t: w, sep: false });
  };
  for (const part of keys.split(/(\s+\/\s+|\s+puis\s+|\s+\+\s+|\s+…\s+)/)) {
    if (!part.trim()) continue;
    if (/^\s+(\/|puis|\+|…)\s+$/.test(part)) out.push({ t: part.trim(), sep: true });
    // "⌘W ⌘W": several key combos in a row.
    else if (part.split(" ").every((w) => /^[⇧⌥⌃⌘]+\S+$/.test(w))) part.split(" ").forEach(combo);
    else out.push({ t: part, sep: false });
  }
  return out;
}
</script>

<template>
  <div class="overlay" @mousedown.self="close" @keydown="onKey">
    <div class="modal" role="dialog" aria-label="Raccourcis">
      <header>
        <h2>Raccourcis</h2>
        <input ref="input" v-model="q" placeholder="Filtrer : onglet, agent, souris…" spellcheck="false" />
        <button class="close" aria-label="Fermer (Échap)" @click="close">×</button>
      </header>
      <div class="cols">
        <section v-for="g in shown" :key="g.group" class="group">
          <h3>{{ g.group }}</h3>
          <div v-for="i in g.items" :key="i.keys + i.action" class="row">
            <span class="keys">
              <template v-for="(c, k) in caps(i.keys)" :key="k">
                <span v-if="c.sep" class="sep">{{ c.t }}</span>
                <kbd v-else>{{ c.t }}</kbd>
              </template>
            </span>
            <span class="action">{{ i.action }}</span>
          </div>
        </section>
        <p v-if="!shown.length" class="empty">Aucun raccourci pour « {{ q }} ».</p>
      </div>
      <footer>Les commandes sans raccourci sont dans la palette <kbd>⌘K</kbd>.</footer>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 58; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; padding: 32px; }
.modal {
  width: min(1040px, 100%); max-height: 100%; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
h2 { margin: 0; font-size: 16px; font-weight: 600; }
header input {
  flex: 1; max-width: 360px; margin-left: auto; height: 32px; border-radius: 8px; border: 1px solid var(--line-strong);
  background: var(--field); color: var(--text); font-size: 13px; padding: 0 10px;
}
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: 18px; }
.close:hover { background: var(--hover); color: var(--text); }
.cols { overflow: auto; padding: 8px 18px 16px; columns: 2 420px; column-gap: 32px; }
.group { break-inside: avoid; padding-top: 10px; }
h3 { margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: var(--accent); }
.row { display: grid; grid-template-columns: 170px 1fr; gap: 12px; align-items: baseline; padding: 4px 0; border-bottom: 1px solid var(--line); font-size: 12.5px; }
.keys { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; }
kbd {
  font-family: var(--mono); font-size: 11.5px; padding: 1px 6px; border-radius: 5px; border: 1px solid var(--line-strong);
  border-bottom-width: 2px; background: var(--field); color: var(--text); white-space: nowrap;
}
.sep { color: var(--muted); font-size: 11px; padding: 0 1px; }
.action { color: var(--text-2); }
.empty { color: var(--muted); font-size: 13px; }
footer { padding: 10px 16px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--muted); }
footer kbd { font-size: 10.5px; }
</style>
