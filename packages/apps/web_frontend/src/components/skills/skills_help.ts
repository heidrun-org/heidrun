// The information cards of the lines of the window Find new skills: which lines have a card, and which blocks each card has.
// The texts are in `i18n/locales/<language>/settingsSkills.json`, under the keys `help_<topic>_title`, `help_<topic>_label`,
// `help_<topic>_<block>_title`, and `help_<topic>_<block>_text`.
// - issue #608
// - issue #609

/** The lines of the window Find new skills that have an information card. */
export type SkillsHelpTopic = "level" | "source" | "search" | "folder" | "address" | "result";

/** The blocks of the information card of each line, in the order of the card. */
export const SKILLS_HELP_BLOCKS: Record<SkillsHelpTopic, readonly string[]> = {
  level: ["what", "user", "workspace", "agents"],
  source: ["what", "skills_sh", "local_folder", "code_hosting"],
  search: ["what", "sent", "how"],
  folder: ["what", "does", "no_file"],
  address: ["what", "example", "sent", "fails"],
  result: ["what", "inspect", "install"],
};
