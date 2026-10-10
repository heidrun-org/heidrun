import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
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

  it("has the name first, as a one-line field, then the command line, as a text area", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    const fields = wrapper.findAll("input, textarea");
    expect(fields.map((field) => field.element.tagName)).toEqual(["INPUT", "TEXTAREA"]);
    expect(fields[0].attributes("placeholder")).toBe("Name (optional)");
    expect(wrapper.get("label[for=new-script-name]").text()).toBe("Name (optional)");
    expect(wrapper.get("label[for=new-script-command]").text()).toBe("Command line");
  });

  it("puts the focus in the name field", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    expect(document.activeElement).toBe(wrapper.get("input").element);
  });

  it("does not allow Create while the command line is empty", async () => {
    const { wrapper } = await mountNewCustomScriptModal();
    const create = wrapper.get("button[type=submit]");
    expect(create.text()).toBe("Create");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("input").setValue("my name");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("textarea").setValue("   ");
    expect(create.attributes("disabled")).toBeDefined();
    await wrapper.get("textarea").setValue("make dev");
    expect(create.attributes("disabled")).toBeUndefined();
  });

  it("creates the script with the name that the person gave", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("input").setValue("  build all  ");
    await wrapper.get("textarea").setValue("pnpm -r build");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const actions = project.byWorkspace["w1"]!.config.actions;
    expect(actions).toHaveLength(2);
    expect(actions[1]).toMatchObject({ label: "build all", command: "pnpm -r build" });
    expect(newCustomScriptModal.open).toBe(false);
  });

  it("names the script with the first 20 characters of the command line when the name is empty", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("textarea").setValue("pnpm --filter web_frontend test");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const actions = project.byWorkspace["w1"]!.config.actions;
    expect(actions[1].label).toBe("pnpm --filter web_fr");
    expect(actions[1].command).toBe("pnpm --filter web_frontend test");
  });

  it("names the script with the command line when the name has only spaces and the command is short", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("input").setValue("   ");
    await wrapper.get("textarea").setValue("make dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].label).toBe("make dev");
  });

  it("keeps the lines of a command line of several lines", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("textarea").setValue("cd web\npnpm install\npnpm dev");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const action = project.byWorkspace["w1"]!.config.actions[1];
    expect(action.command).toBe("cd web\npnpm install\npnpm dev");
    expect(action.label).toBe("cd web pnpm install");
  });

  it("creates the script when the person presses the key Command and Enter in the text area", async () => {
    const { wrapper, project } = await mountNewCustomScriptModal();
    await wrapper.get("textarea").setValue("make test");
    await wrapper.get("textarea").trigger("keydown", { key: "Enter", metaKey: true });
    await flushPromises();
    expect(project.byWorkspace["w1"]!.config.actions[1].command).toBe("make test");
  });

  it("closes without creating a script when the person clicks Cancel", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("textarea").setValue("make test");
    await wrapper.get("button[type=button].btn").trigger("click");
    expect(newCustomScriptModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.actions).toHaveLength(1);
  });

  it("closes without creating a script when the person presses Escape", async () => {
    const { wrapper, project, newCustomScriptModal } = await mountNewCustomScriptModal();
    await wrapper.get("textarea").setValue("make test");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(newCustomScriptModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.actions).toHaveLength(1);
  });
});
