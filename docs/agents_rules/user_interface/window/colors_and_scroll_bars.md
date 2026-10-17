# User interface of Heidrun: colors and scroll bars

- Created: 13 October 2026
- Last updated: 18 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md)
- Related issue: [issue 320](https://github.com/heidrun-org/heidrun/issues/320), [issue 645](https://github.com/heidrun-org/heidrun/issues/645)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../glossary/index.md).

## Colors

- The main colors of the window are the colors of VS Code, measured on a screenshot of VS Code in Dark Modern and in Light Modern ([issue #320](https://github.com/heidrun-org/heidrun/issues/320)). They are CSS variables in `packages/apps/web_frontend/src/styles.css`, one value for the dark theme and one value for the light theme.
- `--shell` is the color of the top bar, of the sidebar icon bars, of the status bar, and of the window behind the sidebars and the viewport. It is #181818 in the dark theme and #f8f8f8 in the light theme.
- `--side` is the color of the left sidebar, of the right sidebar, of the frame of the viewport, and of the tab bar. It has the same value as `--shell`, as in VS Code, so only the border line (`--line`) separates a sidebar icon bar from its sidebar.
- `--bg` is the color of a pane, and the background of the terminal in a pane has the same value: #1f1f1f in the dark theme and #ffffff in the light theme. A change of `--bg` changes the background of the terminal themes in `TerminalView.vue` too, because Codex reads `--bg` when it starts.
- `--text` is #cccccc in the dark theme and #3b3b3b in the light theme. `--muted` is #8f8f8f in the dark theme and #737373 in the light theme. `--line`, the color of the border lines, is #2b2b2b in the dark theme and #e5e5e5 in the light theme.
- `--icon` is the color of the icons of the sidebar icon bars: #888888 in the dark theme and #5d5d5d in the light theme. The icon of the selected entry has the text color (`--text`).
- `--pane-head-selected` is the background of the header of the selected pane: #1f3452 in the dark theme and #dbe7fb in the light theme. It is a light tint of the blue of the ring of the selected pane ([issue #345](https://github.com/heidrun-org/heidrun/issues/345)).
- `--pane-head-line` is the line under the header of a pane: #2b2b2b in the dark theme and #e4e4df in the light theme. In both themes, its contrast ratio against `--bg` is at least 1.1, so the line shows in the dark theme as well as in the light theme ([issue #345](https://github.com/heidrun-org/heidrun/issues/345)).
- The hover colors, the accent color, the status colors, and the other grays keep their own values.

## Scroll bars

- Every scroll bar of the application has the same look as the scroll bar of VS Code, in the dark theme and in the light theme: 8 pixels wide, no track, no background, and a rounded thumb. The thumb has the color `--scrollbar-thumb`, a gray at 40 percent (`rgba(121, 121, 121, 0.4)` in the dark theme, `rgba(100, 100, 100, 0.4)` in the light theme). It has the color `--scrollbar-thumb-hover`, `rgba(100, 100, 100, 0.7)`, while the pointer is over the thumb.
- The look is one global rule in `packages/apps/web_frontend/src/styles.css`, made with the `::-webkit-scrollbar` pseudo-elements on every element. A component never writes a rule for its own scroll bar.
- Nothing sets the CSS properties `scrollbar-width` or `scrollbar-color` to a value other than `none`: in Chrome, these two properties replace the pseudo-elements, so the scroll bar would lose the look. The value `none`, which hides a scroll bar, is allowed.
- The window has no scroll bar of its own, so it has no free strip at its right edge: the root element has `scrollbar-gutter: auto`, set in `packages/apps/web_frontend/src/styles.css`. Bootstrap sets `scrollbar-gutter: stable` on the root element, which would keep a black strip of 8 pixels (the width of a scroll bar) at the right edge of the window. Nothing sets `scrollbar-gutter` to another value than `auto` ([issue #645](https://github.com/heidrun-org/heidrun/issues/645)).

