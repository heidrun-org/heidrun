# Chats sidebar section: the dates line

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../../../glossary/index.md)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../../../glossary/index.md).

- The dates line has an information card, opened the same way as the information card of the files line: the whole line is the part that gets a background under the pointer, and a click on the line opens the information card.
- The information card of the dates line has a title with the clock icon and the text "Dates and messages", then one row for each fact, with the name of the fact in muted color at the left and its value at the right: "Started" and "Last activity" say how long ago the date was with one unit ("2 days ago", "Just now" under one minute), and each one ends with a small question mark (the HTML tag `small` around the icon `question-circle`) whose title is the full date with the day of the week and the time; "Duration" has one unit, rounded to the nearest ("12 minutes", "3 hours", "Less than a minute"); and "Messages from you" is the number of messages. A fact that the chat does not have is left out. The text "ago" is made again each time the information card opens. A muted row "Your first messages" follows, then one row with a chat icon for each of the first three messages that the developer typed, in order, each one on one line of text cut to 300 characters by the program. A row of a fact and a row of a message get the soft background while the pointer is over them, like the rows of the other information cards of a chat. The information card shows no folder and no file: the files line shows the files. The name of a fact stays on one line.
