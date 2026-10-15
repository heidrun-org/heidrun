import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the window Search, with the options that the settings store holds at this start of the application. */
async function mountSearchModal() {
  const { default: SearchModal } = await import("./SearchModal.vue");
  const wrapper = mount(SearchModal, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/** The three checkboxes of the window Search, in the order of the screen: this workspace, agents only, regex. */
function checkboxesOf(wrapper: Awaited<ReturnType<typeof mountSearchModal>>) {
  return wrapper.findAll<HTMLInputElement>('input[type="checkbox"]');
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  document.body.innerHTML = "";
});

describe("the options of the window Search", () => {
  it("are all unchecked at the first start", async () => {
    const wrapper = await mountSearchModal();
    expect(checkboxesOf(wrapper).map((checkbox) => checkbox.element.checked)).toEqual([false, false, false]);
  });

  it("keep their last state after the application restarts", async () => {
    const wrapper = await mountSearchModal();
    const [thisWorkspace, agentsOnly, regex] = checkboxesOf(wrapper);
    await thisWorkspace.setValue(true);
    await regex.setValue(true);
    expect(agentsOnly.element.checked).toBe(false);
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").searchRegex).toBe(true));
    wrapper.unmount();

    vi.resetModules();
    const restartedWrapper = await mountSearchModal();
    expect(checkboxesOf(restartedWrapper).map((checkbox) => checkbox.element.checked)).toEqual([true, false, true]);
  });
});
