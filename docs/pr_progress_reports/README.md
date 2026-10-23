# Progress reports

- Created: 19 October 2026
- Last updated: 19 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 715](https://github.com/heidrun-org/heidrun/issues/715)

This folder holds dated reports that summarize major changes from pull requests. Each report gives its exact time range and links to the pull requests behind the summary.

To generate another report, use the prompt below and replace the bracketed dates and times.

## Prompt to generate a progress report

> Review the pull requests associated with the GitHub account **[account]** in this repository from **[start date, time, and time zone]** through **[end date, time, and time zone]**. Read each pull request and its description. Write a comprehensive report about the changes, organized around the major features rather than listing every pull request. Describe the work in a neutral, feature-focused voice; avoid addressing the reader or crediting an individual, and use passive wording where it reads naturally. Link each summary to the pull requests that support it. Include the exact reporting period, the report generation date and time with its time zone, and the counts of pull requests by state. Save the report in `docs/pr_progress_reports/` as a Markdown file whose filename contains the precise generation date, time, and time zone offset. Update this folder's `README.md` and `index.md`, and `docs/index.md`, when adding the report.
