import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick, type Ref } from "vue";
import MacroMenu from "./MacroMenu.vue";
import { hardCodedMacros, macros, projectMacros, type Macro } from "../stores/macros";
import { t } from "../i18n/index";

vi.mock("../stores/macros", async () => {
  const { reactive, ref } = await import("vue");
  return {
    macros: reactive({ personal: [] }),
    hardCodedMacros: ref([]),
    projectMacros: ref([]),
    macroEditor: reactive({ open: false }),
    resolveMacroVariables: vi.fn(async (text: string) => text),
  };
});
vi.mock("../stores/session", () => ({ insertText: vi.fn(async () => {}) }));

const personalMacro: Macro = { id: "own", label: "Own macro", description: "", text: "Own text" };
const hardCodedMacro: Macro = { id: "fixed", label: "Fixed macro", description: "A description", text: "Fixed text" };
const projectMacro: Macro = { id: "projet-0", label: "Project macro", description: "", text: "Project text" };

let wrapper: VueWrapper;

/** Mounts the macro menu, then opens it with a click on its button. */
async function openMenu(): Promise<HTMLElement> {
  wrapper = mount(MacroMenu, { props: { paneId: "pane_1" }, attachTo: document.body });
  await wrapper.get("button.tool").trigger("click");
  await nextTick();
  return document.body.querySelector<HTMLElement>(".menu")!;
}

/** The class names of the direct children of the menu, in order, for the parts that make its shape. */
function shapeOf(menu: HTMLElement): string[] {
  return [...menu.children].map((child) => {
    if (child.classList.contains("menu-divider")) {
      return "divider";
    }
    if (child.classList.contains("menu-header")) {
      return `header:${child.textContent}`;
    }
    const name = child.querySelector(".fw-medium")?.textContent ?? child.textContent!.trim();
    const description = child.querySelector("small")?.textContent;
    return description === undefined ? `item:${name}` : `item:${name}|${description}`;
  });
}

beforeEach(() => {
  macros.personal = [];
  (hardCodedMacros as unknown as Ref<Macro[]>).value = [];
  (projectMacros as unknown as Ref<Macro[]>).value = [];
});

afterEach(() => {
  wrapper.unmount();
});

describe("the macro menu", () => {
  it("puts a separator between two groups of macros, and shows the title of each group", async () => {
    macros.personal = [personalMacro];
    (hardCodedMacros as unknown as Ref<Macro[]>).value = [hardCodedMacro];
    const menu = await openMenu();
    expect(shapeOf(menu)).toEqual([
      `header:${t("macroMenu.personal")}`,
      "item:Own macro",
      "divider",
      `header:${t("macroMenu.hardCoded")}`,
      "item:Fixed macro|A description",
      "divider",
      `item:${t("macroMenu.edit")}`,
    ]);
  });

  it("puts a separator between each pair of groups when the project has macros too", async () => {
    (projectMacros as unknown as Ref<Macro[]>).value = [projectMacro];
    macros.personal = [personalMacro];
    (hardCodedMacros as unknown as Ref<Macro[]>).value = [hardCodedMacro];
    const menu = await openMenu();
    expect(shapeOf(menu).filter((part) => part === "divider")).toHaveLength(3);
  });

  it("shows no title and no separator between groups when only one group has macros", async () => {
    (hardCodedMacros as unknown as Ref<Macro[]>).value = [hardCodedMacro];
    const menu = await openMenu();
    expect(shapeOf(menu)).toEqual(["item:Fixed macro|A description", "divider", `item:${t("macroMenu.edit")}`]);
  });

  it("ends with the item Edit, with no hint line under it", async () => {
    macros.personal = [personalMacro];
    const menu = await openMenu();
    expect(menu.lastElementChild!.textContent!.trim()).toBe(t("macroMenu.edit"));
    expect(t("macroMenu.edit")).toMatch(/^[^ .…]+$/);
    expect(menu.querySelector(".menu-text")).toBeNull();
  });

  it("writes the name of a macro in a larger font than its description, with the description under the name", async () => {
    (hardCodedMacros as unknown as Ref<Macro[]>).value = [hardCodedMacro];
    const menu = await openMenu();
    const name = menu.querySelector(".fw-medium")!;
    const description = menu.querySelector("small")!;
    expect(name.textContent).toBe("Fixed macro");
    expect(description.textContent).toBe("A description");
    expect(name.parentElement).toBe(description.parentElement);
    expect(name.parentElement!.classList.contains("flex-column")).toBe(true);
  });
});
