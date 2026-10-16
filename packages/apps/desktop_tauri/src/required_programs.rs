//! The programs of other makers that Heidrun needs on the computer: Herdr, which is required, and ngrok, which is
//! optional and only for the mobile access. Heidrun installs neither of them. At the start, the web page asks which ones
//! are installed, and shows a notice with the install command of each missing program (issue 546).

use serde::Serialize;
use std::path::Path;
use std::process::Stdio;

/// The state of one program on this computer.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgramStatus {
    /// True when the program is on this computer.
    pub is_installed: bool,
}

/// The state of each program that Heidrun needs.
#[derive(Debug, Serialize, PartialEq)]
pub struct RequiredProgramsStatus {
    /// Herdr: required. Heidrun cannot show a terminal without it.
    pub herdr: ProgramStatus,
    /// ngrok: optional. Only the mobile access uses it.
    pub ngrok: ProgramStatus,
}

/// Tells which programs are installed. Herdr is searched like `herdr::herdr_bin` does, then on the `PATH` of the login
/// shell, because Heidrun starts the Herdr server through the login shell. ngrok is searched like the mobile server does.
#[tauri::command]
pub async fn required_programs_status() -> RequiredProgramsStatus {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let ngrok_path = mobile_server::find_ngrok();
    RequiredProgramsStatus {
        herdr: ProgramStatus { is_installed: is_herdr_installed(&crate::herdr::herdr_bin(), &shell).await },
        ngrok: ProgramStatus { is_installed: ngrok_path.is_some() },
    }
}

/// True when Herdr is installed. `herdr_path` is the path that `herdr::herdr_bin` gives: an absolute path when Herdr is in
/// one of the usual places, or the bare name `herdr` when it is not. For the bare name, the login shell `shell` searches
/// its `PATH`.
async fn is_herdr_installed(herdr_path: &Path, shell: &str) -> bool {
    if herdr_path.is_absolute() {
        return herdr_path.is_file();
    }
    tokio::process::Command::new(shell)
        .arg("-lc")
        .arg("command -v herdr")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_required_programs_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[tokio::test]
    async fn herdr_is_installed_when_its_absolute_path_is_a_file() {
        let folder = temporary_folder("herdr_file");
        let herdr_path = folder.join("herdr");
        std::fs::write(&herdr_path, "#!/bin/sh\n").unwrap();
        assert_eq!(is_herdr_installed(&herdr_path, "/usr/bin/false").await, true);
    }

    #[tokio::test]
    async fn herdr_is_missing_when_its_absolute_path_is_not_there() {
        let folder = temporary_folder("herdr_missing");
        assert_eq!(is_herdr_installed(&folder.join("herdr"), "/usr/bin/true").await, false);
    }

    #[tokio::test]
    async fn herdr_is_missing_when_its_absolute_path_is_a_folder() {
        let folder = temporary_folder("herdr_folder");
        let herdr_path = folder.join("herdr");
        std::fs::create_dir_all(&herdr_path).unwrap();
        assert_eq!(is_herdr_installed(&herdr_path, "/usr/bin/true").await, false);
    }

    #[tokio::test]
    async fn the_bare_name_asks_the_login_shell() {
        assert_eq!(is_herdr_installed(Path::new("herdr"), "/usr/bin/true").await, true);
        assert_eq!(is_herdr_installed(Path::new("herdr"), "/usr/bin/false").await, false);
    }

    #[tokio::test]
    async fn the_bare_name_is_missing_when_the_shell_cannot_start() {
        let folder = temporary_folder("no_shell");
        let shell = folder.join("no_such_shell");
        assert_eq!(is_herdr_installed(Path::new("herdr"), &shell.display().to_string()).await, false);
    }

    #[test]
    fn the_status_is_sent_with_the_names_that_the_web_page_reads() {
        let status = RequiredProgramsStatus {
            herdr: ProgramStatus { is_installed: false },
            ngrok: ProgramStatus { is_installed: true },
        };
        assert_eq!(
            serde_json::to_value(&status).unwrap(),
            serde_json::json!({ "herdr": { "isInstalled": false }, "ngrok": { "isInstalled": true } })
        );
    }
}
