# User interface of Heidrun: composition bar

- Created: 18 October 2026
- Last updated: 18 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [User interface of Heidrun: panes](panes.md)
- Related issue: [issue 637](https://github.com/heidrun-org/heidrun/issues/637)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Composition bar

- A drop of image files on the window, on any part of the window, opens the composition bar and adds the images to it. A file that is not an image gets the message "This file is not an image". The same file is never added twice.
- The composition bar sits under the terminal of the focused pane, inside the border of the pane. It exists only after a drop, and until the developer sends or closes it, so a pane that never received a drop has its whole height. The composition bar follows the focus: it is for the focused pane only.
- The first line holds the plus button, then one small picture for each image. The plus button comes first, so it does not move when an image is added. It opens the file picker of the system, which accepts several image files. Each picture has a small button that removes it. Removing the last image keeps the composition bar open.
- The second line is a text input that takes several lines. It has a label for the screen readers and a placeholder, and it grows with its lines up to 160 pixels, then scrolls. The key Enter sends, and the keys Shift and Enter write a new line. The third line shows the number of images, the button "Close" (key Escape), and the button "Send" (key Enter).
- When an image arrives, the text input gets the keyboard. The key Enter in the text input (without Shift), and the button "Send", paste each image in the focused pane one after the other, with a wait of half a second. When the text is not empty, Heidrun then writes the text in the pane and presses Enter in the pane. When the text is empty, Heidrun writes nothing and presses nothing, so the developer keeps the keyboard in the terminal. Then the composition bar closes and the keyboard goes back to the terminal.
- When a paste fails, the images that were not pasted and the text stay in the composition bar.
- The button "Close" removes every image and the text, and closes the composition bar.
- A click on a picture opens the big view. The big view shows one large picture, with its file name and its position (for example "2 of 3"), a button on each side, and a close button. The key Left and the key Right, and the two buttons, go to the previous and to the next image, and the last image is followed by the first image. The key Escape, the close button, and a click beside the picture close the big view. The big view takes its keys before the terminal and the composition bar.
- A drop never pastes at once, and never pastes in the pane under the pointer.
- Push to talk is not part of the composition bar yet ([issue 637](https://github.com/heidrun-org/heidrun/issues/637)).
