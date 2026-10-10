<script setup lang="ts">
import { ref } from "vue";
import splashImage from "../assets/heidrun_splash_screen.jpg";
import { showMainWindow } from "../lib/api";
import { t } from "../i18n/index";

const DISPLAY_DURATION_MS = 3000;

const isVisible = ref(true);

function close() {
  isVisible.value = false;
}

/**
 * Called when the splash image is loaded, or when it failed to load. The main window is created hidden, so this is
 * the moment the user sees it: the image is decoded first, so the first frame of the window already holds the image.
 * The display time starts here, because the user could not see the splash screen before.
 */
async function onImageSettled(event: Event) {
  try {
    await (event.target as HTMLImageElement).decode();
  } catch {
    // An image that cannot be decoded must not keep the window hidden.
  }
  try {
    await showMainWindow();
  } catch {
    // Outside Heidrun (a plain browser), there is no window to show.
  }
  window.setTimeout(close, DISPLAY_DURATION_MS);
}
</script>

<template>
  <Transition name="splash">
    <div v-if="isVisible" class="splash" @click="close">
      <img class="splash-image" :src="splashImage" alt="" @load="onImageSettled" @error="onImageSettled" />
      <div class="splash-text">
        <h1 class="splash-title">{{ t("splashScreen.title") }}</h1>
        <p class="splash-motto">{{ t("splashScreen.motto") }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: #0b0c0e;
  cursor: pointer;
}
.splash-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}
.splash-text {
  position: relative;
  width: 100%;
  padding: 120px 24px 56px;
  text-align: center;
  color: #fff;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88), rgba(0, 0, 0, 0));
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}
.splash-title {
  margin: 0;
  font-size: 128px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #ffd76a;
}
.splash-motto {
  margin: 24px 0 0;
  font-size: 52px;
  font-weight: 500;
}
.splash-leave-active {
  transition: opacity 0.6s ease;
}
.splash-leave-to {
  opacity: 0;
}
</style>
