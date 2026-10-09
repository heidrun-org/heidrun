<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { confirmMerge, merging } from "../stores/git";
import { toast } from "../stores/session";

const cancel = ref<HTMLButtonElement>();
onMounted(() => nextTick(() => cancel.value?.focus()));

const r = computed(() => merging.req!);
const kind = computed(() => (merging.forge === "github" ? "la PR" : "la MR"));
// Not "ready": merging still possible, but said loudly.
const risky = computed(() => r.value.level !== "ok" || r.value.review?.level === "crit");

async function go() {
  const ref = r.value.ref;
  const target = r.value.target || "la branche cible";
  if (await confirmMerge()) {
    // glab sets auto-merge when the pipeline is still running: say what happened.
    const out = merging.result;
    if (/auto.?merge|when the pipeline succeeds|will be merged/i.test(out)) toast(`${ref} sera fusionnée quand la CI sera verte`);
    else if (/branche distante n’a pas été supprimée/.test(out)) toast(out);
    else toast(`${ref} fusionnée dans ${target}`);
  }
}
</script>

<template>
  <div class="overlay" @mousedown.self="!merging.busy && (merging.open = false)" @keydown.esc.stop.prevent="!merging.busy && (merging.open = false)">
    <div class="dialog" role="alertdialog" aria-labelledby="merge-title">
      <div class="eyebrow">Fusion</div>
      <h2 id="merge-title">Fusionner {{ kind }} {{ r.ref }} ?</h2>
      <p class="title">{{ r.title }}</p>
      <p class="branches mono">{{ r.branch }} → {{ r.target || "branche cible" }}</p>
      <div class="chips">
        <span class="chip" :class="r.level">{{ r.state }}</span>
        <span v-if="r.review" class="chip" :class="r.review.level">{{ r.review.label }}</span>
      </div>
      <p v-if="risky" class="warn">Elle n’est pas indiquée comme prête : l’hébergeur peut refuser, ou fusionner sans les vérifications habituelles.</p>

      <div class="opts">
        <label class="sr" for="merge-method">Méthode</label>
        <select id="merge-method" v-model="merging.method" :disabled="merging.busy">
          <option value="merge">Commit de fusion</option>
          <option value="squash">Squash (un seul commit)</option>
          <option value="rebase">Rebase</option>
        </select>
        <label class="check">
          <input v-model="merging.removeBranch" type="checkbox" :disabled="merging.busy" />Supprimer la branche source
        </label>
      </div>
      <p v-if="merging.forge === 'gitlab'" class="hint">Si la CI tourne encore, GitLab programme la fusion pour quand elle sera verte.</p>
      <p class="hint">Fusion du dernier commit vu{{ r.sha ? ` (${r.sha.slice(0, 8)})` : "" }} : si quelqu’un a poussé depuis, l’hébergeur la refuse.</p>
      <pre v-if="merging.error" class="err mono">{{ merging.error }}</pre>

      <div class="row">
        <button title="Cancel the merge" ref="cancel" class="btn lg" :disabled="merging.busy" @click="merging.open = false">Annuler</button>
        <button title="Merge the branch" class="btn lg go" :disabled="merging.busy" @click="go">{{ merging.busy ? "Fusion…" : `Fusionner ${r.ref}` }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(560px, 100%); padding: 22px; border-radius: 14px; background: var(--panel); border: 1px solid #3a3150;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; gap: 10px;
}
.eyebrow { color: var(--question); }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.title { margin: 0; font-size: 13.5px; color: var(--text); }
.branches { margin: 0; font-size: 12px; color: var(--text-2); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { height: 22px; padding: 0 8px; border-radius: 11px; display: inline-flex; align-items: center; font-size: 11px; font-weight: 600; background: var(--chip); color: var(--text-2); }
.chip.ok { background: var(--tint-ok); color: var(--ok); } .chip.warn { background: var(--tint-warn); color: var(--accent); }
.chip.crit { background: var(--tint-crit); color: var(--blocked); } .chip.pending { background: var(--tint-working); color: var(--working); }
.chip.muted { color: var(--muted); }
.warn { margin: 0; font-size: 12px; color: var(--accent); }
.opts { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 4px; }
select { height: 32px; border-radius: 8px; border: 1px solid var(--line-strong); background: var(--field); color: var(--text); font-size: 12.5px; padding: 0 8px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-2); }
.check input { accent-color: var(--question); }
.hint { margin: 0; font-size: 11.5px; color: var(--muted); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: 12px; white-space: pre-wrap; }
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.btn.go { background: #7a4fc2; border-color: transparent; color: #fff; font-weight: 600; }
.btn.go:hover:not(:disabled) { background: #8a5fd4; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
