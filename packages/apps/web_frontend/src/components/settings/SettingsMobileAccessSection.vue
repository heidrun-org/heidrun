<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { mobile, mobileStatus, revokeMobile, setMobile } from "../../stores/mobile";
import AbbreviatedTime from "../AbbreviatedTime.vue";
import { t } from "../../i18n/index";

const st = computed(() => mobile.status);
let timer = 0;
onMounted(() => {
  mobileStatus();
  timer = window.setInterval(mobileStatus, 5000);
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <div class="eyebrow">iPhone · iPad</div>
    <p class="m-0">{{ t("mobileModal.lead") }}</p>

    <SettingsSwitchRow :model-value="st?.enabled === true" :is-disabled="mobile.busy" :label="t('mobileModal.enable')" @update:model-value="setMobile($event)" />

    <div v-if="st?.error" class="alert theme-danger" role="alert">{{ st.error }}</div>

    <template v-if="st?.enabled && st.running && st.qr">
      <div class="d-flex align-items-center gap-3">
        <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
        <div class="qr bg-white p-2 rounded" v-html="st.qr"></div>
        <ol class="d-flex flex-column gap-2 ps-3 m-0">
          <li>{{ t("mobileModal.pairStep1Before") }}<b>Tailscale</b>{{ t("mobileModal.pairStep1After") }}</li>
          <li>{{ t("mobileModal.pairStep2") }}</li>
          <li>{{ t("mobileModal.pairStep3Before") }}<b>{{ t("mobileModal.pairStep3Bold") }}</b>{{ t("mobileModal.pairStep3After") }}</li>
        </ol>
      </div>
      <p class="m-0 mono text-body-secondary">{{ st.url }}</p>
      <p class="m-0 form-text">{{ t("mobileModal.qrSecret") }}</p>
      <p v-if="mobile.lastSeen" class="m-0 form-text"><AbbreviatedTime :milliseconds="mobile.lastSeen" phrase-key="mobileModal.lastSeen" /></p>
      <button type="button" class="btn align-self-start" :disabled="mobile.busy" :title="t('mobileModal.revokeTitle')" @click="revokeMobile">
        {{ t("mobileModal.revoke") }}
      </button>
    </template>
    <template v-else-if="st?.enabled && !st.running && !st.error">
      <p class="m-0 form-text">{{ t("mobileModal.starting") }}</p>
    </template>
    <template v-else-if="!st?.enabled">
      <div class="alert theme-secondary d-flex flex-column gap-2">
        <div class="eyebrow">{{ t("mobileModal.beforeEnable") }}</div>
        <ol class="d-flex flex-column gap-2 ps-3 m-0">
          <li>{{ t("mobileModal.setupStep1Before") }}<b>Tailscale</b>{{ t("mobileModal.setupStep1After") }}</li>
          <li>{{ t("mobileModal.setupStep2") }}</li>
        </ol>
      </div>
    </template>
  </div>
</template>

<style scoped>
.qr { width: 220px; flex-shrink: 0; }
.qr :deep(svg) { display: block; width: 100%; height: auto; }
</style>
