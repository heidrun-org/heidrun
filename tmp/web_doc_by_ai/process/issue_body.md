## Request

Preserve the AI documentation experiment in `tmp/web_doc_by_ai` as an isolated, reviewable repository change. This issue covers storing the experiment and its current state; integration into the production website is a later decision.

## Scope

- Preserve generator source, learned writing prompt, calibrated judge, source snapshots, screenshots, evaluation data, raw results and process documents.
- Keep the experiment limited to the Files sidebar rule and four Files sidebar pages.
- Make the parked workspace runnable without changing the normal website or root commands.
- Record failed and stopped runs, known defects and verification limits.
- Prepare the existing change in a temporary worktree, commit it and open a pull request targeting `dev_jerome`. Do not merge the pull request.

## Current evidence

Dependency installation, writer and judge dry runs, seven pure judge tests, 111 website tests, the production website build and browser loading of the four pages and screenshots passed. These checks did not perform a paid model run.

The subsequent GPT-6.1 Sol / high generator run was stopped at the user's request during the writing pass. Existing generated pages were unchanged and the judge was not started. Preserve this as an interrupted attempt, not a successful generation.

Two documentation defects remain: relative paths use the Git repository root when the workspace is a repository subfolder, and New workspace… adds a workspace without selecting it. The calibrated evaluation evidence is narrow and does not prove universal judge reliability.

## Acceptance criteria

- All experiment files added by the pull request are under `tmp/web_doc_by_ai`.
- Dependencies, caches and generated build output are excluded from the commit.
- Instructions distinguish generator operation from separately authorized Git publication.
- The experiment state and resume commands are documented, with the two known defects still identified.
- The normal website and application source remain unchanged.

## Parked website preview

![Rendered Files sidebar page](https://github.com/user-attachments/assets/4da439fd-28ad-478d-bdf3-4ddfdc644f1d)
