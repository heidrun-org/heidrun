//! Adds a `LIMIT` to a statement that has none, so that one query never floods the context of a coding agent by mistake.

/// The limit of the command query when the option `--limit` is not given.
pub const DEFAULT_LIMIT: u64 = 1000;

/// The statement with `LIMIT <limit>` at its end, or the statement as it is when the limit is 0, when the statement is not a
/// `SELECT`, a `WITH`, or a `VALUES`, or when the word `LIMIT` is already in it, outside the quoted texts, the comments, and
/// the parentheses. A `LIMIT` inside a subquery limits only the subquery, so it does not count.
/// The comments are removed from a statement that gets a limit, and the limit goes on a new line, so a comment at the end
/// cannot hide it.
pub fn add_limit(sql: &str, limit: u64) -> String {
    if limit == 0 {
        return sql.to_string();
    }
    let (without_comments, code_only) = split_statement(sql);
    let words = upper_case_words(&code_only);
    let is_read = matches!(words.first().map(String::as_str), Some("SELECT" | "WITH" | "VALUES"));
    if !is_read || upper_case_words(&outside_parentheses(&code_only)).iter().any(|word| word == "LIMIT") {
        return sql.to_string();
    }
    let mut statement = without_comments.trim_end();
    while let Some(rest) = statement.strip_suffix(';') {
        statement = rest.trim_end();
    }
    format!("{statement}\nLIMIT {limit}")
}

/// The words of a text, in upper case.
fn upper_case_words(text: &str) -> Vec<String> {
    text.split(|character: char| !(character.is_ascii_alphanumeric() || character == '_'))
        .filter(|word| !word.is_empty())
        .map(str::to_ascii_uppercase)
        .collect()
}

/// The text with each character inside parentheses changed to one space, so only the words at the depth 0 stay.
fn outside_parentheses(code_only: &str) -> String {
    let mut depth = 0usize;
    code_only
        .chars()
        .map(|character| match character {
            '(' => {
                depth += 1;
                ' '
            }
            ')' => {
                depth = depth.saturating_sub(1);
                ' '
            }
            _ if depth > 0 => ' ',
            _ => character,
        })
        .collect()
}

/// The statement in two forms: without its comments, and without its comments and its quoted texts. A comment and a quoted
/// text become one space, so two words around them never join.
fn split_statement(sql: &str) -> (String, String) {
    let mut without_comments = String::with_capacity(sql.len());
    let mut code_only = String::with_capacity(sql.len());
    let mut characters = sql.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '-' if characters.peek() == Some(&'-') => {
                for next in characters.by_ref() {
                    if next == '\n' {
                        break;
                    }
                }
                without_comments.push('\n');
                code_only.push(' ');
            }
            '/' if characters.peek() == Some(&'*') => {
                characters.next();
                let mut previous = ' ';
                for next in characters.by_ref() {
                    if previous == '*' && next == '/' {
                        break;
                    }
                    previous = next;
                }
                without_comments.push(' ');
                code_only.push(' ');
            }
            '\'' | '"' | '`' | '[' => {
                let end = if character == '[' { ']' } else { character };
                without_comments.push(character);
                while let Some(next) = characters.next() {
                    without_comments.push(next);
                    if next == end {
                        if end != ']' && characters.peek() == Some(&end) {
                            without_comments.push(end);
                            characters.next();
                            continue;
                        }
                        break;
                    }
                }
                code_only.push(' ');
            }
            _ => {
                without_comments.push(character);
                code_only.push(character);
            }
        }
    }
    (without_comments, code_only)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_the_limit_to_a_statement_that_has_none() {
        assert_eq!(add_limit("SELECT * FROM commits", 1000), "SELECT * FROM commits\nLIMIT 1000");
        assert_eq!(add_limit("  select 1 ;; \n", 5), "  select 1\nLIMIT 5");
        assert_eq!(add_limit("WITH a AS (SELECT 1) SELECT * FROM a", 5), "WITH a AS (SELECT 1) SELECT * FROM a\nLIMIT 5");
    }

    #[test]
    fn adds_nothing_when_the_statement_has_a_limit() {
        assert_eq!(add_limit("SELECT * FROM commits LIMIT 5", 1000), "SELECT * FROM commits LIMIT 5");
        assert_eq!(add_limit("SELECT * FROM commits\nlimit 5 offset 2", 1000), "SELECT * FROM commits\nlimit 5 offset 2");
    }

    #[test]
    fn adds_the_limit_when_the_only_limit_is_inside_a_subquery() {
        let sql = "SELECT c.id FROM chat_sessions AS c, (SELECT 1 LIMIT 1) WHERE c.repository = 'a/b'";
        assert_eq!(add_limit(sql, 1000), format!("{sql}\nLIMIT 1000"));
        let sql = "WITH a AS (SELECT 1 LIMIT 1) SELECT * FROM a";
        assert_eq!(add_limit(sql, 5), format!("{sql}\nLIMIT 5"));
        let sql = "SELECT * FROM (SELECT 1 LIMIT 1) LIMIT 3";
        assert_eq!(add_limit(sql, 5), sql);
    }

    #[test]
    fn adds_nothing_when_the_limit_is_0() {
        assert_eq!(add_limit("SELECT * FROM commits", 0), "SELECT * FROM commits");
    }

    #[test]
    fn adds_nothing_to_a_statement_that_is_not_a_read() {
        assert_eq!(add_limit("PRAGMA table_info(commits)", 1000), "PRAGMA table_info(commits)");
        assert_eq!(add_limit("DELETE FROM commits", 1000), "DELETE FROM commits");
    }

    #[test]
    fn ignores_the_word_limit_in_a_quoted_text_or_in_a_comment() {
        assert_eq!(add_limit("SELECT 'limit' AS a", 7), "SELECT 'limit' AS a\nLIMIT 7");
        assert_eq!(add_limit("SELECT \"limit\" FROM t", 7), "SELECT \"limit\" FROM t\nLIMIT 7");
        assert_eq!(add_limit("SELECT 'it''s; limit' AS a", 7), "SELECT 'it''s; limit' AS a\nLIMIT 7");
        assert_eq!(add_limit("SELECT 1 /* limit */", 7), "SELECT 1\nLIMIT 7");
    }

    #[test]
    fn removes_a_comment_at_the_end_so_that_it_cannot_hide_the_limit() {
        assert_eq!(add_limit("SELECT 1; -- the limit comes later", 7), "SELECT 1\nLIMIT 7");
        assert_eq!(add_limit("-- a comment\nSELECT 1", 7), "\nSELECT 1\nLIMIT 7");
    }
}
