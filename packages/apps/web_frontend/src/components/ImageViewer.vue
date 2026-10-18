<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { ImageDrop } from "../lib/image_drop";
import { compositionBar } from "../stores/composition_bar";
import { t } from "../i18n/index";

// The big view of the images of the composition bar: one large picture, with the buttons and the keys left and right.
// Issue: https://github.com/heidrun-org/heidrun/issues/637
const path = computed(() => (compositionBar.viewerIndex === null ? null : (compositionBar.paths[compositionBar.viewerIndex] ?? null)));
const count = computed(() => compositionBar.paths.length);
const picture = computed(() => {
  if (path.value === null) {
    return "";
  }
  return compositionBar.previews[path.value] || compositionBar.thumbnails[path.value] || "";
});
const isLoaded = computed(() => path.value !== null && path.value in compositionBar.previews);
const isFailed = computed(() => path.value !== null && isLoaded.value && compositionBar.previews[path.value] === "");
const fileName = computed(() => (path.value === null ? "" : path.value.slice(path.value.lastIndexOf("/") + 1)));
const root = ref<HTMLElement | null>(null);

// The large picture is made when the big view reaches the image, and kept for the next visit.
watch(
  path,
  (current) => {
    if (current !== null && current in compositionBar.previews === false) {
      void ImageDrop.loadPreview(current);
    }
  },
  { immediate: true },
);

// A key of the big view never reaches the terminal, the composition bar, or the shortcuts of the window.
function onKey(event: KeyboardEvent) {
  const actions: Record<string, () => void> = {
    ArrowLeft: () => ImageDrop.moveViewer(-1),
    ArrowRight: () => ImageDrop.moveViewer(1),
    Escape: () => ImageDrop.closeViewer(),
  };
  const action = actions[event.key];
  if (action === undefined) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  action();
}
onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  root.value?.focus();
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div ref="root" class="overlay" tabindex="-1" role="dialog" :aria-label="t('imageViewer.label')" @mousedown.self="ImageDrop.closeViewer()">
    <button class="close" :aria-label="t('imageViewer.close')" :title="t('imageViewer.close')" @click="ImageDrop.closeViewer()">
      <Icon name="x-lg" />
    </button>
    <button v-if="count > 1" class="arrow previous" :aria-label="t('imageViewer.previous')" @click="ImageDrop.moveViewer(-1)">
      <Icon name="chevron-left" />
    </button>
    <figure class="stage" @mousedown.self="ImageDrop.closeViewer()">
      <img v-if="picture" :src="picture" :alt="fileName" />
      <p v-else-if="isFailed" class="message">{{ t("imageViewer.failed") }}</p>
      <p v-else class="message">{{ t("imageViewer.loading") }}</p>
      <figcaption>
        <span class="name">{{ fileName }}</span>
        <span class="position">{{ t("imageViewer.position", { position: (compositionBar.viewerIndex ?? 0) + 1, total: count }) }}</span>
      </figcaption>
    </figure>
    <button v-if="count > 1" class="arrow next" :aria-label="t('imageViewer.next')" @click="ImageDrop.moveViewer(1)">
      <Icon name="chevron-right" />
    </button>
  </div>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; gap: 12px; padding: 28px; background: rgba(0, 0, 0, 0.8); outline: none; }
.stage { flex: 1; min-width: 0; max-height: 100%; margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
.stage img { max-width: 100%; max-height: calc(100vh - 110px); object-fit: contain; border-radius: 6px; background: var(--field); }
.message { color: var(--muted); }
figcaption { display: flex; gap: 12px; color: var(--text-2); font-size: var(--font-size); }
.position { color: var(--muted); font-variant-numeric: tabular-nums; }
.arrow, .close {
  display: flex; align-items: center; justify-content: center; border: 1px solid var(--line-modal); border-radius: 50%;
  background: var(--raised); color: var(--text); cursor: pointer;
}
.arrow { flex: none; width: 44px; height: 44px; font-size: calc(var(--font-size) * 1.5); }
.close { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; }
.arrow:hover, .close:hover { background: var(--hover); }
</style>
