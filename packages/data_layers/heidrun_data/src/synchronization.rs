//! Runs the mode initialize or the mode update of each source that is asked for, with the library of its data layer package.

use crate::database_lock::lock_database;
use crate::output::QueryRow;
use crate::sources::Source;
use serde_json::{json, Value};
use std::path::PathBuf;

/// The mode of a synchronization, for every source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Read every source since the beginning.
    Initialize,
    /// Read only what is new in every source.
    Update,
}

impl SynchronizationMode {
    /// The name of the mode on the command line and in the output.
    pub fn name(self) -> &'static str {
        match self {
            SynchronizationMode::Initialize => "initialize",
            SynchronizationMode::Update => "update",
        }
    }
}

/// What the four sources need to be read. Each source takes only the fields that it uses.
#[derive(Debug, Clone)]
pub struct SynchronizationOptions {
    /// The absolute path of the SQLite file.
    pub database_path: PathBuf,
    /// The folder of the Git repository, or a folder inside it. For source control, code hosting, and coding agents.
    pub folder: PathBuf,
    /// The name of the repository in the format `owner/name`, or `None` for the one that each source finds from the folder.
    pub repository: Option<String>,
    /// The file of the user activity records. For user activity.
    pub user_activity_file: PathBuf,
    /// The folder of the configuration of Claude Code, for example `~/.claude`. For coding agents.
    pub claude_dir: PathBuf,
    /// The folder of Codex. For coding agents.
    pub codex_home: PathBuf,
    /// The folder `.agents` of the home folder, which several coding agents read. For coding agents.
    pub agents_home: PathBuf,
}

/// The result of the synchronization of one source.
#[derive(Debug, Clone, PartialEq)]
pub struct SourceReport {
    /// The source.
    pub source: Source,
    /// The mode that ran.
    pub mode: SynchronizationMode,
    /// The repository that was read, or `None` for user activity, which has no repository.
    pub repository: Option<String>,
    /// The number of rows written in each table, in the order of the tables.
    pub written_rows: Vec<(String, usize)>,
}

impl SourceReport {
    /// The report as one row of the output: `source`, `mode`, `repository`, and `writtenRows`, an object with one count
    /// for each table.
    pub fn to_row(&self) -> QueryRow {
        let written_rows: serde_json::Map<String, Value> =
            self.written_rows.iter().map(|(table, count)| (table.clone(), Value::from(*count))).collect();
        let row = json!({
            "source": self.source.name(),
            "mode": self.mode.name(),
            "repository": self.repository,
            "writtenRows": written_rows,
        });
        match row {
            Value::Object(row) => row,
            _ => unreachable!("The report is an object"),
        }
    }

    /// The report as one line for a person, for example `code_hosting: owner/name (update): issues 2 written, ...`.
    pub fn to_line(&self) -> String {
        let counts: Vec<String> =
            self.written_rows.iter().map(|(table, count)| format!("{table} {count} written")).collect();
        match &self.repository {
            Some(repository) => format!("{}: {repository} ({}): {}", self.source.name(), self.mode.name(), counts.join(", ")),
            None => format!("{} ({}): {}", self.source.name(), self.mode.name(), counts.join(", ")),
        }
    }
}

/// Runs the mode on each source, one after the other, in the fixed order of `Source::ALL`. Each source takes the lock of
/// the SQLite file while it writes, so it waits for the desktop application. A source that fails does not stop the others.
/// `log` receives the lines of progress of every source.
pub fn synchronize(
    mode: SynchronizationMode,
    sources: &[Source],
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Vec<(Source, Result<SourceReport, String>)> {
    Source::in_fixed_order(sources)
        .into_iter()
        .map(|source| {
            log(&format!("source {}: mode {}", source.name(), mode.name()));
            let result = lock_database(&options.database_path)
                .and_then(|_guard| synchronize_source(mode, source, options, log));
            (source, result)
        })
        .collect()
}

/// Runs the mode on one source.
fn synchronize_source(
    mode: SynchronizationMode,
    source: Source,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    match source {
        Source::SourceControl => synchronize_source_control(mode, options, log),
        Source::CodeHosting => synchronize_code_hosting(mode, options, log),
        Source::CodingAgents => synchronize_coding_agents(mode, options, log),
        Source::UserActivity => synchronize_user_activity(mode, options, log),
    }
}

/// Reads the commits, with `data_layer_source_control`.
fn synchronize_source_control(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_source_control as layer;
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&options.folder)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::SourceControlDatabase::open(&options.database_path)?;
    let runner = layer::GitCommandRunner::new(&options.folder);
    let reader = layer::GitReader::new(&runner, log);
    let report = layer::synchronize(layer_mode, &repository, &mut database, &reader, log)?;
    Ok(SourceReport {
        source: Source::SourceControl,
        mode,
        repository: Some(report.repository),
        written_rows: vec![("commits".to_string(), report.commit_count)],
    })
}

/// Reads the issues and the pull requests, with `data_layer_code_hosting`.
fn synchronize_code_hosting(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_code_hosting as layer;
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&options.folder)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::CodeHostingDatabase::open(&options.database_path)?;
    let runner = layer::GhGraphqlRunner;
    let reader = layer::GithubReader::new(&runner, log);
    let report = layer::synchronize(layer_mode, &repository, &mut database, &reader, log)?;
    Ok(SourceReport {
        source: Source::CodeHosting,
        mode,
        repository: Some(report.repository),
        written_rows: vec![
            ("issues".to_string(), report.issue_count),
            ("pull_requests".to_string(), report.pull_request_count),
        ],
    })
}

/// Reads the chat sessions of Claude Code and of Codex, and the configuration of the coding agent, with
/// `data_layer_coding_agents`.
fn synchronize_coding_agents(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_coding_agents as layer;
    if !options.folder.is_dir() {
        return Err(format!("The folder {} does not exist.", options.folder.display()));
    }
    let root = layer::find_root(&options.folder);
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&root)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::ChatSessionsDatabase::open(&options.database_path)?;
    let report = layer::synchronize(
        layer_mode,
        &repository,
        &root.display().to_string(),
        &options.claude_dir.join("projects"),
        &options.codex_home,
        &mut database,
        log,
    )?;
    let folders = layer::ConfigurationFolders {
        root,
        claude_dir: options.claude_dir.clone(),
        codex_home: options.codex_home.clone(),
        agents_home: options.agents_home.clone(),
    };
    let mut configuration_database = layer::ConfigurationDatabase::open(&options.database_path)?;
    let counts = layer::synchronize_configuration(&repository, &folders, &mut configuration_database, log)?;
    let mut written_rows = vec![("chat_sessions".to_string(), report.chat_session_count)];
    written_rows.extend(counts.iter().map(|count| (count.kind.table_name().to_string(), count.written_count)));
    Ok(SourceReport { source: Source::CodingAgents, mode, repository: Some(report.repository), written_rows })
}

/// Reads the user activity records, with `data_layer_user_activity`.
fn synchronize_user_activity(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_user_activity as layer;
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::UserActivityDatabase::open(&options.database_path)?;
    let reader = layer::UserActivityFileReader::new(&options.user_activity_file);
    let report = layer::synchronize(layer_mode, &reader, &mut database, log)?;
    Ok(SourceReport {
        source: Source::UserActivity,
        mode,
        repository: None,
        written_rows: vec![("user_activity_records".to_string(), report.record_count)],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A report of code hosting with two tables.
    fn code_hosting_report() -> SourceReport {
        SourceReport {
            source: Source::CodeHosting,
            mode: SynchronizationMode::Update,
            repository: Some("owner/name".to_string()),
            written_rows: vec![("issues".to_string(), 2), ("pull_requests".to_string(), 1)],
        }
    }

    #[test]
    fn writes_a_report_as_one_row_with_one_count_for_each_table() {
        assert_eq!(
            Value::Object(code_hosting_report().to_row()),
            json!({
                "source": "code_hosting",
                "mode": "update",
                "repository": "owner/name",
                "writtenRows": { "issues": 2, "pull_requests": 1 },
            })
        );
    }

    #[test]
    fn writes_a_report_as_one_line_with_or_without_a_repository() {
        assert_eq!(code_hosting_report().to_line(), "code_hosting: owner/name (update): issues 2 written, pull_requests 1 written");
        let report = SourceReport {
            source: Source::UserActivity,
            mode: SynchronizationMode::Initialize,
            repository: None,
            written_rows: vec![("user_activity_records".to_string(), 3)],
        };
        assert_eq!(report.to_line(), "user_activity (initialize): user_activity_records 3 written");
    }
}
