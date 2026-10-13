# User interface of Heidrun: panes

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)
- Related issue: [issue 326](https://github.com/heidrun-org/heidrun/issues/326)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Panes

- A tab with one pane shows one terminal over the whole viewport.
- A tab with several panes shares the viewport between its panes.
- The panes are not cards. The frame of the viewport has no padding, so a pane at the edge of the viewport touches the border of the viewport: the border of the viewport is the only line there, with no gap and no second border. A pane has no rounded corner. A pane that touches a corner of the viewport follows the rounded corner of the viewport, because the frame of the viewport clips it. The top corners of the viewport belong to the tab bar, so no pane touches them ([issue #326](https://github.com/heidrun-org/heidrun/issues/326)).
- Two panes that touch have one thin line between them and no gap, as in VS Code. This holds for two panes side by side, for two panes one above the other, for three panes that meet, and for the pinned panes in the column of pinned panes. The line is the 1 pixel border of the panes: a pane that has a neighbour on its left or above it starts 1 pixel early, so the borders of two panes make one line, and every pane ends exactly at the edge of its share. The developer grabs the line to change the size of the panes. The place to grab is as wide as the gap between the viewport and a sidebar (`--pane-gap`), and it shows a color while the pointer is over it. The line is never a gap, and no corner of a pane is rounded where lines meet.
- The border of the panes goes 1 pixel past the frame of the viewport on its left, on its right, and at its bottom, so the frame clips it. At the top, the border of the panes is the line under the tab bar. The ring of the selected pane and the ring of a blocked pane have the color of the state. At the top, the ring is the top border of the pane, so that it joins the selected tab. On the left, on the right, and at the bottom, the ring is drawn just inside the border of the pane, so that it also shows at the edge of the viewport, where the frame hides the border ([issue #326](https://github.com/heidrun-org/heidrun/issues/326)).
- A click on a pane gives the focus to that pane.
- The selected pane is easy to see, in the dark theme and in the light theme, in the grid and in the column of pinned panes. The header of the selected pane has a tinted background (`--pane-head-selected`). The name of every other pane is in the muted color (`--muted`), and its folder is in the faint color (`--faint`), so that the selected pane is the only pane with a full contrast. The ring stays as it is. A blocked pane keeps the red look of its header and of its text ([issue #345](https://github.com/heidrun-org/heidrun/issues/345)).
- A click on the pin button in the header of a pane pins the pane. A pinned pane goes into the column of pinned panes.
- The column of pinned panes sits at the right edge of the viewport, beside the panes of the selected tab. It shows every pinned pane in every tab, the tab of the pinned pane included. Its width is the same in every tab, so a pinned pane keeps the same width in every tab.
- The panes of the selected tab that are not pinned fill the width that the column leaves. A tab whose panes are all pinned shows the same picture as an empty tab.
- The header of a pinned pane in the column shows the pressed pin button, as in the panes of the selected tab. A click on the pressed pin button unpins the pane.
- A pinned pane does not change when the developer selects another tab or another workspace. Only the panes of the selected tab change.

## Needs you

- The Needs you sidebar section is a sidebar section of the right sidebar. It holds one card for each agent that is blocked, that asks a question, or that has finished, with the blocked agents first.
- A click on a card shows the pane of the agent. A card also lets the developer answer a blocked agent, pin the pane, and hide the card.
- The button of the Needs you sidebar section shows the number of cards. The number is red when an agent is blocked.
- A hidden card comes back at the next change of the agent. A finished agent leaves the sidebar section after the delay that the settings give.

