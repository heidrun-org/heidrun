# Chats sidebar section: the summary of a chat

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../../glossary.md)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary.md](../../../glossary.md).

- Under the title, each chat shows a summary in muted color, in up to three lines. A line has no indent: its icon starts at the same place as the first letter of the title. A line that has nothing to say is left out. Each line starts with a small icon.
  1. The clock icon, then the first and the last date, then the number of messages from the developer.
  2. The icon of the forge of the repository (GitHub or GitLab, else the Git icon), then the issue numbers, then the pull request numbers. A list of numbers shows the first three, then "+" and how many more.
  3. The file icon, then the names of the first two files that the coding agent wrote, then "+" and how many more. This line is the files line.
  The folders where the coding agent ran are found and kept, but the summary does not show them yet.
- Every information card of a chat is 34 rem wide, and narrower when the window leaves less room at the left of its part. A list in an information card that is taller than half of the window scrolls, with the scroll bar of the section "Scroll bars".
- The program finds the summary without a model, by reading the file of the chat: the dates come from the `timestamp` field of the records, the messages from the records that the developer typed (the program also keeps the text of the first three, on one line, cut to 300 characters), and the files from the Write, Edit, MultiEdit, and NotebookEdit tools of Claude and from the patches of Codex. A pull request number comes from the `pr-link` records of Claude, from addresses that end with `/pull/<number>`, and from the words "pull request" or "PR" before a number. An issue number comes from addresses that end with `/issues/<number>`, from the word "issue" before a number, from `gh` commands, and from a bare `#<number>` in a message of the developer or in a commit command. A number that is a pull request is never an issue.
- The program keeps what it read in each file in the file `chats_cache.json`, in the data folder of Heidrun. It reads a file again only when the size or the modification date of the file changes. A file that only grew is read from the place where the last read stopped, so a long chat that is still running costs little.
