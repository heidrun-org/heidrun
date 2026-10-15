# Directory Context: `/packages/auxiliary/mobile_website`

## Purpose
The mobile website of Heidrun Mobile: the page that the phone opens to keep the coding agents working when the developer is away from the desk. The mobile server serves the built page from the Mac, and the page talks only to the mobile server.

## Key Exports & Entry Points
- `index.html`: the entry of Vite. It names `src/main.ts` and `public/manifest.webmanifest`.
- `src/mobile_app.ts`: the class `MobileApp`. It holds the open screen, refreshes the data, and handles the taps.
- `src/mobile_api.ts`: the pairing key of the phone, and the calls to the mobile server.
- `src/output_text.ts`: turns the output of a pane, which is a copy of a terminal screen with colors and many empty lines, into short HTML.
- `src/ansi_parser.ts`, `src/ansi_palette.ts`: read the color codes of a terminal screen into lines of styled text, and give the color of each code.
- `src/screen_address.ts`: writes and reads the screen that is open in the part of the address after "#".
- `src/color_painter.ts`: sets the colors of the output after its HTML is in the page.
- `dev/`: the development server with a fake Mac, and the proxy to the real desktop application. See its own CONTEXT.md.
- `src/screens/`: one class for each screen. See its own CONTEXT.md.
- `src/components/`: the parts that several screens share. See its own CONTEXT.md.
- `tests/`: the Vitest tests, which run the whole page against a fake Mac.
- `dist/`: the built website. Git ignores it. The package `mobile_server` holds this folder inside its program at build time.
- Command to work on this folder with a page that reloads by itself: `pnpm --filter mobile_website dev`
- Command to build this folder: `pnpm --filter mobile_website build`
- Command to test this folder: `pnpm --filter mobile_website test`

## Rules
- This package has no `src/index.ts` and no `exports` entry. No package imports it. The package `mobile_server` reads only the folder `dist`.
- This package imports nothing from `web_frontend`, and nothing from `desktop_tauri`.
- A refresh never moves what the developer reads. The page draws a screen again only when its HTML changed, and a new HTML keeps the scroll of the page and of the output. The output follows its end only when the developer already looks at the end. A test checks it.
- The address of the page always names the screen that is open (`#/needs-you`, `#/panes`, `#/panes/<pane>`), so a reload and the buttons Back and Forward of the browser lead to the same screen. The server needs no route for it, because "#" is never sent. A test checks it.
- The page has no framework, no inline script, no inline style, and no event attribute in its HTML. The header `Content-Security-Policy` of the mobile server allows only files of its own address, and a test checks every screen.
- The output of a pane carries each color in the attribute `data-fg` or `data-bg`, always as `#rrggbb` from `AnsiPalette`, never as the text that the Mac sent. `ColorPainter.paint` turns the attributes into styles with the style object of the element, which the content security policy allows. The call `read` always sends `ansi: true`.
- Every text that comes from the Mac or from a coding agent goes through `HtmlEscape.escape` before it enters a template. A test with hostile text checks it.
- The page calls only the closed list of methods of the mobile server (`state`, `read`, `answer`, `prompt`, `keys`), with the header `x-herdr-token`.
- The pairing key comes in the address after `#t=`, which a browser never sends to a server. The phone keeps it in `localStorage` under the name `hd-token`, so a phone that is already paired stays paired.
- The texts of the page are in English. A text says "coding agent", never "agent" alone.
- A change of this package needs a new build of the package `mobile_server`. The scripts `test` and `tauri dev` and `tauri build` build this package first.

## Background
- The page moved here from `packages/apps/desktop_tauri/mobile` in step 1 of [issue #525](https://github.com/heidrun-org/heidrun/issues/525). Step 2 replaced the single file with this Vite and TypeScript package, with the layout of three screens and a bottom bar. The plan is in [issue #524](https://github.com/heidrun-org/heidrun/issues/524).
- The calls of the first page are kept as they were. The only addition is the parameter `ansi` of the method `read`, which the desktop application passes to the herdr call `pane.read` as `format: "ansi"`.
