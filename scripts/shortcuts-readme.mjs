// Writes the shortcut table of README.md from src/lib/shortcuts.json (also shown by ⌘/ in the app).
// npm run docs:shortcuts
import { readFileSync, writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const groups = JSON.parse(readFileSync(new URL("src/lib/shortcuts.json", root), "utf8"));
const START = "<!-- shortcuts:start -->";
const END = "<!-- shortcuts:end -->";

const table = [
  START,
  "<!-- Généré depuis src/lib/shortcuts.json : npm run docs:shortcuts -->",
  "",
  "| Raccourci | Action |",
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
  console.error(`Marqueurs ${START} / ${END} absents de README.md`);
  process.exit(1);
}
writeFileSync(path, readme.slice(0, a) + table + readme.slice(b + END.length));
console.log("README.md : tableau des raccourcis à jour");
