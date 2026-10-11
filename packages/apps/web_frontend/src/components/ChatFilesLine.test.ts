import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import ChatFilesLine from "./ChatFilesLine.vue";
import { chatFiles } from "../lib/chat_files";
import { state } from "../stores/session";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

const FILES = ["/work/app/.claude/worktrees/fix/src/a.rs", "/work/app/web/b ts.vue", "/elsewhere/c.md"];

/** What the Tauri command `chats_files_exist` answers: every file exists, except the ones in `missing`. */
function answerExistence(missingOnDisk: string[] = [], missingOnRemote: string[] = []) {
  vi.mocked(invoke).mockImplementation(async (command, payload) => {
    if (command === "chats_files_exist") {
      return (payload as { paths: string[] }).paths.map((path) => ({
        path,
        on_disk: missingOnDisk.includes(path) === false,
        on_remote: missingOnRemote.includes(path) === false,
      }));
    }
    return null;
  });
}

function mountLine(props: Partial<InstanceType<typeof ChatFilesLine>["$props"]> = {}) {
  return mount(ChatFilesLine, {
    attachTo: document.body,
    props: {
      text: "a.rs, b ts.vue, +1",
      entries: chatFiles("/work/app", FILES),
      folder: "/work/app/sub",
      webBase: "https://github.com/heidrun-org/heidrun",
      forge: "github",
      ...props,
    },
  });
}

/** Opens the card, and waits for the answer about the files. */
async function openCard(wrapper: ReturnType<typeof mountLine>) {
  await wrapper.trigger("click");
  await flushPromises();
}

/** The rows of the open card: the name, the folder, and the texts of the buttons of each file. */
function cardRows(wrapper: ReturnType<typeof mountLine>) {
  return wrapper.findAll("[data-file]").map((row) => ({
    name: row.get(".fw-medium").text(),
    folder: row.find(".folder").exists() ? row.get(".folder").text() : "",
    buttons: row.findAll("button").map((button) => button.text()),
  }));
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(openUrl).mockClear();
  answerExistence();
  state.toast = "";
});

describe("ChatFilesLine", () => {
  it("shows the icon of a file and the text of the line, and no card before the pointer rests on it", () => {
    const wrapper = mountLine();
    expect(wrapper.find(".bi-file-earmark").exists()).toBe(true);
    expect(wrapper.text()).toBe("a.rs, b ts.vue, +1");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("shows a title with an icon and the number of files, then each file with its name and its folders", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const title = wrapper.get(".popover .list-group-item");
    expect(title.text()).toBe("3 files written");
    expect(title.find(".bi-files").exists()).toBe(true);
    expect(cardRows(wrapper).map((row) => [row.name, row.folder])).toEqual([
      ["a.rs", "src"],
      ["b ts.vue", "web"],
      ["c.md", "/elsewhere"],
    ]);
  });

  it("shows the path of a file of a worktree as the path of the same file at the root of the repository", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(wrapper.get("[data-file]").text()).not.toContain(".claude");
  });

  it("shows an icon that fits the kind of each file", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const icons = wrapper.findAll("[data-file]").map((row) => row.get("i.bi").classes());
    expect(icons[0]).toContain("bi-file-earmark-code");
    expect(icons[1]).toContain("bi-file-earmark-code");
    expect(icons[2]).toContain("bi-file-earmark-text");
  });

  it("highlights a row of the card under the pointer with the Bootstrap list group, and not the title", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(wrapper.get(".popover .list-group").classes()).toContain("list-group-flush");
    expect(wrapper.get(".popover .list-group-item").classes()).not.toContain("list-group-item-action");
    for (const row of wrapper.findAll("[data-file]")) {
      expect(row.classes()).toEqual(expect.arrayContaining(["list-group-item", "list-group-item-action"]));
    }
  });

  it("gives each file below the root a button for VS Code and a button for GitHub, with an icon, and a file outside none", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(cardRows(wrapper).map((row) => row.buttons)).toEqual([["VS Code", "GitHub"], ["VS Code", "GitHub"], []]);
    const buttons = wrapper.get("[data-file]").findAll("button");
    expect(buttons[0].find(".bi-code-slash").exists()).toBe(true);
    expect(buttons[1].find(".bi-github").exists()).toBe(true);
  });

  it("names the forge GitLab, with its icon, on the buttons of a repository on GitLab", async () => {
    const wrapper = mountLine({ forge: "gitlab", webBase: "https://gitlab.com/group/app" });
    await openCard(wrapper);
    expect(cardRows(wrapper)[0].buttons).toEqual(["VS Code", "GitLab"]);
    expect(wrapper.get("[data-file]").findAll("button")[1].find(".bi-gitlab").exists()).toBe(true);
  });

  it("has no button for the forge when the repository has no remote", async () => {
    const wrapper = mountLine({ forge: null, webBase: null });
    await openCard(wrapper);
    expect(cardRows(wrapper).map((row) => row.buttons)).toEqual([["VS Code"], ["VS Code"], []]);
  });

  it("asks which files exist each time the card opens, only for the files below the root", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(invoke).toHaveBeenCalledWith("chats_files_exist", { folder: "/work/app/sub", paths: ["src/a.rs", "web/b ts.vue"] });
    await wrapper.trigger("keydown", { key: "Escape" });
    await wrapper.trigger("click");
    await flushPromises();
    expect(vi.mocked(invoke).mock.calls.filter(([command]) => command === "chats_files_exist").length).toBe(2);
  });

  it("disables the button for VS Code of a file that is not on the disk, and says why in its title", async () => {
    answerExistence(["src/a.rs"]);
    const wrapper = mountLine();
    await openCard(wrapper);
    const [vscode, github] = wrapper.get("[data-file]").findAll("button");
    expect(vscode.attributes("disabled")).toBeDefined();
    expect(vscode.attributes("title")).toBe("VS Code cannot open src/a.rs: the file does not exist on this Mac.");
    expect(github.attributes("disabled")).toBeUndefined();
    expect(github.attributes("title")).toBe("Open src/a.rs on GitHub");
    const [otherVscode] = wrapper.findAll("[data-file]")[1].findAll("button");
    expect(otherVscode.attributes("disabled")).toBeUndefined();
  });

  it("disables the button of the forge for a file that is not on the default branch, and says why in its title", async () => {
    answerExistence([], ["web/b ts.vue"]);
    const wrapper = mountLine();
    await openCard(wrapper);
    const [vscode, github] = wrapper.findAll("[data-file]")[1].findAll("button");
    expect(github.attributes("disabled")).toBeDefined();
    expect(github.attributes("title")).toBe("web/b ts.vue does not exist on GitHub, on the default branch.");
    expect(vscode.attributes("disabled")).toBeUndefined();
  });

  it("keeps the buttons on when the program cannot tell which files exist", async () => {
    vi.mocked(invoke).mockRejectedValue("no git");
    const wrapper = mountLine();
    await openCard(wrapper);
    for (const button of wrapper.findAll("[data-file] button")) {
      expect(button.attributes("disabled")).toBeUndefined();
    }
  });

  it("opens the file on the forge, on the default branch, with the path at the root", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-file]")[0].findAll("button")[1].trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/heidrun-org/heidrun/blob/HEAD/src/a.rs");
    await wrapper.findAll("[data-file]")[1].findAll("button")[1].trigger("click");
    expect(openUrl).toHaveBeenLastCalledWith("https://github.com/heidrun-org/heidrun/blob/HEAD/web/b%20ts.vue");
  });

  it("checks the file at the root with the folder of the workspace, then opens it in VS Code with the answer", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockResolvedValueOnce({ root: "/work/app", path: "src/a.rs" }).mockResolvedValueOnce(null);
    await wrapper.findAll("[data-file]")[0].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenNthCalledWith(1, "files_resolve", { cwd: "/work/app/sub", path: "/work/app/src/a.rs" });
    expect(invoke).toHaveBeenNthCalledWith(2, "file_open_external", { root: "/work/app", path: "src/a.rs" });
  });

  it("shows the reason in a message when the file cannot be opened in VS Code", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    vi.mocked(invoke).mockReset();
    vi.mocked(invoke).mockRejectedValueOnce("file not found");
    await wrapper.findAll("[data-file]")[0].findAll("button")[0].trigger("click");
    await flushPromises();
    expect(state.toast).toBe("file not found");
    expect(state.toastKind).toBe("error");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("shows the reason in a message when the address cannot be opened", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce("no browser");
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-file]")[0].findAll("button")[1].trigger("click");
    await flushPromises();
    expect(state.toast).toBe("no browser");
  });

  it("gives each button a title with the path below the root", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const buttons = wrapper.findAll("[data-file]")[0].findAll("button");
    expect(buttons[0].attributes("title")).toBe("Open src/a.rs in VS Code");
    expect(buttons[1].attributes("title")).toBe("Open src/a.rs on GitHub");
  });
});
