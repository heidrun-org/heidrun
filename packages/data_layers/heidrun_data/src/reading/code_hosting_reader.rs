//! Reads the body and the comments of one issue or of one pull request, with the `GraphqlRunner` of
//! `data_layer_code_hosting`, and the diff of a pull request with the command `gh pr diff`.
//!
//! GitHub only, as `data_layer_code_hosting`: the support of GitLab comes at the same time as in that package.

use crate::output::QueryRow;
use data_layer_code_hosting::GraphqlRunner;
use serde_json::{json, Value};
use std::process::Command;
use crate::REQUEST_PACKAGE;
use request_log::{record, RequestKind, RequestSpec, Summary};

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

/// The query of one pull request with one page of its comments.
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
        }
    }
}
"#;

/// The query of one page of the reviews of one pull request, each with the first page of its comments on the lines.
const REVIEWS_QUERY: &str = r#"
query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        pullRequest(number: NUMBER) {
            reviews(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes {
                    id submittedAt body state
                    author { login }
                    comments(first: 100) {
                        pageInfo { hasNextPage endCursor }
                        nodes { createdAt body path line originalLine author { login } }
                    }
                }
            }
        }
    }
}
"#;

/// The query of one page of the comments on the lines of one review, after its first page.
const REVIEW_COMMENTS_QUERY: &str = r#"
query($id: ID!, $cursor: String) {
    node(id: $id) {
        ... on PullRequestReview {
            comments(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes { createdAt body path line originalLine author { login } }
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
    let spec = RequestSpec::new(REQUEST_PACKAGE, "read_code_hosting", RequestKind::Collection)
        .choice("kind", format!("{kind:?}"))
        .parameter("repository", repository)
        .parameter("number", number);
    record(spec, || read_code_hosting_inside(runner, kind, repository, number), |entries| Summary::count(entries.len()))
}

/// The work of `read_code_hosting`, between the start event and the completion event of its request.
fn read_code_hosting_inside(
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
        match next_cursor(node.get("comments")) {
            Some(next) => cursor = Some(next),
            None => break,
        }
    }
    if kind == CodeHostingKind::PullRequest {
        read_reviews(runner, owner, name, number, &mut entries)?;
    }
    entries.sort_by(|left, right| {
        let is_body = |entry: &Entry| entry.kind == kind.name();
        is_body(right).cmp(&is_body(left)).then_with(|| left.at.cmp(&right.at))
    });
    Ok(entries)
}

/// Reads every page of the reviews of a pull request, and every page of the comments on the lines of each review.
///
/// # Errors
/// An error when a query fails.
fn read_reviews(
    runner: &dyn GraphqlRunner,
    owner: &str,
    name: &str,
    number: u64,
    entries: &mut Vec<Entry>,
) -> Result<(), String> {
    let query = REVIEWS_QUERY.replace("NUMBER", &number.to_string());
    let variables = [("owner", Some(owner)), ("name", Some(name))];
    let reviews = read_all_nodes(runner, &query, &variables, "/data/repository/pullRequest/reviews", None)?;
    for review in &reviews {
        entries.push(Entry {
            kind: "review".to_string(),
            author: author_of(review),
            at: review.get("submittedAt").and_then(Value::as_str).map(str::to_string),
            text: text_of(review, "body"),
            extra: vec![("state".to_string(), Value::from(text_of(review, "state")))],
        });
        let mut comments = review.pointer("/comments/nodes").and_then(Value::as_array).cloned().unwrap_or_default();
        if let Some(cursor) = next_cursor(review.get("comments")) {
            let id = text_of(review, "id");
            let variables = [("id", Some(id.as_str()))];
            comments.extend(read_all_nodes(runner, REVIEW_COMMENTS_QUERY, &variables, "/data/node/comments", Some(cursor))?);
        }
        for comment in &comments {
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
    Ok(())
}

/// Reads the nodes of every page of one connection of GitHub, from the page after `cursor`. `pointer` is the place of the
/// connection in the answer, and the variable `cursor` comes after `variables`.
///
/// # Errors
/// An error when a query fails, or when the answer has no connection at `pointer`.
fn read_all_nodes(
    runner: &dyn GraphqlRunner,
    query: &str,
    variables: &[(&str, Option<&str>)],
    pointer: &str,
    cursor: Option<String>,
) -> Result<Vec<Value>, String> {
    let mut nodes = Vec::new();
    let mut cursor = cursor;
    loop {
        let mut page_variables = variables.to_vec();
        page_variables.push(("cursor", cursor.as_deref()));
        let answer = runner.run(query, &page_variables)?;
        if let Some(errors) = answer.get("errors") {
            return Err(format!("GitHub answered with errors: {errors}"));
        }
        let connection = answer
            .pointer(pointer)
            .filter(|connection| !connection.is_null())
            .ok_or_else(|| format!("The answer of GitHub has nothing at {pointer}."))?;
        nodes.extend(connection.get("nodes").and_then(Value::as_array).cloned().unwrap_or_default());
        match next_cursor(Some(connection)) {
            Some(next) => cursor = Some(next),
            None => return Ok(nodes),
        }
    }
}

/// The cursor of the next page of a connection, or `None` when the connection has no next page.
fn next_cursor(connection: Option<&Value>) -> Option<String> {
    let page = connection?.get("pageInfo")?;
    if page.get("hasNextPage").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    page.get("endCursor").and_then(Value::as_str).map(str::to_string)
}

/// The diff of a pull request, with the command `gh pr diff`.
///
/// # Errors
/// An error when the command `gh` does not start or fails.
pub fn read_pull_request_diff(repository: &str, number: u64) -> Result<Entry, String> {
    let spec = RequestSpec::new(REQUEST_PACKAGE, "read_pull_request_diff", RequestKind::Collection)
        .parameter("repository", repository)
        .parameter("number", number);
    record(spec, || read_pull_request_diff_inside(repository, number), |_| Summary::count(1))
}

/// The work of `read_pull_request_diff`, between the start event and the completion event of its request.
fn read_pull_request_diff_inside(repository: &str, number: u64) -> Result<Entry, String> {
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
            assert!(query.contains("(number: 7)") || query.contains("node(id: $id)"));
            let cursor = variables.iter().find(|(key, _)| *key == "cursor").and_then(|(_, value)| *value);
            self.cursors.borrow_mut().push(cursor.map(str::to_string));
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
            answers: RefCell::new(vec![
                answer("pullRequest", vec![comment("ada", 5)], None),
                answer("pullRequest", Vec::new(), None),
            ]),
            cursors: RefCell::new(Vec::new()),
        };
        let entries = read_code_hosting(&runner, CodeHostingKind::PullRequest, "owner/name", 7).unwrap();
        let kinds: Vec<&str> = entries.iter().map(|entry| entry.kind.as_str()).collect();
        assert_eq!(kinds, ["pull_request", "review_comment", "review", "comment"]);
        assert_eq!(Value::Object(entries[1].to_row())["path"], json!("a.rs"));
        assert_eq!(Value::Object(entries[1].to_row())["line"], json!(12));
    }

    #[test]
    fn reads_every_page_of_the_reviews_and_of_the_review_comments_of_a_pull_request() {
        let review = |id: &str, day: u32, comments_next: Option<&str>| {
            json!({
                "id": id, "submittedAt": format!("2026-10-{day:02}T10:00:00Z"), "body": "", "state": "COMMENTED",
                "author": { "login": "bob" },
                "comments": {
                    "pageInfo": { "hasNextPage": comments_next.is_some(), "endCursor": comments_next },
                    "nodes": [{ "createdAt": format!("2026-10-{day:02}T09:00:00Z"), "body": "First.", "path": "a.rs", "line": 1, "author": { "login": "bob" } }],
                },
            })
        };
        let reviews_page = |reviews: Vec<Value>, next: Option<&str>| {
            json!({ "data": { "repository": { "pullRequest": { "reviews": {
                "pageInfo": { "hasNextPage": next.is_some(), "endCursor": next }, "nodes": reviews,
            } } } } })
        };
        let review_comments_page = json!({ "data": { "node": { "comments": {
            "pageInfo": { "hasNextPage": false, "endCursor": null },
            "nodes": [{ "createdAt": "2026-10-03T09:30:00Z", "body": "Second.", "path": "a.rs", "line": 2, "author": { "login": "bob" } }],
        } } } });
        let runner = FakeRunner {
            answers: RefCell::new(vec![
                answer("pullRequest", Vec::new(), None),
                reviews_page(vec![review("review-1", 3, Some("comments-1"))], Some("reviews-1")),
                reviews_page(vec![review("review-2", 4, None)], None),
                review_comments_page,
            ]),
            cursors: RefCell::new(Vec::new()),
        };
        let entries = read_code_hosting(&runner, CodeHostingKind::PullRequest, "owner/name", 7).unwrap();
        assert_eq!(
            *runner.cursors.borrow(),
            vec![None, None, Some("reviews-1".to_string()), Some("comments-1".to_string())]
        );
        let texts: Vec<(&str, &str)> = entries.iter().map(|entry| (entry.kind.as_str(), entry.text.as_str())).collect();
        assert_eq!(
            texts,
            [
                ("pull_request", "The body."),
                ("review_comment", "First."),
                ("review_comment", "Second."),
                ("review", ""),
                ("review_comment", "First."),
                ("review", ""),
            ]
        );
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
