<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { openUrl } from "@tauri-apps/plugin-opener";
import SettingsSwitchRow from "./SettingsSwitchRow.vue";
import { mobile, mobileStatus, revokeMobile, setMobile } from "../../stores/mobile";
import AbbreviatedTime from "../AbbreviatedTime.vue";
import { toast } from "../../stores/session";
import { t } from "../../i18n/index";

const st = computed(() => mobile.status);
const errorText = computed(() => (st.value?.error ? t(`mobileModal.error.${st.value.error.kind}`) : ""));
const isOpeningTheTunnel = computed(() => st.value?.enabled === true && st.value.running === false && st.value.error === null);

// The tunnel needs a few seconds to open: ask for the status every second until it is open.
let timer = 0;
let isMounted = false;
function scheduleNextStatus() {
  timer = window.setTimeout(async () => {
    await mobileStatus();
    if (isMounted) {
      scheduleNextStatus();
    }
  }, isOpeningTheTunnel.value ? 1000 : 5000);
}
onMounted(async () => {
  isMounted = true;
  await mobileStatus();
  if (isMounted) {
    scheduleNextStatus();
  }
});
onBeforeUnmount(() => {
  isMounted = false;
  window.clearTimeout(timer);
});

async function openPairingLink(link: string) {
  try {
    await openUrl(link);
  } catch (reason) {
    toast(String(reason), "error");
  }
}
</script>

<template>
  <div class="d-flex flex-column gap-3">
    <p class="m-0">{{ t("mobileModal.lead") }}</p>

    <SettingsSwitchRow :model-value="st?.enabled === true" :is-disabled="mobile.busy" :label="t('mobileModal.enable')" @update:model-value="setMobile($event)" />

    <div v-if="st?.error" class="alert theme-danger" role="alert">
      {{ errorText }}
      <div v-if="st.error.detail" class="mono mt-1">{{ st.error.detail }}</div>
    </div>

    <template v-if="st?.enabled && st.running && st.qr">
      <div class="d-flex align-items-center gap-3">
        <!-- eslint-disable-next-line vue/no-v-html : SVG produced by the app itself -->
        <div class="qr bg-white p-2 rounded" v-html="st.qr"></div>
        <p class="m-0">{{ t("mobileModal.pairStep") }}</p>
      </div>
      <p class="m-0">
        <a v-if="st.link" class="mono" :href="st.link" :title="t('mobileModal.openTitle')" @click.prevent="openPairingLink(st.link)">{{ st.url }}</a>
        <span v-else class="mono text-body-secondary">{{ st.url }}</span>
      </p>
      <p class="m-0 form-text">{{ t("mobileModal.firstVisit") }}</p>
      <p class="m-0 form-text">{{ t("mobileModal.qrSecret") }}</p>
      <p v-if="mobile.lastSeen" class="m-0 form-text"><AbbreviatedTime :milliseconds="mobile.lastSeen" phrase-key="mobileModal.lastSeen" /></p>
      <button type="button" class="btn align-self-start" :disabled="mobile.busy" :title="t('mobileModal.revokeTitle')" @click="revokeMobile">
        {{ t("mobileModal.revoke") }}
      </button>
    </template>
    <template v-else-if="isOpeningTheTunnel">
      <p class="m-0 form-text">{{ t("mobileModal.starting") }}</p>
    </template>
    <template v-else-if="!st?.enabled">
      <p class="m-0 form-text">{{ t("mobileModal.tunnelNote") }}</p>
    </template>
  </div>
</template>

<style scoped>
.qr { width: 220px; flex-shrink: 0; }
.qr :deep(svg) { display: block; width: 100%; height: auto; }
</style>
