# Documentation by AI

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 501](https://github.com/heidrun-org/heidrun/issues/501)

This folder explains how the documentation experiment produced a reusable writing prompt, and how that prompt is used to generate the website's user documentation.

Read [the process](process.md) for the learning method, evidence, stopping decisions and normal generation workflow. The [documentation_by_ai package](../../packages/dev_tools/documentation_by_ai/README.md) holds the command, learned prompt, presentation templates and technical instructions.

## Normal generation

The developer explicitly starts one command. The command runs one writing call with GPT-6 Luna / medium, builds the website once and stops. The developer reviews the result and requests changes when needed. There is no automatic judge, review of completed pages, screenshot acquisition or correction loop.

```sh
pnpm docs:generate-and-build
```

The command is provided for later use. Creating these documents and the package does not run the command, generate pages, build the website or publish anything.

Generation updates the user documentation and its sidebar, not the marketing homepage, About page or independently generated shortcuts. Suitable verified screenshots must be supplied or already available; otherwise the writer reports the missing evidence and produces text without invented images.

## Where information lives

- [process.md](process.md): the method and the separation between prompt improvement and normal generation.
- [Package README](../../packages/dev_tools/documentation_by_ai/README.md): commands, inputs, logs, failure handling and implementation boundaries.
- [Learned prompt](../../packages/dev_tools/documentation_by_ai/prompts/learned_prompt.md): the maintained writing instructions.
- [Historical calibration material](../../packages/dev_tools/documentation_by_ai/calibration/README.md): examples used to check a judge, retained for a deliberately requested future learning experiment.

The command never commits, merges or publishes. Those are separate developer actions.
