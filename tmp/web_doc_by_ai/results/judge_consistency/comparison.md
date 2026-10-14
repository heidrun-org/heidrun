# Repeated Files sidebar evaluation

## Frozen-input results

| Page | Run 1 mean | Run 2 mean | Largest criterion difference |
| --- | ---: | ---: | ---: |
| browse_project_files.md | 5.0000 | 5.0000 | 0 |
| copy_a_file_path.md | 5.0000 | 5.0000 | 0 |
| create_a_file_or_folder.md | 5.0000 | 5.0000 | 0 |
| files_sidebar_section_controls.md | 5.0000 | 5.0000 | 0 |

Overall scores: 5.0000 and 5.0000. Navigation and consistency are 5 in both runs. All 26 scores (24 page criteria plus two set criteria) match exactly. The exact prompt and hashes of all four pages, four PNG screenshots, screenshot metadata, and sidebar configuration match across runs and remain unchanged after evaluation.

Both evaluations used rubric version 2, Claude claude-sonnet-5-5, high effort, and the same four-page scope. Each evaluator read the four PNG images. Both repository snapshots remained unchanged during evaluation. The default model identifier was resolved from a live local Claude command; the requested identifier and effort were passed explicitly to the actual evaluations.

## Evidence review

Neither run required moving the same screenshot to incompatible places, rejected action/result reference tables, required a separate workspace page, demanded a fictional recovery for the long-list limit, or deducted for the unselected Introduction. Optional suggestions differ, as expected: run 1 mentions the Markdown-only Reading control and an unverified workspace-subfolder path distinction; run 2 suggests shortening a short supporting description and recognises the Ignored files location as relevant. These are not contradictory required changes and do not affect scores.

The repeated runs satisfy the provisional acceptance criteria saved before evaluation: largest criterion difference 0, overall difference 0.0000, and no contradictory required corrections found. Two runs are limited evidence; future language-model answers may still vary. A 5 means no verified scoring defect under this contract, not that every fact and runtime state has been exhaustively checked. The evaluator did not launch the application.

## Deliberately wrong instruction

A separate negative control changed only the copy-page text in memory: **Copy relative path** became **Upload file to GitHub**. No repository file was changed. The evaluator found the unsupported label against actual source files and the screenshot, and recommended restoring the actual menu label.

- Accuracy: 2 (blocker).
- Task success: 3 (material consequential guessing).
- User language: 4 (minor inconsistent label).
- Set consistency: 4.

The initial negative-control expectation of task success at most 2 was not met: the correct screenshot lets a reader infer the actual control, so 3 agrees with the contract's consequential-guessing anchor. Accuracy at most 2 was met. This demonstrates detection of one real operational error, not calibration of every severity or criterion. The aggregate score still reaches 4.6667 despite a blocking accuracy finding; always review individual criteria and evidence, not only the aggregate. The aggregate formula is unchanged.

## Implementation verification

The judge-focused tests pass (14 of 14). The package suite has 37 passing tests and two failures for missing generation/type comments on the unselected existing Introduction page. The four Files sidebar pages were not edited to address these unrelated failures. Whitespace validation passes.

The previous scores cannot be compared numerically with these results: scoring contract version 2 removes optional preferences and outside-scope deductions that version 1 permitted. These evaluations establish a new baseline, not an improvement caused by page edits.

No repository commit, pull request, or merge was created.
