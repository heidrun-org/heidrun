import { reactive, watch } from "vue";

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family stack given to xterm. */
  stack: string;
}

// Geist Mono, JetBrains Mono, Fira Code and Inconsolata are loaded from Google Fonts
// (index.html); the others ship with macOS or are installed by the user.
export const FONTS: FontOption[] = [
  { id: "geist", label: "Geist Mono", stack: '"Geist Mono", ui-monospace, Menlo, monospace' },
  { id: "sf", label: "SF Mono", stack: 'ui-monospace, "SF Mono", Menlo, monospace' },
  { id: "jetbrains", label: "JetBrains Mono", stack: '"JetBrains Mono", ui-monospace, Menlo, monospace' },
  { id: "fira", label: "Fira Code", stack: '"Fira Code", ui-monospace, Menlo, monospace' },
  // Installed locally (powerline/fonts or Nerd Fonts); Google's Inconsolata as a
  // fallback, without the powerline glyphs.
  {
    id: "inconsolata-powerline",
    label: "Inconsolata for Powerline",
    stack: '"Inconsolata for Powerline", "Inconsolata Nerd Font Mono", "Inconsolata Nerd Font", "InconsolataGo Nerd Font", Inconsolata, ui-monospace, monospace',
  },
  { id: "menlo", label: "Menlo", stack: "Menlo, monospace" },
  { id: "monaco", label: "Monaco", stack: "Monaco, Menlo, monospace" },
];

export const FONT_MIN = 9;
export const FONT_MAX = 24;
export const FONT_DEFAULT = 12.5;

const KEY = "heidrun.settings";

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
  /** Right panel section. */
  rightTab: "pane" as "pane" | "actions" | "git" | "notes",
  /** Last size of the note window, in px. */
  noteWidth: 760,
  /** Side columns, in px (drag the borders; double-click resets). */
  leftWidth: 280,
  /** Start the Herdr server in the background when it is not running. */
  autoStartHerdr: true,
  /** Finished items (Activité, « À traiter » terminé) disappear after this many minutes; 0 = never. */
  finishedTtl: 15,
  /** Notifications. */
  notifBlockedMin: 5, // remind once when an agent stays blocked this long (0 = off)
  notifContext: true, // an agent's context goes past 80 %
  notifQuota: true, // Claude 5 h / week quota past 80 % then 95 %
  notifEvening: "", // "18:30": summary of the day's finished work ("" = off)
  quietFrom: "", // "20:00" … "08:00": no notification in between ("" = never quiet)
  quietTo: "",
  /** Git viewer: "unified" | "split" diff, or the whole "file". */
  diffMode: "unified" as "unified" | "split" | "file" | "read",
  /** Git window: code size (⌘+ / ⌘− while it is open) and file list width. */
  codeFontSize: 12.5,
  /** Side-by-side diff: share of the width for the old version (0.5 = middle). */
  splitRatio: 0.5,
  /** Markdown reading: centred column, or the whole width. */
  mdWidth: "center" as "center" | "full",
  /** Git window: file list hidden (the viewer takes the whole window). */
  gitListHidden: false,
  gitListWidth: 340,
  /** Language of the user interface. */
  language: "en" as "en" | "fr",
  /** Clock display: "auto" follows the language, "12h" shows AM and PM, "24h" shows the hour from 0 to 23. */
  timeFormat: "auto" as "auto" | "12h" | "24h",
  /** Days of the week you work, numbered like `Date.getDay()` (0 is Sunday). The weekly quota pace counts only these days. */
  workingDays: [0, 1, 2, 3, 4, 5, 6] as number[],
  /** Application theme: "system" follows the operating system. */
  theme: "system" as "system" | "light" | "dark",
  /** Code colours: "auto" follows the application theme. */
  codeTheme: "auto",
  codeWrap: false,
  rightWidth: 320,
  noteHeight: 520,
  /** Agents kept "à côté" (pane ids), stacked in a column on the right of the tab. */
  dockedPanes: [] as string[],
  /** History estimates: 1 h of agent work ≈ this many hours of a developer. */
  histHumanFactor: 4,
  /** Your own time: minutes per consigne written, per decision answered. */
  histPromptMin: 3,
  histDecisionMin: 0.5,
  /** File explorer: tree width, Markdown shown rendered. */
  filesListWidth: 300,
  filesMdRead: true,
  /** Show the diff before each save in the editor. */
  filesDiffBeforeSave: false,
  /** Mosaic: only the agents at work (main, recent journal, or in Claude's list). */
  mosaicActiveOnly: true,
  /** Monthly budget per workspace (label → USD); alert at 80 % and 100 %. */
  budgets: {} as Record<string, number>,
  dockWidth: 560,
};

function load(): typeof defaults {
  try {
    const saved = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    // "github-dark" was the only default before themes existed: it now means "auto".
    if (saved.codeTheme === "github-dark") {
      saved.codeTheme = "auto";
    }
    return saved;
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

/** The sections of the Settings window. */
export type SettingsSection = "terminal" | "mouse" | "finishedItems" | "notifications" | "general" | "mobileAccess";

/** State of the Settings window: not saved, the window starts closed on the first section. */
export const settingsModal = reactive({
  open: false,
  section: "general" as SettingsSection,
});

/** Opens the Settings window, on `section` when given. */
export function openSettings(section?: SettingsSection) {
  if (section !== undefined) {
    settingsModal.section = section;
  }
  settingsModal.open = true;
}
