<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { closeThreeJsDemoModal } from "../stores/three_js_demo_modal";
import type { ThreeJsDemoScene } from "../lib/three_js_demo_scene";
import { t } from "../i18n/index";

const canvas = ref<HTMLCanvasElement>();
const webGlVersion = ref("");
const errorText = ref("");
let scene: ThreeJsDemoScene | null = null;
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeThreeJsDemoModal();
  }
}

onMounted(async () => {
  window.addEventListener("keydown", onKeyDown, true);
  try {
    // Three.js is loaded only when the window opens, so the other windows do not pay for its size.
    const { ThreeJsDemoScene } = await import("../lib/three_js_demo_scene");
    const canvasElement = canvas.value;
    if (isUnmounted === true || canvasElement === undefined) {
      return;
    }
    scene = new ThreeJsDemoScene(canvasElement);
    webGlVersion.value = scene.webGlVersion;
    resizeObserver = new ResizeObserver(([entry]) => scene?.resize(entry.contentRect.width, entry.contentRect.height));
    resizeObserver.observe(canvasElement);
    scene.start();
  } catch (error) {
    errorText.value = String(error);
  }
});

onBeforeUnmount(() => {
  isUnmounted = true;
  window.removeEventListener("keydown", onKeyDown, true);
  resizeObserver?.disconnect();
  scene?.dispose();
});
</script>

<template>
  <div class="overlay" @mousedown.self="closeThreeJsDemoModal">
    <dialog class="dialog dialog-lg dialog-instant dialog-nonmodal" open aria-labelledby="three-js-demo-title">
      <div class="dialog-header">
        <div id="three-js-demo-title" class="dialog-title" role="heading" aria-level="2">{{ t("threeJsDemoModal.title") }}</div>
        <button type="button" class="btn-close" :aria-label="t('threeJsDemoModal.close')" :title="t('threeJsDemoModal.close')" @click="closeThreeJsDemoModal"></button>
      </div>
      <div class="dialog-body">
        <div v-if="errorText !== ''" class="alert alert-danger" role="alert">{{ t("threeJsDemoModal.notAvailable", { error: errorText }) }}</div>
        <canvas v-show="errorText === ''" ref="canvas" class="demo-canvas" :aria-label="t('threeJsDemoModal.canvasLabel')"></canvas>
      </div>
      <div v-if="webGlVersion !== ''" class="dialog-footer">
        <span class="form-text">{{ t("threeJsDemoModal.version", { version: webGlVersion }) }}</span>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 59; background: rgba(0, 0, 0, 0.55); }
.demo-canvas { display: block; width: 100%; height: 360px; }
</style>
