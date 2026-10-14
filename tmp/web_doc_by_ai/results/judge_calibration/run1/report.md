# Judgement of the documentation: 4.6 out of 5

Rubric 2; scope: selected pages; agent: claude; model: claude-sonnet-5-5; effort: high.

| Page | Type | Mean | taskSuccess | usefulness | order | singleType | userLanguage | accuracy | Lines | Longest paragraph | Paragraph runs | Troubleshooting | Related pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sample_19.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_42.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_07.md | reference | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 15 | 3 sentences | 0 | no | 2 links |
| sample_63.md | how-to | 4.5 | 3 | 4 | 5 | 5 | 5 | 5 | 20 | 2 sentences | 1 | yes | 2 links |
| sample_28.md | how-to | 4.2 | 3 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_55.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_34.md | how-to | 4.2 | 3 | 5 | 5 | 5 | 5 | 2 | 21 | 3 sentences | 1 | yes | 2 links |
| sample_81.md | how-to | 4.7 | 5 | 5 | 5 | 5 | 5 | 3 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_12.md | how-to | 5.0 | 5 | 5 | 5 | 5 | 5 | 5 | 12 | 2 sentences | 0 | no | 2 links |
| sample_46.md | reference | 4.7 | 5 | 5 | 5 | 5 | 5 | 3 | 15 | 3 sentences | 0 | no | 2 links |
| sample_73.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 16 | 3 sentences | 0 | yes | 2 links |
| sample_90.md | how-to | 4.0 | 2 | 5 | 5 | 5 | 5 | 2 | 12 | 2 sentences | 0 | no | 2 links |

Site: navigation 5, consistency 5.



Limitations and outside-scope observations (not scored):

- Site scoring does not apply to independent candidates, so navigation and consistency are neutral.
- The candidates sample_07 and sample_46 are titled 'Files sidebar row actions'. The sidebar item is 'Files sidebar section controls'. This was not scored, because the candidates are independent.
- The linked page create_a_file_or_folder.md has a French error-message heading. It is outside the selected scope and was not scored.
- The behaviour of every page was checked in the rule file and the code. The application was not run.

### sample_19.md (5.0)

The steps match the right-click file menu, the two copy actions and the Copied toast in the rule and the code. The task is achievable and accurate.


Evidence:


### sample_42.md (4.0)

The page names an item that does not exist and presents it as the relative-path copy, so the task cannot be completed as written.

- The page names a non-existent menu item, Upload file to GitHub, in the steps, the table and the check.

Evidence:

- accuracy / blocker / Steps step 4, the table, and Troubleshooting: The page names the menu item **Upload file to GitHub** and says it copies the relative path `docs/README.md`. Impact: The menu has no such item, and an upload is not a copy. The core lookup table and the check in Troubleshooting are wrong.. Source: packages/apps/web_frontend/src/i18n/locales/en/filesPanel.json. The only items are "fileMenu.copyAbsolutePath": "Copy absolute path" and "fileMenu.copyRelativePath": "Copy relative path". The rule files.md says the context menu has two items and the Files sidebar section only reads files. Recommendation: Replace every mention of Upload file to GitHub with Copy relative path.
- taskSuccess / blocker / Steps step 4: The step tells the reader to choose an item that does not exist, and the check in Troubleshooting asks for the same missing item. Impact: The reader cannot copy the relative path by following the page. The reader may look for a GitHub upload feature.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The context menu only calls copyPath('absolute') and copyPath('relative'). Recommendation: Name the real second item, Copy relative path.

### sample_07.md (5.0)

A clean lookup table. Every row matches the rule and the code, including the folder-row context menu and the empty-folder behaviour.


Evidence:


### sample_63.md (4.5)

The page is mostly accurate, but the missing right-click step leaves the reader guessing how to reach the menu items.

- The step that opens the context menu is missing.
- The Troubleshooting entry has a symptom only.

Evidence:

- taskSuccess / material / Steps step 3: Step 3 says to choose Copy absolute path or Copy relative path. No step says to right-click the file row to open the context menu. Impact: The two items appear only in a context menu that opens on right-click of a file row. The reader must guess how to reach them. The menu is mentioned only later, in the sentence after the steps and in Troubleshooting.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The row has @contextmenu="openFileMenu($event, entry.row)", and there is no other copy control. Recommendation: Add the step: right-click the file row to open the context menu.
- usefulness / minor / Troubleshooting: The only text is 'A folder row has no path-copy context menu.' It gives no recovery and no check. Impact: The reader sees the symptom but not what to do. The reader still has to guess to right-click a file row.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. openFileMenu returns early when row.dir is true. Recommendation: Add the recovery (right-click a file row) and a check that the two items appear.

### sample_28.md (4.2)

The steps are right, but the table that guides the choice gives the wrong result for each item.

- The table swaps the results of the two copy items.

Evidence:

- accuracy / blocker / The table under Steps: The Copy absolute path row shows `docs/README.md`. The Copy relative path row shows `/Users/alex/projects/example/docs/README.md`. Impact: The two results are swapped, so the core lookup table is unreliable. It also contradicts its own Use when column.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. copyPath('absolute') copies the result of file_full_path. copyPath('relative') copies row.path, relative to the workspace folder. Recommendation: Swap the copied text of the two rows.
- taskSuccess / material / Step 4 and the table: Step 4 tells the reader to choose by the table. The table gives each choice the wrong result. Impact: The reader who follows the table pastes a path of the wrong kind.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The same copyPath function: the absolute path comes from file_full_path. Recommendation: Correct the table, as in the accuracy finding.

### sample_55.md (5.0)

The steps, the no-slash rule, Enter and Escape, the error behaviour and the screenshot all match the rule and the code.


Evidence:


### sample_34.md (4.2)

A false instruction, to right-click a folder row, makes the main steps fail. Only a self-contradicting Troubleshooting entry saves the task.

- The page says a folder row has the file context menu. It does not.

Evidence:

- accuracy / blocker / Steps step 3 and Troubleshooting: Step 3 says to right-click the folder row to open the context menu and copy the folder path. Troubleshooting says a folder row has the same menu as a file. Impact: A folder row has no context menu, so the instruction cannot work. The page also contradicts itself, because the same entry then says to right-click a file row instead.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. openFileMenu: if (row.dir) { return; }. The rule files.md says: 'The row of a folder has no context menu.' Recommendation: Say to right-click the file row. State that a folder row has no path-copy menu.
- taskSuccess / material / Steps step 3: The step sends the reader to the folder row, which gives no menu. The page title, the example and the table say file. Impact: The reader must work out that the step is wrong. Troubleshooting is the only place that gives a way out, and it contradicts its own symptom.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The folder-row menu is never opened. Recommendation: Correct step 3 and the Troubleshooting entry.

### sample_81.md (4.7)

The text steps are correct, but the image does not show the state named in its caption.

- The screenshot shows the file context menu, not the name box that the caption describes.

Evidence:

- accuracy / material / The image after step 3: The alternative text says a name box inside docs with example.md typed. The image copy_path.png shows the context menu of README.md with Copy absolute path and Copy relative path, and no name box. Impact: The screenshot shows a different state from the caption and from the step beside it. A reader looking for the name box sees a copy menu.. Source: packages/auxiliary/website_public/docs/public/documentation_images/files/screenshots.json. new_file.png shows the New file name box with example.md typed. copy_path.png shows the context menu. Recommendation: Use new_file.png for this step.

### sample_12.md (5.0)

The Reading button appears only for Markdown files, and the page says so correctly.


Evidence:


### sample_46.md (4.7)

The row-action table is accurate, but the Empty folders section states a false destructive behaviour.

- The Empty folders section says Heidrun deletes the folder from disk.

Evidence:

- accuracy / material / Empty folders: The text says: 'After restart, Heidrun deletes the empty folder from disk.' Impact: Heidrun never deletes a folder. The reader may fear data loss, or may not know that the empty folder stays on disk. The rest of the table is correct.. Source: docs/agents_rules/user_interface/sidebars/files.md. The rule says the tree remembers new empty folders until Heidrun restarts. It forgets the folders that no longer exist on disk and never removes any. dirs_existing in packages/apps/desktop_tauri/src/files.rs only reads the disk. Recommendation: Say that the folder stays on disk and is absent from the folder tree after a restart.

### sample_73.md (4.0)

The key instruction is false: the application rejects a slash in the name, so the promised result cannot happen.

- The page says the name box accepts a slash. It refuses it, and nothing is created.

Evidence:

- accuracy / blocker / Steps step 3: The step says: 'Type `notes/today.md` to create a folder and a file together. The slash is accepted in the name box.' Impact: The name cannot contain a slash. The caption of the image still says example.md, so it also disagrees with the step.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. submitNaming: if (name.includes('/')) { toast(t('filesPanel.nameHasSlash'), 'error'); return; }. The message is 'A name cannot contain the character /. Select a folder first.' Recommendation: Tell the reader to type a name without a slash, and to select the destination folder first.
- taskSuccess / blocker / Steps step 3 and step 4: Following step 3 and pressing Enter gives an error toast and creates nothing. The page never mentions that error. Impact: The page promises a created folder and file that the application refuses to create. The reader's task fails with no explanation. The Troubleshooting entry covers only duplicate names.. Source: packages/apps/web_frontend/src/components/FilesPanel.vue. The same submitNaming check returns before file_create is called. Recommendation: Remove the nested path. Add the slash error to Troubleshooting.

### sample_90.md (4.0)

The page describes a feature that does not exist for TypeScript files, so its stated task is impossible.

- The page claims the Reading button exists for every file. It exists only for Markdown files.

Evidence:

- accuracy / blocker / Before you start and the opening sentence: The page says **Reading** is available for every file, and describes a TypeScript file shown in Reading mode. Impact: The Reading button exists only for Markdown files. The feature the page describes does not exist for TypeScript.. Source: packages/apps/web_frontend/src/components/GitModal.vue. The button is `v-if="md"`, with `md = isMarkdown(selected)`, which matches only .md, .markdown or .mdx. The mode falls back to 'file' when the file is not Markdown. The comment says Reading only exists for Markdown. Recommendation: Say that Reading is for Markdown files only. For TypeScript, say that the file shows as a whole file.
- taskSuccess / blocker / Steps step 3: Step 3 tells the reader to click Reading for the TypeScript file. No such button is shown for it. Impact: The stated task cannot be done. The reader searches for a button that does not exist.. Source: packages/apps/web_frontend/src/components/GitModal.vue. The button is shown only `v-if="md"`. Recommendation: Rewrite the task around what the large Git window really shows for a TypeScript file.
