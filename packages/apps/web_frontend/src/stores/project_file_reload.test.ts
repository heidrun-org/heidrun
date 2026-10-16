import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The text of the file .heidrun/config.json that the fake backend gives, and how many times the project was loaded. */
const backend = { configText: "{}", loads: 0 };

async function loadStores() {
  vi.resetModules();
  const { invoke } = await import("@tauri-apps/api/core");
  vi.mocked(invoke).mockImplementation((async (command: string) => {
    if (command === "project_config_text") {
      return backend.configText;
    }
    if (command === "project_load") {
      backend.loads++;
      return { root: "/project", config_path: "/project/.heidrun/config.json", config: { version: 1, launchers: [] }, detected: [] };
    }
    throw new Error(`unexpected command ${command}`);
  }) as never);
  const projectStore = await import("./project");
  const sessionStore = await import("./session");
  sessionStore.state.snapshot = {
    workspaces: [{ workspace_id: "w1", number: 1, worktree: { path: "/project" } }],
    tabs: [],
    panes: [],
  } as never;
  sessionStore.state.selectedWorkspaceId = "w1";
  projectStore.project.byWorkspace.w1 = { root: "/project", config_path: "", config: { version: 1, launchers: [] }, detected: [] };
  return projectStore;
}

beforeEach(() => {
  backend.configText = "{}";
  backend.loads = 0;
});

describe("reloadProjectWhenFileChanged", () => {
  it("only records the text the first time", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });

  it("loads the project again when another program changed the file", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    backend.configText = '{"version":1,"launchers":[],"prompts":[{"text":"New"}]}';
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(1);
  });

  it("loads nothing when the file did not change", async () => {
    const store = await loadStores();
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });

  it("does nothing for a workspace whose project is not loaded yet", async () => {
    const store = await loadStores();
    delete store.project.byWorkspace.w1;
    backend.configText = "changed";
    await store.reloadProjectWhenFileChanged();
    await store.reloadProjectWhenFileChanged();
    expect(backend.loads).toBe(0);
  });
});
