<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { copy, osc52Provider } from "../lib/clipboard";
import { fontStack, settings } from "../stores/settings";

const props = defineProps<{ terminalId: string; focused: boolean }>();

const el = ref<HTMLDivElement>();
const exited = ref(false);
const id = crypto.randomUUID();

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let observer: ResizeObserver | null = null;
const unlisten: UnlistenFn[] = [];

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function attach(takeover = false) {
  if (!term) return;
  exited.value = false;
  try {
    await invoke("pty_spawn", { id, terminalId: props.terminalId, cols: term.cols, rows: term.rows, takeover });
  } catch (e) {
    term.writeln(`\r\n\x1b[31mImpossible d’attacher le terminal : ${e}\x1b[0m`);
    exited.value = true;
  }
}

onMounted(async () => {
  term = new Terminal({
    fontFamily: fontStack(),
    fontSize: settings.fontSize,
    lineHeight: 1.25,
    cursorBlink: true,
    macOptionIsMeta: true,
    // Herdr captures the mouse, so a plain drag goes to Herdr (which copies via OSC 52).
    // ⌥ + drag forces a local xterm selection instead.
    macOptionClickForcesSelection: true,
    scrollback: 0, // Herdr owns the scrollback; the attach client redraws the screen.
    allowProposedApi: true,
    theme: {
      background: "#0b0c0e",
      foreground: "#c9cdd1",
      cursor: "#c9cdd1",
      selectionBackground: "#2a3b4d",
      black: "#16181b",
      red: "#e58a8a",
      green: "#7ec699",
      yellow: "#f2a93b",
      blue: "#6ea8fe",
      magenta: "#c29bf0",
      cyan: "#3fb8af",
      white: "#c9cdd1",
      brightBlack: "#5a6066",
      brightRed: "#f0a3a3",
      brightGreen: "#9bd8b0",
      brightYellow: "#f6c06a",
      brightBlue: "#9cc3ff",
      brightMagenta: "#d6b8f6",
      brightCyan: "#6fd0c8",
      brightWhite: "#e8e6e1",
    },
  });
  try {
    await document.fonts.load(`${settings.fontSize}px ${fontStack()}`);
  } catch {
    /* ignore */
  }
  fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  term.loadAddon(new ClipboardAddon(osc52Provider));

  // ⌘C copies the local selection; without one it falls through to the terminal.
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === "keydown" && e.metaKey && !e.ctrlKey && e.code === "KeyC" && term?.hasSelection()) {
      copy(term.getSelection());
      term.clearSelection();
      return false;
    }
    return true;
  });
  term.open(el.value!);
  fit.fit();

  // Listen before spawning so no early output is lost.
  unlisten.push(
    await listen<{ id: string; data: string }>("pty://data", (e) => {
      if (e.payload.id === id) term?.write(decode(e.payload.data));
    }),
    await listen<{ id: string }>("pty://exit", (e) => {
      if (e.payload.id === id) exited.value = true;
    }),
  );

  term.onData((data) => invoke("pty_write", { id, data }).catch(() => {}));
  term.onResize(({ cols, rows }) => invoke("pty_resize", { id, cols, rows }).catch(() => {}));

  observer = new ResizeObserver(() => fit?.fit());
  observer.observe(el.value!);

  await attach(false);
  if (props.focused) term.focus();
});

// Font changes: wait for the font to load so xterm measures the right cell size,
// then refit; the new cols/rows reach Herdr through onResize.
watch(
  () => [settings.fontId, settings.fontSize] as const,
  async () => {
    if (!term) return;
    const stack = fontStack();
    try {
      await document.fonts.load(`${settings.fontSize}px ${stack}`);
    } catch {
      /* fall back to whatever is available */
    }
    term.options.fontFamily = stack;
    term.options.fontSize = settings.fontSize;
    fit?.fit();
  },
);

watch(
  () => props.focused,
  (f) => f && term?.focus(),
);

onBeforeUnmount(() => {
  observer?.disconnect();
  unlisten.forEach((u) => u());
  invoke("pty_kill", { id }).catch(() => {});
  term?.dispose();
});
</script>

<template>
  <div class="wrap">
    <div ref="el" class="term"></div>
    <div v-if="exited" class="overlay">
      <p>Terminal détaché.</p>
      <div class="actions">
        <button class="btn" @click="attach(false)">Rattacher</button>
        <button class="btn" @click="attach(true)">Prendre le contrôle</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; position: relative; }
.term { position: absolute; inset: 8px 4px 4px 12px; }
.overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; background: rgba(11, 12, 14, 0.82); color: var(--text-2);
}
.overlay p { margin: 0; }
.actions { display: flex; gap: 8px; }
:deep(.xterm) { height: 100%; }
:deep(.xterm-viewport) { background: transparent !important; }
</style>
