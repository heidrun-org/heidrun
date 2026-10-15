// Unified diff → lines, and side-by-side rows.

export interface DiffLine {
  kind: "add" | "del" | "ctx" | "hunk";
  old?: number;
  new?: number;
  text: string;
}

export interface SplitRow {
  hunk?: string;
  left?: DiffLine;
  right?: DiffLine;
}

export function parseDiff(text: string): DiffLine[] {
  const out: DiffLine[] = [];
  let o = 0;
  let n = 0;
  let inHunk = false;
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const h = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/.exec(line);
    if (h) {
      o = Number(h[1]);
      n = Number(h[2]);
      inHunk = true;
      out.push({ kind: "hunk", text: line });
      continue;
    }
    if (!inHunk) continue; // headers (diff --git, index, ---, +++)
    if (line.startsWith("+")) out.push({ kind: "add", new: n++, text: line.slice(1) });
    else if (line.startsWith("-")) out.push({ kind: "del", old: o++, text: line.slice(1) });
    else if (line.startsWith(" ")) out.push({ kind: "ctx", old: o++, new: n++, text: line.slice(1) });
    else if (line.startsWith("\\")) continue; // "\ No newline at end of file"
    else if (line === "") continue;
    else inHunk = false; // next file header
  }
  return out;
}

/** Removed lines on the left, added on the right, paired block by block. */
export function splitDiff(lines: DiffLine[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.kind === "hunk") {
      rows.push({ hunk: l.text });
      i++;
    } else if (l.kind === "ctx") {
      rows.push({ left: l, right: l });
      i++;
    } else {
      const dels: DiffLine[] = [];
      const adds: DiffLine[] = [];
      while (i < lines.length && lines[i].kind === "del") dels.push(lines[i++]);
      while (i < lines.length && lines[i].kind === "add") adds.push(lines[i++]);
      for (let k = 0; k < Math.max(dels.length, adds.length); k++) rows.push({ left: dels[k], right: adds[k] });
    }
  }
  return rows;
}

export function diffStats(lines: DiffLine[]) {
  return { added: lines.filter((l) => l.kind === "add").length, removed: lines.filter((l) => l.kind === "del").length };
}
