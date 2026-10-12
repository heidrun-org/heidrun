import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { loadChatReferenceDetails } from "./chat_references";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const ISSUE = { kind: "issue" as const, number: 250, url: null };
const PULL_REQUEST = { kind: "pull_request" as const, number: 249, url: null };

beforeEach(() => {
  vi.mocked(invoke).mockReset();
});

describe("loadChatReferenceDetails", () => {
  it("reads an issue of GitHub with the cached command, and gives its details", async () => {
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({
        title: "Add Chats",
        state: "CLOSED",
        body: "Goal",
        labels: [{ name: "Simple Work", color: "2ea043" }],
        author: { login: "jerome" },
        createdAt: "2026-10-11T09:30:00Z",
      }),
    );
    const details = await loadChatReferenceDetails("/work/app", "github", ISSUE);
    expect(invoke).toHaveBeenCalledWith("forge_cli_cached", {
      cwd: "/work/app",
      tool: "gh",
      args: ["issue", "view", "250", "--json", "title,state,body,labels,author,createdAt"],
    });
    expect(details).toEqual({
      title: "Add Chats",
      rawState: "closed",
      body: "Goal",
      labels: [{ name: "Simple Work", color: "2ea043" }],
      author: "jerome",
      createdAt: Date.parse("2026-10-11T09:30:00Z"),
      headBranch: null,
      baseBranch: null,
    });
  });

  it("reads a pull request of GitHub with its two branches", async () => {
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({ title: "Move", state: "MERGED", headRefName: "move-it", baseRefName: "dev_jerome" }),
    );
    const details = await loadChatReferenceDetails("/work/app", "github", PULL_REQUEST);
    expect(vi.mocked(invoke).mock.calls[0][1]).toMatchObject({
      args: ["pr", "view", "249", "--json", "title,state,body,labels,author,createdAt,headRefName,baseRefName"],
    });
    expect(details).toMatchObject({ title: "Move", rawState: "merged", headBranch: "move-it", baseBranch: "dev_jerome" });
  });

  it("reads an issue and a merge request of GitLab, and says open for the state opened", async () => {
    vi.mocked(invoke).mockResolvedValue(
      JSON.stringify({
        title: "Fix",
        state: "opened",
        description: "Text",
        labels: ["bug"],
        author: { username: "jerome" },
        created_at: "2026-10-11T09:30:00Z",
        source_branch: "fix-it",
        target_branch: "main",
      }),
    );
    const issue = await loadChatReferenceDetails("/work/app", "gitlab", ISSUE);
    expect(invoke).toHaveBeenLastCalledWith("forge_cli_cached", {
      cwd: "/work/app",
      tool: "glab",
      args: ["api", "projects/:fullpath/issues/250"],
    });
    expect(issue).toMatchObject({ rawState: "open", body: "Text", labels: [{ name: "bug", color: null }], author: "jerome" });
    await loadChatReferenceDetails("/work/app", "gitlab", PULL_REQUEST);
    expect(vi.mocked(invoke).mock.lastCall?.[1]).toMatchObject({ args: ["api", "projects/:fullpath/merge_requests/249"] });
  });

  it("gives null when the forge does not answer, or answers with something that is not JSON", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("gh: not logged in");
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
    vi.mocked(invoke).mockResolvedValueOnce("not json");
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toBeNull();
  });

  it("gives empty values for the fields that the forge does not send", async () => {
    vi.mocked(invoke).mockResolvedValue(JSON.stringify({ title: "Bare", state: "OPEN" }));
    expect(await loadChatReferenceDetails("/work/app", "github", ISSUE)).toEqual({
      title: "Bare",
      rawState: "open",
      body: "",
      labels: [],
      author: null,
      createdAt: null,
      headBranch: null,
      baseBranch: null,
    });
  });
});
