# Judgement of the documentation: 3.7 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.7 | 3 | 3 | 4 | 4 | 4 | 4 | 19 | 1 sentences | 0 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 4.0 | 3 | 3 | 4 | 5 | 4 | 5 | 13 | 1 sentences | 0 | no | 3 links |
| copy_a_file_path.md | how-to | 4.5 | 4 | 4 | 5 | 5 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |
| create_a_file_or_folder.md | how-to | 3.8 | 3 | 4 | 4 | 3 | 4 | 5 | 20 | 2 sentences | 0 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.7 | 3 | 3 | 4 | 4 | 3 | 5 | 29 | 4 sentences | 1 | no | 4 links |
| open_a_file.md | how-to | 4.0 | 3 | 3 | 4 | 5 | 4 | 5 | 11 | 1 sentences | 0 | no | 3 links |

Site: navigation 3, consistency 3.

- The only entry in "Get started" is the Introduction, which is a placeholder ("This page is a placeholder"). No page tells a new reader how to open the Files sidebar section. The Related pages are also incomplete: browse_files does not link to copy_a_file_path or to the appearance page, the reference does not link to the appearance page, and the Keyboard shortcuts page is not linked by any page of this group.
- The Troubleshooting is uneven. Only browse_files and create_a_file_or_folder have one, yet open_a_file and the other pages need a Git repository too. The same facts repeat across pages: a click on a file opens the large Git window appears in four pages, and the Refresh and Collapse description appears in two.
- The words and the shape differ from page to page. "Files" is bold in browse_files and open_a_file but plain in the other pages. The headings of copy_a_file_path and open_a_file repeat the page title. Only some pages name the icon-only buttons, and none says that they show only an icon.

### browse_files.md (3.7)

A correct but thin how-to: the steps are short and the Troubleshooting is real, but the way to reach the Files sidebar section is missing and the heading promises a find that does not exist.

- The section "Find a file or folder" promises a way to find, but the Files sidebar section has no search. Step 2 "Look through the folder tree" is not an action. Rename the section "Browse the folder tree" and replace step 2 with the action "Click the arrow of a folder to see its content", or merge steps 2 and 3.
- No page says how to open the Files sidebar section. Step 1 says "Open the Files sidebar section" but never names the folder icon at the top of the left sidebar. Add this to step 1.
- The Troubleshooting heading paraphrases the message. The screen shows "This workspace is not a Git repository.", so use these exact words. Add the second message "Select a workspace." and its solution, because a new reader meets it first.

### change_the_files_list_appearance.md (4.0)

Every claim is correct and the page keeps to one type, but the repeated step and the hidden icon make a simple task harder than it must be.

- "More options" is a button that shows only three vertical dots, and the page never says so. A new user cannot find it from the name alone. Write "Select **More options** (three vertical dots) in the header".
- The two sections repeat step 1 word for word. Merge them into one list: open the menu, then choose indentation, row height, and indent guides. Say that a check mark shows the choice that is on.
- The page gives no defaults and no result. Add the defaults (Medium, Comfortable, Show) so the reader can go back, and say that Heidrun keeps the choices.

### copy_a_file_path.md (4.5)

The best page of the set: three clear steps, a visible result, and correct facts; only a few small gaps remain.

- Say that only a file row has the menu. A right click on a folder row does nothing special, and a reader who tries it will think the feature is broken.
- Say what "relative" means in the step itself: relative to the folder of the workspace. Today it appears only in the introduction.
- The heading "Copy a file path" repeats the page title. Remove it or use a heading that adds information. Add how to reach the Files sidebar section, or link to a page that says it.

### create_a_file_or_folder.md (3.8)

The facts are correct and the Troubleshooting is good, but a descriptive section and a crowded step 3 weaken the how-to, and the empty folder surprise is not told.

- "Choose where to create the item" is a description paragraph, not steps. Turn it into step 1: "Click the folder where you want the new item", then state the fallback (the folder of a selected file, otherwise the repository root).
- Step 3 holds four facts: the key, the new row selected, the file opening, and the result. Split it into the action and a result sentence. The sentence about cancelling also belongs in its own line.
- Add what the reader will meet. A new empty folder disappears from the tree after Heidrun restarts, because Git does not list an empty folder. Heidrun shows an error message when the name has a slash or exists. A blank name closes the name box without creating anything.

### files_sidebar_reference.md (3.7)

The facts are correct and the two tables are good, but the page leaves out the right-click menu and the defaults, and the first section is a paragraph instead of a table.

- The reference misses things a reader will look up: the right-click menu of a file row (Copy absolute path, Copy relative path), the defaults of More options (Medium, Comfortable, Show), the message "Select a workspace.", the message "This workspace is not a Git repository.", and the fact that the tree reloads when the repository changes. Add a section or table row for each.
- The section "Folder tree" is a dense paragraph of four long sentences. Turn it into a table of what a row shows (arrow, icon, name, status letter, dot). Remove internal wording like "a space for a folder arrow". Explain "the setting to show ignored files", or say where it is.
- "Opening files" repeats the click on a file in "Rows and selection", and the page open_a_file repeats it again. Keep one line in "Rows and selection" and delete the section "Opening files", or add what changed files show. Add the page change_the_files_list_appearance to the Related pages, because "More options" belongs to it.

### open_a_file.md (4.0)

Correct and short, but it adds almost nothing to the click on a file row that three other pages already describe.

- Step 2 "Find the file in the Files sidebar section" is vague and repeats the page browse_files. Say the action: click the arrow of a folder until the file shows, then click the file row. Merge steps 2 and 3.
- The last sentence about **Diff** and **Side by side** tells what is disabled, but not what the reader sees or why. Say that the file shows in full because it has no change, and say what a changed file shows. Add how to close the large Git window.
- The page nearly repeats browse_files and the reference. Add something only this page can give, for example what the large Git window offers, or merge the page into browse_files.