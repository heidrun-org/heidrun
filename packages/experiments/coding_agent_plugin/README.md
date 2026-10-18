# Coding agent plugin

This package is a temporary working folder. It holds a copy of the four skills that all the repositories of the developer share, so that the developer can work on the four skills as one group, and later turn the group into a plugin for a coding agent. A coding agent is Claude Code, Codex, or Antigravity. A plugin is the word that Claude Code and Codex use for a group of skills with a manifest file.

## What is in this package

The package holds copies of text files and no code. It has no test and no script, because a test would only compare each copy with its original, and the originals change often.

- `skills/issue_fix_workflow/`: fixes one issue in four parts (the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, and the Issue Fix Completion), in a temporary worktree.
- `skills/bug_triage_workflow/`: triages the open issues of a repository to keep the list small, and closes an issue only when the developer names its number.
- `skills/git_cleanup_adviser/`: reviews the Git branches and the worktrees, and advises which ones appear safe to remove. It gives advice only and removes nothing.
- `skills/context_md_system/`: reads, creates, updates, and verifies the `CONTEXT.md` files, the short files that hold the purpose, the exports, and the rules of one folder.
- `CONTEXT.md`: the purpose, the exports, and the rules of this folder, for a coding agent.
- `package.json`: the package file, with no dependency and no script.

## Install the skills with the skills command line

The web site skills.sh belongs to the command line tool `skills`. The command `npx` runs this tool without a separate installation, and `npx` comes with Node.js. Run the commands below in the project that must receive the skills.

To install the four skills from the folder of this package on GitHub, give the address of the folder. The address names the branch `dev_jerome`.

```bash
npx skills add https://github.com/heidrun-org/heidrun/tree/dev_jerome/packages/experiments/coding_agent_plugin
```

To try the package before its branch has the folder, give the path of the folder on this computer in place of the address.

```bash
npx skills add /path/to/heidrun/packages/experiments/coding_agent_plugin
```

Without options, the tool shows the four skills and asks which skills to install and for which coding agents. To install all four skills for Claude Code and Codex without any question, add the options as below.

```bash
npx skills add https://github.com/heidrun-org/heidrun/tree/dev_jerome/packages/experiments/coding_agent_plugin --skill '*' --agent claude-code --agent codex --yes
```

The tool writes each skill in the folder `.agents/skills/<name>` of the project, which Codex reads. It adds a symbolic link in the folder `.claude/skills/<name>` for Claude Code, and it writes the file `skills-lock.json` at the root of the project.

These options of the command `npx skills add` are the useful ones:

- `--list` (or `-l`): shows the skills that the tool finds, and installs nothing.
- `--skill <name>` (or `-s`): installs only the skill with this name. Repeat the option for several skills. `'*'` means all the skills.
- `--agent <name>` (or `-a`): installs for this coding agent, for example `claude-code` or `codex`. Repeat the option for several coding agents.
- `--global` (or `-g`): installs in the folder of the user, so that every project sees the skills, and not in the project.
- `--copy`: copies the files in place of symbolic links.
- `--yes` (or `-y`): asks no question.

## How to work on the skills

The original skills stay in the folder `.agents/skills` of the repository, and the links in the folder `.claude/skills` stay the same. The copy and the original can differ later, because the package does not keep them in sync. A change to a skill is made in `.agents/skills` first.

To compare a copy with its original, run this command at the root of the repository, with the name of the skill in place of `issue_fix_workflow`. The command prints nothing when the two folders are identical.

```bash
diff -r .agents/skills/issue_fix_workflow packages/experiments/coding_agent_plugin/skills/issue_fix_workflow
```

## What this package does not do

- It makes no plugin manifest yet. The manifest comes in a later issue.
- It does not install a plugin in a coding agent. The section "Install the skills with the skills command line" installs only the skills, one folder for each skill.
- It makes no choice about the shared place for the skills of all the repositories.
- It does not keep the copies in sync with the originals.
- It changes nothing in the application, and nothing outside the folder `packages/experiments` imports it.

## When this package goes away

The package is removed, or replaced by the real plugin, when the parent issue decides where the shared skills live.

- [Issue 682](https://github.com/heidrun-org/heidrun/issues/682): the plan for the first step, which creates this package.
- [Issue 658](https://github.com/heidrun-org/heidrun/issues/658): the parent issue, which decides the shared place.
