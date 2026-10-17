# User interface of Heidrun: the information card of every option of the Settings window

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun](../../glossary/index.md), [Abbreviated times](abbreviated_times.md), [Guards section](settings_guards.md)
- Related issue: [issue 608](https://github.com/heidrun-org/heidrun/issues/608), [issue 266](https://github.com/heidrun-org/heidrun/issues/266), [issue 556](https://github.com/heidrun-org/heidrun/issues/556), [issue 596](https://github.com/heidrun-org/heidrun/issues/596)

This file is a part of the rules of the user interface of Heidrun. It gives the rule of the help text of the Settings window.

## The rule

- Every option of the Settings window has a circled question mark. A click on the circled question mark opens an information card. The information card explains the option in full: what the option is, how it works, and what happens when the option is on and when it is off.
- The page of the Settings window stays short. The circled question mark is the only element that this rule adds to the page. The long text is inside the information card, and never on the page.
- A help text that was on the page moves into the information card of its option. A line that is not a help text stays on the page: the example of the time format, the note that tells how to install the font "Inconsolata for Powerline" when the developer chooses it, and the error lines.
- An option is a switch, a button group, a choice list, a text field, or a button that changes a setting. The font size is one option, with its three buttons. Each coding agent of the section "Coding agents" is one option. In the section "Guards", the project guards are one option, and each hardcoded guard is one option.

## The layout

- The component is `SettingsOptionHelp.vue` in the folder `components/settings`. It wraps the component `InformationCard.vue` with the placement "bottom": the card opens below the circled question mark, with its arrow under the middle of the circled question mark, and it stays inside the window.
- The card has a heading with the circled question mark and the name of the option, then one block for each subject. A block has a title in a medium weight, and its text below. The card has no padding of its own besides the Bootstrap list group.
- The usual blocks are "What it is", "How it works", "When the option is on", and "When the option is off". A switch has "What it is", "When the option is on", and "When the option is off". A choice or a field has "What it is" and "How it works". A choice with a different effect for each button adds one block for each button, titled with the label of the button. Another block is allowed when the option needs it, for example "Keyboard shortcuts".
- The circled question mark sits after the name of the option: after the heading, after the label, or after the label of the switch. The font size has no name, so the circled question mark is after its last button. The button "Rebuild the clusters" has it on its right.
- The texts are in the locale files `settingsHelp.json`, in English and in French. A text that already existed in another locale file stays there, and the block uses its key.

## The rows of a list

- A coding agent is a row of a Bootstrap list group, and the whole row is the label of its switch. A click on the circled question mark, or inside its card, must not switch the agent. The row catches the click in its capture phase and cancels it, so the label does not reach the switch.
- Bootstrap gives a row of a list group `z-index: 1` while the pointer or the keyboard focus is on it, and this hid the card behind the buttons of the section. The component `InformationCard.vue` lifts the row that holds an open card to `z-index: 3`.
- In the section "Guards", the circled question mark of the project guards is on the line of the project. The circled question mark of a hardcoded guard is on its row, just before the button with an eye, and outside of the part of the row that is dimmed when the guard is off.

## The test

- The test `components/settings/settings_information_cards.test.ts` mounts the nine sections. In each section, every option has the attribute `data-option` with the name of its option, and the test fails when:
  - the list of the options of a section is not the expected list. A new option goes in this list.
  - an option has no circled question mark.
  - an input, a select, or a text area is outside an option.
  - a card does not open below its circled question mark, has no text, or shows the key of a missing translation.
- The test `components/settings/SettingsOptionHelp.test.ts` checks the circled question mark, the heading, the blocks, the values of the parameters, and the two languages.
- The test `i18n/index.test.ts` checks that the English and the French files have the same keys and markers, and the test `i18n/unused_texts.test.ts` fails on a text that no code uses.
