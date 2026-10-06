<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { answerDanger, danger } from "../stores/guards";

const cancel = ref<HTMLButtonElement>();
// Focus on "Annuler": Enter must never run a dangerous command by reflex.
onMounted(() => nextTick(() => cancel.value?.focus()));
</script>

<template>
  <div class="overlay" @mousedown.self="answerDanger(false)" @keydown.esc.stop.prevent="answerDanger(false)">
    <div class="dialog" role="alertdialog" aria-labelledby="danger-title" aria-describedby="danger-why">
      <div class="eyebrow" :class="danger.level">{{ danger.level === "block" ? "Commande interdite" : "Commande à risque" }}</div>
      <h2 id="danger-title">{{ danger.level === "block" ? "Cette commande n’est pas envoyée" : "Exécuter cette commande ?" }}</h2>
      <p id="danger-why" class="why">{{ danger.why }}<template v-if="danger.where"> · {{ danger.where }}</template></p>
      <pre class="cmd mono">{{ danger.command }}</pre>
      <p v-if="danger.level === 'block'" class="hint">Le projet l’interdit dans <span class="mono">.herdr-desk.json</span> (<span class="mono">guards.block</span>). Lance-la toi-même dans un terminal si c’est voulu.</p>
      <div class="row">
        <button ref="cancel" class="btn lg" @click="answerDanger(false)">{{ danger.level === "block" ? "Fermer" : "Annuler" }}</button>
        <button v-if="danger.level !== 'block'" class="btn lg danger" @click="answerDanger(true)">Exécuter quand même</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog {
  width: min(620px, 100%); padding: 22px; border-radius: 14px; background: var(--panel);
  border: 1px solid #5c2826; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; gap: 12px;
}
.eyebrow { color: var(--blocked); }
h2 { margin: 0; font-size: 18px; font-weight: 600; }
.why { margin: 0; color: var(--text-2); font-size: 13px; }
.cmd {
  margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--bg); border: 1px solid var(--line-strong);
  font-size: 12.5px; white-space: pre-wrap; word-break: break-all; max-height: 240px; overflow: auto; user-select: text;
}
.hint { margin: 0; font-size: 12px; color: var(--muted); }
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn.danger { background: #a83a36; border-color: transparent; color: #fff; font-weight: 600; }
.btn.danger:hover { background: #c0433e; }
</style>
