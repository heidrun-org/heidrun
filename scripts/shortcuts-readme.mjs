// Writes the shortcut table of README.md from packages/web-frontend/src/lib/shortcuts.json (also shown by ⌘/ in the app).
// pnpm docs:shortcuts
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const groups = JSON.parse(readFileSync(new URL("packages/web-frontend/src/lib/shortcuts.json", root), "utf8"));
const START = "<!-- shortcuts:start -->";
const END = "<!-- shortcuts:end -->";

const table = [
  START,
  "<!-- Generated from packages/web-frontend/src/lib/shortcuts.json: pnpm docs:shortcuts -->",
  "",
  "| Shortcut | Action |",
  "| --- | --- |",
  ...groups.flatMap((g) => [`| **${g.group}** | |`, ...g.items.map((i) => `| ${i.keys} | ${i.action.replace(/\|/g, "\\|")} |`)]),
  "",
  END,
].join("\n");

const path = new URL("README.md", root);
const readme = readFileSync(path, "utf8");
const a = readme.indexOf(START);
const b = readme.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`Markers ${START} / ${END} missing from README.md`);
  process.exit(1);
}
writeFileSync(path, readme.slice(0, a) + table + readme.slice(b + END.length));
console.log("README.md: shortcuts table up to date");
