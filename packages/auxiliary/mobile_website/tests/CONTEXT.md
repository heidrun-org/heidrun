# Directory Context: `/packages/auxiliary/mobile_website/tests`

## Purpose
The Vitest tests of the mobile website. They start the whole page in jsdom against a fake Mac, so a test taps on the page like the developer does.

## Key Exports & Entry Points
- `fake_mac.ts`: the class `FakeMac`. It takes the place of `fetch`, checks the pairing key like the mobile server, and remembers every call.
- `app_harness.ts`: the class `AppHarness`. It starts the page with fake timers, taps on an element, and lets the timers run.
- `fixtures.ts`: the four coding agents that most tests start from.
- `setup.ts`: puts the document, the timers, and the global values back after each test.
- Command to test this folder: `pnpm --filter mobile_website test`

## Rules
- A test never calls a real server. It uses `FakeMac`.
- A test of a screen taps on the page. It does not call a `render` method, so it tests the same path as the phone.
