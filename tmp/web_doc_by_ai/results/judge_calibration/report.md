# Judge calibration results

## Conclusion

The revised judge passed the declared defect-detection and severity thresholds on this calibration set. The evidence supports using the judge to identify tested Files sidebar defects, with human review of evidence and verification limits. The experiment does not certify the current Files pages, establish a perfect score, or prove reliability on unseen kinds of documentation defects.

The Files sidebar pages, screenshots, screenshot metadata, sidebar configuration and application/rule source files stayed unchanged. Only evaluator code, focused tests and evaluator developer guidance changed. No repository commit, pull request or merge was created. The current user pages were not rescored.

## Protocol

Expected decisions were saved before each evaluation stage, withheld from the judge and never changed after seeing answers. Expectations came from the actual rule and code sources and inspected PNG pixels. The primary assistant wrote and reviewed the expectations; there was no independent human panel. Samples use neutral filenames and the evaluator sees no good/defective labels. The model is Claude claude-sonnet-5-5 with high effort. Every evaluation used the real local command, not a fake judge.

Candidates are evaluated independently. Site scores are neutral and excluded from calibration acceptance. The same judge prompt builder, scoring contract, parser and report combiner are used, with extra instructions explaining virtual candidate filenames and independent scoring. This candidate context differs from judging a normal publication set. Sources and linked prerequisites remain readable; original candidate content on disk is not authoritative.

Two original runs reversed the order of the same twelve candidates. Four were correct and eight had planted defects. Detection requires identifying the planted issue as a deduction on its declared criterion; an unrelated deduction or optional suggestion does not count. Score thresholds were declared separately. The six fresh examples were frozen before the scoring revision, withheld during revision, and evaluated twice in opposite orders. They reuse the same feature and some base procedures; they are not evidence of generalisation to unrelated features.

## Original judge, version 2

- Defects detected: 8/8 in each run (16/16 trials).
- Correct examples incorrectly flagged: 0/4 in each run.
- Declared severity thresholds met: 7/8 in run 1, 8/8 in run 2.
- The false claim that empty folders are deleted from disk scored accuracy 3 in one run and 2 in the other. The declared threshold was at most 2, so run 1 failed calibration.
- Missing-menu task success varied between 3 and 2; wrong-screenshot accuracy varied between 3 and 4. The original judge found the defects but did not grade their severity consistently.
- One original answer also inaccurately said the Use when column had been swapped; only the path-example values were swapped. The primary reversed-path finding was correct, but incidental explanations still require review.

This failed result is preserved rather than replaced with the later results.

## Revision, version 3

The severity anchors distinguish false operational instructions from omitted interactions. False operational claims about available controls, accepted inputs, copied path kind or data creation/replacement/modification/deletion are accuracy blockers. Wrong task instructions requiring unavailable controls or rejected inputs are task blockers. A necessary but inferable missing interaction is material. An image that contradicts its instructional-state caption is material, unlike a cosmetic crop or optional placement.

Blocking findings set reviewStatus to blocked irrespective of the average. Other deductions or reported verification limitations set needs_review. No verified defect is not a certification of accuracy or completeness. Numeric scores remain diagnostic; the average cannot override a blocking finding.

A check on all twelve original examples after revision detected 8/8 defects and met 8/8 original thresholds; none of the four correct examples received a deduction. This checks the revision on known examples; it is not the fresh-example validation.

## Fresh examples, version 3

| Defect | Primary criterion | Run 1 | Run 2 | Declared threshold |
| --- | --- | ---: | ---: | ---: |
| Existing file wrongly overwritten | accuracy | 2 | 2 | ≤ 2 |
| Enter and Escape behaviour reversed | accuracy | 2 | 2 | ≤ 2 |
| Copy-menu caption over creation image | accuracy | 3 | 3 | ≤ 3 |
| Missing creation action | taskSuccess | 3 | 3 | ≤ 3 |

Both fresh-example runs caught all four defects with the intended findings and met all four declared severity thresholds. Both correct examples received 5 on all six criteria, with no findings: one complete creation procedure without a screenshot and one complete path-copy procedure with a correctly captioned intermediate screenshot. All 36 page criterion scores match across the two runs. The evaluators inspected both PNGs and checked the relevant real source files. Findings were reviewed for the intended defect rather than accepted solely because the numeric threshold was met.

Both sets are correctly marked blocked because they contain blocking findings, even though the aggregate scores are above 4.7. This demonstrates why the average is unsuitable as the acceptance decision.

## Verification and limits

- 16/16 judge-focused implementation tests pass, including blocking acceptance despite a high average and requiring review when full scores coexist with verification limitations.
- Frozen expected-answer hashes still match; no expectations or thresholds were changed after evaluation.
- Frozen user-page, image, metadata, sidebar and application/rule source hashes still match. Evaluator source hashes match the saved version 3 contract.
- Source paths supplied in findings exist and source evidence is present. Structure and arithmetic checks do not prove every explanation true.
- The application was not launched. Clipboard permissions, operating-system-specific behaviour, timing and every runtime state were not tested.
- The fresh validation contains only four defective and two correct examples. It gives useful evidence of detection and severity within this narrow scope, not a general reliability percentage.
- Detection of missing essential actions, false controls and data-loss claims was tested. Readability with real people, exhaustive coverage, subtle omissions beyond these examples and contradictions across a real publication set remain outside this calibration.

### Expectation rationale correction

A few original rationale strings used the helper names beginCreate/submitCreate/creating. The actual names in FilesPanel.vue are startNaming/submitNaming/naming. This naming mistake did not change the expected behaviour: the New file button reveals the name box, Enter creates, Escape cancels, and slash-containing names are rejected. The original expectation files and decision thresholds are retained unchanged; judge evidence was checked against the actual code names.

## Evidence files

- expectations.md and cases_private.json: original decisions declared before evaluation.
- protocol.json: model settings, hashes and acceptance rules.
- holdout_private.json and holdout_protocol.json: fresh-example expectations frozen before revision.
- candidates.json and holdout_candidates.json: exact candidate texts supplied to the judge, without expected labels.
- run1 and run2: original answers and activity logs.
- revised1: revised judge on known examples.
- holdout1 and holdout2: fresh-example raw answers, prompts, reports and activity logs.
- metrics.json: detection and threshold results for every case.
- source_hashes.json and source_hashes_version3.json: source fingerprints.
- rubric_version2.md and rubric_version3.ts: scoring rules before and after calibration.
- runner_version2.mjs and runner_version3.mjs: exact evaluation runners.
