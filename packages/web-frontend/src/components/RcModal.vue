<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { openUrl } from "@tauri-apps/plugin-opener";
import { remote, toggleRemoteControl } from "../stores/claude";
import { allPanes, toast } from "../stores/session";
import { copy } from "../lib/clipboard";
import { paneName } from "../lib/format";
import { t } from "../i18n/index";

// Remote Control link of a Claude session, with a QR code made locally (no network).
const pane = computed(() => allPanes.value.find((p) => p.pane_id === remote.openFor) ?? null);
const url = computed(() => (remote.openFor ? remote.urls[remote.openFor] : undefined));
const svg = ref("");

watch(
  url,
  async (u) => {
    svg.value = u
      ? await QRCode.toString(u, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0c0e", light: "#ffffff" } })
      : "";
  },
  { immediate: true },
);

function close() {
  remote.openFor = null;
}

async function copyUrl() {
  if (!url.value) return;
  await copy(url.value);
  toast(t("rcModal.linkCopied"));
}

async function openInBrowser() {
  if (url.value) await openUrl(url.value).catch((e) => toast(String(e)));
}

function manage() {
  if (!pane.value) return;
  toggleRemoteControl(pane.value.pane_id);
  close();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.stopPropagation();
    close();
  }
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="scrim" @mousedown.self="close">
    <section class="win" role="dialog" aria-modal="true" aria-label="Remote Control">
      <header>
        <div>
          <div class="eyebrow">Remote Control</div>
          <h2>{{ pane ? paneName(pane) : t("rcModal.claudeSession") }}</h2>
        </div>
        <button class="x" :aria-label="t('rcModal.closeLabel')" :title="t('rcModal.closeTitle')" @click="close">
          <Icon name="x-lg" />
        </button>
      </header>
      <template v-if="url">
        <!-- Output of the qrcode library: an SVG built from the URL only. -->
        <div class="qr" role="img" :aria-label="t('rcModal.qrLabel', { url })" v-html="svg"></div>
        <p class="hint">{{ t("rcModal.scanHint") }}</p>
        <div class="url">
          <span class="mono">{{ url }}</span>
        </div>
        <div class="actions">
          <button :title="t('rcModal.copyTitle')" class="btn primary" @click="copyUrl">{{ t("rcModal.copy") }}</button>
          <button :title="t('rcModal.openTitle')" class="btn" @click="openInBrowser">{{ t("rcModal.open") }}</button>
          <button class="btn" :title="t('rcModal.manageTitle')" @click="manage">{{ t("rcModal.manage") }}</button>
        </div>
      </template>
      <p v-else class="hint">{{ t("rcModal.noLink") }}</p>
    </section>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 46; background: rgba(5, 6, 7, 0.55); display: flex; align-items: center; justify-content: center; }
.win {
  width: min(600px, calc(100vw - 40px)); display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px;
  border-radius: 14px; border: 1px solid var(--line-modal); background: var(--field); box-shadow: 0 28px 72px rgba(0, 0, 0, 0.6);
}
header { display: flex; align-items: flex-start; justify-content: space-between; }
h2 { margin: 4px 0 0; font-size: 16px; font-weight: 600; }
.x {
  width: 28px; height: 28px; border: none; border-radius: 7px; background: transparent; color: var(--muted);
  display: inline-flex; align-items: center; justify-content: center; padding: 0;
}
.x:hover { background: var(--hover); color: var(--text); }
.qr { align-self: center; width: 240px; height: 240px; padding: 12px; border-radius: 12px; background: #fff; }
.qr :deep(svg) { width: 100%; height: 100%; display: block; }
.hint { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; text-align: center; }
.url { padding: 10px 12px; border-radius: 9px; background: var(--bg); }
.url .mono {
  display: block; font-size: 12px; color: var(--text-2); white-space: nowrap; overflow-x: auto;
  user-select: text; text-align: center;
}
.actions { display: flex; gap: 8px; justify-content: space-between; }
.actions .btn { flex: 1; justify-content: center; white-space: nowrap; }
</style>
