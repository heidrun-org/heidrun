# Historical learning material; not a generation stage

These files preserve the small GPT-6 Luna / high text calibration used during the experiment. They are copied reference data, not executable runners. Normal generate-and-build never reads them or starts a judge.

- candidates.json: two good and five deliberately defective pane focus history examples.
- expectations_private.json: expected detections and score thresholds; never include this in judge input.
- protocol.json: original fixed settings and separate-call/reversed-order method.
- output_contract.md: one existing source path per source-dependent finding.
- input_hashes.json: original input fingerprints; those files may differ in the current checkout.
- rubric_3.md: the fixed evaluation contract used at that point.

For a future explicitly requested calibration, first preserve a matching current source snapshot, refresh good/defective examples and freeze expectations. Give each example and the rubric to a fresh independent judge call with source access. Keep expectations, prior answers and scores withheld. Score detection, severity and output format separately; retain failures and account for good examples incorrectly flagged. Do not rerun just to get a better number.

The old fixtures and expected labels describe historical behavior. Do not treat their assertions, old source paths or success thresholds as verified current behavior. This set did not calibrate screenshot understanding or prove reliability for every feature. The original protocol's concurrency allowance is a historical record, not permission to delegate or parallelize future work. Human approval is required to start a new learning experiment.
