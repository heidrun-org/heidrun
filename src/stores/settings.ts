import { reactive, watch } from "vue";

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack given to xterm. */
  stack: string;
}

// Geist Mono, JetBrains Mono and Fira Code are loaded from Google Fonts (index.html);
// the others ship with macOS.
export const FONTS: FontOption[] = [
  { id: "geist", label: "Geist Mono", stack: '"Geist Mono", ui-monospace, Menlo, monospace' },
  { id: "sf", label: "SF Mono", stack: 'ui-monospace, "SF Mono", Menlo, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
  { id: "fira", label: "Fira Code", stack: '"Fira Code", ui-monospace, Menlo, monospace' },
  { id: "menlo", label: "Menlo", stack: "Menlo, monospace" },
  { id: "monaco", label: "Monaco", stack: "Monaco, Menlo, monospace" },
];

export const FONT_MIN = 9;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 12.5;

const KEY = "herdr-desk.settings";

const defaults = {
  fontId: "geist",
  fontSize: FONT_DEFAULT,
  leftOpen: true,
  rightOpen: true,
  /**
   * "select": dragging selects text in the terminal (⌘C to copy).
   * "app": mouse goes to Herdr / the program in the pane (scroll, clicks); ⌥ + drag still selects.
   */
  mouseMode: "select" as "select" | "app",
};

function load(): typeof defaults {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...defaults };
  }
}

export const settings = reactive(load());

watch(
  () => ({ ...settings }),
  (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* preferences are a convenience */
    }
  },
  { deep: true },
);

export function fontStack(): string {
  return (FONTS.find((f) => f.id === settings.fontId) ?? FONTS[0]).stack;
}

export function zoom(delta: number) {
  const next = Math.round((settings.fontSize + delta) * 2) / 2;
  settings.fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, next));
}

export function resetZoom() {
  settings.fontSize = FONT_DEFAULT;
}
