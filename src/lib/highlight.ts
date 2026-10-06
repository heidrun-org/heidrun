// Syntax highlighting (highlight.js core + the languages of our projects).
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import dart from "highlight.js/lib/languages/dart";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import makefile from "highlight.js/lib/languages/makefile";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import sql from "highlight.js/lib/languages/sql";
import twig from "highlight.js/lib/languages/twig";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGS = { bash, css, dart, dockerfile, ini, javascript, json, makefile, markdown, php, python, rust, scss, sql, twig, typescript, xml, yaml };
for (const [name, def] of Object.entries(LANGS)) hljs.registerLanguage(name, def);

const BY_EXT: Record<string, string> = {
  sh: "bash", bash: "bash", zsh: "bash", env: "bash",
  css: "css", scss: "scss", sass: "scss", less: "css",
  dart: "dart", dockerfile: "dockerfile",
  ini: "ini", toml: "ini", conf: "ini", cfg: "ini",
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  ts: "typescript", tsx: "typescript", mts: "typescript",
  json: "json", jsonc: "json", lock: "json",
  md: "markdown", markdown: "markdown",
  php: "php", py: "python", rs: "rust", sql: "sql", twig: "twig",
  html: "xml", htm: "xml", xml: "xml", svg: "xml", vue: "xml", xlf: "xml", xliff: "xml",
  yml: "yaml", yaml: "yaml", neon: "yaml",
};

export function languageFor(path: string): string | null {
  const name = path.split("/").pop()?.toLowerCase() ?? "";
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "dockerfile";
  if (name === "makefile") return "makefile";
  if (name.startsWith(".env")) return "bash";
  return BY_EXT[name.split(".").pop() ?? ""] ?? null;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One line, highlighted on its own (diff views). */
export function highlightLine(text: string, lang: string | null): string {
  if (!lang || !text) return escape(text);
  try {
    return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value;
  } catch {
    return escape(text);
  }
}

/**
 * A whole file, highlighted at once (multi-line comments and strings stay right),
 * then cut into lines: spans open at a line end are closed and reopened on the next.
 */
export function highlightFile(text: string, lang: string | null): string[] {
  let html: string;
  try {
    html = lang ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value : escape(text);
  } catch {
    html = escape(text);
  }
  const lines: string[] = [];
  const open: string[] = [];
  for (const raw of html.split("\n")) {
    let line = open.join("") + raw;
    const re = /<span[^>]*>|<\/span>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      if (m[0] === "</span>") open.pop();
      else open.push(m[0]);
    }
    line += "</span>".repeat(open.length);
    lines.push(line);
  }
  return lines;
}

export const CODE_THEMES = [
  { id: "github-dark", label: "GitHub Dark" },
  { id: "one-dark", label: "One Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "solarized", label: "Solarized" },
];
