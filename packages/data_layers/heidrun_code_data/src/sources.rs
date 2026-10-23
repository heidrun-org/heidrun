//! The four sources of the data layer of Heidrun Code, named with the names of their packages without the prefix `data_layer_`,
//! and their tables.

/// One source of the data layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    /// The commits of the Git repository, written by `data_layer_source_control`.
    SourceControl,
    /// The issues and the pull requests of the GitHub repository, written by `data_layer_code_hosting`.
    CodeHosting,
    /// The chat sessions of Claude Code and of Codex, and the configuration of the coding agent (the memory files, the
    /// subagents, and the skills), written by `data_layer_coding_agents`.
    CodingAgents,
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

/// The kind of a table of a source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TableKind {
    /// A table of documents: the columns `repository`, a key, a date, and `data`, which holds the JSON of the document.
    Documents,
    /// A link table: the values of one relation of a document, one row for each value. It has no date and no column `data`.
    Links,
    /// A table of plain facts: its columns are the facts, and it has no column `data`.
    Facts,
    /// A view: rows that SQLite calculates from tables when a query asks for them. A view is read only and has no row count.
    View,
}

impl TableKind {
    /// The name of the kind in the output of the command `schema`.
    pub fn name(self) -> &'static str {
        match self {
            TableKind::Documents => "documents",
            TableKind::Links => "links",
            TableKind::Facts => "facts",
            TableKind::View => "view",
        }
    }
}

/// One table or view of a source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Table {
    /// The name of the table in the SQLite file.
    pub name: &'static str,
    /// The kind of the table.
    pub kind: TableKind,
    /// The column of the date that the mode update uses, or `None` for a table that has no such date.
    pub date_column: Option<&'static str>,
    /// The JSON schema of the column `data`, or `None` for a table that has no column `data`.
    pub data_schema: Option<DataSchema>,
    /// The tables that this table joins. Empty for a table of documents.
    pub joins: &'static [Join],
}

/// The join of a link table of the chat sessions to the table `chat_sessions`.
const CHAT_SESSION_JOIN: Join = Join { table: "chat_sessions", columns: &[("repository", "repository"), ("chatSessionId", "id")] };

/// The tables of source control.
const SOURCE_CONTROL_TABLES: &[Table] = &[Table {
    name: "commits",
    kind: TableKind::Documents,
    date_column: Some("committedAt"),
    data_schema: Some(DataSchema { file_name: "commit.schema.json", text: data_layer_source_control::COMMIT_SCHEMA }),
    joins: &[],
}];

/// The tables of code hosting.
const CODE_HOSTING_TABLES: &[Table] = &[
    Table {
        name: "issues",
        kind: TableKind::Documents,
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema { file_name: "issue.schema.json", text: data_layer_code_hosting::ISSUE_SCHEMA }),
        joins: &[],
    },
    Table {
        name: "pull_requests",
        kind: TableKind::Documents,
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema {
            file_name: "pull_request.schema.json",
            text: data_layer_code_hosting::PULL_REQUEST_SCHEMA,
        }),
        joins: &[],
    },
];

/// The table of one kind of the configuration of the coding agent.
const fn configuration_table(name: &'static str, file_name: &'static str, text: &'static str) -> Table {
    Table {
        name,
        kind: TableKind::Documents,
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema { file_name, text }),
        joins: &[],
    }
}

/// The tables of the coding agents: the chat sessions, their link tables, and the configuration of the coding agent.
const CODING_AGENTS_TABLES: &[Table] = &[
    Table {
        name: "chat_sessions",
        kind: TableKind::Documents,
        date_column: Some("updatedAt"),
        data_schema: Some(DataSchema {
            file_name: "chat_session.schema.json",
            text: data_layer_coding_agents::CHAT_SESSION_SCHEMA,
        }),
        joins: &[],
    },
    Table { name: "chat_session_folders", kind: TableKind::Links, date_column: None, data_schema: None, joins: &[CHAT_SESSION_JOIN] },
    Table {
        name: "chat_session_issues",
        kind: TableKind::Links,
        date_column: None,
        data_schema: None,
        joins: &[CHAT_SESSION_JOIN, Join { table: "issues", columns: &[("repository", "repository"), ("issueNumber", "number")] }],
    },
    Table {
        name: "chat_session_pull_requests",
        kind: TableKind::Links,
        date_column: None,
        data_schema: None,
        joins: &[
            CHAT_SESSION_JOIN,
            Join { table: "pull_requests", columns: &[("repository", "repository"), ("pullRequestNumber", "number")] },
        ],
    },
    Table { name: "chat_session_files", kind: TableKind::Links, date_column: None, data_schema: None, joins: &[CHAT_SESSION_JOIN] },
    configuration_table("memory_files", "memory_file.schema.json", data_layer_coding_agents::MEMORY_FILE_SCHEMA),
    configuration_table("subagents", "subagent.schema.json", data_layer_coding_agents::SUBAGENT_SCHEMA),
    configuration_table("skills", "skill.schema.json", data_layer_coding_agents::SKILL_SCHEMA),
    Table {
        name: "token_usage_minutes",
        kind: TableKind::Facts,
        date_column: None,
        data_schema: None,
        joins: &[CHAT_SESSION_JOIN],
    },
    Table {
        name: "token_usage_synchronizations",
        kind: TableKind::Facts,
        date_column: Some("synchronizedAt"),
        data_schema: None,
        joins: &[],
    },
    Table {
        name: "model_price_versions",
        kind: TableKind::Facts,
        date_column: Some("checkedAt"),
        data_schema: None,
        joins: &[],
    },
    Table {
        name: "model_prices",
        kind: TableKind::Facts,
        date_column: None,
        data_schema: None,
        joins: &[Join { table: "model_price_versions", columns: &[("version", "version")] }],
    },
    Table { name: "latest_model_prices", kind: TableKind::View, date_column: None, data_schema: None, joins: &[] },
    Table {
        name: "token_usage_with_cost",
        kind: TableKind::View,
        date_column: None,
        data_schema: None,
        joins: &[CHAT_SESSION_JOIN],
    },
];

/// The tables of the user activity.
const USER_ACTIVITY_TABLES: &[Table] = &[Table {
    name: "user_activity_records",
    kind: TableKind::Documents,
    date_column: Some("endedAt"),
    data_schema: Some(DataSchema {
        file_name: "user_activity_record.schema.json",
        text: data_layer_user_activity::USER_ACTIVITY_RECORD_SCHEMA,
    }),
    joins: &[],
}];

impl Source {
    /// The four sources, in the fixed order of `update` and `initialize`. The two sources that the others link to come first.
    pub const ALL: [Source; 4] = [Source::SourceControl, Source::CodeHosting, Source::CodingAgents, Source::UserActivity];

    /// The name of the source on the command line and in the output.
    pub fn name(self) -> &'static str {
        match self {
            Source::SourceControl => "source_control",
            Source::CodeHosting => "code_hosting",
            Source::CodingAgents => "coding_agents",
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
            Source::CodingAgents => CODING_AGENTS_TABLES,
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
            Source::in_fixed_order(&[Source::UserActivity, Source::CodingAgents, Source::CodeHosting, Source::CodingAgents]),
            vec![Source::CodeHosting, Source::CodingAgents, Source::UserActivity]
        );
    }

    #[test]
    fn gives_a_json_schema_to_every_table_that_is_not_a_link_table() {
        for (_, table) in all_tables() {
            match table.kind {
                TableKind::Documents => {
                    assert!(table.data_schema.is_some() && table.date_column.is_some() && table.joins.is_empty(), "{}", table.name);
                }
                TableKind::Links => {
                    assert!(table.data_schema.is_none() && table.date_column.is_none() && !table.joins.is_empty(), "{}", table.name);
                }
                TableKind::Facts | TableKind::View => assert!(table.data_schema.is_none(), "{}", table.name),
            }
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
