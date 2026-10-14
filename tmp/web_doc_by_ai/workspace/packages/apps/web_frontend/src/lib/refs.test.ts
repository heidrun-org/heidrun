import { describe, expect, it } from "vitest";
import {
  EMPTY_CONTEXT,
  findChoices,
  findCommands,
  findFileRefs,
  findInlineShell,
  findQuestion,
  findRefs,
  findShellBlock,
  findStep,
  remoteToWeb,
  type RefContext,
} from "./refs";

const GITLAB: RefContext = {
  base: "https://gitlab.com/group/app",
  origin: "https://gitlab.com",
  forge: "gitlab",
  ticketUrl: null,
  ticketPrefixes: [],
  enabled: true,
};
const GITHUB: RefContext = { ...GITLAB, base: "https://github.com/org/app", origin: "https://github.com", forge: "github" };

describe("remoteToWeb", () => {
  it("converts an scp-like remote", () => {
    expect(remoteToWeb("git@github.com:org/app.git")).toEqual({
      base: "https://github.com/org/app",
      origin: "https://github.com",
      host: "github.com",
    });
  });

  it("converts an ssh URL with a port", () => {
    expect(remoteToWeb("ssh://git@gitlab.acme.io:2222/group/sub/app")?.base).toBe("https://gitlab.acme.io/group/sub/app");
  });

  it("converts an https URL with a user", () => {
    expect(remoteToWeb("https://user@host.io/g/a.git/")?.base).toBe("https://host.io/g/a");
  });

  it("refuses a value that is not a remote", () => {
    expect(remoteToWeb("not a remote")).toBeNull();
    expect(remoteToWeb("")).toBeNull();
  });
});

describe("findRefs", () => {
  it("links an issue number on GitHub and GitLab", () => {
    expect(findRefs("fix #12", GITHUB)[0]).toMatchObject({ kind: "issue", url: "https://github.com/org/app/issues/12" });
    expect(findRefs("fix #12", GITLAB)[0]).toMatchObject({ kind: "issue", url: "https://gitlab.com/group/app/-/issues/12" });
  });

  it("reports the position of a match", () => {
    const [match] = findRefs("fix #12 now", GITHUB);
    expect(match.start).toBe(4);
    expect(match.end).toBe(7);
  });

  it("links a GitLab merge request written with an exclamation mark", () => {
    expect(findRefs("see !34", GITLAB)[0]).toMatchObject({ kind: "mr", url: "https://gitlab.com/group/app/-/merge_requests/34" });
  });

  it("does not read an exclamation mark as a merge request on GitHub", () => {
    expect(findRefs("wow !34", GITHUB)).toEqual([]);
  });

  it("links an explicit pull request", () => {
    const [match] = findRefs("merged PR #5", GITHUB);
    expect(match).toMatchObject({ kind: "mr", url: "https://github.com/org/app/pull/5", target: { type: "mr", number: 5 } });
  });

  it("links an issue of another repository on the same host", () => {
    const [match] = findRefs("see other/lib#7", GITLAB);
    expect(match.url).toBe("https://gitlab.com/other/lib/-/issues/7");
    expect(match.target).toMatchObject({ project: "other/lib", number: 7 });
  });

  it("does not link a number inside a URL", () => {
    expect(findRefs("https://example.com/page#12", GITHUB)).toEqual([]);
  });

  it("does not link an HTML entity", () => {
    expect(findRefs("a &#39; b", GITHUB)).toEqual([]);
  });

  it("links a commit hash made of letters and digits", () => {
    const [match] = findRefs("commit 26d63ea fixed it", GITHUB);
    expect(match).toMatchObject({ kind: "commit", url: "https://github.com/org/app/commit/26d63ea" });
  });

  it("ignores a hex word without digits and a number without letters", () => {
    expect(findRefs("deadbeef 1234567", GITHUB)).toEqual([]);
  });

  it("links tickets only when a ticket URL is set", () => {
    expect(findRefs("see ABC-123", GITHUB)).toEqual([]);
    const ctx = { ...GITHUB, ticketUrl: "https://acme.atlassian.net/browse/{key}" };
    expect(findRefs("see ABC-123", ctx)[0]).toMatchObject({ kind: "ticket", url: "https://acme.atlassian.net/browse/ABC-123" });
  });

  it("skips words that look like tickets", () => {
    const ctx = { ...GITHUB, ticketUrl: "https://t/{key}" };
    expect(findRefs("encoding UTF-8 and SHA-256", ctx)).toEqual([]);
  });

  it("restricts tickets to the configured prefixes", () => {
    const ctx = { ...GITHUB, ticketUrl: "https://t/{key}", ticketPrefixes: ["OPS"] };
    expect(findRefs("ABC-1 OPS-2", ctx).map((m) => m.kind)).toEqual(["ticket"]);
  });

  it("returns nothing when the feature is disabled", () => {
    expect(findRefs("fix #12", { ...GITHUB, enabled: false })).toEqual([]);
  });

  it("returns nothing for a blank line", () => {
    expect(findRefs("  ", GITHUB)).toEqual([]);
  });

  it("gives no URL without a repository", () => {
    expect(findRefs("fix #12", EMPTY_CONTEXT)[0].url).toBeNull();
  });

  it("sorts the matches by position and never overlaps them", () => {
    const matches = findRefs("PR #5 and #9 and 26d63ea", GITHUB);
    expect(matches.map((m) => m.start)).toEqual([...matches.map((m) => m.start)].sort((a, b) => a - b));
    expect(matches.filter((m) => m.target?.number === 5)).toHaveLength(1);
  });
});

describe("findCommands", () => {
  const known = new Set(["compact", "fin-tache"]);

  it("finds a known slash command", () => {
    expect(findCommands("run /compact now", known)).toEqual([{ start: 4, end: 12, command: "/compact" }]);
  });

  it("ignores unknown commands and paths", () => {
    expect(findCommands("open /tmp/x and /unknown", known)).toEqual([]);
    expect(findCommands("see src/compact", known)).toEqual([]);
  });

  it("returns nothing without known commands", () => {
    expect(findCommands("/compact", new Set())).toEqual([]);
  });
});

describe("findStep", () => {
  it("reads a numbered item", () => {
    expect(findStep("  1. Open the issue")).toMatchObject({ start: 2, number: 1, text: "Open the issue" });
    expect(findStep("2) Commit the change")).toMatchObject({ number: 2 });
  });

  it("refuses a short item and a plain line", () => {
    expect(findStep("1. ok")).toBeNull();
    expect(findStep("hello world")).toBeNull();
  });
});

describe("findShellBlock", () => {
  const screen = (lines: string[]) => (i: number) => lines[i] ?? null;

  it("reads a one-line command", () => {
    const block = findShellBlock(screen(["! docker ps"]), 0, 80);
    expect(block).toMatchObject({ first: 0, last: 0, command: "docker ps" });
  });

  it("joins a command continued with a backslash", () => {
    const block = findShellBlock(screen(["! docker run \\", "  --rm alpine"]), 1, 80);
    expect(block?.command).toBe("docker run --rm alpine");
    expect(block?.last).toBe(1);
  });

  it("returns null away from the command", () => {
    expect(findShellBlock(screen(["hello"]), 0, 80)).toBeNull();
  });

  it("does not take a double exclamation mark", () => {
    expect(findShellBlock(screen(["!!important thing"]), 0, 80)).toBeNull();
  });
});

describe("findInlineShell", () => {
  it("finds a command ending a sentence", () => {
    const [hit] = findInlineShell("Run ! pnpm test. Then wait");
    expect(hit.command).toBe("pnpm test");
  });

  it("finds a command between backticks", () => {
    expect(findInlineShell("Run `! git status` please")[0].command).toBe("git status");
  });

  it("ignores French punctuation", () => {
    expect(findInlineShell("C'est super ! Bravo")).toEqual([]);
  });
});

describe("findFileRefs", () => {
  it("finds a path with a line and a column", () => {
    const [hit] = findFileRefs("error in src/app.ts:42:7 here");
    expect(hit).toMatchObject({ path: "src/app.ts", line: 42 });
  });

  it("finds a relative path without line", () => {
    expect(findFileRefs("see ./lib/x.rs")[0]).toMatchObject({ path: "./lib/x.rs", line: null });
  });

  it("finds a bare file name only when it has a line", () => {
    expect(findFileRefs("app.ts:10")[0]).toMatchObject({ path: "app.ts", line: 10 });
    expect(findFileRefs("open app.ts please")).toEqual([]);
  });

  it("ignores URLs, versions and host names", () => {
    expect(findFileRefs("https://x.io/a.js")).toEqual([]);
    expect(findFileRefs("version 1.2.3")).toEqual([]);
    expect(findFileRefs("db.example.com:5432")).toEqual([]);
  });
});

describe("findQuestion", () => {
  it("returns the question that ends the last message", () => {
    expect(findQuestion("● Done with the change.\n\n  Should I open a pull request?")).toBe("Should I open a pull request?");
  });

  it("returns null when the message does not end with a question", () => {
    expect(findQuestion("● All done.")).toBeNull();
  });

  it("ignores the prompt box under the message", () => {
    const screen = ["● Ready?", "", "────────────", "❯ yes", "────────────"].join("\n");
    expect(findQuestion(screen)).toBe("Ready?");
  });

  it("ignores the status lines after the message", () => {
    expect(findQuestion("● Merge now?\n\n✻ Worked for 2m 3s")).toBe("Merge now?");
  });
});

describe("findChoices", () => {
  const menu = [
    "Do you want to run this command?",
    "  git status",
    "❯ 1. Yes",
    "  2. Yes, and do not ask again",
    "  3. No",
  ].join("\n");

  it("reads a numbered menu with its question", () => {
    const result = findChoices(menu);
    expect(result?.question).toBe("git status");
    expect(result?.options.map((o) => o.label)).toEqual(["Yes", "Yes, and do not ask again", "No"]);
    expect(result?.options[0].selected).toBe(true);
  });

  it("returns null for a list without a selected option", () => {
    expect(findChoices("1. one\n2. two")).toBeNull();
  });

  it("returns null when there is only one option", () => {
    expect(findChoices("❯ 1. Only")).toBeNull();
  });

  it("returns null when the list is followed by more text", () => {
    const screen = `${menu}\nmore\ntext\nafter\nthe menu`;
    expect(findChoices(screen)).toBeNull();
  });
});
