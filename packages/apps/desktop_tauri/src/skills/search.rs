//! The search on skills.sh.

use serde::Deserialize;
use super::github::http_client;
use super::types::{SearchResult, is_valid_name, is_valid_source};

pub(super) const SEARCH_URL: &str = "https://skills.sh/api/search";

#[derive(Deserialize)]
pub(super) struct SearchResponse {
    pub(super) skills: Vec<SearchResult>,
}

/// Searches skills.sh. An empty query gives an empty list.
#[tauri::command]
pub async fn skills_search(query: String) -> Result<Vec<SearchResult>, String> {
    let query = query.trim();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let response = http_client()?
        .get(SEARCH_URL)
        .query(&[("q", query), ("limit", "20")])
        .send()
        .await
        .map_err(|e| format!("skills_search_failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("skills_search_failed: HTTP {}", response.status().as_u16()));
    }
    let parsed: SearchResponse = response.json().await.map_err(|e| format!("skills_search_failed: {e}"))?;
    Ok(parsed.skills.into_iter().filter(|s| is_valid_source(&s.source) && is_valid_name(&s.skill_id)).collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_answer_of_the_search() {
        let json = r#"{"query":"pdf","skills":[{"id":"anthropics/skills/pdf","source":"anthropics/skills","skillId":"pdf","name":"pdf","installs":208236}],"count":1}"#;
        let parsed: SearchResponse = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.skills, [SearchResult { source: "anthropics/skills".into(), skill_id: "pdf".into(), name: "pdf".into(), installs: 208236 }]);
    }
}
