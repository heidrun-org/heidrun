import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, string>): Promise<unknown> => null));
const writeTextMock = vi.hoisted(() => vi.fn(async (_text: string) => {}));
const revealMock = vi.hoisted(() => vi.fn(async (_path: string) => {}));
const openSearchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}), revealItemInDir: revealMock }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: writeTextMock }));
// The theme reads the colour scheme of the browser, which jsdom does not have.
vi.mock("../stores/theme", async () => {
  const { ref } = await import("vue");
  return { codeThemeClass: ref("github-dark") };
});
// CodeMirror needs a real browser: the stub shows what the file view gives to the editor.
vi.mock("./CodeEditor.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { path: String, text: String, wrap: Boolean, readOnly: Boolean },
      setup(props, { expose }) {
        expose({ openSearch: openSearchMock });
        return () =>
          h("div", {
            class: "code-editor-stub",
            "data-path": props.path,
            "data-read-only": String(props.readOnly),
            "data-wrap": String(props.wrap),
            "data-text": props.text,
          });
      },
    }),
  };
});

import FileView from "./FileView.vue";
import { settings } from "../stores/settings";

const LABEL = "Heidrun file view: /work/project/src/main.ts";

/** What the backend answers for the files of the tests. */
function answer(command: string, args: Record<string, string>) {
  if (command === "files_resolve") {
    return { root: "/work/project", path: args.path.replace("/work/project/", "") };
  }
  if (command === "git_file") {
    return args.path.endsWith(".md") ? "# Title\n\nSome **text**.\n" : "const a = 1;\n";
  }
  if (command === "file_image") {
    return "data:image/png;base64,AAAA";
  }
  return null;
}

function mountFileView(label = LABEL) {
  return mount(FileView, {
    props: {
      pane: { pane_id: "w1:p2", terminal_id: "t2", workspace_id: "w1", tab_id: "w1:t1", focused: false, agent_status: "unknown", revision: 1, label, cwd: "/work/project" },
    },
  });
}

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => answer(command, args));
  writeTextMock.mockClear();
  revealMock.mockClear();
  openSearchMock.mockClear();
  settings.filesMdRead = true;
  settings.codeWrap = false;
});

describe("FileView (issue #714)", () => {
  it("resolves the file from the folder of the pane, reads it, and gives it to a read only editor", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("files_resolve", { cwd: "/work/project", path: "/work/project/src/main.ts" });
    expect(invokeMock).toHaveBeenCalledWith("git_file", { root: "/work/project", path: "src/main.ts", rev: null });
    const editor = wrapper.get(".code-editor-stub");
    expect(editor.attributes("data-read-only")).toBe("true");
    expect(editor.attributes("data-path")).toBe("src/main.ts");
    expect(editor.attributes("data-text")).toBe("const a = 1;");
  });

  it("has no button to edit or to save, and never calls a command that writes", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    const buttons = wrapper.findAll("button").map((button) => button.text());
    expect(buttons).toEqual(["Search", "⧉ Path", "Finder", "VS Code"]);
    const commands = invokeMock.mock.calls.map(([command]) => command);
    expect(commands.filter((command) => /write|create|rename|trash/.test(command))).toEqual([]);
  });

  it("shows a Markdown file as rendered text, with the switch to the source code", async () => {
    const wrapper = mountFileView("Heidrun file view: /work/project/README.md");
    await flushPromises();
    expect(wrapper.find(".md-doc h1").text()).toBe("Title");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
    await wrapper.findAll(".seg button")[1].trigger("click");
    await flushPromises();
    expect(settings.filesMdRead).toBe(false);
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("# Title\n\nSome **text**.");
  });

  it("shows no switch between rendered text and source code for a file that is not Markdown", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.find(".seg").exists()).toBe(false);
  });

  it("gives the choice of wrapping lines to the editor", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("false");
    await wrapper.get(".wrap-toggle input").setValue(true);
    expect(settings.codeWrap).toBe(true);
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("true");
  });

  it("opens the search panel of the editor with the button Search", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    await wrapper.get("[data-action='search']").trigger("click");
    expect(openSearchMock).toHaveBeenCalledTimes(1);
  });

  it("shows no button Search while the file is shown as rendered Markdown", async () => {
    const wrapper = mountFileView("Heidrun file view: /work/project/README.md");
    await flushPromises();
    expect(wrapper.find("[data-action='search']").exists()).toBe(false);
  });

  it("copies the path inside the project, and the absolute path with the key Option", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    const copyButton = wrapper.findAll("button").find((button) => button.text() === "⧉ Path")!;
    await copyButton.trigger("click");
    expect(writeTextMock).toHaveBeenLastCalledWith("src/main.ts");
    await copyButton.trigger("click", { altKey: true });
    expect(writeTextMock).toHaveBeenLastCalledWith("/work/project/src/main.ts");
  });

  it("shows the file in the Finder, and opens it in VS Code", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    await wrapper.findAll("button").find((button) => button.text() === "Finder")!.trigger("click");
    expect(revealMock).toHaveBeenCalledWith("/work/project/src/main.ts");
    await wrapper.findAll("button").find((button) => button.text() === "VS Code")!.trigger("click");
    expect(invokeMock).toHaveBeenCalledWith("file_open_external", { root: "/work/project", path: "src/main.ts" });
  });

  it("shows an image as a picture", async () => {
    const wrapper = mountFileView("Heidrun file view: /work/project/logo.png");
    await flushPromises();
    expect(wrapper.get(".img img").attributes("src")).toBe("data:image/png;base64,AAAA");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
  });

  it("shows the error of the backend when the file cannot be read", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "files_resolve") {
        throw "no such file";
      }
      return null;
    });
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".err").text()).toBe("no such file");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
  });

  it("reads the new file when the label of the pane changes", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    await wrapper.setProps({ pane: { ...wrapper.props("pane"), label: "Heidrun file view: /work/project/src/other.ts" } });
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("git_file", { root: "/work/project", path: "src/other.ts", rev: null });
    expect(wrapper.get(".code-editor-stub").attributes("data-path")).toBe("src/other.ts");
  });
});
