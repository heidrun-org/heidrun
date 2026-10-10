<script setup lang="ts">
import { onMounted, ref } from "vue";
import splashImage from "../assets/heidrun_splash_screen.jpg";
import { t } from "../i18n/index";

const DISPLAY_DURATION_MS = 3000;

const isVisible = ref(true);

function close() {
  isVisible.value = false;
}

onMounted(() => {
  window.setTimeout(close, DISPLAY_DURATION_MS);
});
</script>

<template>
  <Transition name="splash">
    <div v-if="isVisible" class="splash" @click="close">
      <img class="splash-image" :src="splashImage" alt="" />
      <div class="splash-text">
        <h1 class="splash-title">{{ t("splashScreen.title") }}</h1>
        <p class="splash-motto">{{ t("splashScreen.motto") }}</p>
        <p class="splash-subtitle">{{ t("splashScreen.subtitle") }}</p>
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
  font-size: 64px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #ffd76a;
}
.splash-motto {
  margin: 12px 0 0;
  font-size: 26px;
  font-weight: 500;
}
.splash-subtitle {
  margin: 8px 0 0;
  font-size: 15px;
  opacity: 0.8;
}
.splash-leave-active {
  transition: opacity 0.6s ease;
}
.splash-leave-to {
  opacity: 0;
}
</style>
