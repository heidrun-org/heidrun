//! Reads the body and the comments of one issue or of one pull request, with the `GraphqlRunner` of
//! `data_layer_code_hosting`, and the diff of a pull request with the command `gh pr diff`.
//!
//! GitHub only, as `data_layer_code_hosting`: the support of GitLab comes at the same time as in that package.

use crate::output::QueryRow;
use data_layer_code_hosting::GraphqlRunner;
use serde_json::{json, Value};
use std::process::Command;

/// The query of one issue with one page of its comments.
const ISSUE_QUERY: &str = r#"
query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        issue(number: NUMBER) {
            number title body createdAt state
            author { login }
            comments(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes { createdAt body author { login } }
            }
        }
    }
}
"#;

/// The query of one pull request with one page of its comments, and its reviews with their comments on the lines.
const PULL_REQUEST_QUERY: &str = r#"
query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        pullRequest(number: NUMBER) {
            number title body createdAt state
            author { login }
            comments(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes { createdAt body author { login } }
            }
            reviews(first: 100) {
                nodes {
                    submittedAt body state
                    author { login }
                    comments(first: 100) { nodes { createdAt body path line originalLine author { login } } }
                }
            }
        }
    }
}
"#;

/// The kind of a thing of code hosting.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeHostingKind {
    /// An issue.
    Issue,
    /// A pull request.
    PullRequest,
}

impl CodeHostingKind {
    /// The name of the field of the repository in the answer of GitHub.
    fn field(self) -> &'static str {
        match self {
            CodeHostingKind::Issue => "issue",
            CodeHostingKind::PullRequest => "pullRequest",
        }
    }

    /// The name of the kind in the output.
    fn name(self) -> &'static str {
        match self {
            CodeHostingKind::Issue => "issue",
            CodeHostingKind::PullRequest => "pull_request",
        }
    }
}

/// One entry of an issue or of a pull request: its body, a comment, a review, or a review comment on a line.
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    /// `issue` or `pull_request` for the body, `comment`, `review`, `review_comment`, or `diff`.
    pub kind: String,
    /// The login of the author, or `None` for a deleted account and for the diff.
    pub author: Option<String>,
    /// The date, or `None` for the diff.
    pub at: Option<String>,
    /// The text.
    pub text: String,
    /// The extra fields of the entry: `number`, `title`, and `state` for the body, `state` for a review, and `path` and
    /// `line` for a review comment.
    pub extra: Vec<(String, Value)>,
}

impl Entry {
    /// The entry as one row: `kind`, `author`, `at`, the extra fields, then `text`.
    pub fn to_row(&self) -> QueryRow {
        let mut row = QueryRow::new();
        row.insert("kind".to_string(), Value::from(self.kind.clone()));
        row.insert("author".to_string(), json!(self.author));
        row.insert("at".to_string(), json!(self.at));
        for (key, value) in &self.extra {
            row.insert(key.clone(), value.clone());
        }
        row.insert("text".to_string(), Value::from(self.text.clone()));
        row
    }

    /// The entry as text for a person.
    pub fn to_text(&self) -> String {
        if self.kind == "diff" {
            return format!("{}\n", self.text.trim_end());
        }
        let extra: Vec<String> = self.extra.iter().map(|(key, value)| format!("{key}: {}", value_text(value))).collect();
        format!(
            "--- {} by {} at {}{}\n{}\n",
            self.kind,
            self.author.as_deref().unwrap_or("(unknown)"),
            self.at.as_deref().unwrap_or("(no date)"),
            if extra.is_empty() { String::new() } else { format!(" ({})", extra.join(", ")) },
            self.text.trim_end()
        )
    }
}

/// A value as text: a string as it is, and any other value as JSON.
fn value_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => other.to_string(),
    }
}

/// The login of the author of a node.
fn author_of(node: &Value) -> Option<String> {
    node.get("author").and_then(|author| author.get("login")).and_then(Value::as_str).map(str::to_string)
}

/// A text field of a node, or the empty text.
fn text_of(node: &Value, field: &str) -> String {
    node.get(field).and_then(Value::as_str).unwrap_or_default().to_string()
}

/// Reads the body, then every comment, of an issue or of a pull request, then for a pull request every review and every
/// review comment on a line. `repository` is `owner/name`.
///
/// # Errors
/// An error when the query fails, or when the repository has no issue or no pull request with this number.
pub fn read_code_hosting(
    runner: &dyn GraphqlRunner,
    kind: CodeHostingKind,
    repository: &str,
    number: u64,
) -> Result<Vec<Entry>, String> {
    let (owner, name) = repository
        .split_once('/')
        .ok_or_else(|| format!("The repository {repository} is not in the format owner/name."))?;
    let query = match kind {
        CodeHostingKind::Issue => ISSUE_QUERY,
        CodeHostingKind::PullRequest => PULL_REQUEST_QUERY,
    }
    .replace("NUMBER", &number.to_string());
    let mut entries = Vec::new();
    let mut cursor: Option<String> = None;
    loop {
        let answer = runner.run(&query, &[("owner", Some(owner)), ("name", Some(name)), ("cursor", cursor.as_deref())])?;
        if let Some(errors) = answer.get("errors") {
            return Err(format!("GitHub answered with errors: {errors}"));
        }
        let node = answer
            .get("data")
            .and_then(|data| data.get("repository"))
            .and_then(|repository| repository.get(kind.field()))
            .filter(|node| !node.is_null())
            .ok_or_else(|| format!("The repository {repository} has no {} number {number}.", kind.name().replace('_', " ")))?;
        if cursor.is_none() {
            entries.push(Entry {
                kind: kind.name().to_string(),
                author: author_of(node),
                at: node.get("createdAt").and_then(Value::as_str).map(str::to_string),
                text: text_of(node, "body"),
                extra: vec![
                    ("number".to_string(), Value::from(number)),
                    ("title".to_string(), Value::from(text_of(node, "title"))),
                    ("state".to_string(), Value::from(text_of(node, "state"))),
                ],
            });
            for review in node.pointer("/reviews/nodes").and_then(Value::as_array).into_iter().flatten() {
                entries.push(Entry {
                    kind: "review".to_string(),
                    author: author_of(review),
                    at: review.get("submittedAt").and_then(Value::as_str).map(str::to_string),
                    text: text_of(review, "body"),
                    extra: vec![("state".to_string(), Value::from(text_of(review, "state")))],
                });
                for comment in review.pointer("/comments/nodes").and_then(Value::as_array).into_iter().flatten() {
                    let line = comment.get("line").filter(|line| !line.is_null()).or_else(|| comment.get("originalLine"));
                    entries.push(Entry {
                        kind: "review_comment".to_string(),
                        author: author_of(comment),
                        at: comment.get("createdAt").and_then(Value::as_str).map(str::to_string),
                        text: text_of(comment, "body"),
                        extra: vec![
                            ("path".to_string(), Value::from(text_of(comment, "path"))),
                            ("line".to_string(), line.cloned().unwrap_or(Value::Null)),
                        ],
                    });
                }
            }
        }
        for comment in node.pointer("/comments/nodes").and_then(Value::as_array).into_iter().flatten() {
            entries.push(Entry {
                kind: "comment".to_string(),
                author: author_of(comment),
                at: comment.get("createdAt").and_then(Value::as_str).map(str::to_string),
                text: text_of(comment, "body"),
                extra: Vec::new(),
            });
        }
        let page = node.pointer("/comments/pageInfo");
        let has_next_page = page.and_then(|page| page.get("hasNextPage")).and_then(Value::as_bool) == Some(true);
        let next_cursor = page.and_then(|page| page.get("endCursor")).and_then(Value::as_str).map(str::to_string);
        match next_cursor {
            Some(next_cursor) if has_next_page => cursor = Some(next_cursor),
            _ => break,
        }
    }
    entries.sort_by(|left, right| {
        let is_body = |entry: &Entry| entry.kind == kind.name();
        is_body(right).cmp(&is_body(left)).then_with(|| left.at.cmp(&right.at))
    });
    Ok(entries)
}

/// The diff of a pull request, with the command `gh pr diff`.
///
/// # Errors
/// An error when the command `gh` does not start or fails.
pub fn read_pull_request_diff(repository: &str, number: u64) -> Result<Entry, String> {
    let output = Command::new("gh")
        .args(["pr", "diff", &number.to_string(), "--repo", repository, "--color", "never"])
        .output()
        .map_err(|error| format!("The command gh pr diff did not start: {error}"))?;
    if !output.status.success() {
        return Err(format!("The command gh pr diff failed: {}", String::from_utf8_lossy(&output.stderr).trim()));
    }
    Ok(Entry {
        kind: "diff".to_string(),
        author: None,
        at: None,
        text: String::from_utf8_lossy(&output.stdout).into_owned(),
        extra: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    /// A fake runner that gives the answers in order, and keeps the cursors it received.
    struct FakeRunner {
        answers: RefCell<Vec<Value>>,
        cursors: RefCell<Vec<Option<String>>>,
    }

    impl GraphqlRunner for FakeRunner {
        fn run(&self, query: &str, variables: &[(&str, Option<&str>)]) -> Result<Value, String> {
            assert!(query.contains("(number: 7)"));
            self.cursors.borrow_mut().push(variables[2].1.map(str::to_string));
            Ok(self.answers.borrow_mut().remove(0))
        }
    }

    /// An answer for the field `field` with the comments of `comments` and the next page when `next` is given. Only a pull
    /// request has reviews.
    fn answer(field: &str, comments: Vec<Value>, next: Option<&str>) -> Value {
        let mut answer = json!({ "data": { "repository": { field: {
            "number": 7, "title": "A title", "body": "The body.", "createdAt": "2026-10-01T10:00:00Z", "state": "OPEN",
            "author": { "login": "ada" },
            "comments": { "pageInfo": { "hasNextPage": next.is_some(), "endCursor": next }, "nodes": comments },
            "reviews": { "nodes": [{
                "submittedAt": "2026-10-03T10:00:00Z", "body": "Looks good.", "state": "APPROVED", "author": { "login": "bob" },
                "comments": { "nodes": [{
                    "createdAt": "2026-10-03T09:00:00Z", "body": "Rename this.", "path": "a.rs", "line": null,
                    "originalLine": 12, "author": { "login": "bob" },
                }] },
            }] },
        } } } });
        if field == "issue" {
            answer["data"]["repository"][field].as_object_mut().unwrap().remove("reviews");
        }
        answer
    }

    /// A comment of `login` on the day `day`.
    fn comment(login: &str, day: u32) -> Value {
        json!({ "createdAt": format!("2026-10-{day:02}T10:00:00Z"), "body": format!("A comment of {login}."), "author": { "login": login } })
    }

    #[test]
    fn reads_the_body_and_every_page_of_the_comments_of_an_issue() {
        let runner = FakeRunner {
            answers: RefCell::new(vec![
                answer("issue", vec![comment("ada", 2)], Some("cursor-1")),
                answer("issue", vec![comment("bob", 4)], None),
            ]),
            cursors: RefCell::new(Vec::new()),
        };
        let entries = read_code_hosting(&runner, CodeHostingKind::Issue, "owner/name", 7).unwrap();
        assert_eq!(*runner.cursors.borrow(), vec![None, Some("cursor-1".to_string())]);
        let kinds: Vec<&str> = entries.iter().map(|entry| entry.kind.as_str()).collect();
        assert_eq!(kinds, ["issue", "comment", "comment"]);
        assert_eq!(
            Value::Object(entries[0].to_row()),
            json!({ "kind": "issue", "author": "ada", "at": "2026-10-01T10:00:00Z", "number": 7, "title": "A title", "state": "OPEN", "text": "The body." })
        );
        assert_eq!(entries[2].to_text(), "--- comment by bob at 2026-10-04T10:00:00Z\nA comment of bob.\n");
    }

    #[test]
    fn reads_the_reviews_and_the_review_comments_of_a_pull_request_in_the_order_of_their_dates() {
        let runner = FakeRunner {
            answers: RefCell::new(vec![answer("pullRequest", vec![comment("ada", 5)], None)]),
            cursors: RefCell::new(Vec::new()),
        };
        let entries = read_code_hosting(&runner, CodeHostingKind::PullRequest, "owner/name", 7).unwrap();
        let kinds: Vec<&str> = entries.iter().map(|entry| entry.kind.as_str()).collect();
        assert_eq!(kinds, ["pull_request", "review_comment", "review", "comment"]);
        assert_eq!(Value::Object(entries[1].to_row())["path"], json!("a.rs"));
        assert_eq!(Value::Object(entries[1].to_row())["line"], json!(12));
    }

    #[test]
    fn says_when_the_number_is_not_an_issue_of_the_repository() {
        let runner = FakeRunner {
            answers: RefCell::new(vec![json!({ "data": { "repository": { "issue": null } } })]),
            cursors: RefCell::new(Vec::new()),
        };
        let error = read_code_hosting(&runner, CodeHostingKind::Issue, "owner/name", 7).unwrap_err();
        assert_eq!(error, "The repository owner/name has no issue number 7.");
    }
}
