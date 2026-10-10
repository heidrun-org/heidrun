/** One line `key: value` of the frontmatter of a SKILL.md file. */
export interface FrontmatterField {
  key: string;
  value: string;
}

/** A SKILL.md text cut in two: the frontmatter fields, and the Markdown text after them. */
export interface SkillText {
  /** The fields of the frontmatter, in the order of the file. Empty when the file has no frontmatter. */
  fields: FrontmatterField[];
  /** The text after the frontmatter. The whole text when the file has no frontmatter. */
  body: string;
}

/**
 * Cuts the frontmatter (`---` … `---`, simple YAML: one `key: value` per line) off the start of a SKILL.md text.
 * A line without a colon, such as the continuation of a long value, is added to the value of the previous field.
 */
export function splitSkillText(text: string): SkillText {
  const clean = text.replace(/^﻿/, "");
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(clean);
  if (match === null) {
    return { fields: [], body: clean };
  }
  const fields: FrontmatterField[] = [];
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0 && /^\s/.test(line) === false) {
      const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
      fields.push({ key: line.slice(0, separator).trim(), value });
    } else if (fields.length > 0 && line.trim() !== "") {
      const last = fields[fields.length - 1];
      last.value = `${last.value} ${line.trim()}`.trim();
    }
  }
  return { fields, body: clean.slice(match[0].length).replace(/^\r?\n/, "") };
}
