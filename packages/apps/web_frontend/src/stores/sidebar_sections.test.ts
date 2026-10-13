import { beforeEach, describe, expect, it } from "vitest";
import { settings } from "./settings";
import { openSidebarSection } from "./sidebar_sections";

beforeEach(() => {
  settings.leftOpen = true;
  settings.rightOpen = true;
  settings.leftCollapsed = false;
  settings.rightCollapsed = false;
  settings.leftSidebarSection = "actions";
  settings.rightSidebarSection = "notes";
});

describe("openSidebarSection", () => {
  it.each(["actions", "git"] as const)("shows the sidebar section %s in the left sidebar", (sidebarSection) => {
    openSidebarSection(sidebarSection);
    expect(settings.leftSidebarSection).toBe(sidebarSection);
  });

  it.each(["actions", "git"] as const)("shows the left sidebar when it is hidden and the sidebar section is %s", (sidebarSection) => {
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
    openSidebarSection("git");
    expect(settings.rightOpen).toBe(false);
    expect(settings.rightSidebarSection).toBe("notes");
    settings.leftOpen = false;
    openSidebarSection("notes");
    expect(settings.leftOpen).toBe(false);
    expect(settings.leftSidebarSection).toBe("git");
    openSidebarSection("toHandle");
    expect(settings.leftOpen).toBe(false);
    expect(settings.leftSidebarSection).toBe("git");
  });

  it.each(["actions", "git"] as const)("expands the collapsed left sidebar when the sidebar section is %s", (sidebarSection) => {
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
