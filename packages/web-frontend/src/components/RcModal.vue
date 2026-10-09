<script setup lang="ts">
import Icon from "./Icon.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import QRCode from "qrcode";
import { openUrl } from "@tauri-apps/plugin-opener";
import { remote, toggleRemoteControl } from "../stores/claude";
import { allPanes, toast } from "../stores/session";
import { copy } from "../lib/clipboard";
import { paneName } from "../lib/format";

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
  toast("Lien de la session copié");
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
          <h2>{{ pane ? paneName(pane) : "Session Claude" }}</h2>
        </div>
        <button class="x" aria-label="Fermer" title="Fermer (Échap)" @click="close">
          <Icon name="x-lg" />
        </button>
      </header>
      <template v-if="url">
        <!-- Output of the qrcode library: an SVG built from the URL only. -->
        <div class="qr" role="img" :aria-label="`QR code de ${url}`" v-html="svg"></div>
        <p class="hint">Scanne avec l’appareil photo de ton iPhone ou iPad : la session s’ouvre dans l’app Claude.</p>
        <div class="url">
          <span class="mono">{{ url }}</span>
        </div>
        <div class="actions">
          <button class="btn primary" @click="copyUrl">Copier le lien</button>
          <button class="btn" @click="openInBrowser">Ouvrir dans le navigateur</button>
          <button class="btn" title="Ouvre le panneau de Claude Code dans le terminal (déconnexion…)" @click="manage">Gérer dans le terminal</button>
        </div>
      </template>
      <p v-else class="hint">Le lien de la session n’est pas encore visible dans le terminal.</p>
    </section>
  </div>
</template>

<style scoped>
.scrim { position: fixed; inset: 0; z-index: 46; background: rgba(5, 6, 7, 0.55); display: flex; align-items: center; justify-content: center; }
.win {
  width: min(600px, calc(100vw - 40px)); display: flex; flex-direction: column; gap: 14px; padding: 18px 20px 20px;
  border-radius: 14px; border: 1px solid #33383e; background: var(--field); box-shadow: 0 28px 72px rgba(0, 0, 0, 0.6);
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
