<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Terminal, type IBufferLine, type IDecoration, type IMarker } from "@xterm/xterm";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  EMPTY_CONTEXT,
  REF_COLORS,
  claudeCommands,
  agentListState,
  findAgentRow,
  promptBoxAt,
  findCommands,
  findRefs,
  findShellBlock,
  findInlineShell,
  findFileRefs,
  findStep,
  refContext,
  type RefContext,
} from "../lib/refs";
import { sendPrompt, toast } from "../stores/session";
import { openIssue } from "../stores/issues";
import { openFileRef } from "../stores/files";
import { fold, search } from "../stores/search";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { ClipboardAddon } from "@xterm/addon-clipboard";
import { copy, osc52Provider } from "../lib/clipboard";
import { fontStack, settings } from "../stores/settings";
import { selectionReaders } from "../stores/notes";

const props = defineProps<{
  terminalId: string;
  paneId: string;
  focused: boolean;
  cwd?: string | null;
  /** Agent running in the pane ("claude", "codex"…), if any. */
  agent?: string | null;
}>();
const emit = defineEmits<{ pin: [text: string] }>();

const hasSelection = ref(false);

const el = ref<HTMLDivElement>();
const exited = ref(false);
const id = crypto.randomUUID();

let term: Terminal | null = null;
let fit: FitAddon | null = null;
let observer: ResizeObserver | null = null;
const MOUSE_MODES = new Set([9, 1000, 1001, 1002, 1003, 1005, 1006, 1015, 1016]);
// Alternate screen: ignored. Herdr redraws the whole pane anyway and there is no
// scrollback here, but xterm only allows decorations (reference colors) on the normal screen.
const ALT_MODES = new Set([47, 1047, 1049]);
const requestedMouse = new Set<number>();
const unlisten: UnlistenFn[] = [];

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Herdr refuses an attach while it is reading the same terminal for someone else
// (the app's own pane.read polling, another client…): "has a read in progress; retry".
// That is transient: retry quietly a few times before showing "Terminal détaché".
let spawnedAt = 0;
let retries = 0;
let lastOutput = "";
const textDecoder = new TextDecoder();

async function attach(takeover = false, quiet = false) {
  if (!term) return;
  exited.value = false;
  if (!quiet) retries = 0;
  spawnedAt = Date.now();
  lastOutput = "";
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
  // URLs and references open with ⌘-click, like in iTerm (a plain click stays a click).
  term.loadAddon(
    new WebLinksAddon((e, uri) => {
      if (e.metaKey) openUrl(uri).catch(() => {});
    }),
  );
  // References, slash commands and numbered steps: hovering shows a small action
  // chip (open, run, ask the agent); ⌘-click does the same directly.
  term.registerLinkProvider({
    provideLinks(y, callback) {
      const line = term?.buffer.active.getLine(y - 1);
      if (!line) return callback(undefined);
      const { text, col, width } = lineText(line);
      const range = (s: number, e: number) => ({
        start: { x: col[s] + 1, y },
        end: { x: col[e - 1] + width[e - 1], y },
      });
      const items: { s: number; e: number; label: string; run: () => void; underline: boolean; alt?: ChipAction; meta?: () => void; after?: boolean }[] = [];
      // "! command" suggested by Claude (its shell mode): the whole command, joined on
      // one line even when it spans several, is sent to the prompt and run.
      if (isClaude()) {
        const buf = term!.buffer.active;
        const at = (i: number) => {
          const l = i >= 0 && i < term!.rows ? buf.getLine(buf.viewportY + i) : undefined;
          return l ? lineText(l).text : null;
        };
        // Selection in the agent list: a click in the prompt box gives the focus back
        // to the text input (↑ until past the first row), to type again.
        const row0 = y - 1 - buf.viewportY;
        if (promptBoxAt(at, row0)) {
          const list = agentListState(at, term!.rows);
          if (list && list.selected !== null) {
            const steps = list.selected + 1;
            return callback([
              {
                text,
                range: { start: { x: 1, y }, end: { x: term!.cols, y } },
                decorations: { underline: false, pointerCursor: true },
                activate: () => {
                  hideChip(true);
                  backToPrompt(steps);
                },
                hover: () => {
                  overLink = true;
                  showChip({ start: { x: 1, y }, end: { x: Math.max(2, text.trimEnd().length), y } }, "↩ Revenir à la saisie", () => backToPrompt(steps), undefined, true);
                },
                leave: () => {
                  overLink = false;
                  hideChip();
                },
              },
            ]);
          }
        }
        // Agent list under the prompt: a click switches to that agent (↓ to reach the
        // list, ↓ to the row, Enter), instead of walking there with the arrow keys.
        const agentRow = findAgentRow(at, y - 1 - buf.viewportY, term!.rows);
        if (agentRow) {
          // Stop at the end of the description: the elapsed time is pushed to the
          // right edge after a wide gap ("…availability          29m 5s · ↓").
          const gap = /\s{4,}\S/.exec(text.slice(agentRow.start));
          const e0 = gap ? agentRow.start + gap.index : text.trimEnd().length;
          const link = {
            s: agentRow.start,
            e: e0,
            label: agentRow.current ? `● ${agentRow.name} (affiché)` : `▷ Voir ${agentRow.name}`,
            run: () => switchToAgent(agentRow.name),
            underline: true,
            after: true,
          };
          return callback([toLink(link)]);
        }
        const block = findShellBlock(at, y - 1 - buf.viewportY, term!.cols);
        if (block) {
          const row = y - 1 - buf.viewportY;
          const s0 = row === block.first ? block.start : text.length - text.trimStart().length;
          const e0 = text.trimEnd().length;
          if (e0 > s0) {
            const short = block.command.length > 48 ? `${block.command.slice(0, 48)}…` : block.command;
            const link = {
              s: s0,
              e: e0,
              label: `▷ Exécuter ${short}`,
              run: () => sendPrompt(props.paneId, `! ${block.command}`),
              underline: true,
            };
            return callback([toLink(link)]);
          }
        }
      }
      // "lance ! scripts/x.sh." inside a sentence: run it like a "!" block.
      const inline = props.agent ? findInlineShell(text) : [];
      for (const c of inline) {
        const short = c.command.length > 48 ? `${c.command.slice(0, 48)}…` : c.command;
        items.push({ s: c.start, e: c.end, label: `▷ Exécuter ${short}`, run: () => sendPrompt(props.paneId, `! ${c.command}`), underline: true });
      }
      const inCommand = (s: number, e: number) => inline.some((c) => s < c.end && e > c.start);
      for (const r of findRefs(text, refCtx)) {
        if (!r.url || inCommand(r.start, r.end)) continue;
        const what = text.slice(r.start, r.end);
        const target = r.target;
        const preview = target ? () => openIssue(props.cwd, target, r.url) : undefined;
        items.push({
          s: r.start,
          e: r.end,
          label: `↗ Ouvrir ${what}`,
          run: () => openUrl(r.url!).catch(() => {}),
          underline: true,
          // Issues and MR: also previewed in the app; ⌘-click goes straight there.
          alt: preview ? { label: "⧉ Aperçu", run: preview } : undefined,
          meta: preview,
        });
      }
      // "src/app.ts:42" cited by the agent (or a compiler): opened in the file explorer.
      for (const f of findFileRefs(text)) {
        if (items.some((i) => f.start < i.e && f.end > i.s)) continue;
        const name = f.path.split("/").pop() + (f.line ? `:${f.line}` : "");
        const open = () => openFileRef(props.cwd, f.path, f.line);
        items.push({ s: f.start, e: f.end, label: `📄 Ouvrir ${name}`, run: open, underline: true, meta: open });
      }
      if (isClaude()) {
        for (const c of findCommands(text, commands)) {
          if (items.some((i) => c.start < i.e && c.end > i.s)) continue;
          items.push({ s: c.start, e: c.end, label: `▷ Lancer ${c.command}`, run: () => sendPrompt(props.paneId, c.command), underline: true });
        }
      }
      if (props.agent) {
        const step = findStep(text);
        if (step) {
          // The step's hover zone stops before any other link on the line.
          const firstOther = Math.min(step.end, ...items.filter((i) => i.s > step.start).map((i) => i.s));
          const end = text.slice(0, firstOther).trimEnd().length;
          if (end > step.start && !items.some((i) => i.s <= step.start && i.e > step.start)) {
            const snippet = step.text.length > 90 ? `${step.text.slice(0, 90)}…` : step.text;
            items.push({
              s: step.start,
              e: end,
              label: `▷ Faire le point ${step.number}`,
              run: () => sendPrompt(props.paneId, `Vas-y pour le point ${step.number} : « ${snippet} »`),
              underline: false,
            });
          }
        }
      }
      const links = items.map(toLink);
      callback(links.length ? links : undefined);

      function toLink(i: (typeof items)[number]) {
        return {
          text: text.slice(i.s, i.e),
          range: range(i.s, i.e),
          decorations: { underline: i.underline, pointerCursor: i.underline },
          activate: (e: MouseEvent) => {
            if (e.metaKey) {
              hideChip(true);
              (i.meta ?? i.run)();
            }
          },
          hover: () => {
            overLink = true;
            showChip(range(i.s, i.e), i.label, i.run, i.alt, i.after);
          },
          leave: () => {
            overLink = false;
            hideChip();
          },
        };
      }
    },
  });
  term.loadAddon(new ClipboardAddon(osc52Provider));

  // Mouse reporting: Herdr's attach client asks for it, which turns every drag into
  // mouse events and makes text selection impossible. In "select" mode we drop those
  // requests (and remember them, to restore them if the user switches back to "app").
  term.parser.registerCsiHandler({ prefix: "?", final: "h" }, (params) => {
    const modes = params.flat() as number[];
    const mouse = modes.filter((m) => MOUSE_MODES.has(m));
    mouse.forEach((m) => requestedMouse.add(m));
    const dropMouse = settings.mouseMode === "select" && mouse.length > 0;
    const dropAlt = modes.some((m) => ALT_MODES.has(m));
    if (!dropMouse && !dropAlt) return false;
    const rest = modes.filter((m) => !ALT_MODES.has(m) && !(dropMouse && MOUSE_MODES.has(m)));
    if (rest.length) term!.write(`\x1b[?${rest.join(";")}h`);
    return true;
  });
  term.parser.registerCsiHandler({ prefix: "?", final: "l" }, (params) => {
    const modes = params.flat() as number[];
    modes.forEach((m) => requestedMouse.delete(m));
    if (!modes.some((m) => ALT_MODES.has(m))) return false;
    const rest = modes.filter((m) => !ALT_MODES.has(m));
    if (rest.length) term!.write(`\x1b[?${rest.join(";")}l`);
    return true;
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
      if (e.payload.id !== id) return;
      const bytes = decode(e.payload.data);
      // Keep the start of the output, to recognize an attach refused by Herdr.
      if (Date.now() - spawnedAt < 4000 && lastOutput.length < 600) lastOutput += textDecoder.decode(bytes, { stream: true });
      term?.write(bytes);
    }),
    await listen<{ id: string }>("pty://exit", (e) => {
      if (e.payload.id !== id) return;
      const early = Date.now() - spawnedAt < 4000;
      const busy = /read in progress|retry/i.test(lastOutput);
      if ((busy || early) && retries < 6) {
        retries++;
        window.setTimeout(() => {
          term?.reset();
          attach(false, true);
        }, 250 * retries);
        return;
      }
      exited.value = true;
    }),
  );

  term.onWriteParsed(scheduleRefs);
  term.onResize(scheduleRefs);
  term.onData((data) => invoke("pty_write", { id, data }).catch(() => {}));
  term.onResize(({ cols, rows }) => invoke("pty_resize", { id, cols, rows }).catch(() => {}));

  // Mouse wheel. In "select" mode xterm no longer reports the mouse, so it would turn
  // the wheel into ↑/↓ keys (shell or prompt history). Instead we send real wheel
  // events to Herdr, which scrolls the pane's history as it does in its own UI.
  // ⌥ + wheel does the opposite: ↑/↓ keys, to walk through previous commands.
  el.value!.addEventListener("wheel", onWheel, { capture: true, passive: false });
  el.value!.addEventListener("mousedown", onDown, true);
  el.value!.addEventListener("mouseup", onUp, true);

  observer = new ResizeObserver(() => fit?.fit());
  observer.observe(el.value!);

  await attach(false);
  if (props.focused) term.focus();
});

// ---- References: #12, !34, PR #5, ABC-123, commits ------------------------

let refCtx: RefContext = EMPTY_CONTEXT;
let commands = new Set<string>();
const isClaude = () => (props.agent ?? "").includes("claude");
watch(
  () => [props.cwd, props.agent] as const,
  async ([cwd]) => {
    refCtx = await refContext(cwd);
    if (isClaude()) commands = await claudeCommands(cwd);
    scheduleRefs();
  },
  { immediate: true },
);

// ---- Hover chip -------------------------------------------------------------

const wrapEl = ref<HTMLDivElement>();
interface ChipAction {
  label: string;
  run: () => void;
}
const chip = ref<{ left: number | null; right: number | null; top: number; label: string; run: () => void; alt?: ChipAction } | null>(null);
let chipTimer = 0;
// Mouse on the chip: the chip is frozen. Claude redraws the screen all the time, and
// xterm then re-reads the link under the last pointer position, which may be another
// issue by now: without this, the chip would switch target or vanish under the mouse.
let onChip = false;
const CHIP_H = 26;

/**
 * The chip sits just above the hovered text, touching it: the pointer goes straight
 * up into it without crossing anything, and the rest of the line (other #12, !34…)
 * stays visible and reachable. On the first row, it goes just below instead.
 */
function showChip(
  r: { start: { x: number; y: number }; end: { x: number; y: number } },
  label: string,
  run: () => void,
  alt?: ChipAction,
  /** On the line itself, after the text (agent list rows: one link per line). */
  after = false,
) {
  if (onChip) return;
  window.clearTimeout(chipTimer);
  const screen = el.value?.querySelector(".xterm-screen") as HTMLElement | null;
  if (!term || !screen || !wrapEl.value) return;
  const s = screen.getBoundingClientRect();
  const w = wrapEl.value.getBoundingClientRect();
  const cellW = s.width / term.cols;
  const cellH = s.height / term.rows;
  const row = r.start.y - 1 - term.buffer.active.viewportY;
  const rowTop = s.top - w.top + row * cellH;
  // 2 px of overlap with the text: no gap where the pointer would leave the link.
  const top = after ? rowTop + (cellH - CHIP_H) / 2 : row > 0 ? rowTop - CHIP_H + 2 : rowTop + cellH - 2;
  const left = after ? s.left - w.left + r.end.x * cellW : s.left - w.left + (r.start.x - 1) * cellW - 2;
  const width = alt ? 230 : 180;
  const roomy = left + width < w.width;
  chip.value = { left: roomy ? Math.max(0, left) : null, right: roomy ? null : 10, top, label, run, alt };
}

function hideChip(now = false) {
  window.clearTimeout(chipTimer);
  if (now) {
    onChip = false;
    chip.value = null;
    return;
  }
  if (onChip) return;
  else chipTimer = window.setTimeout(() => (chip.value = null), 350);
}

/** Keys, one at a time: Claude Code's TUI reads them as separate presses. */
async function pressKeys(keys: string[]) {
  for (const k of keys) {
    await invoke("pty_write", { id, data: k }).catch(() => {});
    await new Promise((r) => window.setTimeout(r, 45));
  }
}

async function backToPrompt(steps: number) {
  if (!term) return;
  const up = term.modes.applicationCursorKeysMode ? "\x1bOA" : "\x1b[A";
  term.focus();
  await pressKeys(Array(steps).fill(up));
}

function screenLine(i: number): string | null {
  if (!term || i < 0 || i >= term.rows) return null;
  const l = term.buffer.active.getLine(term.buffer.active.viewportY + i);
  return l ? lineText(l).text : null;
}

/**
 * Moves Claude Code's agent selection to `name` and opens it. The selection may
 * still be in the prompt (first ↓ enters the list) or already on a row (❯), for
 * instance while another agent is shown: the screen is read again after each step.
 */
async function switchToAgent(name: string) {
  if (!term) return;
  const app = term.modes.applicationCursorKeysMode;
  const down = app ? "\x1bOB" : "\x1b[B";
  const up = app ? "\x1bOA" : "\x1b[A";
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
  term.focus();
  let list = agentListState(screenLine, term.rows);
  if (!list) return;
  if (list.selected === null) {
    await pressKeys([down]);
    // Claude marks the selected row with ❯, but not always right away (or not at
    // all, depending on the version): wait a little for it, and without it assume
    // the first row, as the ↓ from the prompt lands there.
    let after = null as ReturnType<typeof agentListState>;
    for (let i = 0; i < 5; i++) {
      await wait(i ? 120 : 160);
      after = agentListState(screenLine, term.rows);
      if (!after || after.selected !== null) break;
    }
    // The list is gone: the ↓ opened something else. Undo it and stop rather than
    // pressing Enter on something unknown.
    if (!after) {
      await pressKeys([up]);
      toast("Impossible d’atteindre la liste des agents : utilise ↓ puis Entrée");
      return;
    }
    list = { names: after.names, selected: after.selected ?? 0 };
  }
  const target = list.names.indexOf(name);
  if (target === -1) return;
  const from = list.selected ?? 0;
  const steps = target - from;
  await pressKeys([...Array(Math.abs(steps)).fill(steps > 0 ? down : up), "\r"]);
}

function enterChip() {
  onChip = true;
  window.clearTimeout(chipTimer);
}
function leaveChip() {
  onChip = false;
  hideChip();
}

function runChip(alt = false) {
  const c = chip.value;
  hideChip(true);
  if (alt) c?.alt?.run();
  else c?.run();
  term?.focus();
}

/** The text of a buffer line, with the cell column of each character (wide chars, emoji). */
function lineText(line: IBufferLine): { text: string; col: number[]; width: number[] } {
  let text = "";
  const col: number[] = [];
  const width: number[] = [];
  for (let x = 0; x < line.length; x++) {
    const cell = line.getCell(x);
    if (!cell) break;
    const w = cell.getWidth();
    if (w === 0) continue; // second half of a wide char
    const chars = cell.getChars() || " ";
    for (let i = 0; i < chars.length; i++) {
      col.push(x);
      width.push(w);
    }
    text += chars;
  }
  return { text, col, width };
}

// Colors are decorations on top of the cells: the stream itself is never modified,
// so the agent's TUI keeps drawing exactly as it wants. Rows are recomputed only
// when their text changed (or moved), a short while after output settles.
interface RowRefs {
  text: string;
  marker: IMarker | null;
  decorations: IDecoration[];
}
const rows = new Map<number, RowRefs>();
let refsTimer = 0;

function scheduleRefs() {
  if (refsTimer) return;
  refsTimer = window.setTimeout(() => {
    refsTimer = 0;
    paintRefs();
  }, 120);
}

function clearRow(y: number) {
  const r = rows.get(y);
  if (!r) return;
  r.decorations.forEach((d) => d.dispose());
  r.marker?.dispose();
  rows.delete(y);
}

function paintRefs() {
  if (!term) return;
  const buf = term.buffer.active;
  if (buf.type !== "normal") return;
  for (const y of [...rows.keys()]) if (y >= term.rows) clearRow(y);
  for (let y = 0; y < term.rows; y++) {
    const line = buf.getLine(buf.baseY + y);
    if (!line) continue;
    const { text, col, width } = lineText(line);
    const prev = rows.get(y);
    if (prev && prev.text === text && (!prev.marker || (!prev.marker.isDisposed && prev.marker.line === buf.baseY + y))) continue;
    clearRow(y);
    const refs = findRefs(text, refCtx);
    if (!refs.length) {
      rows.set(y, { text, marker: null, decorations: [] });
      continue;
    }
    const marker = term.registerMarker(buf.baseY + y - (buf.baseY + buf.cursorY));
    const decorations: IDecoration[] = [];
    for (const r of refs) {
      const x = col[r.start];
      const end = col[r.end - 1] + width[r.end - 1];
      const d = term.registerDecoration({ marker, x, width: end - x, foregroundColor: REF_COLORS[r.kind], layer: "top" });
      if (d) decorations.push(d);
    }
    rows.set(y, { text, marker, decorations });
  }
}

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

// Global search: once this pane is shown, select the found text if it is in the
// terminal's buffer (the screen, mostly: older history stays in Herdr).
/** Logical line (wrapped rows joined) with, for each character, its row and column. */
function logicalLine(lastRow: number): { first: number; text: string; pos: { y: number; x: number }[] } {
  const buf = term!.buffer.active;
  let first = lastRow;
  while (first > 0 && buf.getLine(first)?.isWrapped) first--;
  let text = "";
  const pos: { y: number; x: number }[] = [];
  for (let y = first; y <= lastRow; y++) {
    const l = buf.getLine(y);
    if (!l) continue;
    for (let x = 0; x < l.length; x++) {
      const ch = l.getCell(x)?.getChars() ?? "";
      if (!ch) continue; // second half of a wide character
      // One entry per UTF-16 unit, like string indices.
      text += ch;
      for (let k = 0; k < ch.length; k++) pos.push({ y, x });
    }
  }
  return { first, text: text.replace(/\s+$/, ""), pos };
}

watch(
  () => search.jump,
  async (j) => {
    if (!j || j.paneId !== props.paneId) return;
    const whole = fold(j.line.trim());
    const lead = j.line.length - j.line.trimStart().length;
    const needle = fold(j.line.slice(j.start, j.end));
    if (!needle) return;
    // A pane just opened is still attaching: give its screen a moment to arrive.
    for (let attempt = 0; attempt < 6; attempt++) {
      await new Promise((r) => window.setTimeout(r, attempt ? 300 : 120));
      if (!term || search.jump?.seq !== j.seq) return;
      const buf = term.buffer.active;
      // The very line clicked first; else the most recent line holding the match.
      for (const exact of [true, false]) {
        let y = buf.length - 1;
        while (y >= 0) {
          const ll = logicalLine(y);
          const folded = fold(ll.text);
          let at = -1;
          if (exact) {
            const i = whole ? folded.indexOf(whole) : -1;
            if (i !== -1) at = i + (j.start - lead);
          } else at = folded.indexOf(needle);
          if (at >= 0 && at + needle.length <= ll.pos.length) {
            const a = ll.pos[at];
            const b = ll.pos[at + needle.length - 1];
            const cols = term.cols;
            term.scrollToLine(Math.max(0, a.y - Math.floor(term.rows / 2)));
            term.select(a.x, a.y, (b.y - a.y) * cols + b.x - a.x + 1);
            term.focus();
            search.jump = null;
            return;
          }
          y = ll.first - 1;
        }
      }
    }
    search.jump = null;
    toast("Résultat plus haut dans l’historique : fais défiler le panneau pour le voir");
  },
  { immediate: true },
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

// ---- Clicks for the program, in "select" mode -------------------------------
// Dragging selects text, but a simple click (no drag, no modifier) still reaches
// the program when it asked for the mouse: buttons and × in Claude Code's panels,
// menus in Herdr… Clicks on our own links are left alone.
let overLink = false;
let down: { x: number; y: number } | null = null;

function onDown(e: MouseEvent) {
  down = e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey ? { x: e.clientX, y: e.clientY } : null;
}

function onUp(e: MouseEvent) {
  const start = down;
  down = null;
  if (!term || !start || settings.mouseMode !== "select" || overLink) return;
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 3) return; // a drag: selection
  if (![1000, 1002, 1003].some((m) => requestedMouse.has(m))) return;
  const { col, row } = cellAt(e as unknown as WheelEvent);
  let seq: string;
  if (requestedMouse.has(1006)) {
    seq = `\x1b[<0;${col};${row}M\x1b[<0;${col};${row}m`;
  } else {
    const c = (n: number) => String.fromCharCode(32 + Math.min(n, 223));
    seq = `\x1b[M${c(0)}${c(col)}${c(row)}\x1b[M${c(3)}${c(col)}${c(row)}`;
  }
  invoke("pty_write", { id, data: seq }).catch(() => {});
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
  window.clearTimeout(refsTimer);
  window.clearTimeout(chipTimer);
  for (const y of [...rows.keys()]) clearRow(y);
  el.value?.removeEventListener("wheel", onWheel, { capture: true });
  el.value?.removeEventListener("mousedown", onDown, true);
  el.value?.removeEventListener("mouseup", onUp, true);
  if (selectionReaders.get(props.paneId)) selectionReaders.delete(props.paneId);
  observer?.disconnect();
  unlisten.forEach((u) => u());
  invoke("pty_kill", { id }).catch(() => {});
  term?.dispose();
});
</script>

<template>
  <div ref="wrapEl" class="wrap">
    <div ref="el" class="term"></div>
    <div
      v-if="chip"
      class="chips"
      :style="{
        top: `${chip.top}px`,
        left: chip.left != null ? `${chip.left}px` : 'auto',
        right: chip.right != null ? `${chip.right}px` : 'auto',
      }"
      @mouseenter="enterChip()"
      @mouseleave="leaveChip()"
      @mousedown.stop.prevent
    >
      <button class="chip" type="button" :title="chip.alt ? '' : '⌘-clic sur le texte fait la même chose'" @click="runChip(false)">{{ chip.label }}</button>
      <button v-if="chip.alt" class="chip" type="button" title="Aperçu dans l’app (⌘-clic sur le texte)" @click="runChip(true)">{{ chip.alt.label }}</button>
    </div>
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
/* The padding is part of the hover zone, and reaches down to the hovered text. */
.chips { position: absolute; z-index: 6; height: 26px; display: flex; align-items: flex-start; gap: 4px; padding: 0 4px; }
.chip { height: 22px; padding: 0 9px; border-radius: 6px;
  border: 1px solid #3a4250; background: #1b2028; color: var(--text); font-size: 11.5px; font-weight: 500;
  white-space: nowrap; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); cursor: pointer;
  max-width: 360px; overflow: hidden; text-overflow: ellipsis;
}
.chip:hover { background: #24406a; border-color: #3d6aa8; }
:deep(.xterm-viewport) { background: transparent !important; }
</style>
