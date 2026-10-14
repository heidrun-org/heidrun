# Parked folder verification

Date: 14 October 2026.

## Results

- Dependencies installed: 404 packages, 10 workspace projects, frozen lockfile.
- Writer dry run passed with the Files sidebar rule limit.
- Judge dry run passed with the four Files sidebar pages.
- Pure judge tests: 7 passed, 9 skipped. Skipped tests create temporary Git fixture commits.
- Website tests: 111 passed across 7 files.
- Production build passed in 1.73 seconds.
- Browser preview loaded all four pages and all four screenshot images. browser_checks.json records loaded image dimensions; preview.jpg records the rendered website.
- The four generated pages and screenshot source files match the preserved source manifest.

## Parked command correction

The original tsx command failed with listen EPERM while creating a temporary socket. Both direct Node invocations succeeded. The two parked workspace package scripts now use node --import tsx. The original package.json is preserved in history/before_parked_check. Failed attempts and successful commands remain in this folder. Dependencies and build output remain in the parked folder and are ignored by its local .gitignore.

## Verification limits

No paid model generation or fresh AI evaluation occurred. Dry runs prove local input reading and prompt construction, not model execution. The native application was not exercised. The two previously confirmed documentation defects remain unchanged; see process/HANDOFF.md.

Fifteen outside tracked file fingerprints differ from the initial snapshot. Final Git status has no tracked changes, and the branch and index remain unchanged. This check did not edit those outside files, but concurrent or intervening repository updates prevent claiming that the whole checkout stayed unchanged. result.json lists the differences. No staging, commit, pull request, merge, push or deployment was performed by this check. The temporary preview was stopped after verification.
