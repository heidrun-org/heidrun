# Calibration expectations declared before evaluation

The judge sees only candidate text, neutral identifiers, and the fixed evaluation instructions. Expected findings, case categories, and score thresholds are withheld. These expectations were reviewed against actual rule/code files and the pixels of both PNGs before evaluation. They were reviewed by the primary assistant, not by an independent human panel. This limitation remains.

| Candidate | Kind | Expected result | Source |
| --- | --- | --- | --- |
| sample_19.md | good: Complete path-copy procedure | No material or worse finding; correct labels, ordering and examples. All criteria at least 4; no material or worse findings. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_42.md | defect: Unsupported menu item | Required deduction: invented Upload file to GitHub label does not exist. accuracy at most 2. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_07.md | good: Action/result reference table | No material or worse finding; action/result lookup table is valid reference. All criteria at least 4; no material or worse findings. | docs/agents_rules/user_interface/sidebars/files.md |
| sample_63.md | defect: Missing context-menu opening step | Required deduction: instructions jump from locating file to choosing hidden menu items; must explain right-click. taskSuccess at most 3. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_28.md | defect: Reversed absolute/relative examples | Required deduction: examples are reversed; absolute has full path and relative has row path. accuracy at most 3. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_55.md | good: Correct intermediate screenshot | No material or worse finding; actual PNG shows name box before Enter, caption accurately states that. All criteria at least 4; no material or worse findings. | packages/auxiliary/website_public/docs/public/documentation_images/files/new_file.png |
| sample_34.md | defect: Folder wrongly supports copying its path | Required deduction: a folder row never opens this menu. accuracy at most 2. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_81.md | defect: Wrong screenshot under correct name-box caption | Required deduction: actual PNG shows copy context menu, no creation name box or example.md. accuracy at most 4. | packages/auxiliary/website_public/docs/public/documentation_images/files/copy_path.png |
| sample_12.md | good: Correct Markdown-only Reading prerequisite | No material or worse finding; Reading exists for Markdown, explicit prerequisite. All criteria at least 4; no material or worse findings. | packages/apps/web_frontend/src/components/GitModal.vue |
| sample_46.md | defect: False deletion of empty folders | Required deduction: forgetting empty folder tree entry does not delete folder from disk. accuracy at most 2. | docs/agents_rules/user_interface/sidebars/files.md |
| sample_73.md | defect: Invalid slash in a creation name | Required deduction: slash rejected, does not create nested folder and file. accuracy at most 2. | packages/apps/web_frontend/src/components/FilesPanel.vue |
| sample_90.md | defect: Reading button for a TypeScript file | Required deduction: Reading absent for non-Markdown file; prerequisite is materially false. accuracy at most 2. | packages/apps/web_frontend/src/components/GitModal.vue |

## Acceptance

All eight defects must be explicitly identified as deductions with correct evidence and meet their declared criterion threshold in both independent runs. None of the four good examples may receive a material or worse finding. Images must actually be inspected. Report detection separately from exact severity agreement. Do not use the aggregate score as the acceptance decision.

The second run reverses candidate order. The scope, candidates, sources, rubric, model and effort remain fixed. No expected results will be revised after seeing the judge answers.
