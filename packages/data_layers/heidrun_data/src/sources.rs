//! The four sources of the data layer of Heidrun, named with the names of their packages without the prefix `data_layer_`,
//! and their tables.

/// One source of the data layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    /// The commits of the Git repository, written by `data_layer_source_control`.
    SourceControl,
    /// The issues and the pull requests of the GitHub repository, written by `data_layer_code_hosting`.
    CodeHosting,
    /// The chat sessions of Claude Code and of Codex, written by `data_layer_coding_agents`.
    ChatSessions,
    /// The user activity records of the developer, written by `data_layer_user_activity`.
    UserActivity,
}

/// The JSON schema of the column `data` of a table, as the data layer package holds it with `include_str!`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DataSchema {
    /// The name of the file in the folder `schemas` of the package, for example `commit.schema.json`.
    pub file_name: &'static str,
    /// The text of the file.
    pub text: &'static str,
}

/// How a link table joins another table: each pair is a column of the link table and the column of the other table that
/// has the same value.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Join {
    /// The other table.
    pub table: &'static str,
    /// The pairs of columns: the column of the link table, then the column of the other table.
    pub columns: &'static [(&'static str, &'static str)],
}

/// One table of a source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Table {
    /// The name of the table in the SQLite file.
    pub name: &'static str,
    /// The column of the date that the mode update uses, or `None` for a link table, which has no date.
    pub date_column: Option<&'static str>,
    /// The JSON schema of the column `data`, or `None` for a link table, which has no column `data`.
    pub data_schema: Option<DataSchema>,
    /// The tables that a link table joins. Empty for a table that is not a link table.
    pub joins: &'static [Join],
}

/// The join of a link table of the chat sessions to the table `chat_sessions`.
const CHAT_SESSION_JOIN: Join = Join { table: "chat_sessions", columns: &[("repository", "repository"), ("chatSessionId", "id")] };

/// The tables of source control.
const SOURCE_CONTROL_TABLES: &[Table] = &[Table {
    name: "commits",
    date_column: Some("committedAt"),
    data_schema: Some(DataSchema { file_name: "commit.schema.json", text: data_layer_source_control::COMMIT_SCHEMA }),
    joins: &[],
}];

/// The tables of code hosting.
const CODE_HOSTING_TABLES: &[Table] = &[
    Table {
        name: "issues",
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema { file_name: "issue.schema.json", text: data_layer_code_hosting::ISSUE_SCHEMA }),
        joins: &[],
    },
    Table {
        name: "pull_requests",
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema {
            file_name: "pull_request.schema.json",
            text: data_layer_code_hosting::PULL_REQUEST_SCHEMA,
        }),
        joins: &[],
    },
];

/// The tables of the chat sessions.
const CHAT_SESSIONS_TABLES: &[Table] = &[
    Table {
        name: "chat_sessions",
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema {
            file_name: "chat_session.schema.json",
            text: data_layer_coding_agents::CHAT_SESSION_SCHEMA,
        }),
        joins: &[],
    },
    Table { name: "chat_session_folders", date_column: None, data_schema: None, joins: &[CHAT_SESSION_JOIN] },
    Table {
        name: "chat_session_issues",
        date_column: None,
        data_schema: None,
        joins: &[CHAT_SESSION_JOIN, Join { table: "issues", columns: &[("repository", "repository"), ("issueNumber", "number")] }],
    },
    Table {
        name: "chat_session_pull_requests",
        date_column: None,
        data_schema: None,
        joins: &[
            CHAT_SESSION_JOIN,
            Join { table: "pull_requests", columns: &[("repository", "repository"), ("pullRequestNumber", "number")] },
        ],
    },
    Table { name: "chat_session_files", date_column: None, data_schema: None, joins: &[CHAT_SESSION_JOIN] },
];

/// The tables of the user activity.
const USER_ACTIVITY_TABLES: &[Table] = &[Table {
    name: "user_activity_records",
    date_column: Some("endedAt"),
    data_schema: Some(DataSchema {
        file_name: "user_activity_record.schema.json",
        text: data_layer_user_activity::USER_ACTIVITY_RECORD_SCHEMA,
    }),
    joins: &[],
}];

impl Source {
    /// The four sources, in the fixed order of `update` and `initialize`. The two sources that the others link to come first.
    pub const ALL: [Source; 4] = [Source::SourceControl, Source::CodeHosting, Source::ChatSessions, Source::UserActivity];

    /// The name of the source on the command line and in the output.
    pub fn name(self) -> &'static str {
        match self {
            Source::SourceControl => "source_control",
            Source::CodeHosting => "code_hosting",
            Source::ChatSessions => "chat_sessions",
            Source::UserActivity => "user_activity",
        }
    }

    /// The source of a name, or `None` when the name is not the name of a source.
    pub fn from_name(name: &str) -> Option<Source> {
        Source::ALL.into_iter().find(|source| source.name() == name)
    }

    /// The tables of the source in the SQLite file.
    pub fn tables(self) -> &'static [Table] {
        match self {
            Source::SourceControl => SOURCE_CONTROL_TABLES,
            Source::CodeHosting => CODE_HOSTING_TABLES,
            Source::ChatSessions => CHAT_SESSIONS_TABLES,
            Source::UserActivity => USER_ACTIVITY_TABLES,
        }
    }

    /// Sorts sources in the fixed order of `Source::ALL`, and removes a source given two times.
    pub fn in_fixed_order(sources: &[Source]) -> Vec<Source> {
        Source::ALL.into_iter().filter(|source| sources.contains(source)).collect()
    }
}

/// Every table of the four sources, with its source, in the fixed order.
pub fn all_tables() -> Vec<(Source, &'static Table)> {
    Source::ALL.into_iter().flat_map(|source| source.tables().iter().map(move |table| (source, table))).collect()
}

/// The table of a name, with its source, or `None` when no source has the table.
pub fn find_table(name: &str) -> Option<(Source, &'static Table)> {
    all_tables().into_iter().find(|(_, table)| table.name == name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_each_source_and_finds_it_back_from_its_name() {
        for source in Source::ALL {
            assert_eq!(Source::from_name(source.name()), Some(source));
        }
        assert_eq!(Source::from_name("commits"), None);
    }

    #[test]
    fn sorts_the_sources_in_the_fixed_order_whatever_the_order_given() {
        assert_eq!(
            Source::in_fixed_order(&[Source::UserActivity, Source::ChatSessions, Source::CodeHosting, Source::ChatSessions]),
            vec![Source::CodeHosting, Source::ChatSessions, Source::UserActivity]
        );
    }

    #[test]
    fn gives_a_json_schema_to_every_table_that_is_not_a_link_table() {
        for (_, table) in all_tables() {
            assert_eq!(table.data_schema.is_some(), table.joins.is_empty(), "{}", table.name);
            assert_eq!(table.date_column.is_some(), table.joins.is_empty(), "{}", table.name);
        }
        assert_eq!(find_table("issues").map(|(source, _)| source), Some(Source::CodeHosting));
        assert_eq!(find_table("issue"), None);
    }

    #[test]
    fn every_joined_table_is_a_table_of_a_source() {
        for (_, table) in all_tables() {
            for join in table.joins {
                assert!(find_table(join.table).is_some(), "{}", join.table);
            }
        }
    }
}
