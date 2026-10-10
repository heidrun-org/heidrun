import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("./TerminalView.vue", () => ({ default: { render: () => null } }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    renamePane: vi.fn(async () => ({})),
  };
});

const SNAPSHOT = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" }],
  panes: [{ pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent_status: "unknown" }],
  agents: [],
  tabs: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** Mounts the sidebar and the pane card of the same pane, as the application shows them together. */
async function mountBoth() {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const { default: Sidebar } = await import("./Sidebar.vue");
  const { default: PaneCard } = await import("./PaneCard.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  const sidebar = mount(Sidebar);
  const card = mount(PaneCard, {
    props: { pane: session.allPanes.value[0] },
  });
  return { session, api, sidebar, card };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("rename of a visible pane", () => {
  it("shows exactly one rename field when the rename starts in the sidebar", async () => {
    const { session, sidebar, card } = await mountBoth();
    session.startRename("pane", "p1", "sidebar");
    await flushPromises();
    expect(sidebar.findAll("input.rename")).toHaveLength(1);
    expect(card.findAll("input.rename")).toHaveLength(0);
  });

  it("shows exactly one rename field when the rename starts in the pane card", async () => {
    const { session, sidebar, card } = await mountBoth();
    session.startRename("pane", "p1", "card");
    await flushPromises();
    expect(sidebar.findAll("input.rename")).toHaveLength(0);
    expect(card.findAll("input.rename")).toHaveLength(1);
  });

  it("starts the rename in the sidebar by default", async () => {
    const { session } = await mountBoth();
    session.startRename("pane", "p1");
    expect(session.state.renamingPlace).toBe("sidebar");
  });

  it("saves the new name typed in the sidebar field", async () => {
    const { session, api, sidebar } = await mountBoth();
    session.startRename("pane", "p1", "sidebar");
    await flushPromises();
    const input = sidebar.get("input.rename");
    await input.setValue("my terminal");
    await input.trigger("keydown.enter");
    await flushPromises();
    expect(api.renamePane).toHaveBeenCalledWith("p1", "my terminal");
    expect(session.state.renaming).toBeNull();
  });

  it("saves the new name typed in the pane card field", async () => {
    const { session, api, card } = await mountBoth();
    session.startRename("pane", "p1", "card");
    await flushPromises();
    const input = card.get("input.rename");
    await input.setValue("my terminal");
    await input.trigger("keydown.enter");
    await flushPromises();
    expect(api.renamePane).toHaveBeenCalledWith("p1", "my terminal");
  });
});
