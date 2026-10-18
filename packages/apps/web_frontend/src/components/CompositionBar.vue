<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import { ImageDrop, PASTE_DELAY_MS } from "../lib/image_drop";
import { compositionBar } from "../stores/composition_bar";
import { insertText, toast } from "../stores/session";
import { t } from "../i18n/index";

// The composition bar under the focused pane: the images and the text wait here until the developer sends them to the pane.
// Issue: https://github.com/heidrun-org/heidrun/issues/637
const props = defineProps<{ paneId: string }>();
const emit = defineEmits<{ (event: "sent"): void }>();

const textInput = ref<HTMLTextAreaElement | null>(null);
const isSending = ref(false);

/** The file name at the end of a path. */
function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

// The text input gets the keyboard each time that an image arrives, so that the developer types, then presses Enter to send.
function focusTextInput() {
  void nextTick(() => textInput.value?.focus());
}
onMounted(focusTextInput);
watch(
  () => compositionBar.paths.length,
  (length, previousLength) => {
    if (length > previousLength) {
      focusTextInput();
    }
  },
);
watch(
  () => compositionBar.paths.slice(),
  (paths) => {
    for (const path of paths) {
      if (path in compositionBar.thumbnails === false) {
        compositionBar.thumbnails[path] = "";
        void ImageDrop.loadThumbnail(path);
      }
    }
  },
  { immediate: true },
);

async function addImages() {
  try {
    await ImageDrop.pickImages();
  } catch {
    toast(t("compositionBar.pickFailed"), "error");
  }
  focusTextInput();
}

// The text input grows with its lines, up to a maximum height, then scrolls.
const TEXT_MAX_HEIGHT_PX = 160;
function resizeTextInput() {
  const element = textInput.value;
  if (element === null) {
    return;
  }
  element.style.height = "auto";
  element.style.height = `${Math.min(element.scrollHeight, TEXT_MAX_HEIGHT_PX)}px`;
}
watch(() => compositionBar.text, () => void nextTick(resizeTextInput));
onMounted(resizeTextInput);

// Enter sends. Shift+Enter writes a new line.
function onTextKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && event.shiftKey === false && event.isComposing === false) {
    event.preventDefault();
    void send();
  }
}

// Sends the images first, then the text. The text is written and submitted only when it is not empty: with no text, the
// developer keeps the keyboard in the terminal and speaks or types there.
async function send() {
  if (isSending.value === true) {
    return;
  }
  isSending.value = true;
  const paths = compositionBar.paths.slice();
  const text = compositionBar.text.trim();
  const { pastedCount, result } = await ImageDrop.pasteInto(props.paneId, paths);
  for (const path of paths.slice(0, pastedCount)) {
    ImageDrop.remove(path);
  }
  if (result === "failed") {
    isSending.value = false;
    toast(t("compositionBar.pasteFailed"), "error");
    return;
  }
  if (result === "no_terminal") {
    isSending.value = false;
    toast(t("compositionBar.noTerminal"), "error");
    return;
  }
  if (text !== "") {
    if (pastedCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS));
    }
    await insertText(props.paneId, text, true);
  }
  isSending.value = false;
  ImageDrop.close();
  emit("sent");
}
</script>

<template>
  <div class="composition-bar d-flex flex-column gap-2" role="region" :aria-label="t('compositionBar.label')" @keydown.esc="ImageDrop.close()">
    <div class="thumbs d-flex flex-wrap align-items-center gap-2">
      <button class="btn add" :aria-label="t('compositionBar.add')" :title="t('compositionBar.addTitle')" @click="addImages">
        <Icon name="plus-lg" />
      </button>
      <figure v-for="path in compositionBar.paths" :key="path" class="thumb" :title="path">
        <button class="open" :aria-label="t('compositionBar.open', { name: fileName(path) })" @click="ImageDrop.openViewer(path)">
          <img v-if="compositionBar.thumbnails[path]" :src="compositionBar.thumbnails[path]" :alt="t('compositionBar.thumbnailAlt', { name: fileName(path) })" />
          <Icon v-else name="image" />
        </button>
        <button class="btn remove" :aria-label="t('compositionBar.remove', { name: fileName(path) })" @click="ImageDrop.remove(path)">
          <Icon name="x-lg" />
        </button>
      </figure>
    </div>
    <textarea
      ref="textInput"
      v-model="compositionBar.text"
      class="form-control text"
      rows="1"
      :aria-label="t('compositionBar.textLabel')"
      :placeholder="t('compositionBar.textPlaceholder')"
      @keydown="onTextKeydown"
    ></textarea>
    <div class="d-flex align-items-center gap-2">
      <span class="count">{{ t("compositionBar.count", { count: compositionBar.paths.length }) }}</span>
      <span class="spacer"></span>
      <button class="btn" :title="t('compositionBar.closeTitle')" @click="ImageDrop.close()">{{ t("compositionBar.close") }} <kbd>Esc</kbd></button>
      <button class="btn send" :title="t('compositionBar.sendTitle')" :disabled="isSending" @click="send">
        {{ t("compositionBar.send") }} <kbd>↵</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
.composition-bar { flex: none; padding: 8px 12px; border-top: 1px solid var(--line); background: var(--raised); }
.spacer { flex: 1; }
.count { color: var(--muted); font-size: calc(var(--font-size) * 0.85); }
.thumb {
  position: relative; display: flex; align-items: center; justify-content: center; width: 96px; height: 64px; margin: 0;
  border: 1px solid var(--line-modal); border-radius: 6px; background: var(--field); color: var(--muted); overflow: hidden;
}
.open { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: zoom-in; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.remove { position: absolute; top: 2px; right: 2px; height: 20px; padding: 0 4px; background: var(--raised); }
.add { width: 64px; height: 64px; justify-content: center; background: var(--field); font-size: calc(var(--font-size) * 1.5); }
.text { resize: none; max-height: 160px; overflow-y: auto; }
.send { background: var(--field); }
</style>
