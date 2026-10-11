<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import aboutImage from "../assets/heidrun_splash_screen.jpg";
import { t } from "../i18n/index";

const isOpen = ref(false);
const version = ref("");
const closeButton = ref<HTMLButtonElement>();
let unlisten: UnlistenFn | null = null;

async function open() {
  version.value = await getVersion().catch(() => "");
  isOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}

function close() {
  isOpen.value = false;
}

onMounted(async () => {
  unlisten = await listen("show-about", open).catch(() => null);
});
onUnmounted(() => unlisten?.());
</script>

<template>
  <div v-if="isOpen" class="overlay" @mousedown.self="close" @keydown.esc.stop.prevent="close">
    <div class="dialog" role="dialog" aria-labelledby="about-title">
      <figure class="figure">
        <img class="image" :src="aboutImage" alt="" />
        <figcaption class="legend">{{ t("aboutModal.legend") }}</figcaption>
      </figure>
      <div class="info">
        <h2 id="about-title">{{ t("aboutModal.title") }}</h2>
        <p class="version">{{ t("aboutModal.version", { version }) }}</p>
        <p class="description">{{ t("aboutModal.description") }}</p>
        <button ref="closeButton" class="btn lg" @click="close">{{ t("aboutModal.close") }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog {
  width: min(460px, 100%); border-radius: 14px; background: var(--panel); overflow: hidden;
  border: 1px solid var(--border, #2a2c31); box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
}
.figure { position: relative; margin: 0; line-height: 0; }
.image { display: block; width: 100%; aspect-ratio: 1 / 1; object-fit: cover; }
.legend {
  position: absolute; left: 0; right: 0; bottom: 0; padding: 48px 16px 14px; line-height: 1.3;
  text-align: center; font-size: 17px; font-weight: 600; color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0));
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
.info { padding: 18px 22px 22px; display: flex; flex-direction: column; align-items: center; gap: 6px; }
h2 { margin: 0; font-size: var(--font-size); font-weight: 600; }
.version { margin: 0; font-size: var(--font-size); opacity: 0.7; }
.description { margin: 4px 0 10px; font-size: var(--font-size); text-align: center; opacity: 0.85; }
</style>
