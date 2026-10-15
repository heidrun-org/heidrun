# Heidrun documentation experiment

Parked on 14 October 2026. This folder contains the complete source snapshot, generated website, writing prompts, calibrated judge, data and results of the Files sidebar documentation experiment. Nothing here is integrated into the real website.

## Start here

Read [the handoff](process/HANDOFF.md) for the current state and [the process](process/PROCESS.md) for the workflow. The experiment is parked: no generation, evaluation, publication or Git operation runs automatically.

| Folder | Contents |
| --- | --- |
| [workspace](workspace/) | Source snapshot including the generator, agent command support, application inputs, rules, assets and experiment website. |
| [prompts](prompts/) | Saved learned writing style and source modules for writing and judging. |
| [data](data/) | Calibration cases, expected results, protocols, provenance and preservation fingerprints. |
| [results](results/) | Model comparisons, learning rounds, image-aware judgements, calibration and live checks. |
| [history](history/) | Earlier trial source, patches, pre-parking versions and historical helper scripts. |
| [process](process/) | Workflow, current findings and how to resume. |

## Resume commands

Run from the real repository root. The separate workspace has its own package manifests and lockfile. Installed dependencies and compiled Rust files are deliberately not copied; install dependencies when resuming.

```sh
pnpm --dir tmp/web_doc_by_ai/workspace install --frozen-lockfile --store-dir ../runtime/pnpm_store --cache-dir ../runtime/pnpm_cache
pnpm --dir tmp/web_doc_by_ai/workspace docs:update_by_ai --dry-run --only docs/agents_rules/user_interface/sidebars/files.md
pnpm --dir tmp/web_doc_by_ai/workspace docs:judge_by_ai --dry-run --only browse_project_files.md copy_a_file_path.md create_a_file_or_folder.md files_sidebar_section_controls.md
pnpm --dir tmp/web_doc_by_ai/workspace --filter website_public dev --host 127.0.0.1 --port 5180
```

The experiment preview is at `http://127.0.0.1:5180/heidrun/documentation/` while that local server runs. These commands do not use the real website package. The parked writer and judge entry points use their own workspace directory rather than finding the enclosing repository root.

A future authorised writing run uses the same command without `--dry-run`, with `--model gpt-6.1-sol --effort high` and the Files rule limit. A future judge run uses the same four-page limit without `--dry-run`; Claude defaults are pinned to `claude-sonnet-5-5` and `high` effort. Such runs can use paid model access and are not started by parking.

## Boundaries

- All edits, generated pages, screenshots and new reports stay in this folder.
- Generator and judge runs never commit, stage, change branches, push, create pull requests, merge or deploy.
- Issue 407 separately authorises a temporary worktree, commit and pull request to preserve this folder. Merge and deployment remain unauthorised.
- The normal repository workspace patterns do not include tmp, and the normal website and root commands are unchanged.
- Do not execute historical runners from history or results. Their absolute paths and old behaviour are preserved as evidence.
- Integration into the real website is a later, separately authorised decision.

## Current result

The calibrated judge caught the planted defects in its fresh-example checks. The subsequent source-only evaluation gave the real pages 5/5 with needs_review. Live checks then confirmed two documentation defects: relative paths use the Git repository root when the workspace is a repository subfolder, and New workspace… adds a workspace without selecting it. The generated pages have not been corrected for these findings.

Original worktrees and external result folders remain as recovery copies. The source manifest records exact originals; relocated entry-point and context changes are documented in data/parking_changes.json.

## Parked command verification

The nested dependencies are installed. Both dry-run commands use `node --import tsx` to avoid the temporary socket required by the tsx command in a restricted environment. Original failed attempts are preserved with the successful checks in results/parked_folder_check. This changes only the parked package scripts. The dry runs, pure judge tests and website tests do not run a paid model or generate replacement user pages.

Dependency installation, both dry runs, seven pure judge tests, 111 website tests, the production build, and browser loading of all four pages and screenshots passed. [Verification report](results/parked_folder_check/README.md) records evidence and limits. Generated Files pages and screenshot sources are unchanged. The check did not edit outside files; the report records outside fingerprint differences caused by intervening repository updates.

## Preservation pull request

[Issue 407](https://github.com/heidrun-org/heidrun/issues/407) covers storing this experiment for review. The temporary branch is codex/park-ai-documentation-experiment-407, based on dev_jerome. Only this folder is included in the preservation change; the normal website remains separate.

The GPT-6.1 Sol / high attempt in results/known_files_fixes_20261014 was stopped by the user during the writing pass. Existing pages are unchanged, and the judge was not started. No model run is resumed by preparing this pull request. Dependencies, caches and build output are excluded from the commit and must be installed in a new checkout. Historical absolute paths remain evidence from the original run.
