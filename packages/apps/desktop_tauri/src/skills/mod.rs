//! Manages the skills (the folders with a `SKILL.md` file) that the coding agents read.
//!
//! Each coding agent reads its skills from its own folder, at the workspace level (the folder of the workspace) or at
//! the user level (the home folder of the user):
//!
//! | Agent       | Workspace folder  | User folder                                      |
//! |-------------|-------------------|--------------------------------------------------|
//! | Claude Code | `.claude/skills/` | `skills/` of the Claude configuration folder     |
//! | Codex       | `.agents/skills/` | `~/.agents/skills/`                              |
//!
//! The real files of an installed skill are in the folder of Codex. For every other agent that the user switched on,
//! Heidrun adds a link (a symbolic link) in the folder of that agent, so the files cannot become different from each
//! other. The search goes to skills.sh. The text and the files of a skill come from its GitHub repository. Next to
//! every skill installed from skills.sh, Heidrun writes the file `.heidrun_origin.json`, which records where the skill
//! comes from. The list of the files of each repository and the text of each `SKILL.md` file are kept in the cache
//! folder `~/Library/Caches/heidrun/skills`, fresh for one hour, and kept for 30 days for the times when GitHub
//! refuses a call or the network is not available.


pub(crate) mod agent_folders;
mod cache;
mod github;
pub(crate) mod install;
pub(crate) mod installed;
mod repository_paths;
pub(crate) mod search;
mod skill_text;
mod types;

#[cfg(test)]
mod test_support;
