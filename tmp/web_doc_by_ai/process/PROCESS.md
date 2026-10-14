# Documentation experiment process

## Scope and inputs

Keep the experiment limited to docs/agents_rules/user_interface/sidebars/files.md and the four Files sidebar pages. Read the captured rules and glossary, then application code. Source-rule conflicts need live verification rather than invented behaviour. Use a running application built from the same source version as the claims under review; start Heidrun with --no-splash-screen.

## Writing

Use the learned style in workspace/packages/dev_tools/documentation_updater/src/documentation_prompt.ts. The source module is authoritative; prompts/ contains saved copies for inspection. Use GPT-6.1 Sol with high effort as the current top writer. Preserve every outline, writing prompt, agent answer, page snapshot and model setting. Do not commit between iterations. A limited run does not advance .last_documented_commit.

## Evaluation

Use contract version 3 and the pinned Claude model and effort recorded in the package. Assess verified reader obstacles, not optional preferences. Every deduction needs a location, evidence, impact and severity. Blocking findings prevent acceptance regardless of the average. Unverified runtime conditions require review. Images must be inspected as pixels; captions alone are not visual evidence.

Keep the rubric, model, effort, scope and input hashes fixed for comparisons. Declare calibration expectations before evaluating examples, withhold expected labels from the judge and preserve failed checks. Use fresh examples after changing the rubric. Do not compare scores from different contract versions as improvements in page quality.

## Live checks

Exercise actual native application interactions and the rendered website. Verify clipboard output by an actual paste into a harmless local field. For relative paths, select a workspace that is a real repository subfolder and record both the workspace folder and repository root. Observe New workspace… through the actual folder chooser and subsequent selection. Preserve screenshots and accessibility text.

Concurrent users or agents can overwrite the global clipboard. Exclude a disturbed paste from the evidence instead of attributing the unexpected content to Heidrun. Capture notification timing in the foreground; a code timeout alone does not establish live timing.

## Acceptance and later integration

Require source-backed claims, readable matching screenshots, reachable links, successful native task completion and explicit handling of verification limits. The small calibration set does not prove universal detection reliability. The two current live-confirmed documentation findings must be resolved and rechecked before acceptance.

Only after the experiment works and the user authorises integration should the successful source and documentation be proposed for the real website. Git publication remains outside this process.
