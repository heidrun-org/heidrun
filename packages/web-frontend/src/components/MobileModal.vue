<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted } from "vue";
import { mobile, mobileStatus, revokeMobile, setMobile } from "../stores/mobile";
import { ago } from "../lib/format";
import { t } from "../i18n/index";

const st = computed(() => mobile.status);
let timer = 0;
onMounted(() => {
  mobileStatus();
  timer = window.setInterval(mobileStatus, 5000);
  window.addEventListener("keydown", onKey, true);
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
  window.removeEventListener("keydown", onKey, true);
});
function close() {
  mobile.open = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
}
</script>

<template>
  <div class="overlay" @mousedown.self="close">
    <div class="dialog" role="dialog" aria-labelledby="mob-title">
      <header>
        <div>
          <div class="eyebrow">iPhone · iPad</div>
          <h2 id="mob-title">{{ t("mobileModal.title") }}</h2>
        </div>
        <button :title="t('mobileModal.closeTitle')" class="close" :aria-label="t('mobileModal.closeLabel')" @click="close"><Icon name="x-lg" /></button>
      </header>

      <p class="lead">
        {{ t("mobileModal.lead") }}
      </p>

      <label class="switch">
        <input type="checkbox" :checked="st?.enabled" :disabled="mobile.busy" @change="setMobile(($event.target as HTMLInputElement).checked)" />
        <span>{{ t("mobileModal.enable") }}</span>
      </label>

      <p v-if="st?.error" class="err">{{ st.error }}</p>

      <template v-if="st?.enabled && st.running && st.qr">
        <div class="pair">
          <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
          <div class="qr" v-html="st.qr"></div>
          <ol>
            <li>{{ t("mobileModal.pairStep1Before") }}<b>Tailscale</b>{{ t("mobileModal.pairStep1After") }}</li>
            <li>{{ t("mobileModal.pairStep2") }}</li>
            <li>{{ t("mobileModal.pairStep3Before") }}<b>{{ t("mobileModal.pairStep3Bold") }}</b>{{ t("mobileModal.pairStep3After") }}</li>
          </ol>
        </div>
        <p class="url mono">{{ st.url }}</p>
        <p class="hint">{{ t("mobileModal.qrSecret") }}</p>
        <p v-if="mobile.lastSeen" class="hint">{{ t("mobileModal.lastSeen", { time: ago(mobile.lastSeen) }) }}</p>
        <div class="row">
          <button class="btn" :disabled="mobile.busy" :title="t('mobileModal.revokeTitle')" @click="revokeMobile">
            {{ t("mobileModal.revoke") }}
          </button>
        </div>
      </template>
      <template v-else-if="st?.enabled && !st.running && !st.error">
        <p class="hint">{{ t("mobileModal.starting") }}</p>
      </template>
      <template v-else-if="!st?.enabled">
        <div class="steps">
          <div class="eyebrow">{{ t("mobileModal.beforeEnable") }}</div>
          <ol>
            <li>{{ t("mobileModal.setupStep1Before") }}<b>Tailscale</b>{{ t("mobileModal.setupStep1After") }}</li>
            <li>{{ t("mobileModal.setupStep2") }}</li>
          </ol>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
:where(button) { background: transparent; border: 0; }
.overlay { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.55); display: flex; align-items: center; justify-content: center; padding: 24px; }
.dialog {
  width: min(620px, 100%); max-height: calc(100vh - 48px); overflow: auto; padding: 20px 22px; border-radius: 14px;
  background: var(--panel); border: 1px solid var(--line-strong); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: flex; flex-direction: column; gap: 12px;
}
header { display: flex; align-items: flex-start; justify-content: space-between; }
h2 { margin: 2px 0 0; font-size: 18px; font-weight: 600; }
.eyebrow { color: var(--done); }
.close { width: 28px; height: 28px; border-radius: 7px; color: var(--muted); font-size: 18px; }
.close:hover { background: var(--hover); color: var(--text); }
.lead { margin: 0; font-size: 13px; color: var(--text-2); line-height: 1.5; }
.switch { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; }
.switch input { width: 16px; height: 16px; accent-color: var(--done); }
.err { margin: 0; padding: 10px 12px; border-radius: 8px; background: var(--tint-err); color: var(--fail); font-size: 12.5px; }
.pair { display: flex; gap: 18px; align-items: center; }
.qr { flex-shrink: 0; width: 220px; height: 220px; padding: 10px; border-radius: 10px; background: #fff; }
.qr :deep(svg) { width: 100%; height: 100%; display: block; }
ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 12.5px; color: var(--text-2); line-height: 1.45; }
.url { margin: 0; font-size: 12px; color: var(--muted); }
.hint { margin: 0; font-size: 11.5px; color: var(--muted); }
.row { display: flex; gap: 8px; }
.steps { display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 10px; border: 1px solid var(--line); }
</style>
