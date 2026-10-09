<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { answerDanger, danger } from "../stores/guards";
import { t } from "../i18n/index";

const cancel = ref<HTMLButtonElement>();
// Focus on "Annuler": Enter must never run a dangerous command by reflex.
onMounted(() => nextTick(() => cancel.value?.focus()));
// The file name and the setting name are shown in a monospace font inside the sentence.
const hintParts = computed(() =>
  t("dangerModal.blockedHint")
    .split(/(\{file\}|\{setting\})/)
    .map((part) => (part === "{file}" ? { text: ".heidrun/config.json", mono: true } : part === "{setting}" ? { text: "guards.block", mono: true } : { text: part, mono: false })),
);
</script>

<template>
  <div class="overlay" @mousedown.self="answerDanger(false)" @keydown.esc.stop.prevent="answerDanger(false)">
    <div class="dialog" role="alertdialog" aria-labelledby="danger-title" aria-describedby="danger-why">
      <div class="eyebrow" :class="danger.level">{{ danger.level === "block" ? t("dangerModal.forbidden") : t("dangerModal.risky") }}</div>
      <h2 id="danger-title">{{ danger.level === "block" ? t("dangerModal.notSent") : t("dangerModal.runQuestion") }}</h2>
      <p id="danger-why" class="why">{{ danger.why }}<template v-if="danger.where"> · {{ danger.where }}</template></p>
      <pre class="cmd mono">{{ danger.command }}</pre>
      <p v-if="danger.level === 'block'" class="hint"><template v-for="(part, i) in hintParts" :key="i"><span v-if="part.mono" class="mono">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></p>
      <div class="row">
        <button :title="t('dangerModal.cancelTitle')" ref="cancel" class="btn lg" @click="answerDanger(false)">{{ danger.level === "block" ? t("dangerModal.close") : t("dangerModal.cancel") }}</button>
        <button :title="t('dangerModal.runAnywayTitle')" v-if="danger.level !== 'block'" class="btn lg danger" @click="answerDanger(true)">{{ t("dangerModal.runAnyway") }}</button>
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
