# The technology

- Created: 11 October 2026
- Last updated: 13 October 2026
- Status: Maintained description of the technology
- Related framing: [Project instructions](../../AGENTS.md)

Heidrun is a desktop application built with [Tauri](https://tauri.app). The backend is written in Rust, and the user interface is written with Vue 3 and TypeScript. See [packages/apps/CONTEXT.md](../../packages/apps/CONTEXT.md).

## A fast and small client

- Tauri gives a fast and small client.
- The client needs few dependencies.
- The client will most likely include a JavaScript runtime environment.

## The operating systems

- Heidrun runs on macOS today, because the developers use macOS.
- Heidrun can be compiled for every operating system.
- Heidrun may be compiled for Linux, with containers.

## The interface

- The user works with Heidrun through a graphical interface.
- A command line interface is not needed now. It may come later.

## The installation

- The user installs Heidrun once, from GitHub.
- Heidrun is open source, under the MIT license. See [LICENSE](../../LICENSE).
