# User interface of Heidrun: the other detections in the text of the terminals

- Created: 22 October 2026
- Last updated: 22 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [The references](terminal_text_detection_references.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638)

This file gives the forms, the refused examples, the context, and the visible result of the seven families that are not references. The code is in `lib/refs.ts`, and the precedence is in `lib/terminal_detection.ts`.

| Family | Accepted | Refused | Needs | Visible result |
| --- | --- | --- | --- | --- |
| Web addresses | `http://` or `https://`, also over two lines. | Other schemes. | Nothing. | Underline under the pointer. ⌘-click opens the browser. No hover button, except for an issue, a request, or a commit address. |
| File paths | `src/app.ts`, `./lib/x.rs:10:5`, `~/Library/WebKit/dev.heidrun-org.heidrun.development`, `app.ts:42`. The last piece after the final dot starts with a letter and has 1 to 25 letters and digits. | A bare name without a line (`foo.ts`). A version (`1.2.3`). A host name (`db.example.com:5432`). A path in an address. | Nothing. A relative path starts at the folder of the pane. | Underline. Button "Open". The file opens in the File explorer sidebar section. |
| Shell commands | `! docker ps`, also over several lines (Claude Code), and `run ! pnpm test.` in a sentence. | `Super ! Bravo`. A word that is not a path or a known tool. | A pane that runs a coding agent. | Underline. Button "Run". A click sends `! command` to the input, through the guards. |
| Slash commands | `/compact`, if Claude Code knows it in the folder. | `/tmp/x`. An unknown word. | A pane that runs Claude Code. | Underline. Button "Run". A click sends the command. |
| Numbered steps | `1. Open the issue`, `2) Commit`: a number of one or two digits, a full stop or a closing parenthesis, and at least 4 characters. | `1. ok`. | A pane that runs a coding agent. | No underline. Button "Do step". A click sends a message that asks the agent to do the step. |
| Agent list and input box | `● main`, `○ name`: two rows or more, near the bottom. The input box when a row has the selection. | A single row. | A pane that runs Claude Code. | Button "Show" on a row. A click on the input box gives the keyboard back to the input. |
| Questions and numbered choices | A question at the end of the last message. A menu `1. Yes / 2. No` with one selected option. | A list in the text of the agent. A menu with two selected options. | A coding agent. | The Needs you sidebar section shows the question and the buttons, and so does the phone. |

## Notes

- The sentence that the numbered step sends to the agent is written in French in the code, whatever the language of the window. The text of the buttons follows the language of the window.
- Questions and choices are not decorations of the terminal. `stores/session.ts` reads the screen of the pane (`api.read`) when an agent finishes or is blocked. With the family off, it reads nothing, and removes the questions and the menus already read. With the family on again, it reads the menus of the blocked agents again.
- The mouse behaviour is not text detection. It keeps its own option in the section Terminal of the Settings window, and the section Text detection does not list it.
