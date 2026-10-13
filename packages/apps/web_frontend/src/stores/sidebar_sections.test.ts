import { beforeEach, describe, expect, it } from "vitest";
import { settings } from "./settings";
import { openSidebarSection } from "./sidebar_sections";

beforeEach(() => {
  settings.leftOpen = true;
  settings.rightOpen = true;
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
});
