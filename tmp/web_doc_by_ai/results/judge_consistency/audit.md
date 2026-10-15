# Files sidebar judge consistency review

Reviewed the three saved image-aware evaluations and their structured scores on 14 October 2026. The Files sidebar pages and screenshots are frozen during this review.

## What the old scores show

| Evaluation | Overall score | Mean of four page scores |
| --- | ---: | ---: |
| First with images | 3.6111 | 3.9167 |
| After first corrections | 3.6667 | 3.7500 |
| After second corrections | 3.6389 | 3.7083 |

The overall score rose, then fell by 0.0278. The page average declined by 0.2084 across the corrections. Navigation and consistency carry the same weight as an entire page in the existing overall calculation, so the overall score can hide a decline in page scores. The aggregation formula is unchanged in version 2.

These were changed-page evaluations, not controlled repeatability experiments. Some edits added length or complexity. The saved evidence cannot tell how much of the decrease came from documentation tradeoffs, moving judge requirements, or normal model variation. The old evaluator did not record fixed model and effort settings. No claim of deterministic old-run reproduction is justified.

## Contradictory or unstable requirements

| Earlier feedback | Later feedback | Stable version 2 rule |
| --- | --- | --- |
| Add a row-action table to the reference page; row actions are core controls. | The added row/name box action table repeats how-to steps. | An action/result lookup table is valid reference content. Deduct only for demonstrated confusion or irrelevant content. |
| Put the More options screenshot next to the header table so readers see the five icons. | Move the same screenshot next to More options, two sections later. | Either adjacent placement may work. Deduct only for unreadability, incorrect state, or demonstrated reader confusion. |
| Replace repeated Files-opening steps with a link. | The prerequisite link does not include Files-opening steps; add those steps. Then: replace the added steps with a link. | A correct, sufficient prerequisite link or concise steps are valid. Check the actual linked section. |
| Add workspace selection explanation, then add New workspace… for users without a suitable workspace. | Remove the prerequisite section and create a separate workspace page. | A short prerequisite or accurate link is valid; a limited feature evaluation cannot require a new out-of-scope page. |
| Explain where the Ignored files setting is located. | The added explanation belongs to another window and is off-topic. | Concise location information is valid when the setting affects the Files sidebar section. |
| Document the long-list limit and how to see the rest. | Require symptom, cause, solution, and check for the same limit. | Do not invent a load-rest control or a recovery that the application does not provide. An accurately described product limit is not a documentation failure. |
| Screenshots must show the result; one has no notification or open Git window. | Intermediate-state screenshots are accurate but still penalised for absent result images. | Relevant controls, intermediate states, and results are all acceptable; captions must match actual pixels. |
| Deduct for the unchanged Introduction placeholder and absent tutorial. | Repeat the same site-wide deductions in every limited Files run. | Unselected pages and site-wide tutorial absence are limitations outside the selected-page score. |
| Ordinary expressions such as name box and notification are absent from the glossary. | Treat that absence as user-language inconsistency. | Use established project names for project parts. Ordinary explanatory words do not need glossary entries. |

Several original findings were concrete and useful: obscuring pointers, an insufficient crop, missing workspace access, and inaccurate source claims. Version 2 preserves deductions for verified reader obstacles. Resolving contradictions is not permission to dismiss every negative finding.

## Implementation

The versioned contract distinguishes suggestions from deductions. Every finding records criterion, severity, location, observed evidence, reader impact, source evidence when relevant, and recommendation. The schema checks that each numeric score follows the most severe finding for that criterion, rejects an old rubric version, and rejects duplicate/unexpected page entries. Supplied source paths must exist in the repository. These checks validate structure and arithmetic; a human must still assess evidence truth and relevance.

Claude evaluation defaults are pinned to claude-sonnet-5-5 and high effort, resolved with a real local command. Explicit overrides remain possible. Reports record requested settings and scope. The previous default model was not recorded, so this is a new baseline, not a measured improvement over earlier scores.

## Verification

The judge-focused tests passed: 14 of 14. The package suite passed 37 of 39; the two failures concern the unselected existing Introduction page missing generated/page-type comments. The Introduction page was not changed. Repeated real evaluations and their input hashes are saved alongside this audit. See comparison.md for the observed result and acceptance assessment.

No Files sidebar page or screenshot was edited during this review. No repository commit, pull request, or merge was created.
