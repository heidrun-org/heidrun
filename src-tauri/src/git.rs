//! Git state of a workspace folder, and calls to the forge CLIs (glab / gh).
//!
//! The forge part goes through the user's login shell so `glab` and `gh` are
//! found (Homebrew paths) and use the accounts already connected on the Mac:
//! the app never handles a token.

use serde::Serialize;
use std::time::Duration;
use tokio::process::Command;

#[derive(Serialize, Default)]
pub struct GitFile {
    pub status: String,
    pub path: String,
}

#[derive(Serialize, Default)]
pub struct GitStatus {
    pub root: String,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub changed: u32,
    pub untracked: u32,
    pub files: Vec<GitFile>,
    pub last_sha: Option<String>,
    pub last_subject: Option<String>,
    pub last_time: Option<i64>,
    pub remote: Option<String>,
}

async fn git(cwd: &str, args: &[&str]) -> Option<String> {
    let out = tokio::time::timeout(
        Duration::from_secs(8),
        Command::new("git").arg("-C").arg(cwd).args(args).kill_on_drop(true).output(),
    )
    .await
    .ok()?
    .ok()?;
    out.status.success().then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Parses `git status --porcelain=v2 --branch`.
fn parse_status(text: &str, st: &mut GitStatus) {
    for line in text.lines() {
        if let Some(rest) = line.strip_prefix("# branch.head ") {
            if rest != "(detached)" {
                st.branch = Some(rest.to_string());
            }
        } else if let Some(rest) = line.strip_prefix("# branch.upstream ") {
            st.upstream = Some(rest.to_string());
        } else if let Some(rest) = line.strip_prefix("# branch.ab ") {
            for part in rest.split_whitespace() {
                if let Some(n) = part.strip_prefix('+') {
                    st.ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = part.strip_prefix('-') {
                    st.behind = n.parse().unwrap_or(0);
                }
            }
        } else if let Some(path) = line.strip_prefix("? ") {
            st.untracked += 1;
            if st.files.len() < 40 {
                st.files.push(GitFile { status: "??".into(), path: path.to_string() });
            }
        } else if line.starts_with("1 ") || line.starts_with("2 ") || line.starts_with("u ") {
            st.changed += 1;
            let mut parts = line.split(' ');
            let kind = parts.next().unwrap_or("");
            let xy = parts.next().unwrap_or("").to_string();
            // Fields before the path: 1 → 6 more, 2 → 7 more (+ "orig\tpath"), u → 8 more.
            let skip = match kind { "1" => 6, "2" => 7, _ => 8 };
            let path: String = parts.skip(skip).collect::<Vec<_>>().join(" ");
            let path = path.split('\t').next().unwrap_or("").to_string();
            if st.files.len() < 40 {
                st.files.push(GitFile { status: xy, path });
            }
        }
    }
}

/// Branch, ahead / behind, modified files and last commit of the repository
/// containing `cwd`; `None` when it is not a Git repository.
#[tauri::command]
pub async fn git_status(cwd: String) -> Option<GitStatus> {
    let root = git(&cwd, &["rev-parse", "--show-toplevel"]).await?.trim().to_string();
    let mut st = GitStatus { root: root.clone(), ..Default::default() };
    if let Some(text) = git(&root, &["status", "--porcelain=v2", "--branch"]).await {
        parse_status(&text, &mut st);
    }
    if let Some(log) = git(&root, &["log", "-1", "--format=%h%x1f%s%x1f%ct"]).await {
        let mut it = log.trim().split('\u{1f}');
        st.last_sha = it.next().map(str::to_string).filter(|s| !s.is_empty());
        st.last_subject = it.next().map(str::to_string);
        st.last_time = it.next().and_then(|t| t.parse().ok());
    }
    st.remote = git(&root, &["config", "--get", "remote.origin.url"]).await.map(|s| s.trim().to_string());
    Some(st)
}

/// Read-only calls the app makes, and nothing else: `glab api <path>` (GET only)
/// and `gh pr list` / `gh run list`. Anything that could change the forge or run
/// code (`gh alias set --shell`, `glab mr merge`, `api -X DELETE`…) is refused.
fn allowed(tool: &str, args: &[String]) -> bool {
    let a: Vec<&str> = args.iter().map(String::as_str).collect();
    match tool {
        "glab" => {
            a.first() == Some(&"api")
                && a.len() == 2
                && a[1].starts_with("projects/")
        }
        "gh" => {
            let read_only = matches!(a.get(..2), Some(["pr", "list"]) | Some(["run", "list"]));
            let flags_ok = a.iter().skip(2).all(|x| {
                !x.starts_with('-') || matches!(*x, "--json" | "--limit" | "--branch" | "--state")
            });
            read_only && flags_ok
        }
        _ => false,
    }
}

/// Runs a read-only `glab` / `gh` call in the repository, through the login
/// shell (Homebrew PATH, accounts already connected).
#[tauri::command]
pub async fn forge_cli(cwd: String, tool: String, args: Vec<String>) -> Result<String, String> {
    if !allowed(&tool, &args) {
        return Err(format!("forge_cli : appel non autorisé ({tool} {})", args.join(" ")));
    }
    // `exec "$0" "$@"` passes arguments as is (never re-parsed). It needs a POSIX
    // shell: fish and friends fall back to zsh, which still loads the login PATH.
    let user_shell = std::env::var("SHELL").unwrap_or_default();
    let shell = if user_shell.ends_with("/zsh") || user_shell.ends_with("/bash") || user_shell.ends_with("/sh") {
        user_shell
    } else {
        "/bin/zsh".into()
    };
    let mut cmd = Command::new(shell);
    cmd.arg("-lc").arg("exec \"$0\" \"$@\"").arg(&tool).args(&args).current_dir(&cwd).kill_on_drop(true);
    cmd.env("NO_COLOR", "1").env("NO_PROMPT", "1").env("GLAB_NO_PROMPT", "1").env("GH_PROMPT_DISABLED", "1");
    let out = tokio::time::timeout(Duration::from_secs(20), cmd.output())
        .await
        .map_err(|_| format!("{tool} : pas de réponse en 20 s"))?
        .map_err(|e| format!("{tool} : {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        Err(if err.is_empty() { format!("{tool} a échoué ({})", out.status) } else { err })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_porcelain_v2() {
        let text = "# branch.oid abc\n# branch.head feat/x\n# branch.upstream origin/feat/x\n# branch.ab +2 -1\n\
1 .M N... 100644 100644 100644 aaa bbb src/main.rs\n\
2 R. N... 100644 100644 100644 aaa bbb R100 new name.rs\told.rs\n\
? notes.txt\n";
        let mut st = GitStatus::default();
        parse_status(text, &mut st);
        assert_eq!(st.branch.as_deref(), Some("feat/x"));
        assert_eq!(st.upstream.as_deref(), Some("origin/feat/x"));
        assert_eq!((st.ahead, st.behind), (2, 1));
        assert_eq!(st.changed, 2);
        assert_eq!(st.untracked, 1);
        assert_eq!(st.files[0].path, "src/main.rs");
        assert_eq!(st.files[1].path, "new name.rs");
        assert_eq!(st.files[2].status, "??");
    }

    #[test]
    fn only_read_only_forge_calls() {
        let v = |x: &[&str]| x.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        assert!(allowed("glab", &v(&["api", "projects/:fullpath/merge_requests?state=opened"])));
        assert!(!allowed("glab", &v(&["api", "-X", "DELETE", "projects/:fullpath"])));
        assert!(!allowed("glab", &v(&["mr", "merge", "1"])));
        assert!(allowed("gh", &v(&["pr", "list", "--limit", "20", "--json", "number,title"])));
        assert!(allowed("gh", &v(&["run", "list", "--branch", "x", "--limit", "1", "--json", "status"])));
        assert!(!allowed("gh", &v(&["alias", "set", "--shell", "x", "rm -rf ~"])));
        assert!(!allowed("gh", &v(&["pr", "merge", "1"])));
        assert!(!allowed("gh", &v(&["api", "-X", "DELETE", "repos/x"])));
        assert!(!allowed("sh", &v(&["-c", "id"])));
    }
}
