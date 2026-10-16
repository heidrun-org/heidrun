# User interface of Heidrun Mobile: the screens

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun: Heidrun Mobile](../../glossary/heidrun_mobile.md)
- Related issue: [issue 581](https://github.com/heidrun-org/heidrun/issues/581)

This file gives the rules of each screen of the mobile website of Heidrun Mobile. The code is in [mobile_website](../../../../packages/auxiliary/mobile_website/CONTEXT.md).

## Every screen

- Each screen of the bottom bar has a top bar with its title and a dot that shows the connection to the computer.
- The address of the page names the open screen after "#", so a reload and the buttons Back and Forward of the browser open the same screen.
- A refresh never moves what the developer reads, and never removes the text of the field for a prompt while the developer types or while the microphone listens.
- The texts are in English. A text says "coding agent", never "agent" alone.

## Welcome page

The first page: the baby goat in a big circle, the name, the motto, and the button "Go to the app" at the bottom of the screen. It needs no data from the computer.

## Dashboard

The count of coding agents that need the developer, the count that work, and the usage limits. A tap on a count opens the screen with the details.

## Needs you

The coding agents that wait for the developer. The blocked coding agents come first, each one with its menu.

## Panes

Every pane that runs a coding agent, grouped by workspace and then by tab, with a status dot. A tap opens the screen of one pane.

## Screen of one pane

- The end of the output, with the colors of the terminal.
- The menu of a blocked coding agent, and the button Refuse.
- The macro button in the top bar.
- The field for a prompt, the microphone button, the Interrupt button while the coding agent works, and the button Send.
- The microphone button shows only when the browser has the Web Speech API. The words go into the field after the text that is already there. Nothing is sent before the developer taps Send.

## Macros

- There is no Macros screen, because a macro goes to one pane. The macro button is in the top bar of the screen of one pane.
- A tap on the macro button asks the computer for the macros of that pane: the personal macros, then the macros of the project of its workspace. The computer replaces the variables of each macro for that pane.
- A tap on a macro writes its text into the field for a prompt, after the text that is already there, like the keyboard. Nothing is sent before the developer taps Send, so the macro passes the same guards as a typed prompt.

## Launchers

- The launchers of the project of each workspace, with the status "Not started", "Running", or "Finished", and the description or else the command.
- The button Run runs the command of the launcher in its own tab on the computer, like the Launchers sidebar section. The button Stop sends Ctrl+C to the tab of a running launcher.

## The guards

A dangerous command of a prompt, a macro, an answer, or a launcher opens the confirmation sheet with the command and the reason. The computer runs the command only after the developer confirms the same command.
