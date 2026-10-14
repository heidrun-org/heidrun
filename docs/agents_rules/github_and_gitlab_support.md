# Rule: every support for GitHub is also a support for GitLab

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun](glossary/index.md)
- Related issue: [issue 302](https://github.com/heidrun-org/heidrun/issues/302)

This file gives the rule for every agent that adds support for GitHub. Heidrun works with two Git hosting services: GitHub and GitLab. Everywhere that this repository supports GitHub, it must also support GitLab.

## The rule

- When a change adds support for GitHub, the same change adds the same support for GitLab. This is true for the code of the application, for the documents, and for the instructions to agents in `AGENTS.md`.
- A change that adds support for GitHub is not finished until the same support for GitLab exists, or until a separate issue for the GitLab support exists. When you use a separate issue, write its number in the description of the pull request.
- When a document shows a `gh` command, it also shows the matching `glab` command, next to the `gh` command. `gh` is the command line tool of GitHub. `glab` is the command line tool of GitLab.
- When a `gh` command or option has no matching `glab` command or option, say it in the document, and create a separate issue for the missing support.
- Create each separate issue on GitHub, with the `gh` command, as the section "GitHub and GitLab" of `AGENTS.md` describes.

## The words

- Write "pull request" for GitHub, and "merge request" for GitLab.
- When a text is about both hosting services, write "pull request (GitHub) or merge request (GitLab)".
- Write "issue" for both hosting services.

## The matching commands

Each row gives the `gh` command and the matching `glab` command. In the `glab` option `--attach`, the word "experimental" means that GitLab can change or remove the option without notice. Run `glab <command> --help` to check an option before you use it.

| Action | GitHub | GitLab |
| --- | --- | --- |
| Read an issue | `gh issue view <number>` | `glab issue view <number>` |
| Create an issue | `gh issue create --title "<title>" --body "<body>"` | `glab issue create --title "<title>" --description "<body>"` |
| Attach a file when you create an issue | `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'` | `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'` |
| Attach a file to an existing issue | `gh issue edit <number> --attach './screenshot.png#Alt text'` | `glab issue update <number> --attach './screenshot.png'` |
| Close an issue | `gh issue close <number>` | `glab issue close <number>` |
| Create a pull request or a merge request | `gh pr create --title "<title>" --body "<body>"` | `glab mr create --title "<title>" --description "<body>"` |
| Merge a pull request or a merge request | `gh pr merge <number>` | `glab mr merge <number>` |

The option `--attach` of `glab` takes a file path only. It has no alternative text after `#`.
