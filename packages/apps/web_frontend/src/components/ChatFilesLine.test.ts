import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import ChatFilesLine from "./ChatFilesLine.vue";
import { state } from "../stores/session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

const FILES = ["/work/app/src/a.rs", "/work/app/web/b ts.vue", "/elsewhere/c.md"];

function mountLine(props: Partial<InstanceType<typeof ChatFilesLine>["$props"]> = {}) {
  return mount(ChatFilesLine, {
    attachTo: document.body,
    props: {
      text: "a.rs, b ts.vue, +1",
      files: FILES,
      root: "/work/app",
      folder: "/work/app/sub",
      webBase: "https://github.com/heidrun-org/heidrun",
      forge: "github",
      ...props,
    },
  });
}

/** The rows of the open card: the label of each file, and the texts of its buttons. */
function cardRows(wrapper: ReturnType<typeof mountLine>) {
  return wrapper.findAll("[data-file]").map((row) => ({
    label: row.get("span").text(),
    buttons: row.findAll("button").map((button) => button.text()),
  }));
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockClear();
  state.toast = "";
});

describe("ChatFilesLine", () => {
  it("shows the icon of a file and the text of the line, and no card before the pointer rests on it", () => {
    const wrapper = mountLine();
    expect(wrapper.find(".bi-file-earmark").exists()).toBe(true);
    expect(wrapper.text()).toBe("a.rs, b ts.vue, +1");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("lists every file in the card with its path below the root of the repository", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(wrapper.get(".popover-body").text()).toContain("3 files written");
    expect(cardRows(wrapper).map((row) => row.label)).toEqual(["src/a.rs", "web/b ts.vue", "/elsewhere/c.md"]);
  });

  it("gives each file a button for VS Code and a button for GitHub, and only VS Code for a file outside the repository", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    expect(cardRows(wrapper).map((row) => row.buttons)).toEqual([
      ["VS Code", "GitHub"],
      ["VS Code", "GitHub"],
      ["VS Code"],
    ]);
  });

  it("names the forge GitLab on the buttons of a repository on GitLab", async () => {
    const wrapper = mountLine({ forge: "gitlab", webBase: "https://gitlab.com/group/app" });
    await wrapper.trigger("click");
    expect(cardRows(wrapper)[0].buttons).toEqual(["VS Code", "GitLab"]);
  });

  it("has no button for the forge when the repository has no remote", async () => {
    const wrapper = mountLine({ forge: null, webBase: null });
    await wrapper.trigger("click");
    expect(cardRows(wrapper).map((row) => row.buttons)).toEqual([["VS Code"], ["VS Code"], ["VS Code"]]);
  });

  it("shows the absolute paths when the root is not known", async () => {
    const wrapper = mountLine({ root: null });
    await wrapper.trigger("click");
    expect(cardRows(wrapper).map((row) => row.label)).toEqual(FILES);
  });

  it("opens the file on the forge, on the default branch, after a click on the button of the forge", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.findAll("[data-file]")[1].findAll("button")[1].trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/heidrun-org/heidrun/blob/HEAD/web/b%20ts.vue");
  });

  it("checks the file with the folder of the workspace, then opens it in VS Code with the answer", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ root: "/work/app", path: "src/a.rs" }).mockResolvedValueOnce(null);
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.findAll("[data-file]")[0].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenNthCalledWith(1, "files_resolve", { cwd: "/work/app/sub", path: "/work/app/src/a.rs" });
    expect(invoke).toHaveBeenNthCalledWith(2, "file_open_external", { root: "/work/app", path: "src/a.rs" });
  });

  it("shows the reason in a message when the file cannot be opened in VS Code", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("file not found");
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.findAll("[data-file]")[0].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(state.toast).toBe("file not found");
    expect(state.toastKind).toBe("error");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("shows the reason in a message when the address cannot be opened", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce("no browser");
    const wrapper = mountLine();
    await wrapper.trigger("click");
    await wrapper.findAll("[data-file]")[0].findAll("button")[1].trigger("click");
    await flushPromises();
    expect(state.toast).toBe("no browser");
  });

  it("gives each button a title with the path", async () => {
    const wrapper = mountLine();
    await wrapper.trigger("click");
    const buttons = wrapper.findAll("[data-file]")[0].findAll("button");
    expect(buttons[0].attributes("title")).toBe("Open src/a.rs in VS Code");
    expect(buttons[1].attributes("title")).toBe("Open src/a.rs on GitHub");
  });
});
