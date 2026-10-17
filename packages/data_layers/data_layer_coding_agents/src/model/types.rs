//! The data shapes that the files of the package share: the facts of a chat session, its relations, the tables, the two modes
//! of the synchronization, and the rows of a query.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// The coding agent that wrote a chat session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CodingAgent {
    /// Claude Code.
    ClaudeCode,
    /// Codex.
    Codex,
}

impl CodingAgent {
    /// The name of the coding agent in the SQLite file and in the JSON schemas: `CLAUDE_CODE` or `CODEX`.
    pub fn text(self) -> &'static str {
        match self {
            CodingAgent::ClaudeCode => "CLAUDE_CODE",
            CodingAgent::Codex => "CODEX",
        }
    }

    /// The coding agent of a name written by `text`, or `None` for another text.
    pub fn from_text(text: &str) -> Option<CodingAgent> {
        match text {
            "CLAUDE_CODE" => Some(CodingAgent::ClaudeCode),
            "CODEX" => Some(CodingAgent::Codex),
            _ => None,
        }
    }
}

/// The tokens that one chat session used with one model.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelTokens {
    /// The name of the model. It is an empty text when the model is not known.
    pub model: String,
    /// The input tokens that the provider neither read from its cache nor wrote to it.
    pub fresh_input: u64,
    /// The input tokens that the provider read from its cache.
    pub cached_input: u64,
    /// The input tokens that the provider wrote to its cache.
    pub cache_write_input: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output: u64,
}

/// The facts of one chat session, as the database stores them in the column `data` of the table `chat_sessions`. The file
/// `schemas/chat_session.schema.json` describes the same shape. The relations of the chat session are not here: they are in
/// the link tables (`ChatSessionRelations`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    /// The name of the chat session file of Claude Code, or the identifier of the chat session of Codex.
    pub id: String,
    /// The coding agent that wrote the chat session.
    pub coding_agent: CodingAgent,
    /// The title of the chat session, or the first message of the developer when the chat session has no title.
    pub title: String,
    /// The date of the first record that has a date, in the format ISO 8601. It is `None` when no record has a date.
    pub first_record_at: Option<String>,
    /// The date of the last record that has a date, in the format ISO 8601. It is `None` when no record has a date.
    pub last_record_at: Option<String>,
    /// The date of the last change of the chat session file, in the format ISO 8601.
    pub updated_at: String,
    /// The number of messages that the developer typed.
    pub user_message_count: u32,
    /// The tokens of the chat session for each model, sorted by the name of the model.
    pub tokens: Vec<ModelTokens>,
}

/// What one chat session is linked to. The database stores each list in its own link table, one row for each value, and the
/// lists never hold the same value two times.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ChatSessionRelations {
    /// The folders where the coding agent ran during the chat session.
    pub folders: Vec<String>,
    /// The numbers of the issues that the chat session mentions.
    pub issues: Vec<i64>,
    /// The numbers of the pull requests that the chat session mentions.
    pub pull_requests: Vec<i64>,
    /// The files that the coding agent wrote.
    pub files_written: Vec<String>,
}

/// A chat session with its relations.
#[derive(Debug, Clone, PartialEq)]
pub struct ChatSessionRecord {
    /// The facts of the chat session.
    pub chat_session: ChatSession,
    /// What the chat session is linked to.
    pub relations: ChatSessionRelations,
}

/// One of the five tables of the database.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatSessionTable {
    /// The table `chat_sessions`.
    ChatSessions,
    /// The link table `chat_session_folders`.
    Folders,
    /// The link table `chat_session_issues`.
    Issues,
    /// The link table `chat_session_pull_requests`.
    PullRequests,
    /// The link table `chat_session_files`.
    FilesWritten,
}

impl ChatSessionTable {
    /// The five tables.
    pub const ALL: [ChatSessionTable; 5] = [
        ChatSessionTable::ChatSessions,
        ChatSessionTable::Folders,
        ChatSessionTable::Issues,
        ChatSessionTable::PullRequests,
        ChatSessionTable::FilesWritten,
    ];

    /// The four link tables.
    pub const LINKS: [ChatSessionTable; 4] = [
        ChatSessionTable::Folders,
        ChatSessionTable::Issues,
        ChatSessionTable::PullRequests,
        ChatSessionTable::FilesWritten,
    ];

    /// The name of the table in the SQLite file.
    pub fn name(self) -> &'static str {
        match self {
            ChatSessionTable::ChatSessions => "chat_sessions",
            ChatSessionTable::Folders => "chat_session_folders",
            ChatSessionTable::Issues => "chat_session_issues",
            ChatSessionTable::PullRequests => "chat_session_pull_requests",
            ChatSessionTable::FilesWritten => "chat_session_files",
        }
    }

    /// The name of the column that holds the value of a link table, or `None` for the table `chat_sessions`.
    pub fn value_column(self) -> Option<&'static str> {
        match self {
            ChatSessionTable::ChatSessions => None,
            ChatSessionTable::Folders => Some("folder"),
            ChatSessionTable::Issues => Some("issueNumber"),
            ChatSessionTable::PullRequests => Some("pullRequestNumber"),
            ChatSessionTable::FilesWritten => Some("path"),
        }
    }

    /// The SQLite type of the column that holds the value of a link table, or `None` for the table `chat_sessions`.
    pub fn value_type(self) -> Option<&'static str> {
        match self {
            ChatSessionTable::ChatSessions => None,
            ChatSessionTable::Issues | ChatSessionTable::PullRequests => Some("INTEGER"),
            ChatSessionTable::Folders | ChatSessionTable::FilesWritten => Some("TEXT"),
        }
    }
}

/// The two modes of the synchronization.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Reads every chat session since the beginning.
    Initialize,
    /// Reads only the chat sessions whose file changed since the last read.
    Update,
}

impl SynchronizationMode {
    /// The name of the mode, as the command line writes it.
    pub fn name(self) -> &'static str {
        match self {
            SynchronizationMode::Initialize => "initialize",
            SynchronizationMode::Update => "update",
        }
    }
}

/// What one synchronization did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SynchronizationReport {
    /// The mode of the synchronization.
    pub mode: SynchronizationMode,
    /// The repository that was read, in the format `owner/name`.
    pub repository: String,
    /// The date of the last read. A chat session file that changed before this date was not read. `None`: no limit.
    pub since: Option<String>,
    /// The number of chat sessions that the synchronization wrote.
    pub chat_session_count: usize,
}

/// One row of the answer to a query: the name of each column and its value, in the order of the columns.
pub type QueryRow = Map<String, Value>;
