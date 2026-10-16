//! The four sources of the data layer of Heidrun, named with the names of their packages without the prefix `data_layer_`.

/// One source of the data layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Source {
    /// The commits of the Git repository, written by `data_layer_source_control`.
    SourceControl,
    /// The issues and the pull requests of the GitHub repository, written by `data_layer_code_hosting`.
    CodeHosting,
    /// The chat sessions of Claude Code and of Codex, written by `data_layer_chat_sessions`.
    ChatSessions,
    /// The user activity records of the developer, written by `data_layer_user_activity`.
    UserActivity,
}

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

    /// The tables of the source in the SQLite file, each one with the column of the date that the mode update uses, or
    /// `None` for a link table, which has no date.
    pub fn tables(self) -> &'static [(&'static str, Option<&'static str>)] {
        match self {
            Source::SourceControl => &[("commits", Some("committedAt"))],
            Source::CodeHosting => &[("issues", Some("updatedAt")), ("pull_requests", Some("updatedAt"))],
            Source::ChatSessions => &[
                ("chat_sessions", Some("updatedAt")),
                ("chat_session_folders", None),
                ("chat_session_issues", None),
                ("chat_session_pull_requests", None),
                ("chat_session_files", None),
            ],
            Source::UserActivity => &[("user_activity_records", Some("endedAt"))],
        }
    }

    /// Sorts sources in the fixed order of `Source::ALL`, and removes a source given two times.
    pub fn in_fixed_order(sources: &[Source]) -> Vec<Source> {
        Source::ALL.into_iter().filter(|source| sources.contains(source)).collect()
    }
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
}
