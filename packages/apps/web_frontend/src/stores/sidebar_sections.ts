import { settings, type LeftSidebarSection, type RightSidebarSection } from "./settings";

/** The width of a collapsed sidebar, in px, borders included: the sidebar icon bar alone. */
export const COLLAPSED_SIDEBAR_WIDTH = 48;

/** One button of the sidebar icon bar of a sidebar: one sidebar section. */
export type SidebarSectionButton = {
  /** The identifier of the sidebar section. */
  id: string;
  /** The title of the sidebar section. */
  label: string;
  /** The name of the Bootstrap icon of the sidebar section, without the prefix `bi-`. */
  icon: string;
  /** The number on the button. A badge of 0 shows no number. */
  badge: number;
  /** The number has the color of the working status. */
  isLive?: boolean;
  /** The number has the color of the blocked status. */
  isAlert?: boolean;
};

/**
 * Shows a sidebar section. The sidebar that holds the sidebar section opens if it is hidden, expands if it is collapsed
 * to the sidebar icon bar, and shows the sidebar section. The Scripts and Git sidebar sections belong to the left
 * sidebar. The Needs you, Notes, and Chats sidebar sections belong to the right sidebar.
 */
export function openSidebarSection(sidebarSection: LeftSidebarSection | RightSidebarSection) {
  if (sidebarSection === "actions" || sidebarSection === "git") {
    settings.leftOpen = true;
    settings.leftCollapsed = false;
    settings.leftSidebarSection = sidebarSection;
    return;
  }
  settings.rightOpen = true;
  settings.rightCollapsed = false;
  settings.rightSidebarSection = sidebarSection;
}

/**
 * Answers a click on the icon of a sidebar section in the sidebar icon bar. A click on the icon of the sidebar section
 * that an expanded sidebar shows collapses the sidebar. A click on any other icon shows that sidebar section.
 */
export function clickSidebarSectionIcon(sidebarSection: LeftSidebarSection | RightSidebarSection) {
  const isLeft = sidebarSection === "actions" || sidebarSection === "git";
  if (isLeft && settings.leftCollapsed === false && settings.leftSidebarSection === sidebarSection) {
    settings.leftCollapsed = true;
    return;
  }
  if (isLeft === false && settings.rightCollapsed === false && settings.rightSidebarSection === sidebarSection) {
    settings.rightCollapsed = true;
    return;
  }
  openSidebarSection(sidebarSection);
}
