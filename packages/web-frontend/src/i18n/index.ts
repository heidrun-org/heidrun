import { computed, watch } from "vue";
import { settings } from "../stores/settings";

/** The languages of the user interface. */
export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
] as const;

export type Language = (typeof LANGUAGES)[number]["id"];

/** Values put in the place of the `{name}` markers of a text. */
export type TranslationParams = Record<string, string | number>;

// One JSON file per language and per namespace: locales/<language>/<namespace>.json.
// The key of a text is "<namespace>.<key in the file>".
const files = import.meta.glob<Record<string, string>>("./locales/*/*.json", { eager: true, import: "default" });

const messages: Record<string, Record<string, string>> = {};
for (const [path, content] of Object.entries(files)) {
  const match = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(path);
  if (match === null) {
    continue;
  }
  const [, language, namespace] = match;
  messages[language] ??= {};
  for (const [key, text] of Object.entries(content)) {
    messages[language][`${namespace}.${key}`] = text;
  }
}

/** The language in use. */
export const language = computed<Language>(() => (settings.language === "fr" ? "fr" : "en"));

/** The locale given to the date and number formatting functions of the browser. */
export const locale = computed(() => (language.value === "fr" ? "fr-FR" : "en-US"));

/**
 * The text of `key` in the language in use.
 * With a `count` parameter, the key "<key>_one" or "<key>_other" is used, following the plural rules of the language.
 * `{name}` markers in the text are replaced with the parameter of the same name.
 */
export function t(key: string, params?: TranslationParams): string {
  const table = messages[language.value] ?? {};
  let fullKey = key;
  if (params !== undefined && typeof params.count === "number") {
    const category = new Intl.PluralRules(locale.value).select(params.count) === "one" ? "one" : "other";
    fullKey = `${key}_${category}`;
  }
  const text = table[fullKey] ?? messages.en?.[fullKey];
  if (text === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`Missing translation: ${fullKey}`);
    }
    return fullKey;
  }
  if (params === undefined) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (marker, name: string) => (name in params ? String(params[name]) : marker));
}

watch(
  language,
  (value) => {
    document.documentElement.lang = value;
  },
  { immediate: true },
);
