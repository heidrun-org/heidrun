import { settings, type LeftSidebarSection, type RightSidebarSection } from "./settings";

/**
 * Shows a sidebar section. The sidebar that holds the sidebar section opens if it is hidden, and shows the sidebar
 * section. The Scripts and Git sidebar sections belong to the left sidebar. The Pane and Notes sidebar sections
 * belong to the right sidebar.
 */
export function openSidebarSection(sidebarSection: LeftSidebarSection | RightSidebarSection) {
  if (sidebarSection === "actions" || sidebarSection === "git") {
    settings.leftOpen = true;
    settings.leftSidebarSection = sidebarSection;
    return;
  }
  settings.rightOpen = true;
  settings.rightSidebarSection = sidebarSection;
}
