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
import { selectionReaders } from "../stores/notes";

const props = defineProps<{ terminalId: string; paneId: string; focused: boolean }>();
const emit = defineEmits<{ pin: [text: string] }>();

const hasSelection = ref(false);

const el = ref<HTMLDivElement>();
const exited = ref(false);
const id = crypto.randomUUID();

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let observer: ResizeObserver | null = null;
const MOUSE_MODES = new Set([9, 1000, 1001, 1002, 1003, 1005, 1006, 1015, 1016]);
const requestedMouse = new Set<number>();
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
    // In "app" mouse mode, ⌥ + drag still forces a local selection.
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

  // Mouse reporting: Herdr's attach client asks for it, which turns every drag into
  // mouse events and makes text selection impossible. In "select" mode we drop those
  // requests (and remember them, to restore them if the user switches back to "app").
  term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => {
    const modes = params.flat() as number[];
    const mouse = modes.filter((m) => MOUSE_MODES.has(m));
    mouse.forEach((m) => requestedMouse.add(m));
    if (settings.mouseMode === "app" || !mouse.length) return false;
    const rest = modes.filter((m) => !MOUSE_MODES.has(m));
    if (rest.length) term!.write(`\x1b[?${rest.join(";")}h`);
    return true;
  });
  term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (params) => {
    (params.flat() as number[]).forEach((m) => requestedMouse.delete(m));
    return false;
  });

  // ⌘C copies the local selection; without one it falls through to the terminal.
  // ⇧↵ / ⌥↵ insert a new line instead of sending: ESC + CR, the sequence Claude Code,
  // Codex and zsh read as "newline" (what Option+Enter sends in Terminal/iTerm).
  term.attachCustomKeyEventHandler((e) => {
    if (e.type === "keydown" && e.metaKey && !e.ctrlKey && e.code === "KeyC" && term?.hasSelection()) {
      copy(term.getSelection());
      term.clearSelection();
      return false;
    }
    if ((e.key === "Enter" || e.code === "NumpadEnter") && (e.shiftKey || e.altKey) && !e.metaKey && !e.ctrlKey) {
      if (e.type === "keydown" && !e.isComposing) {
        e.preventDefault();
        invoke("pty_write", { id, data: "\x1b\r" }).catch(() => {});
      }
      return false;
    }
    return true;
  });
  term.open(el.value!);
  fit.fit();

  term.onSelectionChange(() => {
    hasSelection.value = !!term?.hasSelection();
  });
  selectionReaders.set(props.paneId, () => term?.getSelection() ?? "");

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

  // Mouse wheel. In "select" mode xterm no longer reports the mouse, so it would turn
  // the wheel into ↑/↓ keys (shell or prompt history). Instead we send real wheel
  // events to Herdr, which scrolls the pane's history as it does in its own UI.
  // ⌥ + wheel does the opposite: ↑/↓ keys, to walk through previous commands.
  el.value!.addEventListener("wheel", onWheel, { capture: true, passive: false });

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

// Switching modes live: turn local mouse reporting off, or give back what the app asked for.
watch(
  () => settings.mouseMode,
  (mode) => {
    if (!term) return;
    if (mode === "select") {
      term.write("\x1b[?9l\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l\x1b[?1015l\x1b[?1016l");
    } else if (requestedMouse.size) {
      const modes = [...requestedMouse];
      requestedMouse.clear(); // re-added by the handler as the sequence goes through
      term.write(`\x1b[?${modes.join(";")}h`);
    }
  },
);

watch(
  () => props.focused,
  (f) => f && term?.focus(),
);

let wheelRest = 0;

function cellAt(e: WheelEvent): { col: number; row: number } {
  const screen = el.value!.querySelector(".xterm-screen") as HTMLElement | null;
  const rect = (screen ?? el.value!).getBoundingClientRect();
  const cols = term!.cols;
  const rows = term!.rows;
  const col = Math.min(cols, Math.max(1, Math.floor(((e.clientX - rect.left) / rect.width) * cols) + 1));
  const row = Math.min(rows, Math.max(1, Math.floor(((e.clientY - rect.top) / rect.height) * rows) + 1));
  return { col, row };
}

function onWheel(e: WheelEvent) {
  if (!term || e.deltaY === 0) return;
  const appMode = settings.mouseMode === "app";
  // App mode without ⌥: xterm already forwards the wheel to Herdr.
  if (appMode && !e.altKey) return;
  // Select mode with ⌥: keep xterm's default (↑/↓ keys).
  if (!appMode && e.altKey) return;
  e.preventDefault();
  e.stopPropagation();

  // Trackpads send many small deltas: turn them into whole lines.
  const unit = e.deltaMode === 1 ? 1 : e.deltaMode === 2 ? term.rows : 1 / 40;
  wheelRest += e.deltaY * unit;
  const lines = Math.trunc(wheelRest);
  if (!lines) return;
  wheelRest -= lines;
  const up = lines < 0;
  const count = Math.min(Math.abs(lines), 10);
  let seq = "";

  if (appMode) {
    // ⌥ + wheel in app mode: history keys.
    const app = term.modes.applicationCursorKeysMode;
    seq = (up ? (app ? "\x1bOA" : "\x1b[A") : app ? "\x1bOB" : "\x1b[B").repeat(count);
  } else {
    const { col, row } = cellAt(e);
    const button = up ? 64 : 65;
    if (requestedMouse.has(1006)) {
      seq = `\x1b[<${button};${col};${row}M`.repeat(count);
    } else if (requestedMouse.size) {
      seq = (`\x1b[M` + String.fromCharCode(32 + button, 32 + Math.min(col, 223), 32 + Math.min(row, 223))).repeat(count);
    } else {
      // The program did not ask for the mouse at all: plain arrow keys, like a normal terminal.
      seq = (up ? "\x1b[A" : "\x1b[B").repeat(count);
    }
  }
  invoke("pty_write", { id, data: seq }).catch(() => {});
}

function copySelection() {
  if (!term) return;
  copy(term.getSelection());
  term.clearSelection();
}

function pinSelection() {
  if (!term) return;
  emit("pin", term.getSelection());
  term.clearSelection();
}

onBeforeUnmount(() => {
  el.value?.removeEventListener("wheel", onWheel, { capture: true });
  if (selectionReaders.get(props.paneId)) selectionReaders.delete(props.paneId);
  observer?.disconnect();
  unlisten.forEach((u) => u());
  invoke("pty_kill", { id }).catch(() => {});
  term?.dispose();
});
</script>

<template>
  <div class="wrap">
    <div ref="el" class="term"></div>
    <div v-if="hasSelection" class="sel-bar" @mousedown.stop.prevent>
      <button class="btn" @click="copySelection">Copier <kbd>⌘C</kbd></button>
      <button class="btn" @click="pinSelection">Épingler <kbd>⇧⌘P</kbd></button>
    </div>
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
.sel-bar {
  position: absolute; right: 12px; bottom: 12px; z-index: 5; display: flex; gap: 6px; padding: 6px;
  border-radius: 10px; background: #1b1e22; border: 1px solid #33383e; box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
}
.sel-bar .btn { background: var(--field); }
:deep(.xterm-viewport) { background: transparent !important; }
</style>
