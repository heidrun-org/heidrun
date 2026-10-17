//! Fake coding agent tools for the tests of this package.

use crate::agent_shell::AgentShell;
use std::path::PathBuf;

/// A folder with fake commands, and a shell that sees only this folder and the system commands.
pub(crate) struct FakeCommands {
    /// The folder that holds the fake commands.
    pub(crate) folder: PathBuf,
    /// The shell that sees the fake commands.
    pub(crate) shell: AgentShell,
}

/// The fake command script that prints its arguments, then its standard input.
pub(crate) const ECHO_SCRIPT: &str = "printf 'arguments:%s\\n' \"$*\"\nprintf 'standard input:'\ncat";

impl FakeCommands {
    /// Makes a folder with one script for each pair `(command, script)`. A command without a script does not exist.
    pub(crate) fn new(name: &str, scripts: &[(&str, &str)]) -> Self {
        let folder = std::env::temp_dir().join(format!("coding_agent_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        for (command, script) in scripts {
            let path = folder.join(command);
            std::fs::write(&path, format!("#!/bin/sh\n{script}\n")).unwrap();
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            }
        }
        let path = format!("{}:/usr/bin:/bin", folder.display());
        FakeCommands { folder, shell: AgentShell { shell: "/bin/sh".into(), flag: "-c", path: Some(path) } }
    }

    /// The folder where the coding agent runs in the tests.
    pub(crate) fn working_folder(&self) -> PathBuf {
        self.folder.join("work")
    }
}

impl Drop for FakeCommands {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.folder);
    }
}
