import { beforeEach, describe, expect, it } from "vitest";
import { settings } from "./settings";
import { clickSidebarSectionIcon, openSidebarSection } from "./sidebar_sections";

beforeEach(() => {
  settings.leftOpen = true;
  settings.rightOpen = true;
  settings.leftCollapsed = false;
  settings.rightCollapsed = false;
  settings.leftSidebarSection = "actions";
  settings.rightSidebarSection = "notes";
});

describe("openSidebarSection", () => {
  it.each(["actions", "sourceControl"] as const)("shows the sidebar section %s in the left sidebar", (sidebarSection) => {
    openSidebarSection(sidebarSection);
    expect(settings.leftSidebarSection).toBe(sidebarSection);
  });

  it.each(["actions", "sourceControl"] as const)("shows the left sidebar when it is hidden and the sidebar section is %s", (sidebarSection) => {
    settings.leftOpen = false;
    openSidebarSection(sidebarSection);
    expect(settings.leftOpen).toBe(true);
  });

  it.each(["toHandle", "notes", "chats"] as const)("shows the sidebar section %s in the right sidebar", (sidebarSection) => {
    openSidebarSection(sidebarSection);
    expect(settings.rightSidebarSection).toBe(sidebarSection);
  });

  it.each(["toHandle", "notes", "chats"] as const)("shows the right sidebar when it is hidden and the sidebar section is %s", (sidebarSection) => {
    settings.rightOpen = false;
    openSidebarSection(sidebarSection);
    expect(settings.rightOpen).toBe(true);
  });

  it("does not show a hidden sidebar that holds another sidebar section, and does not change its sidebar section", () => {
    settings.rightOpen = false;
    openSidebarSection("sourceControl");
    expect(settings.rightOpen).toBe(false);
    expect(settings.rightSidebarSection).toBe("notes");
    settings.leftOpen = false;
    openSidebarSection("notes");
    expect(settings.leftOpen).toBe(false);
    expect(settings.leftSidebarSection).toBe("sourceControl");
    openSidebarSection("toHandle");
    expect(settings.leftOpen).toBe(false);
    expect(settings.leftSidebarSection).toBe("sourceControl");
  });

  it.each(["actions", "sourceControl"] as const)("expands the collapsed left sidebar when the sidebar section is %s", (sidebarSection) => {
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    openSidebarSection(sidebarSection);
    expect(settings.leftCollapsed).toBe(false);
    expect(settings.rightCollapsed).toBe(true);
  });

  it.each(["toHandle", "notes", "chats"] as const)("expands the collapsed right sidebar when the sidebar section is %s", (sidebarSection) => {
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    openSidebarSection(sidebarSection);
    expect(settings.rightCollapsed).toBe(false);
    expect(settings.leftCollapsed).toBe(true);
  });
});

describe("clickSidebarSectionIcon", () => {
  it.each([
    ["actions", "leftCollapsed"],
    ["notes", "rightCollapsed"],
  ] as const)("collapses the expanded sidebar that shows the sidebar section %s", (sidebarSection, collapsedName) => {
    clickSidebarSectionIcon(sidebarSection);
    expect(settings[collapsedName]).toBe(true);
  });

  it.each([
    ["sourceControl", "leftCollapsed", "leftSidebarSection"],
    ["chats", "rightCollapsed", "rightSidebarSection"],
  ] as const)("shows the sidebar section %s when the sidebar shows another one", (sidebarSection, collapsedName, sectionName) => {
    clickSidebarSectionIcon(sidebarSection);
    expect(settings[collapsedName]).toBe(false);
    expect(settings[sectionName]).toBe(sidebarSection);
  });

  it.each([
    ["actions", "leftCollapsed", "leftSidebarSection"],
    ["notes", "rightCollapsed", "rightSidebarSection"],
  ] as const)("expands the collapsed sidebar to the sidebar section %s", (sidebarSection, collapsedName, sectionName) => {
    settings[collapsedName] = true;
    clickSidebarSectionIcon(sidebarSection);
    expect(settings[collapsedName]).toBe(false);
    expect(settings[sectionName]).toBe(sidebarSection);
  });

  it("does not change the other sidebar", () => {
    clickSidebarSectionIcon("actions");
    expect(settings.rightCollapsed).toBe(false);
    clickSidebarSectionIcon("notes");
    expect(settings.leftCollapsed).toBe(true);
  });
});
