//! Runs the command `git`, and finds the repository of a folder. This is the only file of the package that runs the command
//! `git`.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Runs one `git` command. The tests of the reader can give a fake runner.
pub trait GitRunner {
    /// Runs `git` with the arguments, gives `standard_input` to it when there is one, and gives its standard output as text.
    ///
    /// # Errors
    /// An error with the message of `git` when the command does not start or does not end with the code 0.
    fn run(&self, arguments: &[&str], standard_input: Option<&str>) -> Result<String, String>;
}

/// The runner that runs the command `git` in a folder.
pub struct GitCommandRunner {
    /// The folder where the command `git` runs. It is the folder of the repository, or a folder inside it.
    folder: PathBuf,
    /// True when `git` reads every path of a command as a literal path, never as a pattern.
    is_literal_pathspecs: bool,
}

impl GitCommandRunner {
    /// Creates a runner for the repository of `folder`.
    pub fn new(folder: &Path) -> Self {
        GitCommandRunner { folder: folder.to_path_buf(), is_literal_pathspecs: false }
    }

    /// Makes `git` read every path of a command as a literal path, never as a pattern, so a path with a star or a bracket
    /// names one file only.
    pub fn with_literal_pathspecs(mut self) -> Self {
        self.is_literal_pathspecs = true;
        self
    }
}

impl GitRunner for GitCommandRunner {
    fn run(&self, arguments: &[&str], standard_input: Option<&str>) -> Result<String, String> {
        let command_text = format!("git {}", arguments.join(" "));
        let mut command = Command::new("git");
        command
            .arg("-C")
            .arg(&self.folder)
            .args(arguments)
            // The option --date=format-local writes the dates in the time zone of the process. UTC makes the dates the same everywhere.
            .env("TZ", "UTC");
        if self.is_literal_pathspecs {
            command.env("GIT_LITERAL_PATHSPECS", "1");
        }
        let mut child = command
            .stdin(if standard_input.is_some() { Stdio::piped() } else { Stdio::null() })
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|error| format!("The command {command_text} did not start: {error}"))?;
        let writer = child.stdin.take().zip(standard_input.map(str::to_string)).map(|(mut standard_input_pipe, text)| {
            std::thread::spawn(move || {
                let _ = standard_input_pipe.write_all(text.as_bytes());
            })
        });
        let output = child.wait_with_output().map_err(|error| format!("The command {command_text} did not end: {error}"))?;
        if let Some(writer) = writer {
            let _ = writer.join();
        }
        if !output.status.success() {
            return Err(format!("The command {command_text} failed: {}", describe_failure(&output.stderr)));
        }
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    }
}

/// Finds the repository of a folder, in the format `owner/name`, from the address of the remote `origin`.
///
/// # Errors
/// An error when the folder is not in a Git repository, when the repository has no remote `origin`, or when the address of
/// the remote does not name a repository.
pub fn find_repository(folder: &Path) -> Result<String, String> {
    let address = GitCommandRunner::new(folder)
        .run(&["remote", "get-url", "origin"], None)
        .map_err(|error| format!("The repository of {} cannot be found: {error}", folder.display()))?;
    parse_repository(&address)
}

/// Finds the repository in the address of a remote. The repository is the path of the address, without the slash at the start,
/// without the slash and the text `.git` at the end. The address can have the form `https://host/owner/name.git`,
/// `ssh://git@host/owner/name.git`, or `git@host:owner/name.git`.
///
/// # Errors
/// An error when the address does not name a repository with an owner and a name, for example the address of a folder.
pub fn parse_repository(address: &str) -> Result<String, String> {
    let address = address.trim();
    let path = match address.split_once("://") {
        Some((_, after_scheme)) => after_scheme.split_once('/').map(|(_, path)| path),
        None => address.split_once(':').map(|(_, path)| path),
    };
    let repository = path
        .map(|path| path.trim_matches('/'))
        .map(|path| path.strip_suffix(".git").unwrap_or(path))
        .filter(|path| path.contains('/') && path.split('/').all(|segment| !segment.is_empty()));
    repository
        .map(str::to_string)
        .ok_or_else(|| format!("The address {address} does not name a repository in the format owner/name."))
}

/// Writes the standard error output of a failed command in one text.
fn describe_failure(standard_error: &[u8]) -> String {
    let text = String::from_utf8_lossy(standard_error).trim().to_string();
    if text.is_empty() {
        "the command gave no message".to_string()
    } else {
        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{temp_folder, TestRepository};

    #[test]
    fn finds_the_repository_in_an_address_with_the_scheme_https() {
        assert_eq!(parse_repository("https://github.com/heidrun-org/heidrun.git\n"), Ok("heidrun-org/heidrun".into()));
        assert_eq!(parse_repository("https://github.com/heidrun-org/heidrun"), Ok("heidrun-org/heidrun".into()));
        assert_eq!(parse_repository("https://github.com/heidrun-org/heidrun/"), Ok("heidrun-org/heidrun".into()));
    }

    #[test]
    fn finds_the_repository_in_an_address_of_the_form_user_host_colon_path() {
        assert_eq!(parse_repository("git@github.com:heidrun-org/heidrun.git"), Ok("heidrun-org/heidrun".into()));
    }

    #[test]
    fn finds_the_repository_in_an_address_with_the_scheme_ssh_and_a_port() {
        assert_eq!(parse_repository("ssh://git@gitlab.com:2222/heidrun-org/heidrun.git"), Ok("heidrun-org/heidrun".into()));
    }

    #[test]
    fn keeps_every_group_of_a_gitlab_repository() {
        assert_eq!(
            parse_repository("https://gitlab.com/heidrun-org/tools/heidrun.git"),
            Ok("heidrun-org/tools/heidrun".into())
        );
    }

    #[test]
    fn refuses_an_address_that_does_not_name_a_repository() {
        for address in ["/Users/someone/heidrun", "heidrun", "https://github.com/heidrun", "https://github.com/", ""] {
            assert!(parse_repository(address).unwrap_err().contains("owner/name"), "{address}");
        }
    }

    #[test]
    fn finds_the_repository_of_the_remote_origin_of_a_folder() {
        let repository = TestRepository::new("find_repository");
        repository.git(&["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"], 1);
        let inner_folder = repository.folder.join("inner");
        std::fs::create_dir_all(&inner_folder).unwrap();
        assert_eq!(find_repository(&repository.folder), Ok("fake-owner/fake-name".into()));
        assert_eq!(find_repository(&inner_folder), Ok("fake-owner/fake-name".into()));
    }

    #[test]
    fn says_so_when_the_repository_has_no_remote_origin() {
        let repository = TestRepository::new("no_origin");
        assert!(find_repository(&repository.folder).unwrap_err().contains("origin"));
    }

    #[test]
    fn says_so_when_the_folder_is_not_in_a_git_repository() {
        let folder = temp_folder("no_repository");
        assert!(find_repository(&folder).unwrap_err().contains("not a git repository"));
    }

    #[test]
    fn gives_the_standard_input_to_the_command_and_the_standard_output_back() {
        let repository = TestRepository::new("standard_input");
        let output = GitCommandRunner::new(&repository.folder)
            .run(&["hash-object", "--stdin"], Some("hello\n"))
            .unwrap();
        assert_eq!(output.trim(), "ce013625030ba8dba906f756967f9e9ca394464a");
    }
}
