<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { answerConfirm, confirmDialog } from "../stores/confirm";
import { t } from "../i18n/index";

const cancel = ref<HTMLButtonElement>();
// Focus on "Cancel": Enter must never run a destructive action by reflex.
onMounted(() => nextTick(() => cancel.value?.focus()));
</script>

<template>
  <div class="overlay" @mousedown.self="answerConfirm(false)" @keydown.esc.stop.prevent="answerConfirm(false)">
    <div class="dialog" role="alertdialog" aria-labelledby="confirm-title">
      <h2 id="confirm-title">{{ confirmDialog.title }}</h2>
      <div class="row">
        <button ref="cancel" class="btn lg" :title="t('confirmModal.cancelTitle')" @click="answerConfirm(false)">{{ t("confirmModal.cancel") }}</button>
        <button class="btn lg danger" @click="answerConfirm(true)">{{ confirmDialog.confirmLabel }}</button>
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
  width: min(440px, 100%); padding: 22px; border-radius: 14px; background: var(--panel);
  border: 1px solid #5c2826; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; gap: 16px;
}
h2 { margin: 0; font-size: 16px; font-weight: 600; }
.row { display: flex; justify-content: flex-end; gap: 8px; }
.btn.danger { background: #a83a36; border-color: transparent; color: #fff; font-weight: 600; }
.btn.danger:hover { background: #c0433e; }
</style>
