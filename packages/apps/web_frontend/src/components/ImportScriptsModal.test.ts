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

/** Mounts the window Import scripts, open, on a workspace that has one script and two detected scripts. */
async function mountImportScriptsModal(detected = true) {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
  const { importScriptsModal } = await import("../stores/importScripts");
  const { default: ImportScriptsModal } = await import("./ImportScriptsModal.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: { version: 1, actions: [{ id: "dev", label: "start the server", command: "make dev" }] },
    detected: detected
      ? [
          { label: "pnpm install", command: "pnpm install", source: "package.json" },
          { label: "pnpm dev", command: "pnpm dev", source: "package.json", description: "tauri dev" },
          { label: "make dev", command: "make dev", source: "Makefile" },
        ]
      : [],
  } as never;
  importScriptsModal.open = true;
  const wrapper = mount(ImportScriptsModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, project, importScriptsModal };
}

describe("ImportScriptsModal", () => {
  it("lists the detected scripts that are not yet scripts of the project, with their source", async () => {
    const { wrapper } = await mountImportScriptsModal();
    expect(wrapper.get("h2").text()).toBe("Import scripts");
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
    expect(wrapper.text()).toContain("pnpm install");
    expect(wrapper.text()).toContain("package.json");
    expect(wrapper.text()).not.toContain("Makefile");
  });

  it("does not allow Import while no script is ticked", async () => {
    const { wrapper } = await mountImportScriptsModal();
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("input[type=checkbox]").setValue(true);
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("button[type=submit]").text()).toBe("Import 1 script");
  });

  it("adds the ticked scripts to the scripts of the project, then closes", async () => {
    const { wrapper, project, importScriptsModal } = await mountImportScriptsModal();
    const boxes = wrapper.findAll("input[type=checkbox]");
    await boxes[0].setValue(true);
    await boxes[1].setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const actions = project.byWorkspace["w1"]!.config.actions;
    expect(actions.map((action) => action.command)).toEqual(["make dev", "pnpm install", "pnpm dev"]);
    expect(importScriptsModal.open).toBe(false);
  });

  it("selects all the scripts, then none, with one button", async () => {
    const { wrapper } = await mountImportScriptsModal();
    const toggle = wrapper.get("footer button[type=button]");
    expect(toggle.text()).toBe("Select all");
    await toggle.trigger("click");
    expect(wrapper.get("button[type=submit]").text()).toBe("Import 2 scripts");
    expect(toggle.text()).toBe("Select none");
    await toggle.trigger("click");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
  });

  it("says that there is nothing to import when the project has no detected script", async () => {
    const { wrapper } = await mountImportScriptsModal(false);
    expect(wrapper.text()).toContain("no script to import");
  });

  it("closes without importing when the person presses Escape", async () => {
    const { project, importScriptsModal } = await mountImportScriptsModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(importScriptsModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.actions).toHaveLength(1);
  });
});
