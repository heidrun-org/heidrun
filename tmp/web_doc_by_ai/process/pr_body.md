## Summary

Fixes #407.

Preserve the complete AI documentation experiment under `tmp/web_doc_by_ai`, including the nested source workspace, generator and learned prompt, calibrated judge, screenshots, data, raw results, historical snapshots and process documents. Normal website and application files are unchanged. Dependencies, caches and compiled output are excluded.

The parked commands target their own workspace. The writer and judge scripts use `node --import tsx` after the original command could not create its temporary socket. The process keeps generation separate from separately authorised Git publication.

## Evidence already recorded

- Dependency installation passed.
- Writer and judge dry runs passed.
- Seven pure judge tests and 111 website tests passed.
- Production website build passed; all four Files pages and screenshots loaded in the browser.

These are prior checks preserved in `results/parked_folder_check`; no additional model run or test suite was started for this pull request. The main checkout was built before worktree creation as required by the repository instructions.

## Current experiment limits

The GPT-6.1 Sol / high correction attempt was stopped by the user during writing. Existing pages were unchanged and the calibrated judge was not started. Two known documentation defects remain: repository-relative paths when the workspace is a subfolder, and explicit selection of a newly added workspace. Calibration evidence is limited, and source-only scores are not acceptance.

This pull request preserves an experiment. It does not integrate the pages into the normal website, correct those unresolved page defects, deploy anything or authorise further paid model runs. The pull request is left unmerged for the developer.

## Preservation review

The archive is approximately 42 MB and includes full source snapshots so that the experiment remains separate from the normal packages. Staged paths were checked to stay under the experiment folder. Token/private-key pattern and credential-filename checks found no matches. The whitespace check reports warnings in preserved source snapshots, historical patches and raw logs; original evidence bytes are intentionally retained.
