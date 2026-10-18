<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Icon from "./Icon.vue";
import PushToTalkButton from "./PushToTalkButton.vue";
import VoiceLevel from "./VoiceLevel.vue";
import { ImageDrop, PASTE_DELAY_MS } from "../lib/image_drop";
import { VoiceInput } from "../lib/voice_input";
import { compositionBar } from "../stores/composition_bar";
import { insertText, toast } from "../stores/session";
import { settings } from "../stores/settings";
import { voiceInput } from "../stores/voice_input";
import { hasText, t } from "../i18n/index";

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
onBeforeUnmount(() => {
  voiceInput.error = null;
  if (elapsedTimerId !== null) {
    clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
});

/** The text of the last error of the voice input: a text for its category, else the general text. */
function voiceErrorText(category: string): string {
  const key = `voiceInput.error.${category}`;
  return hasText(key) ? t(key) : t("voiceInput.error.other");
}

/** The seconds since the recording started. */
const elapsedSeconds = ref(0);
let elapsedTimerId: ReturnType<typeof setInterval> | null = null;
function updateElapsedSeconds() {
  elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - voiceInput.startedAt) / 1000));
}
/** The elapsed time as minutes and seconds, for example 0:07. */
const elapsedText = computed(() => `${Math.floor(elapsedSeconds.value / 60)}:${String(elapsedSeconds.value % 60).padStart(2, "0")}`);

/** The microphone is open: the level bars show the voice. */
const isListening = computed(
  () => settings.voiceInput && (voiceInput.state === "starting" || voiceInput.state === "recording"),
);
/** The text of the text input while it is empty: it tells what the voice input does now, else it asks for the text. */
const textPlaceholder = computed(() => {
  if (settings.voiceInput && voiceInput.state === "transcribing") {
    return t("voiceInput.titleTranscribing");
  }
  return isListening.value ? t("voiceInput.listening") : t("compositionBar.textPlaceholder");
});
watch(
  isListening,
  (listening) => {
    if (elapsedTimerId !== null) {
      clearInterval(elapsedTimerId);
      elapsedTimerId = null;
    }
    if (listening) {
      updateElapsedSeconds();
      elapsedTimerId = setInterval(updateElapsedSeconds, 250);
    }
  },
  { immediate: true },
);
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
  if (compositionBar.text === "") {
    element.style.height = "";
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
  const isSettled = await VoiceInput.settle();
  if (isSettled === false || compositionBar.isOpen === false) {
    isSending.value = false;
    return;
  }
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
  <div class="composition-bar d-flex flex-column gap-3" role="region" :aria-label="t('compositionBar.label')" @keydown.esc="ImageDrop.close()">
    <div v-if="compositionBar.paths.length > 0" class="thumbs d-flex flex-wrap align-items-center gap-2">
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
    <div class="controls d-flex align-items-end gap-1">
      <button class="btn icon-button border-0" :aria-label="t('compositionBar.add')" :title="t('compositionBar.addTitle')" @click="addImages">
        <Icon name="plus-lg" />
      </button>
      <div class="field position-relative flex-fill" :class="{ 'is-listening': isListening }">
        <textarea
          ref="textInput"
          v-model="compositionBar.text"
          class="form-control text"
          rows="1"
          :aria-label="t('compositionBar.textLabel')"
          :placeholder="textPlaceholder"
          @keydown="onTextKeydown"
        ></textarea>
        <div v-if="isListening" class="listening position-absolute end-0 bottom-0 d-flex align-items-center justify-content-end gap-2 pe-2">
          <VoiceLevel :levels="voiceInput.levels" />
          <span class="elapsed">{{ elapsedText }}</span>
        </div>
      </div>
      <PushToTalkButton v-if="settings.voiceInput" />
      <button class="btn icon-button border-0 send" :aria-label="t('compositionBar.send')" :title="t('compositionBar.sendTitle')" :disabled="isSending" @click="send">
        <Icon name="send" />
      </button>
    </div>
    <div v-if="settings.voiceInput && voiceInput.error !== null" class="form-text text-danger m-0" role="alert">{{ voiceErrorText(voiceInput.error) }}</div>
  </div>
</template>

<style scoped>
.composition-bar { flex: none; padding: 14px 16px; border-top: 1px solid var(--line); background: var(--raised); }
.thumb {
  position: relative; display: flex; align-items: center; justify-content: center; width: 144px; height: 96px; margin: 0; font-size: calc(var(--font-size) * 2.4);
  border: 1px solid var(--line-modal); border-radius: 6px; background: var(--field); color: var(--muted); overflow: hidden;
}
.open { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; color: inherit; cursor: zoom-in; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.remove { position: absolute; top: 6px; right: 6px; width: 30px; height: 30px; padding: 0; justify-content: center; font-size: calc(var(--font-size) * 1.1); background: var(--raised); }
.field { min-width: 0; --listening-width: min(40%, 340px); }
.text { --control-min-height: 46px; --control-padding-y: 7px; --control-font-size: calc(var(--font-size) * 1.2); resize: none; max-height: 160px; overflow-y: auto; }
.field.is-listening .text { padding-right: calc(var(--listening-width) + 8px); }
.controls { margin-inline: -8px; }
.icon-button, .push-to-talk { flex: none; width: calc(23px + var(--font-size) * 0.65); height: 46px; padding: 0; justify-content: center; font-size: calc(var(--font-size) * 1.3); }
.icon-button:hover, .push-to-talk:hover { --btn-hover-bg: rgba(var(--wash), 0.14); }
.listening { width: var(--listening-width); height: 46px; pointer-events: none; color: var(--muted); }
.elapsed { font-size: calc(var(--font-size) * 1.05); font-variant-numeric: tabular-nums; }
</style>
