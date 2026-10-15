## Fixed evaluation contract: version 3

Evaluate reader outcomes, not whether you could rewrite the page differently. Do not read earlier judge reports or use earlier scores as targets. Optional editorial preferences are suggestions and do not reduce scores. Do not propose a change and also penalise the acceptable alternative.

### Score anchors and evidence

Each finding names one criterion, a page heading/step/image or selected sidebar item, the observed evidence, the reader impact, and a correction. For a source-dependent claim, give the relative source file and the relevant source evidence; verify the rendered interface when code transforms backend data. Distinguish a false claim from a missing source comment. Do not infer a false claim merely because a term is absent from the glossary.

The score for each criterion is determined by its most severe verified finding:

| Severity | Score | Meaning |
| --- | --- | --- |
| No deduction, or suggestion only | 5 | The criterion is met. Optional alternative wording, layout, or images do not prevent 5. |
| minor | 4 | Local friction or a citation gap; the reader can still complete the task or find the information. |
| material | 3 | Demonstrable confusion or a substantial omission; the reader must make a consequential guess or do unnecessary work. |
| blocker | 2 | A demonstrated wrong instruction, unsupported feature, or missing prerequisite prevents the intended task or makes core information unreliable. |
| unusable | 1 | The page cannot support its stated task or lookup purpose. |

Do not stack minor preferences to create a material deduction. A finding can affect several criteria only with separate evidence of the impact on each criterion. State uncertainty as a suggestion or limitation, not as a verified deduction. Verify claims against the project's rules and glossary, then the actual code; disclose a rule/code conflict rather than inventing a feature. A citation gap is normally minor; a materially false operational claim is different.

### Severity decisions, applied before calculating scores

- A verified false operational claim about an available control, accepted input, the kind of copied path, or creation, replacement, modification or deletion of data is an accuracy blocker (2). Correct information elsewhere does not make that false claim safe. Do not downgrade false data-loss information merely because the rest of a reference table is correct.
- A task instruction that requires a nonexistent control, an unavailable mode for the stated file, or an input that the application rejects is a taskSuccess blocker (2). Other paragraphs or screenshots that reveal the correct action do not repair the wrong instruction.
- A necessary interaction omitted from a procedure is taskSuccess material (3) when the real control exists and the reader could infer the missing interaction. This differs from an explicitly wrong action. For example, jumping to a choice in an unopened menu requires guessing; it is not an unavailable feature.
- A screenshot whose caption identifies an instructional state that its pixels do not show is accuracy material (3), even if the correct prose lets the reader finish. This differs from a cosmetic crop or optional image placement. A small cosmetic flaw that does not misrepresent the state is minor (4).
- Judge order when the necessary actions are present but incorrectly sequenced or difficult to locate. An omitted action belongs to taskSuccess; do not also deduct order solely for that same omission. Distinct independent problems may still affect different criteria.
- A demonstrated reader obstacle is not an optional preference merely because the reader can finish the task. Minor local friction still warrants 4; materially false operational information warrants 2. Optional alternatives with no demonstrated obstacle remain suggestions.

### Verification and acceptance

Never claim that repeated agreement or a high average proves correctness. Describe what was inspected and what was not verified. An unknown runtime condition belongs in limitations, not an assertion that it was checked. A score of 5 means no verified defect under this contract, not certification of all facts or runtime behaviour. Any blocker or unusable finding prevents acceptance, regardless of the average. Calibration must test separately prepared good and defective examples without revealing expected answers.

### Six criteria

- taskSuccess: the stated task or lookup goal is achievable without consequential guessing, including clearly linked prerequisites. An application limitation is not a documentation failure when accurately described; do not demand an impossible solution.
- usefulness: content helps this page's task or lookup goal. Penalise duplication only when it creates demonstrable distraction or inconsistent instructions, not merely because two pages mention the same control.
- order: prerequisites and actions are findable in a usable sequence. A concise prerequisite before the main task, or a direct link to that prerequisite, is valid.
- singleType: how-to pages may have concise prerequisites, explanations of results, option tables, and supported troubleshooting. Reference pages may contain action/result lookup tables and concise location descriptions; these are not numbered task procedures.
- userLanguage: use established names for project parts, explaining unfamiliar names in plain words. Ordinary words such as name box, folder tree, and small notification do not need separate glossary entries. Judge clarity rather than exact wording of every sentence.
- accuracy: factual claims match named rule or code sources and actual screenshot states. Do not invent an inaccuracy from an alternative valid wording or from a product limitation.

### Stable decisions for recurring cases

- A reference table saying what a click or key does is valid lookup content. Do not require that table in one evaluation and reject it as how-to steps in another. Do not require every possible row action unless omission affects the page's stated lookup purpose.
- A how-to page can start with a short prerequisite or link. The link text must accurately describe the linked section; a link to workspace selection alone does not explain opening Files. Do not require a separate prerequisite page or a tutorial in a limited feature set.
- Defaults are useful in an option lookup table when supported by sources. Do not require defaults in task instructions merely because the rule file lists them.
- A screenshot may illustrate a control, an intermediate state, or a result. The caption/alternative text must describe the actual state. Require a readable relevant image near the text it helps; do not mandate a screenshot for every step, result, status letter, or notification. The same image can help adjacent header and option sections; optional repositioning is not a deduction without demonstrated reader confusion.
- Inspect every referenced local image before making a visual finding. Root image URLs map to the website's docs/public folder. If pixels cannot be inspected, report that limitation and do not claim that an image is blurry, obscured, or wrong.
- Known recoverable failures need understandable symptoms, supported recovery, and a way to check the result. No fixed heading shape is required. For an unrecoverable application limit, an honest cause/limit and a useful check are sufficient; never request an invented recovery control. Normal disabled controls for an unchanged file are expected behaviour, not mandatory troubleshooting.
- A reference page can name a related control's location when that control affects this feature. A one-sentence location or shortcut is not automatically off-topic or a how-to procedure.
- Related links must have a plausible next use. Two to four useful links are acceptable; do not reject the count or demand unrelated pages. Do not penalise the same fact separately as missing context and unnecessary repetition without explaining the actual conflict.

### Self-check before answering

Check every deduction against these anchors and stable decisions. Remove findings that merely express preferences, demand work outside scope, contradict the source, or impose mutually exclusive requirements. Check every numeric score against the severities of its evidence. Do not raise scores to show improvement: pages may genuinely have material defects under this contract.
