import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { RefContext } from "../lib/refs";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../lib/refs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/refs")>();
  return { ...original, refContext: vi.fn() };
});

import { refContext } from "../lib/refs";
import { codeHosting, itemPrefix, loadCodeHosting, type CodeHostingItem } from "./code_hosting";

/** The context of a repository on `forge`, with a remote address. */
function contextOf(forge: "github" | "gitlab" | null, base: string | null = "https://example.com/team/app"): RefContext {
  return { base, origin: "https://example.com", forge, ticketUrl: null, ticketPrefixes: [], enabled: true };
}

/** The calls of `forge_cli`: the tool and the arguments of each call, in order. */
function forgeCalls(): { tool: string; args: string[] }[] {
  return vi.mocked(invoke).mock.calls.map(([, payload]) => {
    const { tool, args } = payload as { tool: string; args: string[] };
    return { tool, args };
  });
}

/** An item with only the three fields that every test needs. */
function itemOf(number: number, title: string, url: string): CodeHostingItem {
  return { number, title, url, author: null, createdAt: null, labels: [], isDraft: false, headBranch: null, baseBranch: null };
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(refContext).mockReset();
  codeHosting.issues = [];
  codeHosting.requests = [];
  codeHosting.forge = null;
  codeHosting.status = "idle";
  codeHosting.error = "";
});

describe("loadCodeHosting on GitHub", () => {
  beforeEach(() => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[0] === "issue"
          ? [
              {
                number: 370,
                title: "Add the Code hosting sidebar section",
                url: "https://github.com/o/r/issues/370",
                author: { login: "jeromeetienne" },
                createdAt: "2026-10-13T09:30:00Z",
                labels: [{ name: "Design", color: "1d76db" }, { name: "Simple Work", color: "2ea043" }],
              },
            ]
          : [
              {
                number: 371,
                title: "Fix a thing",
                url: "https://github.com/o/r/pull/371",
                author: { login: "erictang" },
                createdAt: "2026-10-12T08:00:00Z",
                isDraft: true,
                headRefName: "fix-a-thing-371",
                baseRefName: "dev_jerome",
              },
            ],
      );
    });
  });

  it("reads the open issues and the open pull requests with gh, in the folder of the repository", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(forgeCalls()).toEqual([
      {
        tool: "gh",
        args: ["issue", "list", "--state", "open", "--limit", "100", "--json", "number,title,url,author,createdAt,labels"],
      },
      {
        tool: "gh",
        args: [
          "pr",
          "list",
          "--state",
          "open",
          "--limit",
          "100",
          "--json",
          "number,title,url,author,createdAt,isDraft,headRefName,baseRefName",
        ],
      },
    ]);
    expect(vi.mocked(invoke).mock.calls.map(([command, payload]) => [command, (payload as { cwd: string }).cwd])).toEqual([
      ["forge_cli_cached", "/work/heidrun"],
      ["forge_cli_cached", "/work/heidrun"],
    ]);
  });

  it("uses the cache of the answers by default, and asks GitHub again after a refresh", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([false, false]);
    vi.mocked(invoke).mockClear();
    await loadCodeHosting("/work/heidrun", true);
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([true, true]);
  });

  it("keeps the number, the title, the address, the author, the date, the labels, the draft mark, and the branches of each item", async () => {
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.status).toBe("ready");
    expect(codeHosting.forge).toBe("github");
    expect(codeHosting.webBase).toBe("https://example.com/team/app");
    expect(codeHosting.issues).toEqual([
      {
        number: 370,
        title: "Add the Code hosting sidebar section",
        url: "https://github.com/o/r/issues/370",
        author: "jeromeetienne",
        createdAt: Date.parse("2026-10-13T09:30:00Z"),
        labels: [
          { name: "Design", color: "1d76db" },
          { name: "Simple Work", color: "2ea043" },
        ],
        isDraft: false,
        headBranch: null,
        baseBranch: null,
      },
    ]);
    expect(codeHosting.requests).toEqual([
      {
        number: 371,
        title: "Fix a thing",
        url: "https://github.com/o/r/pull/371",
        author: "erictang",
        createdAt: Date.parse("2026-10-12T08:00:00Z"),
        labels: [],
        isDraft: true,
        headBranch: "fix-a-thing-371",
        baseBranch: "dev_jerome",
      },
    ]);
  });

  it("keeps an item without author, date, or labels, as nothing", async () => {
    vi.mocked(invoke).mockImplementation(async () => JSON.stringify([{ number: 1, title: "Bare", url: "https://x/1", author: null }]));
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.issues).toEqual([
      { number: 1, title: "Bare", url: "https://x/1", author: null, createdAt: null, labels: [], isDraft: false, headBranch: null, baseBranch: null },
    ]);
  });
});

describe("loadCodeHosting on GitLab", () => {
  it("reads the open issues and the open merge requests with the API of glab, and keeps the number, the title, and the address", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[1].startsWith("projects/:fullpath/issues")
          ? [
              {
                iid: 12,
                title: "An issue",
                web_url: "https://gitlab.com/t/a/-/issues/12",
                author: { username: "jerome" },
                created_at: "2026-10-13T09:30:00Z",
                labels: [{ name: "bug", color: "#d73a4a" }, "plain"],
              },
            ]
          : [
              {
                iid: 5,
                title: "A merge request",
                web_url: "https://gitlab.com/t/a/-/merge_requests/5",
                author: { username: "eric" },
                created_at: "2026-10-12T08:00:00Z",
                draft: true,
                source_branch: "fix-5",
                target_branch: "main",
              },
            ],
      );
    });
    await loadCodeHosting("/work/app");
    expect(forgeCalls()).toEqual([
      { tool: "glab", args: ["api", "projects/:fullpath/issues?state=opened&per_page=100&with_labels_details=true"] },
      { tool: "glab", args: ["api", "projects/:fullpath/merge_requests?state=opened&per_page=100"] },
    ]);
    expect(codeHosting.forge).toBe("gitlab");
    expect(codeHosting.issues).toEqual([
      {
        number: 12,
        title: "An issue",
        url: "https://gitlab.com/t/a/-/issues/12",
        author: "jerome",
        createdAt: Date.parse("2026-10-13T09:30:00Z"),
        labels: [
          { name: "bug", color: "d73a4a" },
          { name: "plain", color: null },
        ],
        isDraft: false,
        headBranch: null,
        baseBranch: null,
      },
    ]);
    expect(codeHosting.requests).toEqual([
      {
        number: 5,
        title: "A merge request",
        url: "https://gitlab.com/t/a/-/merge_requests/5",
        author: "eric",
        createdAt: Date.parse("2026-10-12T08:00:00Z"),
        labels: [],
        isDraft: true,
        headBranch: "fix-5",
        baseBranch: "main",
      },
    ]);
  });

  it("treats a host that is not GitHub as GitLab when the context does not name the forge", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf(null));
    vi.mocked(invoke).mockResolvedValue("[]");
    await loadCodeHosting("/work/app");
    expect(forgeCalls().map((call) => call.tool)).toEqual(["glab", "glab"]);
    expect(codeHosting.forge).toBe("gitlab");
  });
});

describe("loadCodeHosting when nothing can be read", () => {
  it("is idle and empty for no folder, and calls nothing", async () => {
    await loadCodeHosting(null);
    expect(codeHosting.status).toBe("idle");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says noRemote for a repository without a remote address, and calls nothing", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf(null, null));
    await loadCodeHosting("/work/local");
    expect(codeHosting.status).toBe("noRemote");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says failed with the first line of the failure, and empty lists, when gh does not answer", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockRejectedValue("gh: not logged in\nrun gh auth login");
    await loadCodeHosting("/work/heidrun");
    expect(codeHosting.status).toBe("failed");
    expect(codeHosting.error).toBe("gh: not logged in");
    expect(codeHosting.issues).toEqual([]);
    expect(codeHosting.requests).toEqual([]);
  });

  it("empties the lists of the earlier repository while the next one loads", async () => {
    codeHosting.issues = [itemOf(1, "old", "https://x/1")];
    vi.mocked(refContext).mockReturnValue(new Promise(() => {}));
    void loadCodeHosting("/work/other");
    expect(codeHosting.status).toBe("loading");
    expect(codeHosting.issues).toEqual([]);
  });

  it("ignores the answer of an older load that ends after a newer load", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    let answerOlder: (text: string) => void = () => {};
    vi.mocked(invoke).mockImplementationOnce(() => new Promise((resolve) => (answerOlder = resolve)));
    vi.mocked(invoke).mockImplementationOnce(async () => "[]");
    const older = loadCodeHosting("/work/older");
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    vi.mocked(invoke).mockImplementation(async (_command, payload) =>
      JSON.stringify(
        (payload as { args: string[] }).args[0] === "issue"
          ? [{ number: 9, title: "newer", url: "https://x/9" }]
          : [],
      ),
    );
    await loadCodeHosting("/work/newer");
    answerOlder(JSON.stringify([{ number: 1, title: "older", url: "https://x/1" }]));
    await older;
    expect(codeHosting.issues.map((item) => item.title)).toEqual(["newer"]);
  });
});

describe("itemPrefix", () => {
  it("is ! for a merge request of GitLab, and # for every other item", () => {
    expect(itemPrefix("requests", "gitlab")).toBe("!");
    expect(itemPrefix("requests", "github")).toBe("#");
    expect(itemPrefix("issues", "gitlab")).toBe("#");
    expect(itemPrefix("issues", "github")).toBe("#");
  });
});
