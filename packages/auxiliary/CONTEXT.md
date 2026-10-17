# Directory Context: `/packages/auxiliary`

## Purpose
The packages that are useful for the application Heidrun, but are not the application itself: a library and the public website. The data layer packages are in `packages/data_layers`. A package that is only a tool for the developers of Heidrun goes in `packages/dev_tools`.

## Key Exports & Entry Points
- `raw_coding_agent_cli/`: a Rust library and a command line tool that send one prompt to `codex`, `claude`, or `agy`. See its own CONTEXT.md.
- `website_public/`: the public website and documentation, built with VitePress. See its own CONTEXT.md.
- `mobile_server/`: a Rust library that serves the mobile website on the loopback address behind an ngrok tunnel, checks the host name of the tunnel and the pairing key, and hands each call of the phone to the desktop application. See its own CONTEXT.md.
- `mobile_website/`: the mobile website of Heidrun Mobile, which the mobile server serves. See its own CONTEXT.md.
- `heidrun_ctrl/`: a Rust library and the command line that controls the Heidrun application for a coding agent, with its `SKILL.md`. The first commands are the macros: list, add, update, and delete. See its own CONTEXT.md.
- `local_ai_embeddings/`: a Rust library and command line tool for computing text embeddings locally on the CPU or a supported accelerator. See its own CONTEXT.md.

## Rules
- A package that produces the application goes in `packages/apps`, never here.
- A package that is only a tool for the developers of Heidrun goes in `packages/dev_tools`, never here.
- A data layer package goes in `packages/data_layers`, never here.
- A package in `packages/apps` may import a Rust library of this folder, through a `path` dependency in its `Cargo.toml`. No package in this folder imports a package from `packages/apps`.
- No package in this folder imports a package from `packages/dev_tools`.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
- The development tools left this folder for `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226).
- The three data layer packages left this folder for `packages/data_layers` in [issue #470](https://github.com/heidrun-org/heidrun/issues/470).
- `heidrun_ctrl` came with [issue #602](https://github.com/heidrun-org/heidrun/issues/602). `desktop_tauri` imports it, so the format of the macro files has one place.
- `mobile_server` and `mobile_website` came with [issue #524](https://github.com/heidrun-org/heidrun/issues/524), and the rule about the imports of `packages/apps` changed with it. The rule was already false: `desktop_tauri` imports `raw_coding_agent_cli`.
