# Directory Context: `/packages/auxiliary/mobile_website/src/components`

## Purpose
The parts that more than one screen of the mobile website uses.

## Key Exports & Entry Points
- `agent_card.ts`: a coding agent as a card that waits for the developer, and as a row of the list of panes.
- `bottom_bar.ts`: the five buttons Dashboard, Needs you, Panes, Macros, and Launchers.
- `icon.ts`: the class `Icon`. It draws every icon of the page as the inline SVG of Bootstrap Icons.
- `confirm_sheet.ts`: the sheet that asks the developer to check a command once more.
- `menu_buttons.ts`: one button for each choice of the menu that blocks a coding agent.
- `screen_header.ts`: the top bar of a screen, with the connection dot or with the button Back.
- `status_labels.ts`: the word and the color name of the status of a coding agent.

## Rules
- A component draws only. It never calls the mobile server.
- A component imports nothing from `src/screens`.
- Every text that comes from the Mac goes through `HtmlEscape.escape`.
- Every icon comes from `Icon.render`, which reads the package `bootstrap-icons`. Nobody draws an icon by hand, and a test checks it.
