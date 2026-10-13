import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

/** Mounts the window Create a custom script, open, on a workspace that has one custom script. */
async function mountNewCustomScriptModal() {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
  const { newCustomScriptModal } = await import("../stores/newCustomScript");
  const { default: NewCustomScriptModal } = await import("./NewCustomScriptModal.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: {
      version: 1,
      actions: [{ id: "dev", label: "start the server", command: "make dev" }],
    },
    detected: [],
  } as never;
  newCustomScriptModal.open = true;
  const wrapper = mount(NewCustomScriptModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, project, newCustomScriptModal };
}

describe("NewCustomScriptModal", () => {
  it("is called Create a custom script", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    expect(wrapper.get("h2").text()).toBe("Create a custom script");
    expect(wrapper.get("[role=dialog]").attributes("aria-label")).toBe("Create a custom script");
  });

  it("has the kind as radio buttons, then the name, then the command line", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    const radios = wrapper.findAll("input[type=radio]");
    expect(radios.map((radio) => radio.attributes("value"))).toEqual(["commandLine", "codingAgent"]);
    expect(wrapper.get("label[for=new-script-name]").text()).toBe("Name");
    expect(wrapper.get("label[for=new-script-command]").text()).toBe("Command line");
    expect(wrapper.get("label[for=new-script-name]").text()).not.toContain("optional");
  });

  it("puts the focus in the name field", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    expect(document.activeElement).toBe(wrapper.get("#new-script-name").element);
  });

  it("does not allow Create while the name or the command line is empty", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    const create = wrapper.get("button[type=submit]");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-name").setValue("my name");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-command").setValue("   ");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-command").setValue("make dev");
    expect(create.attributes("disabled")).toBeUndefined();
    await wrapper.get("#new-script-name").setValue("  ");
    expect(create.attributes("disabled")).toBeDefined();
  });

  it("creates the script with the name that the person gave", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("  build all  ");
    await wrapper.get("#new-script-command").setValue("pnpm -r build");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const actions = project.byWorkspace["w1"]!.config.actions;
    expect(actions).toHaveLength(2);
    expect(actions[1]).toMatchObject({ label: "build all", command: "pnpm -r build" });
    expect(actions[1].agent).toBeUndefined();
    expect(newCustomScriptModal.open).toBe(false);
  });

  it("saves the description of several lines, and no description when it is empty", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("with");
    await wrapper.get("#new-script-description").setValue("  line one\nline two  ");
    await wrapper.get("textarea#new-script-command").setValue("make a");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].description).toBe("line one\nline two");
  });

  it("keeps the lines of a command line of several lines", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("install and start");
    await wrapper.get("#new-script-command").setValue("cd web\npnpm install\npnpm dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].command).toBe("cd web\npnpm install\npnpm dev");
  });

  it("creates the script when the person presses the key Command and Enter in the text area", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("test");
    await wrapper.get("#new-script-command").setValue("make test");
    await wrapper.get("#new-script-command").trigger("keydown", { key: "Enter", metaKey: true });
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].command).toBe("make test");
  });

  it("shows the fields of the coding agent when the person chooses the kind Coding agent", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    expect(wrapper.find("#new-script-command").exists()).toBe(false);
    expect(wrapper.findAll("input[name=new-script-agent]").map((radio) => radio.attributes("value"))).toEqual(["claude", "codex"]);
    for (const id of ["folder", "model", "effort", "prompt"]) {
      expect(wrapper.find(`#new-script-${id}`).exists()).toBe(true);
    }
  });

  it("creates a script of the kind Coding agent, with the command line that starts the agent", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-script-name").setValue("review");
    await wrapper.get("input[name=new-script-agent][value=claude]").setValue();
    await wrapper.get("#new-script-folder").setValue("packages/apps");
    await wrapper.get("#new-script-model").setValue("opus");
    await wrapper.get("#new-script-effort").setValue("high");
    await wrapper.get("#new-script-prompt").setValue("Review the last commit.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const action = project.byWorkspace["w1"]!.config.actions[1];
    expect(action).toMatchObject({
      label: "review",
      cwd: "packages/apps",
      command: "claude --model 'opus' --effort 'high' 'Review the last commit.'",
      agent: { name: "claude", model: "opus", effort: "high", prompt: "Review the last commit." },
    });
    expect(newCustomScriptModal.open).toBe(false);
  });

  it("puts the folder that the native picker returns in the field, relative to the root of the repository", async () => {
    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValueOnce("/Users/me/webwork/heidrun/packages/apps" as never);
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("button[aria-label='Choose the current work directory']").trigger("click");
    await flushPromises();
    expect((wrapper.get("#new-script-folder").element as HTMLInputElement).value).toBe("packages/apps");
  });

  it("refuses a folder outside the repository", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-script-name").setValue("review");
    await wrapper.get("#new-script-prompt").setValue("Hi");
    await wrapper.get("#new-script-folder").setValue("/etc");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-folder").setValue("../other");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-folder").setValue("/Users/me/webwork/heidrun/docs");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
  });

  it("does not allow Create for the kind Coding agent while the prompt is empty", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("#new-script-name").setValue("review");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("#new-script-prompt").setValue("Hi");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
  });

  /** Mocks the answer of the coding agent, and returns the click on the button that writes the empty fields. */
  async function mockAnswerAndMount(answerText: string) {
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();
    vi.mocked(invoke).mockImplementation((async (command: string) => {
      return command === "coding_agent_ask" ? { text: answerText } : null;
    }) as never);
    const mounted = await mountNewCustomScriptModal();
    const button = mounted.wrapper.get("button[aria-label^='Write the empty fields']");
    return { ...mounted, button, invoke };
  }

  it("writes the name and the description when both are empty", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('Sure: {"name": " Start the server\\nx", "description": "Starts it."}');
    await wrapper.get("#new-script-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "coding_agent_ask");
    expect((call?.[1] as { prompt: string }).prompt).toContain("make dev");
    expect((call?.[1] as { prompt: string }).prompt).toContain('"name", "description"');
    expect((wrapper.get("#new-script-name").element as HTMLInputElement).value).toBe("Start the server");
    expect((wrapper.get("#new-script-description").element as HTMLTextAreaElement).value).toBe("Starts it.");
  });

  it("writes only the description when the name is filled, and keeps the name", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('{"description": "Starts it."}');
    await wrapper.get("#new-script-name").setValue("my name");
    await wrapper.get("#new-script-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find((c) => c[0] === "coding_agent_ask");
    expect((call?.[1] as { prompt: string }).prompt).toContain('are: "description".');
    expect((wrapper.get("#new-script-name").element as HTMLInputElement).value).toBe("my name");
    expect((wrapper.get("#new-script-description").element as HTMLTextAreaElement).value).toBe("Starts it.");
  });

  it("does nothing, and says so, when the name and the description are both filled", async () => {
    const { wrapper, button, invoke } = await mockAnswerAndMount('{"name": "x", "description": "y"}');
    await wrapper.get("#new-script-name").setValue("my name");
    await wrapper.get("#new-script-description").setValue("my description");
    await wrapper.get("#new-script-command").setValue("make dev");
    await button.trigger("click");
    await flushPromises();
    expect(vi.mocked(invoke).mock.calls.some((c) => c[0] === "coding_agent_ask")).toBe(false);
    const { state } = await import("../stores/session");
    expect(state.toast).toContain("both filled");
  });

  it("offers the models and the efforts that the tool of the coding agent lists, with the efforts of the chosen model", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const codexOutput = readFileSync(resolve(import.meta.dirname, "../lib/codex_debug_models.fixture.json"), "utf8");
    vi.mocked(invoke).mockImplementation(async (command: string) => (command === "coding_agent_models_run" ? codexOutput : null));
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("input[value=codingAgent]").setValue();
    await wrapper.get("input[name=new-script-agent][value=codex]").setValue();
    await flushPromises();
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("coding_agent_models_run", { executable: "codex", arguments: ["debug", "models"] });
    const modelTexts = wrapper.findAll("#new-script-model option").map((option) => option.text());
    expect(modelTexts).toContain("GPT-6.1-Sol");
    expect(modelTexts).not.toContain("GPT-Reserve");
    await wrapper.get("#new-script-model").setValue("gpt-6.1-sol");
    expect(wrapper.findAll("#new-script-effort option").map((option) => option.text())).toContain("ultra");
    await wrapper.get("#new-script-model").setValue("gpt-6-luna");
    expect(wrapper.findAll("#new-script-effort option").map((option) => option.text())).not.toContain("ultra");
  });

  it("remembers the kind, the coding agent, the model, and the effort, and nothing else", async () => {
    const first = await mountNewCustomScriptModal();
    await first.wrapper.get("input[value=codingAgent]").setValue();
    await first.wrapper.get("input[name=new-script-agent][value=codex]").setValue();
    await first.wrapper.get("#new-script-model").setValue("gpt-6-luna");
    await first.wrapper.get("#new-script-effort").setValue("low");
    await first.wrapper.get("#new-script-name").setValue("not remembered");
    await first.wrapper.get("#new-script-prompt").setValue("not remembered");
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved).toMatchObject({ customScriptKind: "codingAgent", customScriptAgent: "codex", customScriptModel: "gpt-6-luna", customScriptEffort: "low" });
    first.wrapper.unmount();
    document.body.innerHTML = "";
    vi.resetModules();
    const second = await mountNewCustomScriptModal();
    expect((second.wrapper.get("input[value=codingAgent]").element as HTMLInputElement).checked).toBe(true);
    expect((second.wrapper.get("input[name=new-script-agent][value=codex]").element as HTMLInputElement).checked).toBe(true);
    expect((second.wrapper.get("#new-script-model").element as HTMLSelectElement).value).toBe("gpt-6-luna");
    expect((second.wrapper.get("#new-script-effort").element as HTMLSelectElement).value).toBe("low");
    expect((second.wrapper.get("#new-script-name").element as HTMLInputElement).value).toBe("");
    expect((second.wrapper.get("#new-script-prompt").element as HTMLTextAreaElement).value).toBe("");
  });

  it("edits an existing script: fills the fields, and saves the changes in the same script", async () => {
    const first = await mountNewCustomScriptModal();
    first.wrapper.unmount();
    document.body.innerHTML = "";
    const { project } = await import("../stores/project");
    const { newCustomScriptModal } = await import("../stores/newCustomScript");
    const { default: NewCustomScriptModal } = await import("./NewCustomScriptModal.vue");
    newCustomScriptModal.editedId = "dev";
    newCustomScriptModal.open = true;
    const wrapper = mount(NewCustomScriptModal, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("Edit a custom script");
    expect((wrapper.get("#new-script-name").element as HTMLInputElement).value).toBe("start the server");
    expect((wrapper.get("#new-script-command").element as HTMLTextAreaElement).value).toBe("make dev");
    await wrapper.get("#new-script-name").setValue("start it");
    await wrapper.get("#new-script-command").setValue("make dev2");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const actions = project.byWorkspace["w1"]!.config.actions;
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ id: "dev", label: "start it" });
    expect(newCustomScriptModal.open).toBe(false);
  });

  it("puts the current work directory below the description and above the command line", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    const description = wrapper.get("#new-script-description").element;
    const folder = wrapper.get("#new-script-folder").element;
    const command = wrapper.get("#new-script-command").element;
    expect(wrapper.get("label[for=new-script-folder]").text()).toBe("Current work directory");
    expect(description.compareDocumentPosition(folder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(folder.compareDocumentPosition(command) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("creates a script of the kind Command line that runs in the chosen folder", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("dev");
    await wrapper.get("#new-script-folder").setValue("packages/apps/desktop_tauri");
    await wrapper.get("#new-script-command").setValue("pnpm dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1]).toMatchObject({ command: "pnpm dev", cwd: "packages/apps/desktop_tauri" });
  });

  it("creates a script of the kind Command line without a work directory when the field is empty", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("test");
    await wrapper.get("#new-script-command").setValue("make test");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].cwd).toBeUndefined();
  });

  it("does not allow Create for a script of the kind Command line whose folder is outside the repository", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-name").setValue("test");
    await wrapper.get("#new-script-command").setValue("make test");
    await wrapper.get("#new-script-folder").setValue("../other");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    expect(wrapper.get("#new-script-folder").classes()).toContain("is-invalid");
  });

  it("fills the work directory of an imported script, and saves a change or a cleared field", async () => {
    const first = await mountNewCustomScriptModal();
    first.wrapper.unmount();
    document.body.innerHTML = "";
    const { project } = await import("../stores/project");
    const { newCustomScriptModal } = await import("../stores/newCustomScript");
    const { default: NewCustomScriptModal } = await import("./NewCustomScriptModal.vue");
    project.byWorkspace["w1"]!.config.actions[0].cwd = "packages/web";
    newCustomScriptModal.editedId = "dev";
    newCustomScriptModal.open = true;
    const wrapper = mount(NewCustomScriptModal, { attachTo: document.body });
    await flushPromises();
    expect((wrapper.get("#new-script-folder").element as HTMLInputElement).value).toBe("packages/web");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[0].cwd).toBe("packages/web");

    newCustomScriptModal.editedId = "dev";
    newCustomScriptModal.open = true;
    const second = mount(NewCustomScriptModal, { attachTo: document.body });
    await flushPromises();
    await second.get("#new-script-folder").setValue("");
    await second.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[0].cwd).toBeUndefined();
  });

  it("closes without creating a script when the person clicks Cancel", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-command").setValue("make test");
    await wrapper.get("button[title^=Cancel]").trigger("click");
    expect(newCustomScriptModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.actions).toHaveLength(1);
  });

  it("closes without creating a script when the person presses Escape", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("#new-script-command").setValue("make test");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(newCustomScriptModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.actions).toHaveLength(1);
  });
});
