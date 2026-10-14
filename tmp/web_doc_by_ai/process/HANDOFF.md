# Files sidebar documentation experiment handoff

## Parked state

Date: 14 October 2026. The whole experiment is in tmp/web_doc_by_ai. The main checkout is on dev_jerome; issue 407 now authorises preserving the parked folder in a temporary worktree, committing the current experiment and opening a pull request. No merge or deployment is authorised. The original codex/documentation-experiment-375 and generate-docs-with-ai-375 worktrees are recovery copies, not current execution targets.

## What is preserved

The workspace holds the latest generator, learned writing prompt, version 3 judge, their tests and local dependency source, all captured Heidrun source/rules/assets, generated Files pages and website configuration. Results include the learning rounds, model comparisons, three image-aware judging rounds, judge consistency review, calibration examples and actual-page evaluations. History includes the original trial implementation, old source-changing and judgement runners, screenshots before and after correction, original handoff and patches.

## Evaluation findings

Version 2 caught all eight planted defects in two runs but graded some severities inconsistently; one declared threshold failed. Version 3 added explicit severity decisions and blocked acceptance despite a high average. It caught all four fresh defects in each of two independent runs, with no false alarms on the two correct examples, and matching scores. Sixteen focused judge tests passed. This is narrow calibration evidence, not a universal accuracy claim.

The actual-page version 3 run returned 5/5 with needs_review and runtime limits. That result was superseded by two concrete live findings:

1. Copy relative path uses the Git repository root. With the workspace set to the captured repository's docs subfolder, copying docs/README.md produced docs/README.md in the notification and clipboard. A workspace-relative result would be README.md. Correct the workspace-folder description in Copy a file path and Files sidebar section controls.
2. New workspace… opens the native folder chooser and adds the chosen folder to the list without selecting it. An explicit click on the new docs entry selected it. Browse and open project files omits that necessary selection after creation.

Neither correction has been made. Do not treat the earlier 5/5 as acceptance.

## Successful live checks

The production website build passed in 1.92 seconds. All four generated pages and four PNGs loaded under /heidrun/, and nine distinct prerequisite/related targets and anchors were checked. Nested-workspace absolute copying produced the correct full path and was verified by an actual clipboard paste. File opening, Markdown Reading mode, disabled Diff and Side by side for an unchanged file, Escape closing, and cancellation of a typed new-file name were exercised without creating a file.

The original heidrun workspace selection and File viewing mode were restored. The added docs workspace remains in the application's workspace list. Only the experiment's own app and preview processes are stopped for parking; unrelated Heidrun processes are left alone.

## Inconclusive or remaining checks

The initial copy notification appeared and later disappeared, but a later timed check still reported the notification in the accessibility tree at about 11.7 seconds while the source timeout is 4 seconds. The user stopped the run before this discrepancy was resolved. Treat notification timing as inconclusive, not as a confirmed application defect. The raw observations are in results/live_files_verification/notification_timing.json.

The additional repository-root clipboard control was disturbed by another clipboard writer and is excluded from paste evidence. The nested relative and absolute pastes succeeded before that interference. Other operating systems, denied clipboard permissions, error paths, real creation/duplicate-name errors and restart persistence were not exercised in that live run. Public hosting was not deployed.

The full documentation-updater package suite previously had two failures for metadata on the unselected Introduction page. Those failures were not repaired by editing the Files pages.

## Resume

Read README.md, install the nested workspace dependencies, and inspect dry-run prompts before a paid model run. First authorise and perform a Files-only writing pass to address the two live findings. Then judge the unchanged output with fixed settings and repeat the relevant native checks. Keep all new artifacts here and keep failed evidence. Do not run a model or edit a user page merely as part of parking.

The current CLI relocation is a storage-boundary change only. Dependencies are now installed. On 14 October 2026, both relocated dry runs passed, seven pure judge tests and 111 website tests passed, and the production build and browser checks of all four pages and screenshots passed. The parked package scripts now use node --import tsx after the original tsx command failed to create a temporary socket. No paid model or page replacement was run. See ../results/parked_folder_check/README.md for evidence and verification limits, including outside fingerprint changes. Source history read from the parent Git repository is only a hint; data/provenance.json records the captured source version.

## Interrupted correction attempt

The user authorised a real GPT-6.1 Sol / high Files-only correction run and then stopped the run during its writing pass. The generator process and child process ended. Existing workspace files, including generated pages, stayed unchanged. The judge was not started. results/known_files_fixes_20261014 preserves the prompts, completed outline, progress and stopped.json. This attempt is incomplete and must not be described as a successful correction or evaluation.

## Repository preservation

Issue 407 separately authorises a commit and pull request for the current experiment in a temporary worktree based on dev_jerome. This authorisation does not permit generator Git publication, merging, production integration, or resuming a model run. The original parked folder remains a recovery copy; the reviewable version is in the temporary worktree. Dependencies and generated build output are not committed.
