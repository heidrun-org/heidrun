import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import paneCardSource from "./PaneCard.vue?raw";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
// The terminal needs a real browser (xterm, the colour scheme query): the pane header is the subject of these tests.
vi.mock("./TerminalView.vue", () => ({ default: { template: "<div></div>" } }));

const LONG_NAME = "jetienne@Jeromes-Macbook-Pro:~/webwork/heidrun";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** The declarations of the style rule of `selector`, in the style block of the component PaneCard. */
function styleRule(selector: string): string {
  const style = paneCardSource.slice(paneCardSource.indexOf("<style"));
  const escaped = selector.replace(/[.]/g, "\\.");
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(style);
  expect(match, `the style rule ${selector}`).not.toBeNull();
  return match![1];
}

async function mountPaneCard(paneFields: Record<string, unknown> = {}) {
  const { default: PaneCard } = await import("./PaneCard.vue");
  return mount(PaneCard, {
    props: {
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
    global: { stubs: { PromptMenu: true } },
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

  it("keeps the terminal title as the name of a shell pane while a command runs", async () => {
    const wrapper = await mountPaneCard({
      label: null,
      terminal_title_stripped: "npm run dev",
      cwd: "/Users/jetienne/webwork/heidrun",
    });
    expect(wrapper.get(".name").text()).toBe("npm run dev");
  });
});
