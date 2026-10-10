// Writes the shortcut table of packages/website_public/docs/documentation/shortcuts.md from packages/web_frontend/src/lib/shortcuts.json (also shown by ⌘/ in the app)
// and the English texts of packages/web_frontend/src/i18n/locales/en/shortcuts.json.
// pnpm docs:shortcuts
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const groups = JSON.parse(readFileSync(new URL("packages/web_frontend/src/lib/shortcuts.json", root), "utf8"));
// shortcuts.json holds translation keys; the documentation is in English.
const english = JSON.parse(readFileSync(new URL("packages/web_frontend/src/i18n/locales/en/shortcuts.json", root), "utf8"));
const text = (key) => {
  if (english[key] === undefined) {
    console.error(`Missing English text for ${key} in src/i18n/locales/en/shortcuts.json`);
    process.exit(1);
  }
  return english[key];
};
const icon = (n) => `<img src="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/${n}.svg" alt="${n}" width="14">`;
const START = "<!-- shortcuts:start -->";
const END = "<!-- shortcuts:end -->";

const table = [
  START,
  "<!-- Generated from packages/web_frontend/src/lib/shortcuts.json: pnpm docs:shortcuts -->",
  "",
  "| Shortcut | Action |",
  "| --- | --- |",
  ...groups.flatMap((g) => [
    `| **${text(g.groupKey)}** | |`,
    ...g.items.map((i) => {
      const keys = i.keys ?? text(i.keysKey);
      return `| ${keys.startsWith("bi:") ? icon(keys.slice(3)) : keys} | ${text(i.actionKey).replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;")} |`;
    }),
  ]),
  "",
  END,
].join("\n");

const path = new URL("packages/website_public/docs/documentation/shortcuts.md", root);
const readme = readFileSync(path, "utf8");
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`Markers ${START} / ${END} missing from shortcuts.md`);
  process.exit(1);
}
writeFileSync(path, readme.slice(0, a) + table + readme.slice(b + END.length));
console.log("shortcuts.md: shortcuts table up to date");
