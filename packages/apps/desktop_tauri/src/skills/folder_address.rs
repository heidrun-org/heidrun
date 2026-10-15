//! The web address of a skill folder in a GitHub repository, read as text. Pure functions: no input or output.

use super::types::{is_valid_name, is_valid_source};

/// A web address of a folder of a public GitHub repository, as shown by GitHub:
/// `https://github.com/<owner>/<repository>/tree/<branch>/<path of the folder>`.
#[derive(Debug, PartialEq, Clone)]
pub(super) struct FolderAddress {
    /// The GitHub repository, as `owner/repository`.
    pub(super) source: String,
    /// The parts of the address after `tree/`: the branch, then the path of the folder. A branch name can hold slashes,
    /// so the address alone does not say where the branch ends. At least two parts.
    pub(super) parts: Vec<String>,
}

impl FolderAddress {
    /// The folder name of the skill: the last part of the address.
    pub(super) fn skill_id(&self) -> &str {
        self.parts.last().map(String::as_str).unwrap_or_default()
    }

    /// The address in its normal form, without a query, a fragment, or a slash at the end.
    pub(super) fn url(&self) -> String {
        format!("https://github.com/{}/tree/{}", self.source, self.parts.join("/"))
    }

    /// The parts of the address after `tree/`, joined by slashes, as raw.githubusercontent.com reads them.
    pub(super) fn reference_and_path(&self) -> String {
        self.parts.join("/")
    }

    /// The branch and the path of the folder, when the branch is the first `branch_length` parts.
    pub(super) fn split(&self, branch_length: usize) -> (String, String) {
        (self.parts[..branch_length].join("/"), self.parts[branch_length..].join("/"))
    }

    /// The lengths that the branch can have, the shortest first, because most branches (`main`) have no slash.
    /// The path of the folder keeps at least one part.
    pub(super) fn branch_lengths(&self) -> std::ops::Range<usize> {
        1..self.parts.len()
    }
}

/// True for a part of an address after `tree/`: letters, digits, and `- _ . ~ + @`, and not `.` or `..`.
fn is_valid_part(part: &str) -> bool {
    part != "." && part != ".." && !part.is_empty() && part.chars().all(|c| c.is_ascii_alphanumeric() || "-_.~+@".contains(c))
}

/// Reads the address of a skill folder. The error is `skills_invalid_address: <text>`.
pub(super) fn parse_folder_address(text: &str) -> Result<FolderAddress, String> {
    let invalid = || format!("skills_invalid_address: {}", text.trim());
    let trimmed = text.trim();
    let rest = trimmed
        .strip_prefix("https://github.com/")
        .or_else(|| trimmed.strip_prefix("https://www.github.com/"))
        .ok_or_else(invalid)?;
    let rest = rest.split(['?', '#']).next().unwrap_or_default().trim_end_matches('/');
    let mut parts = rest.split('/');
    let (Some(owner), Some(repository), Some("tree")) = (parts.next(), parts.next(), parts.next()) else {
        return Err(invalid());
    };
    let source = format!("{owner}/{repository}");
    let parts: Vec<String> = parts.map(str::to_string).collect();
    if is_valid_source(&source) == false || parts.len() < 2 || parts.iter().all(|part| is_valid_part(part)) == false {
        return Err(invalid());
    }
    let address = FolderAddress { source, parts };
    if is_valid_name(address.skill_id()) == false {
        return Err(invalid());
    }
    Ok(address)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn address(parts: &[&str]) -> FolderAddress {
        FolderAddress { source: "anthropics/skills".into(), parts: parts.iter().map(|part| part.to_string()).collect() }
    }

    #[test]
    fn reads_the_address_of_a_skill_folder() {
        let parsed = parse_folder_address("https://github.com/anthropics/skills/tree/main/skills/pdf").unwrap();
        assert_eq!(parsed, address(&["main", "skills", "pdf"]));
        assert_eq!(parsed.skill_id(), "pdf");
        assert_eq!(parsed.reference_and_path(), "main/skills/pdf");
    }

    #[test]
    fn ignores_the_spaces_the_query_the_fragment_and_the_slash_at_the_end() {
        let parsed = parse_folder_address("  https://github.com/anthropics/skills/tree/main/skills/pdf/?tab=readme#top \n").unwrap();
        assert_eq!(parsed.url(), "https://github.com/anthropics/skills/tree/main/skills/pdf");
        assert!(parse_folder_address("https://www.github.com/anthropics/skills/tree/main/pdf").is_ok());
    }

    #[test]
    fn keeps_a_branch_name_with_slashes_in_the_parts() {
        let parsed = parse_folder_address("https://github.com/anthropics/skills/tree/klazuka/doc-skills/skill-creator").unwrap();
        assert_eq!(parsed.parts, ["klazuka", "doc-skills", "skill-creator"]);
        assert_eq!(parsed.branch_lengths(), 1..3);
        assert_eq!(parsed.split(1), ("klazuka".to_string(), "doc-skills/skill-creator".to_string()));
        assert_eq!(parsed.split(2), ("klazuka/doc-skills".to_string(), "skill-creator".to_string()));
    }

    #[test]
    fn refuses_a_text_that_is_not_the_address_of_a_folder() {
        for text in [
            "pdf",
            "https://github.com/anthropics/skills",
            "https://github.com/anthropics/skills/tree/main",
            "https://github.com/anthropics/skills/blob/main/skills/pdf/SKILL.md",
            "http://github.com/anthropics/skills/tree/main/skills/pdf",
            "https://gitlab.com/anthropics/skills/tree/main/skills/pdf",
            "https://github.com.evil.example/anthropics/skills/tree/main/skills/pdf",
            "https://github.com/anthropics//tree/main/skills/pdf",
            "https://github.com/anthropics/skills/tree/main//pdf",
        ] {
            assert_eq!(parse_folder_address(text), Err(format!("skills_invalid_address: {text}")), "{text}");
        }
    }

    #[test]
    fn refuses_a_part_that_could_leave_the_folder_or_break_the_call_to_github() {
        for text in [
            "https://github.com/anthropics/skills/tree/main/../pdf",
            "https://github.com/anthropics/skills/tree/main/skills/.hidden",
            "https://github.com/anthropics/skills/tree/main/skills/my%20skill",
            "https://github.com/anthropics/skills/tree/main:x/pdf",
        ] {
            assert!(parse_folder_address(text).is_err(), "{text}");
        }
    }
}
