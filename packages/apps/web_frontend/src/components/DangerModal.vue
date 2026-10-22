<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { answerDanger, changeDangerGuard, danger } from "../stores/guards";
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
    <div class="window-box" role="alertdialog" aria-labelledby="danger-title" aria-describedby="danger-why">
      <div class="eyebrow" :class="danger.level">{{ danger.level === "block" ? t("dangerModal.forbidden") : t("dangerModal.risky") }}</div>
      <h2 id="danger-title">{{ danger.level === "block" ? t("dangerModal.notSent") : t("dangerModal.runQuestion") }}</h2>
      <p id="danger-why" class="why">{{ danger.why }}<template v-if="danger.where"> · {{ danger.where }}</template></p>
      <p v-if="danger.description !== ''" class="description" data-field="description">{{ danger.description }}</p>
      <pre class="cmd mono">{{ danger.command }}</pre>
      <p v-if="danger.level === 'block'" class="hint"><template v-for="(part, i) in hintParts" :key="i"><span v-if="part.mono" class="mono">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></p>
      <div class="row">
        <button v-if="danger.guard !== null" :title="t('dangerModal.changeGuardTitle')" class="btn lg change-guard" data-field="change-guard" @click="changeDangerGuard()">{{ t("dangerModal.changeGuard") }}</button>
        <button :title="t('dangerModal.cancelTitle')" ref="cancel" class="btn lg" @click="answerDanger(false)">{{ danger.level === "block" ? t("dangerModal.close") : t("dangerModal.cancel") }}</button>
        <button :title="t('dangerModal.runAnywayTitle')" v-if="danger.level !== 'block'" class="btn lg danger" @click="answerDanger(true)">{{ t("dangerModal.runAnyway") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 60; background: var(--overlay);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.window-box {
  width: min(620px, 100%); padding: 22px; border-radius: 14px; background: var(--panel);
  border: 1px solid var(--pane-ring-blocked); box-shadow: 0 24px 64px var(--shadow);
  display: flex; flex-direction: column; gap: 12px;
}
.eyebrow { color: var(--blocked-text); }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.why { margin: 0; color: var(--text-2); font-size: var(--font-size); }
.description { margin: 0; color: var(--muted); font-size: var(--font-size); white-space: pre-wrap; }
.cmd {
  margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--bg); border: 1px solid var(--line-strong);
  font-size: var(--font-size); white-space: pre-wrap; word-break: break-all; max-height: 240px; overflow: auto; user-select: text;
}
.hint { margin: 0; font-size: var(--font-size); color: var(--muted); }
.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.change-guard { margin-right: auto; }
</style>
