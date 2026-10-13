import { beforeEach, describe, expect, it } from "vitest";
import {
  chatReferenceName,
  chatReferences,
  chatReferenceState,
  referenceDay,
  referenceExcerpt,
  repositoryName,
} from "./chat_references";
import { settings } from "../stores/settings";

beforeEach(() => {
  settings.language = "en";
});

describe("chatReferences", () => {
  it("lists the issues, then the pull requests, with their web page on GitHub", () => {
    expect(chatReferences([31, 250], [249], "https://github.com/heidrun-org/heidrun", "github")).toEqual([
      { kind: "issue", number: 31, url: "https://github.com/heidrun-org/heidrun/issues/31" },
      { kind: "issue", number: 250, url: "https://github.com/heidrun-org/heidrun/issues/250" },
      { kind: "pull_request", number: 249, url: "https://github.com/heidrun-org/heidrun/pull/249" },
    ]);
  });

  it("gives the web page of an issue and of a merge request on GitLab", () => {
    expect(chatReferences([3], [4], "https://gitlab.com/group/app", "gitlab")).toEqual([
      { kind: "issue", number: 3, url: "https://gitlab.com/group/app/-/issues/3" },
      { kind: "pull_request", number: 4, url: "https://gitlab.com/group/app/-/merge_requests/4" },
    ]);
  });

  it("gives no web page when the repository has no remote", () => {
    expect(chatReferences([3], [], null, null)).toEqual([{ kind: "issue", number: 3, url: null }]);
  });
});

describe("chatReferenceName", () => {
  it("names an issue and a pull request with the texts of the summary line", () => {
    expect(chatReferenceName({ kind: "issue", number: 250, url: null })).toBe("Issue #250");
    expect(chatReferenceName({ kind: "pull_request", number: 249, url: null })).toBe("Pull request #249");
  });
});

describe("chatReferenceState", () => {
  it("shows an open issue in green with the issue icon, and an open pull request with the Git icon", () => {
    expect(chatReferenceState("issue", "open")).toEqual({ text: "Open", icon: "record-circle", look: "bg-success" });
    expect(chatReferenceState("pull_request", "open")).toEqual({ text: "Open", icon: "git", look: "bg-success" });
  });

  it("shows a merged pull request in purple", () => {
    expect(chatReferenceState("pull_request", "merged")).toEqual({
      text: "Merged",
      icon: "sign-merge-right",
      look: "state-done",
    });
  });

  it("shows a closed issue in purple, and a closed pull request in red", () => {
    expect(chatReferenceState("issue", "closed")).toEqual({ text: "Closed", icon: "check-circle", look: "state-done" });
    expect(chatReferenceState("pull_request", "closed")).toEqual({ text: "Closed", icon: "x-circle", look: "bg-danger" });
  });

  it("shows another state as the forge says it", () => {
    expect(chatReferenceState("issue", "locked")).toEqual({ text: "locked", icon: "circle-half", look: "state-other" });
  });
});

describe("repositoryName", () => {
  it("gives the path of the address of the repository", () => {
    expect(repositoryName("https://github.com/heidrun-org/heidrun")).toBe("heidrun-org/heidrun");
    expect(repositoryName("https://gitlab.com/group/sub/app/")).toBe("group/sub/app");
  });

  it("gives null when the address is not known or is not valid", () => {
    expect(repositoryName(null)).toBeNull();
    expect(repositoryName("not an address")).toBeNull();
  });
});

describe("referenceExcerpt", () => {
  it("removes the marks of Markdown for a heading, a link, an image, a code span, and a bold word", () => {
    const body = "## Goal\n\nMove the **Needs you** section, see [the issue](https://x.y/1) and `code`.\n\n![shot](a.png)";
    expect(referenceExcerpt(body)).toBe("Goal\nMove the Needs you section, see the issue and code.");
  });

  it("removes a comment of HTML and the lines of a code fence, and keeps the text of the code", () => {
    expect(referenceExcerpt("<!-- hidden -->Text\n```ts\nlet a = 1;\n```")).toBe("Text\nlet a = 1;");
  });

  it("cuts a long text at 400 characters with an ellipsis", () => {
    const excerpt = referenceExcerpt("a".repeat(500));
    expect(excerpt.length).toBe(401);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("gives an empty text for an empty description", () => {
    expect(referenceExcerpt("")).toBe("");
  });
});

describe("referenceDay", () => {
  it("gives the day of the date, and an empty text when the date is not known", () => {
    const date = new Date(new Date().getFullYear(), 9, 11, 12, 0).getTime();
    expect(referenceDay(date)).toBe("Oct 11");
    expect(referenceDay(null)).toBe("");
  });
});
