import { afterEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import GitStatusSummary from "./GitStatusSummary.vue";
import { git, type GitStatus } from "../stores/git";
import { state } from "../stores/session";

function makeStatus(overrides: Partial<GitStatus>): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "main",
    upstream: "origin/main",
    ahead: 11,
    behind: 0,
    changed: 0,
    untracked: 0,
    files: [],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
    ...overrides,
  };
}

describe("GitStatusSummary", () => {
  afterEach(() => {
    state.selectedWorkspaceId = null;
    git.status = {};
  });

  it("shows the branch, then the commits to download, then the commits to upload", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ ahead: 11, behind: 3 }) };
    const wrapper = mount(GitStatusSummary);
    expect(wrapper.get(".branch").text()).toBe("main");
    expect(wrapper.get(".behind .count").text()).toBe("3");
    expect(wrapper.get(".ahead .count").text()).toBe("11");
    expect(wrapper.find(".behind").element.compareDocumentPosition(wrapper.get(".ahead").element)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("follows the branch when the branch changes", async () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ branch: "main" }) };
    const wrapper = mount(GitStatusSummary);
    git.status = { w1: makeStatus({ branch: "dev_jerome" }) };
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".branch").text()).toBe("dev_jerome");
  });

  it("shows zero when there is nothing to download or to upload", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ ahead: 0, behind: 0 }) };
    const wrapper = mount(GitStatusSummary);
    expect(wrapper.get(".behind .count").text()).toBe("0");
    expect(wrapper.get(".ahead .count").text()).toBe("0");
  });

  it("shows nothing when the workspace is not in a Git repository", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: null };
    expect(mount(GitStatusSummary).find(".git-status").exists()).toBe(false);
  });

  it("lists the details of the repository in the hover card", () => {
    state.selectedWorkspaceId = "w1";
    git.status = {
      w1: makeStatus({
        ahead: 11,
        behind: 3,
        changed: 4,
        untracked: 2,
        last_subject: "Fix the status bar",
        last_time: Math.floor(Date.now() / 1000),
      }),
    };
    const wrapper = mount(GitStatusSummary);
    expect(wrapper.get(".card-title").text()).toBe("main");
    expect(wrapper.get(".upstream").text()).toBe("origin/main");
    expect(wrapper.get(".to-download").text()).toBe("3");
    expect(wrapper.get(".to-upload").text()).toBe("11");
    expect(wrapper.get(".changed").text()).toBe("4");
    expect(wrapper.get(".untracked").text()).toBe("2");
    expect(wrapper.get(".last-subject").text()).toBe("Fix the status bar");
  });

  it("says there is no remote branch when the branch has no upstream", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: makeStatus({ upstream: null }) };
    expect(mount(GitStatusSummary).get(".upstream").text()).toBe("none");
  });
});
