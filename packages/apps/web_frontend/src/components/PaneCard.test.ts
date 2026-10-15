import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import paneCardSource from "./PaneCard.vue?raw";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
// The terminal needs a real browser (xterm, the colour scheme query): the pane header is the subject of these tests.
vi.mock("./TerminalView.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    closePane: vi.fn(async () => ({})),
  };
});

const LONG_NAME = "jetienne@Jeromes-Macbook-Pro:~/webwork/heidrun";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** The declarations of the style rule of `selector`, in the style block of the component PaneCard. */
function styleRule(selector: string): string {
  const style = paneCardSource.slice(paneCardSource.indexOf("<style"));
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(style);
  expect(match, `the style rule ${selector}`).not.toBeNull();
  return match![1];
}

async function mountPaneCard(
  paneFields: Record<string, unknown> = {},
  isInColumnOfPinnedPanes = false,
  extraProps: Record<string, unknown> = {},
) {
  const { default: PaneCard } = await import("./PaneCard.vue");
  return mount(PaneCard, {
    props: {
      isInColumnOfPinnedPanes,
      ...extraProps,
      pane: {
        pane_id: "w1:p1",
        terminal_id: "t1",
        workspace_id: "w1",
        tab_id: "w1:t1",
        focused: false,
        agent_status: "unknown",
        revision: 1,
        label: LONG_NAME,
        ...paneFields,
      },
    },
    global: { stubs: { MacroMenu: true } },
  });
}

describe("PaneCard", () => {
  it("lets the name get narrower than its text and ends it with an ellipsis, so it never runs under the buttons", () => {
    const rule = styleRule(".name");
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("overflow: hidden");
    expect(rule).toContain("text-overflow: ellipsis");
    expect(rule).toContain("white-space: nowrap");
  });

  it("does not let the buttons get narrower", () => {
    expect(styleRule(".tools")).toContain("flex-shrink: 0");
  });

  it("shows the whole name in the tooltip of the name, with the way to rename it", async () => {
    const wrapper = await mountPaneCard();
    expect(wrapper.get(".name").text()).toBe(LONG_NAME);
    expect(wrapper.get(".name").attributes("title")).toBe(`${LONG_NAME} · Double-click to rename`);
  });

  it("names a shell pane without a label after its folder, and shows the full folder path once, without the pane identifier", async () => {
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: LONG_NAME,
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".name").text()).toBe("heidrun");
    expect(wrapper.get(".sub").text()).toBe("~/webwork/heidrun");
  });

  it("shows the Git branch of the folder before the folder path in the header of a shell pane", async () => {
    const { git } = await import("../stores/git");
    git.branchByFolder["/Users/jetienne/webwork/heidrun"] = "dev_jerome";
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: LONG_NAME,
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".sub").text()).toBe("dev_jerome · ~/webwork/heidrun");
  });

  it("keeps the terminal title as the name of a shell pane while a command runs", async () => {
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: "npm run dev",
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".name").text()).toBe("npm run dev");
  });

  it("shows the pressed pin button in the header of a pane of the column of pinned panes, and no close button", async () => {
    const wrapper = await mountPaneCard({}, true);
    const unpinButton = wrapper.get("button[aria-label='Unpin the pane']");
    expect(unpinButton.attributes("aria-pressed")).toBe("true");
    expect(unpinButton.classes()).toContain("on");
    expect(unpinButton.find(".bi-pin-fill").exists()).toBe(true);
    expect(wrapper.find(".bi-x-lg").exists()).toBe(false);
    expect(wrapper.find("button[title='Go to its tab']").exists()).toBe(true);
  });

  it("unpins the pane of the column of pinned panes when the pressed pin button is clicked", async () => {
    const { settings } = await import("../stores/settings");
    settings.pinnedPanes = ["w1:p1"];
    const wrapper = await mountPaneCard({}, true);
    await wrapper.get("button[aria-label='Unpin the pane']").trigger("click");
    expect(settings.pinnedPanes).toEqual([]);
  });

  it("is the selected pane in the column of pinned panes when it is the selected pane of the selected tab", async () => {
    const { state } = await import("../stores/session");
    const { pinnedPaneState } = await import("../stores/pinned_panes");
    state.selectedPaneId = "w1:p1";
    pinnedPaneState.focus = null;
    const wrapper = await mountPaneCard({}, true);
    expect(wrapper.get("section").classes()).toContain("selected");
  });

  it("is not the selected pane in the column of pinned panes when another pinned pane has the keyboard", async () => {
    const { state } = await import("../stores/session");
    const { pinnedPaneState } = await import("../stores/pinned_panes");
    state.selectedPaneId = "w1:p1";
    // The store gives the keyboard back to the grid when the selected pane changes: wait for that, then pin the focus.
    await nextTick();
    pinnedPaneState.focus = "w1:p2";
    const wrapper = await mountPaneCard({}, true);
    expect(wrapper.get("section").classes()).not.toContain("selected");
  });

  it("gives the header of the selected pane a tinted background, in the grid and in the column of pinned panes", () => {
    expect(styleRule(".pane.several-panes.selected:not(.blocked) .head")).toContain("background: var(--pane-head-selected)");
    expect(styleRule(".pane.in-column-of-pinned-panes.several-panes.selected:not(.blocked) .head")).toContain(
      "background: var(--pane-head-selected)",
    );
  });

  it("dims the name and the folder in the header of a pane that is not selected and not blocked", () => {
    expect(styleRule(".pane.several-panes:not(.selected):not(.blocked) .name")).toContain("color: var(--muted)");
    expect(styleRule(".pane.several-panes:not(.selected):not(.blocked) .sub")).toContain("color: var(--faint)");
  });

  it("never tints the header of a blocked pane, so that it keeps its red header", () => {
    expect(paneCardSource).not.toMatch(/\.pane\.several-panes\.selected \.head \{/);
    expect(styleRule(".pane.blocked .head")).toContain("background: var(--tint-err)");
  });

  it("has no highlight when the viewport shows one pane", async () => {
    const { state } = await import("../stores/session");
    state.snapshot = { panes: [{ pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1" }] } as never;
    state.selectedTabId = "w1:t1";
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).not.toContain("several-panes");
  });

  it("has the highlight when the selected tab has two panes", async () => {
    const { state } = await import("../stores/session");
    state.snapshot = {
      panes: [
        { pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1" },
        { pane_id: "w1:p2", tab_id: "w1:t1", workspace_id: "w1" },
      ],
    } as never;
    state.selectedTabId = "w1:t1";
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).toContain("several-panes");
  });

  it("has the highlight when the selected tab has one pane and a pinned pane of another tab is in the column", async () => {
    const { state } = await import("../stores/session");
    const { settings } = await import("../stores/settings");
    state.snapshot = {
      panes: [
        { pane_id: "w1:p1", tab_id: "w1:t1", workspace_id: "w1" },
        { pane_id: "w1:p9", tab_id: "w1:t2", workspace_id: "w1" },
      ],
    } as never;
    state.selectedTabId = "w1:t1";
    settings.pinnedPanes = ["w1:p9"];
    const wrapper = await mountPaneCard();
    expect(wrapper.get("section").classes()).toContain("several-panes");
  });
});

describe("PaneCard usage wheel", () => {
  const WITH_CONTEXT = { agent: "claude", tokens: { hd_ctx: 7, hd_ctx_size: 200_000 } };

  it("shows the context window as a usage wheel, with no word, no bar, and no number beside it", async () => {
    const wrapper = await mountPaneCard(WITH_CONTEXT);
    expect(wrapper.find(".head .usage-wheel").exists()).toBe(true);
    expect(wrapper.find(".head .gauge").exists()).toBe(false);
    expect(wrapper.get(".head").text()).not.toContain("context");
    expect(wrapper.get(".head").text()).not.toContain("%");
  });

  it("shows no usage wheel when the program does not know the context window", async () => {
    const wrapper = await mountPaneCard();
    expect(wrapper.find(".usage-wheel").exists()).toBe(false);
  });

  it("opens the information card of the usage wheel on a click, with the tokens and the size", async () => {
    const wrapper = await mountPaneCard(WITH_CONTEXT);
    expect(wrapper.find(".popover").exists()).toBe(false);
    await wrapper.get(".information-card-part").trigger("click");
    expect(wrapper.get("[data-field=percent]").text()).toContain("7 %");
    expect(wrapper.get("[data-field=used]").text()).toContain("14,000 tokens");
    expect(wrapper.get("[data-field=size]").text()).toContain("200,000 tokens");
  });

  it("puts the pane that holds the open card above the next panes, so that no pane hides the card", () => {
    expect(styleRule(".pane:has(.information-card-part.is-open)")).toContain("z-index: 3");
  });
});

describe("PaneCard close", () => {
  // The store of the settings saves itself in the local storage, so the value of the previous test comes back: reset it.
  // The mocked function `closePane` keeps the calls of the previous test: clear them.
  beforeEach(async () => {
    vi.clearAllMocks();
    const { settings } = await import("../stores/settings");
    settings.confirmPaneClose = true;
  });

  it("closes the pane at once, without the confirmation dialog, when the setting confirmPaneClose is off", async () => {
    const { settings } = await import("../stores/settings");
    settings.confirmPaneClose = false;
    const wrapper = await mountPaneCard();
    const { confirmDialog } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    await flushPromises();
    expect(confirmDialog.open).toBe(false);
    expect(api.closePane).toHaveBeenCalledWith("w1:p1");
  });

  it("asks for confirmation before it closes the pane, and does not close before the answer", async () => {
    const wrapper = await mountPaneCard();
    const { confirmDialog } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the pane (⌘W)");
    expect(api.closePane).not.toHaveBeenCalled();
  });

  it("closes the pane after the user confirms, and does not close it when the user cancels", async () => {
    const wrapper = await mountPaneCard();
    const { answerConfirm } = await import("../stores/confirm");
    const api = await import("../lib/api");
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closePane).not.toHaveBeenCalled();
    await wrapper.get("button[aria-label='Close the pane (⌘W)']").trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closePane).toHaveBeenCalledWith("w1:p1");
  });
});
