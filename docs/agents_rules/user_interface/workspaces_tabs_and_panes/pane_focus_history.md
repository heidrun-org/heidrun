# User interface of Heidrun: pane focus history

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [Glossary of Heidrun: pane focus history](../../glossary/pane_focus_history.md), [Panes](panes.md), [Layout of the window](../window/layout.md)
- Related issue: [issue 380](https://github.com/heidrun-org/heidrun/issues/380)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md) and in [glossary/pane_focus_history.md](../../glossary/pane_focus_history.md).

## Pane focus history

- Heidrun keeps one pane focus history for the whole window. It holds the panes that had the focus, in order, from every workspace and every tab, with one current entry. It lives in memory: it is empty again when Heidrun starts.
- A pane gets the focus when the developer clicks the pane, selects a tab or a workspace, or opens a pane from a search result or from a card of the Needs you sidebar section. Each of these changes the pane that has the keyboard, and the history follows it. A click on a pinned pane gives the focus to the pinned pane without leaving the selected tab.
- Heidrun records a pane only when the pane keeps the focus for 500 milliseconds. A pane that the developer only passes through is not recorded, so the history does not fill with noise. A press on the Back button, on the Forward button, or on an entry of the list records the pane that has the focus before the move, so the move can return to it.
- A pane that gets the focus when it is already the current entry changes nothing.
- A new focus after a move back removes the entries after the current entry, as a web browser does.
- The history keeps at most 50 entries. The oldest entry goes first.
- A pane that the developer closes leaves the history: all its entries are removed. Two entries of the same pane that become neighbours become one entry. When the current entry goes, the current entry becomes the nearest entry before it.

## The Back button and the Forward button

- The two buttons sit at the very top of the window, in the top bar, just on the left of the search button. The Back button is first, with an arrow that points left. The Forward button is second, with an arrow that points right.
- A click on the Back button gives the focus to the pane of the entry before the current entry. A click on the Forward button gives the focus to the pane of the entry after the current entry. Heidrun selects the workspace and the tab of that pane, as a click on the pane does.
- The Back button is disabled when no entry exists before the current entry. The Forward button is disabled when no entry exists after the current entry.
- A press that lasts 500 milliseconds opens a list of entries under the button. The list of the Back button holds the entries before the current entry, the nearest first. The list of the Forward button holds the entries after the current entry, the nearest first. A press on a disabled button opens nothing.
- Each row of the list shows the name of the pane, with its workspace and its tab. A click on a row gives the focus to the pane of that entry, and closes the list. The list also closes on a click outside, and on the key Escape.
- The click that ends a long press does not move in the history.
- The keys ⌘[ and ⌘] do the same as a click on the Back button and on the Forward button, as in Chrome on macOS. Heidrun matches the characters "[" and "]", not the place of the keys, so a French keyboard works. The file explorer keeps the two keys for its editor.
- The history of Back and Forward is a navigation inside the panes, like "Go Back" and "Go Forward" in a code editor. It never closes, opens, moves, or changes a pane.

## Files

- The pure rules of the history are in `packages/apps/web_frontend/src/lib/pane_focus_history.ts`.
- The record of the focus and the moves are in `packages/apps/web_frontend/src/stores/pane_focus_history.ts`.
- The two buttons and the list are in `packages/apps/web_frontend/src/components/PaneFocusHistoryButton.vue`. The top bar, `TopBar.vue`, shows them.
