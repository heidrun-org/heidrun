//! The data shapes of the list of the chat sessions that a program shows: the sort, one chat, and the lists of the two coding
//! agents. The JSON of these shapes is the JSON that the Past chats sidebar section reads.

use crate::coding_agents::scan::ChatMeta;
use serde::{Deserialize, Serialize};

/// The most chat sessions that one call returns for one coding agent.
pub const MAX_LIMIT: usize = 10_000;

/// What the list is sorted by. The names are the ones that the front end sends.
#[derive(Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortKey {
    /// The date of the first record that has a date, or the modification date of the file when no record has a date.
    CreatedOn,
    /// The modification date of the file of the chat session.
    #[default]
    LastUpdated,
    /// The number of messages that the developer typed.
    Messages,
    /// The number of issues that the chat session mentions.
    Issues,
    /// The number of pull requests that the chat session mentions.
    PullRequests,
    /// The number of different files that the coding agent wrote.
    FilesWritten,
}

/// Which end of the sort key comes first. "Ascending" is the smallest value first, "descending" is the largest value first.
#[derive(Deserialize, Debug, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    /// The smallest value first.
    Ascending,
    /// The largest value first.
    #[default]
    Descending,
}

/// How the list is sorted: by which key, and from which end.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Sorting {
    /// What the list is sorted by.
    pub key: SortKey,
    /// Which end of the sort key comes first.
    pub order: SortOrder,
}

/// The tokens that one chat session used, and what they cost.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct ChatUsage {
    /// Every input token that was sent, with the ones that the provider read from its cache and wrote to it.
    pub input_tokens: u64,
    /// The input tokens that the provider read from its cache. They are a part of `input_tokens`.
    pub cached_input_tokens: u64,
    /// The output tokens, with the tokens of the reasoning.
    pub output_tokens: u64,
    /// The estimated cost in US dollars, at the public price of each model. `None` when a model of the chat session has no
    /// known price.
    pub cost_usd: Option<f64>,
}

/// One chat session of the list.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Chat {
    /// The name of the chat session file of Claude Code, or the identifier of the chat session of Codex.
    pub id: String,
    /// The title, or the first message when the chat session has no title.
    pub title: String,
    /// When the file of the chat session changed, in milliseconds since 1970.
    pub updated_at: i64,
    /// What the scan of the file found: the dates, the messages, the folders, the issues, the pull requests, the files.
    pub meta: ChatMeta,
    /// The tokens and the cost of the chat session, or `None` when the chat session used no token.
    pub usage: Option<ChatUsage>,
}

/// The chat sessions of one coding agent in one folder, in the order of the sort, cut to the limit.
#[derive(Serialize, Debug, Default, Clone, PartialEq)]
pub struct AgentChats {
    /// The chat sessions, at most `limit`.
    pub chats: Vec<Chat>,
    /// True when the folder holds a chat session after the last one of `chats`.
    pub has_more: bool,
}

/// The chat sessions of one folder, for each coding agent.
#[derive(Serialize, Debug, Default, Clone, PartialEq)]
pub struct ChatList {
    /// The root of the workspace whose chat sessions these are. The files that a chat session wrote are below it.
    pub root: String,
    /// The chat sessions of Claude Code.
    pub claude: AgentChats,
    /// The chat sessions of Codex.
    pub codex: AgentChats,
}
