// Checks the translation files of src/i18n/locales:
// - every language has the same keys as English;
// - every key given to t("…") in src exists in English.
// pnpm --filter web_frontend check:translations
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const src = new URL("../src/", import.meta.url).pathname;
const localesDir = join(src, "i18n/locales");

/** @type {Record<string, Set<string>>} */
const keys = {};
for (const language of readdirSync(localesDir)) {
  keys[language] = new Set();
  for (const file of readdirSync(join(localesDir, language))) {
    const namespace = file.replace(/\.json$/, "");
    const content = JSON.parse(readFileSync(join(localesDir, language, file), "utf8"));
    for (const key of Object.keys(content)) {
      keys[language].add(`${namespace}.${key}`);
    }
  }
}

const errors = [];
for (const [language, set] of Object.entries(keys)) {
  for (const key of keys.en) {
    if (set.has(key) === false) errors.push(`${language}: missing ${key}`);
  }
  for (const key of set) {
    if (keys.en.has(key) === false) errors.push(`${language}: ${key} is not in English`);
  }
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|vue)$/.test(name) ? [path] : [];
  });
}
const used = /\bt\(\s*["'`]([\w.]+)["'`]\s*(,\s*\{[^}]*\bcount\b)?/g;
for (const file of walk(src)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(used)) {
    const key = match[1];
    const isPlural = match[2] !== undefined;
    const wanted = isPlural ? [`${key}_one`, `${key}_other`] : [key];
    for (const k of wanted) {
      if (keys.en.has(k) === false) errors.push(`${file.slice(src.length)}: unknown key ${k}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Translations OK: ${keys.en.size} keys, languages: ${Object.keys(keys).join(", ")}`);
