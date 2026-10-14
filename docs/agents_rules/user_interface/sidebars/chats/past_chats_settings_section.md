# Past chats sidebar section: the section "Past chats" of the Settings window

- Created: 14 October 2026
- Last updated: 14 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../../glossary/index.md), [chats_list.md](chats_list.md)
- Related issue: [issue 442](https://github.com/heidrun-org/heidrun/issues/442)

This file is a part of the rules of the user interface of Heidrun. The words are defined in [glossary/index.md](../../../glossary/index.md).

- The Settings window has a section "Past chats" (icon `chat-left-text`, the icon of the Past chats sidebar section). It sits in the sidebar of the Settings window just before the section "Dynamic topics", which stays the last section.
- The section holds one choice, "Read the chats again every": a Bootstrap 6 button group of four radio inputs (`btn-group` with `btn-check btn-outline theme-secondary` labels), "5 seconds", "10 seconds", "30 seconds", and "1 minute". The choice is the option `chatsRefreshSeconds` of the settings, in seconds, and the default is 10, so the behavior does not change for the developers who already use Heidrun. A saved value that is not one of the four choices gives the default value back.
- Under the button group, a help paragraph (`form-text`) says that, while the Past chats sidebar section is on the screen, Heidrun reads the files of the chats again after this delay, so that the numbers of a chat that is still running stay true, and that a shorter delay shows the changes sooner.
- The Past chats sidebar section reads the chats again after this delay, while it is on the screen. A change of the choice starts the count again at once, without a new start of Heidrun. The reads of the files are cheap: the program reads again only the lines that the coding agent added to a file, as [chat_summary.md](chat_summary.md) says.
