import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

/** Mounts the window Import launchers, open, on a workspace that has one launcher and two detected launchers. */
async function mountImportLaunchersModal(detected = true) {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
  const { importLaunchersModal } = await import("../stores/importLaunchers");
  const { default: ImportLaunchersModal } = await import("./ImportLaunchersModal.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: { version: 1, launchers: [{ id: "dev", label: "start the server", command: "make dev" }] },
    detected: detected
      ? [
          { label: "pnpm install", command: "pnpm install", source: "package.json" },
          { label: "dev", command: "pnpm dev", source: "package.json", description: "from package.json" },
          { label: "make dev", command: "make dev", source: "Makefile" },
        ]
      : [],
  } as never;
  importLaunchersModal.open = true;
  const wrapper = mount(ImportLaunchersModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, project, importLaunchersModal };
}

describe("ImportLaunchersModal", () => {
  it("lists the detected launchers that are not yet launchers of the project, with their source", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    expect(wrapper.get("h2").text()).toBe("Import launchers");
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
    expect(wrapper.text()).toContain("pnpm install");
    expect(wrapper.text()).toContain("package.json");
    expect(wrapper.text()).not.toContain("Makefile");
  });

  it("does not allow Import while no launcher is ticked", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
    await wrapper.get("input[type=checkbox]").setValue(true);
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("button[type=submit]").text()).toBe("Import 1 launcher");
  });

  it("adds the ticked launchers to the launchers of the project, then closes", async () => {
    const { wrapper, project, importLaunchersModal } = await mountImportLaunchersModal();
    const boxes = wrapper.findAll("input[type=checkbox]");
    await boxes[0].setValue(true);
    await boxes[1].setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const launchers = project.byWorkspace["w1"]!.config.launchers;
    expect(launchers.map((launcher) => launcher.command)).toEqual(["make dev", "pnpm install", "pnpm dev"]);
    expect(importLaunchersModal.open).toBe(false);
  });

  it("selects all the launchers, then none, with one button", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const toggle = wrapper.get("footer button[type=button]");
    expect(toggle.text()).toBe("Select all");
    await toggle.trigger("click");
    expect(wrapper.get("button[type=submit]").text()).toBe("Import 2 launchers");
    expect(toggle.text()).toBe("Select none");
    await toggle.trigger("click");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
  });

  it("says that there is nothing to import when the project has no detected launcher", async () => {
    const { wrapper } = await mountImportLaunchersModal(false);
    expect(wrapper.text()).toContain("no launcher to import");
  });

  it("closes without importing when the person presses Escape", async () => {
    const { project, importLaunchersModal } = await mountImportLaunchersModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(importLaunchersModal.open).toBe(false);
    expect(project.byWorkspace["w1"]!.config.launchers).toHaveLength(1);
  });

  /** Picks the package.json at `path` in the file picker, and makes the command `project_package_scripts` answer `scripts`. */
  async function pickPackageJson(wrapper: Awaited<ReturnType<typeof mountImportLaunchersModal>>["wrapper"], path: string, scripts: unknown[]) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(open).mockResolvedValueOnce(path as never);
    vi.mocked(invoke).mockResolvedValueOnce(scripts as never);
    await wrapper.get(".source > button:first-child").trigger("click");
    await flushPromises();
    return { open, invoke };
  }

  /** The calls that asked the program to read a package.json. */
  function packageScriptCalls(invoke: unknown) {
    return vi.mocked(invoke as (name: string) => Promise<unknown>).mock.calls.filter(([name]) => name === "project_package_scripts");
  }

  const WEB_SCRIPTS = [
    { label: "pnpm install", command: "pnpm install", source: "package.json", cwd: "packages/web" },
    { label: "dev", command: "pnpm dev", source: "package.json", description: "from ./packages/web/package.json", cwd: "packages/web" },
  ];

  it("lists the launchers of the package.json that the person picks, instead of the launchers of the project", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const { open, invoke } = await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/packages/web/package.json", WEB_SCRIPTS);
    expect(vi.mocked(open).mock.calls[0][0]).toMatchObject({ defaultPath: "/Users/me/webwork/heidrun", directory: false });
    expect(invoke).toHaveBeenCalledWith("project_package_scripts", {
      root: "/Users/me/webwork/heidrun",
      packageJson: "/Users/me/webwork/heidrun/packages/web/package.json",
    });
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
    expect(wrapper.get(".picked").text()).toBe("packages/web/package.json");
    expect(wrapper.text()).toContain("pnpm dev");
    expect(wrapper.text()).not.toContain("make dev");
  });

  it("imports a launcher of a picked package.json with its folder as the work directory", async () => {
    const { wrapper, project } = await mountImportLaunchersModal();
    await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/packages/web/package.json", WEB_SCRIPTS);
    await wrapper.findAll("input[type=checkbox]")[1].setValue(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    const imported = project.byWorkspace["w1"]!.config.launchers[1];
    expect(imported).toMatchObject({ label: "dev", command: "pnpm dev", cwd: "packages/web", description: "from ./packages/web/package.json" });
  });

  it("keeps a launcher that has the same command as an imported launcher but another folder", async () => {
    const { wrapper, project } = await mountImportLaunchersModal();
    project.byWorkspace["w1"]!.config.launchers.push({ id: "web-dev", label: "pnpm dev", command: "pnpm dev", cwd: "packages/api" });
    await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/packages/web/package.json", WEB_SCRIPTS);
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
    project.byWorkspace["w1"]!.config.launchers.push({ id: "web-dev-2", label: "pnpm dev", command: "pnpm dev", cwd: "packages/web" });
    await flushPromises();
    expect(wrapper.findAll(".list-group-item")).toHaveLength(1);
  });

  it("refuses a file outside the repository and keeps the current list", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const { invoke } = await pickPackageJson(wrapper, "/Users/me/other/package.json", WEB_SCRIPTS);
    expect(packageScriptCalls(invoke)).toHaveLength(0);
    expect(wrapper.find(".picked").exists()).toBe(false);
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
  });

  it("refuses a file that is not named package.json", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const { invoke } = await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/composer.json", WEB_SCRIPTS);
    expect(packageScriptCalls(invoke)).toHaveLength(0);
    expect(wrapper.find(".picked").exists()).toBe(false);
  });

  it("keeps the current list when the program cannot read the picked package.json", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(open).mockResolvedValueOnce("/Users/me/webwork/heidrun/web/package.json" as never);
    vi.mocked(invoke).mockRejectedValueOnce("not valid JSON");
    await wrapper.get(".source > button:first-child").trigger("click");
    await flushPromises();
    expect(wrapper.find(".picked").exists()).toBe(false);
    expect(wrapper.findAll(".list-group-item")).toHaveLength(2);
  });

  it("does nothing when the person closes the file picker", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(open).mockResolvedValueOnce(null as never);
    await wrapper.get(".source > button:first-child").trigger("click");
    await flushPromises();
    expect(packageScriptCalls(invoke)).toHaveLength(0);
    expect(wrapper.find(".picked").exists()).toBe(false);
  });

  it("goes back to the launchers of the project, and clears the ticks", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/packages/web/package.json", WEB_SCRIPTS);
    await wrapper.get("input[type=checkbox]").setValue(true);
    await wrapper.get(".source button:last-child").trigger("click");
    expect(wrapper.find(".picked").exists()).toBe(false);
    expect(wrapper.text()).toContain("pnpm install");
    expect(wrapper.get("button[type=submit]").attributes("disabled")).toBeDefined();
  });

  it("says that the picked package.json has no launcher left to import", async () => {
    const { wrapper } = await mountImportLaunchersModal();
    await pickPackageJson(wrapper, "/Users/me/webwork/heidrun/web/package.json", []);
    expect(wrapper.text()).toContain("This package.json has no launcher left to import.");
  });
});
