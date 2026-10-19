# User interface of Heidrun: panes

- Created: 13 October 2026
- Last updated: 19 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md)
- Related issue: [issue 326](https://github.com/heidrun-org/heidrun/issues/326), [issue 428](https://github.com/heidrun-org/heidrun/issues/428), [issue 465](https://github.com/heidrun-org/heidrun/issues/465), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 636](https://github.com/heidrun-org/heidrun/issues/636), [issue 688](https://github.com/heidrun-org/heidrun/issues/688), [issue 690](https://github.com/heidrun-org/heidrun/issues/690), [issue 712](https://github.com/heidrun-org/heidrun/issues/712)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Panes

The rules of the pane header are in [pane_headers.md](pane_headers.md).

- A tab with one pane shows one terminal over the whole viewport.
- A tab with several panes shares the viewport between its panes.
- The panes are not cards. The frame of the viewport has no padding, so a pane at the edge of the viewport touches the border of the viewport: the border of the viewport is the only line there, with no gap and no second border. A pane has no rounded corner. A pane that touches a corner of the viewport follows the rounded corner of the viewport, because the frame of the viewport clips it. The top corners of the viewport belong to the tab bar, so no pane touches them ([issue #326](https://github.com/heidrun-org/heidrun/issues/326)).
- Two panes that touch have one thin line between them and no gap, as in VS Code. This holds for two panes side by side, for two panes one above the other, for three panes that meet, and for the pinned panes in the column of pinned panes. The line is the 1 pixel border of the panes: a pane that has a neighbour on its left or above it starts 1 pixel early, so the borders of two panes make one line, and every pane ends exactly at the edge of its share. The developer grabs the line to change the size of the panes. The place to grab is as wide as the gap between the viewport and a sidebar (`--pane-gap`), and it shows a color while the pointer is over it. The line is never a gap, and no corner of a pane is rounded where lines meet.
- The border of the panes goes 1 pixel past the frame of the viewport on its left, on its right, and at its bottom, so the frame clips it. At the top, the border of the panes is the line under the tab bar. The ring of the selected pane and the ring of a blocked pane have the color of the state. At the top, the ring is the top border of the pane, so that it joins the selected tab. On the left, on the right, and at the bottom, the ring is drawn just inside the border of the pane, so that it also shows at the edge of the viewport, where the frame hides the border ([issue #326](https://github.com/heidrun-org/heidrun/issues/326)).
- A click on a pane gives the focus to that pane. Heidrun remembers the panes that had the focus: see [pane_focus_history.md](pane_focus_history.md).
- The header of a pane has two split buttons, "Split right" and "Split down". A plain click on a split button splits the pane and starts the default command of a new tab, the option `newTabCommand` of the settings, in the new pane. With a coding agent, the new pane starts a free coding agent, the same as the plus button of the tab bar, and the tab keeps its name. A shift click on a split button splits the pane and starts a terminal in the new pane. The shortcuts Command+D and Shift+Command+D, and the entries "Split to the right" and "Split to the bottom" of the command palette, do the same as a plain click ([issue 465](https://github.com/heidrun-org/heidrun/issues/465), [issue 688](https://github.com/heidrun-org/heidrun/issues/688)).
- Every pane has a toggle button in its header that shows and hides that pane's composition bar: see [composition_bar.md](composition_bar.md).
- A click on the pin button in the header of a pane pins the pane. A pinned pane goes into the column of pinned panes.
- The column of pinned panes sits at the right edge of the viewport, beside the panes of the selected tab. It shows every pinned pane in every tab, the tab of the pinned pane included. Its width is the same in every tab, so a pinned pane keeps the same width in every tab.
- The panes of the selected tab that are not pinned fill the width that the column leaves. A tab whose panes are all pinned shows the same picture as an empty tab.
- The header of a pinned pane in the column shows the pressed pin button, as in the panes of the selected tab. A click on the pressed pin button unpins the pane.
- A pinned pane does not change when the developer selects another tab or another workspace. Only the panes of the selected tab change.

## Colors of Codex

- Codex chooses its light colors or its dark colors from the text color and the background color of the pane. It asks for both colors once, when it starts. When one of the two answers is missing, Codex keeps its dark colors, which cannot be read on a light background ([issue 636](https://github.com/heidrun-org/heidrun/issues/636)).
- Heidrun attaches to a pane with `herdr terminal attach`, which leaves these two questions to the pane, so Herdr answers only with the colors that the shell of the pane set before. Every command of Heidrun that starts Codex therefore sets both colors first, with one `printf` in the shell. The commands are the new tab, the resume of a chat, and a launcher whose command starts with `codex`. The `printf` sends the two terminal commands `OSC 10` (the text color) and `OSC 11` (the background color). OSC means Operating System Command. A command that does not start Codex gets no `printf`.
- The two colors are the text color and the background color of the terminal view in the theme that Heidrun uses at that moment. They come from `terminal_themes.ts`, the file that the terminal view draws with, so Codex chooses its colors for the very background that the developer sees. The code of this rule is in `terminal_colors.ts`.
- A Codex that already runs keeps its colors when the developer changes the theme, because Codex asks for the colors only once. The developer restarts Codex, or resumes the chat, to get the colors of the new theme. A Codex that the developer starts by hand in a pane gets no colors from Heidrun, so it keeps its dark colors.
- The command `/theme` of Codex changes only the colors of the code. It is not needed: Codex picks its light code theme on a light background by itself.
- The tests are in `terminal_colors.test.ts` and in `agents_codex_colors.test.ts`.

## Needs you

- The Needs you sidebar section is a sidebar section of the right sidebar. It holds one card for each agent that is blocked, that asks a question, or that has finished, with the blocked agents first.
- The Needs you sidebar section shows the title "Needs you" at its top, above the cards and above the message "No agent is blocked, no agent has finished, and no agent asks a question." The title has 12 pixels above it and 14 pixels at its left, the same space as the title of the Past chats sidebar section.
- A click on a card shows the pane of the agent. A card also lets the developer answer a blocked agent, pin the pane, and hide the card.
- The button of the Needs you sidebar section shows the number of cards. The number is red when an agent is blocked.
- A hidden card comes back at the next change of the agent. A finished agent leaves the sidebar section after the delay that the settings give.
- The list of all the workspaces sits at the bottom of the sidebar section, under the cards, when the option `showWorkspacesInNeedsYou` is on (the default). The rules are in [needs_you_workspaces.md](../sidebars/needs_you_workspaces.md) ([issue 417](https://github.com/heidrun-org/heidrun/issues/417)).

