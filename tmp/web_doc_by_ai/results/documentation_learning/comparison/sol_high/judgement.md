# Judgement of the documentation: 3.6 out of 5

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| browse_files.md | how-to | 3.8 | 4 | 3 | 4 | 4 | 4 | 4 | 38 | 2 sentences | 4 | yes | 3 links |
| change_the_files_list_appearance.md | how-to | 3.7 | 4 | 3 | 3 | 4 | 4 | 4 | 18 | 2 sentences | 0 | no | 2 links |
| copy_a_file_path.md | how-to | 4.0 | 4 | 4 | 4 | 4 | 4 | 4 | 20 | 2 sentences | 1 | yes | 3 links |
| create_a_file_or_folder.md | how-to | 3.8 | 4 | 3 | 4 | 4 | 4 | 4 | 31 | 2 sentences | 2 | yes | 3 links |
| files_sidebar_reference.md | reference | 3.8 | 4 | 4 | 3 | 4 | 4 | 4 | 55 | 3 sentences | 2 | no | 4 links |
| open_a_file.md | how-to | 3.5 | 3 | 3 | 4 | 4 | 4 | 3 | 18 | 2 sentences | 1 | yes | 3 links |

Site: navigation 3, consistency 3.

- The sidebar entry "Get started > Introduction" leads to a placeholder page ("This page is a placeholder"), so a new user has no tutorial and no first success. Write the tutorial, or remove the entry.
- The same thing has three names: "Files list" (title of change_the_files_list_appearance), "folder tree", and "Files sidebar section". Pick the glossary words and use them on every page and in the sidebar. The terms "large Git window" and "name box" are used on four pages and are explained on none.
- The Troubleshooting sections do not have the same shape: some entries have a cause, a solution, and a check, and others (browse_files, create_a_file_or_folder) have only a cause. The messages "Select a workspace." and "This workspace is not a Git repository." appear in both browse_files and the reference page, so the pages overlap. Also, every Related pages list ends with the same reference link, and several links (for example from "Open a file" to "Copy a file path") do not lead to a next need.

### browse_files.md (3.8)

Clear steps and a complete Troubleshooting section, but the Troubleshooting section is padded with duplicate and non-failure entries and the headings are too many for 38 lines.

- The Troubleshooting section has two entries with the same cause and the same solution ("Select a workspace." and "This workspace is not a Git repository."). Merge them into one entry, and delete the entry "Refresh is disabled", because it is a short normal wait and not a failure.
- The last Troubleshooting entry ("The list is too long") has no solution and no check, so it does not follow the shape of the other entries. Say in one line that the reader can do nothing about it, or move it to the reference page.
- Steps 3 and 4 are one action; merge them. The sections "Refresh the folder tree" and "Collapse all folders" each have a heading for one step; join them in one section. The page also does not say that Heidrun reloads the folder tree by itself when the repository changes, so the reader does not know when Refresh is needed.

### change_the_files_list_appearance.md (3.7)

The facts are correct (the menu closes after each choice, and Heidrun saves the choices), but the forced single sequence and the repeated Reopen steps make a simple task look long.

- Steps 3, 5, and 7 are three independent choices forced into one sequence, with the filler steps 4 and 6 ("Reopen More options"). Write one short numbered procedure that opens More options and chooses one item, then list the three groups and their choices in a small table.
- The page does not give the default of each group (Medium, Comfortable, Show). A reader who wants to undo a change cannot know which choice is the original one; the rule file states the three defaults.
- The section "Check the selected choices" repeats the first section and adds a second Reopen step; replace it with one sentence: a check mark shows the selected choice, and the folder tree changes at once.

### copy_a_file_path.md (4.0)

Short, correct, and well ordered; only the broken numbering and one weak Related page link lower the score.

- The sentence "The menu closes, and a message shows the copied path." splits the numbered list, so step 4 starts a new list. Put the result inside step 3 and keep one list.
- The Troubleshooting entry repeats steps 2 and 3 as its solution. Reduce it to the symptom, the cause (folder rows have no menu), and the one change to make: right-click a file row.
- The related page "Open a file" ("to view the file before using the path") does not lead to a next need of the reader. Replace it with a link that does, or remove it.

### create_a_file_or_folder.md (3.8)

The task works as written and the facts match the rules, but the destination step is crowded, and the Troubleshooting section has one incomplete entry and one entry whose symptom the reader cannot recognize.

- The second Troubleshooting entry (an empty folder disappears after a restart) has no solution and no check; it describes a limit and not a failure. Move it to the reference page, or add a solution that the rule files support.
- Step 2 of "Choose the destination" mixes three outcomes with a side effect ("the file also opens in the large Git window, which you can close with Escape"). Use a short table (what you click, where the new item goes), and keep the side effect out of the step.
- The first Troubleshooting entry does not show the message that the reader sees ("A name cannot contain the character /. Select a folder first."), so the reader cannot match the symptom. Also, explanation paragraphs between steps 1, 2, and 3 interrupt the numbered list.

### files_sidebar_reference.md (3.8)

A useful page to look up, with correct tables, but one undefined option, missing defaults, and uneven sections stop it from being a clean reference.

- "Ignored folders appear only when the option to show ignored files is enabled" never says where the option is. The option is the checkbox "Ignored files" in the Files window, not in the Files sidebar section. Name the place, or the reader cannot act on the sentence.
- The three appearance groups have no defaults and no sizes in the table. A reference page must give them: Indentation Medium (20 pixels), Row height Comfortable (30 pixels), Indent guides Show; the rule file states these.
- The section "Selection and folder state" is prose while the other sections are tables, and it sits apart from "Rows and selection". The last table mixes error messages, a capability ("Available file changes"), and a limit (empty folders). Merge the two selection sections into one table, and split the last table into messages and limits.

### open_a_file.md (3.5)

Short and readable, but it covers only one of the two things a reader sees when opening a file, and its Troubleshooting entry describes expected behavior as a problem.

- The page says that a file with no changes appears as a whole file, but never says that a file with changes opens as a diff. A reader who opens a changed file sees a diff and not the file; the page does not say so, and does not say that the button File shows the whole file in that case.
- The Troubleshooting entry is not a failure: the buttons Diff and Side by side are disabled by design for an unchanged file, and the large Git window already shows the whole file (the code switches to the file view by itself). The solution "Click File" is therefore unneeded and contradicts the sentence in step 2. Replace the entry with the real case: a changed file opens as a diff, and File shows the whole file.
- Step 3 (press Escape) is closing the window, not part of the task, and the section is one heading for three short steps. Make it one short note, and replace the weak Related page "Copy a file path" with a link that leads to the next need.