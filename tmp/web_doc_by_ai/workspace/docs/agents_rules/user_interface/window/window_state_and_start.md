# User interface of Heidrun: state of the window, splash screen, and goat sounds

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary.md)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../glossary.md).

## Position and size of the window

- When Heidrun quits, it saves the position and the size of the window, and whether the window was maximized or full screen. The window-state plugin of Tauri does this work, and keeps the file `.window-state.json` in the configuration folder of the application.
- At the next start, the window opens with the saved position, the saved size, and the saved maximized or full screen state.
- At the first start, no state is saved, and the window opens in the middle of the screen with the size in `tauri.conf.json`.
- When the saved position is outside every screen that is connected, the window opens at the default position of the operating system, on a connected screen.
- The visible state is never restored. The window stays hidden until the splash image is ready.

## Last state of each option

- Every option keeps its last state between two runs of Heidrun. An option is a toggle, a choice between a few values, a sidebar section that is shown, a panel that is open or closed, or a size.
- The last state of each option is saved in the `localStorage` of the web frontend, in the store `packages/apps/web_frontend/src/stores/settings.ts`, under the key `heidrun.settings`. A new option is a new line in `defaults` of this store, and not a new key.
- At the start, each option reads its saved state. An option with no saved state, or with a corrupted saved value (the wrong type, or a value that is not in the list of its values), uses its default value.
- A text that the user types, a search text for example, is not an option and is not saved. A mode that edits data, for example the edit mode of the budgets in the window History, is not an option and is not saved.

## Splash screen

- At the start, Heidrun shows the splash screen for 3 seconds after the main window appears. A click on the splash screen closes it at once.
- The splash screen has a sound button at its bottom right corner. A click on the sound button plays a goat bleat, and does not close the splash screen. See the section "Goat sounds".
- The command line option `--no-splash-screen` starts Heidrun without the splash screen. The main window then appears at once, and shows the application.
- A program that drives Heidrun, for example to take a screenshot, uses this option, so that it never waits for the splash screen to close. In development, run `pnpm dev -- -- --no-splash-screen`: the command `tauri dev` gives the arguments after its second `--` to the application, and the arguments after its first `--` to `cargo`. For the built application on macOS, run `open -a Heidrun --args --no-splash-screen` while Heidrun is not running.

## Goat sounds

- Heidrun plays two goat bleats. They are the two halves of the sound "Cabra" by sonsdebarcelona, and the files are `data/sounds/goat_bleat/goat_bleat_1.wav` and `data/sounds/goat_bleat/goat_bleat_2.wav`. The application keeps one copy of each file, and plays it from the folder `data/sounds/goat_bleat`.
- A bleat plays only after a click of the developer. No bleat plays by itself.
- Three places play a bleat: the sound button of the About modal, the sound button of the splash screen, and the smiley at the end of the joke of the empty tab screen. A click on the smiley plays a bleat only when it starts the laugh again, so the laugh that starts by itself stays silent, and a click while the laugh is still running plays nothing.
- The bleats play in turn: the first click plays the first bleat, the second click plays the second bleat, the third click plays the first bleat again. The three places share the same turn. A bleat that is still playing stops when the next bleat starts.
- The license of the sound is Creative Commons Attribution NonCommercial 3.0, so the About modal shows the credit to the author, with a link to the Freesound page.
