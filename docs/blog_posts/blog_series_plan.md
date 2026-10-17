# Heidrun blog series plan

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Approved series plan with draft implementation
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Marketing guidance](../marketing/README.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## Required Process

The process URL is part of the instructions for this work:

- [Blog post generation process](https://github.com/jeromeetienne/jeromeetienne.github.io/issues/13)

The interview and three-post proposal were approved before drafting. Generate one PNG illustration per article, store the illustrations in the images folder with the matching article slug, and place the repository blockquote immediately before the image at the end of the first article section. Reuse the illustration in the associated social message. Keep title case for article and section titles. Import the articles into the personal blog's existing article and image hierarchy.

On 17 October 2026, the developer selected “Keep all three as drafts for now.” No publication schedule is agreed. The old July dates in the process are not the dates for this series.

## Interview Decisions

- Audience: developers beginning to use coding agents and developers already managing several coding agents.
- Goal: attract early users who use Heidrun in daily work and report what does not fit their needs. Collaboration is welcome.
- Central idea: coding agents help produce more work; Heidrun helps keep track of the work and recover the reasoning behind the code.
- Original frustration: after starting three or four features, the developer loses track of coding agents that need attention, finished worktrees, and changes already merged. Project instructions helped establish a workflow but did not remove the burden of remembering.
- Second frustration: looking at code months later does not reliably explain the original intent. Code, issues, pull requests, and saved coding agent conversations can supply the context.
- First successful experience: recover a whole piece of work from a partial memory of the topic and approximate date.
- Access: the developer asks Claude Code or Codex in an ordinary conversation. The coding agent uses the heidrun_data skill to query indexed records and read original sources. Do not imply that Heidrun has a built-in conversational search field.
- Positioning: a workspace for directing coding agents and reviewing results, familiar to developers who have used a development environment with tabs and terminals.
- Maturity: early software, used by its creator every day, improving quickly.
- Technical depth: delegated to the writer; explain engineering through demonstrated user value.
- Evidence: the writer should find a concrete historical example and examine the Statistics window's underlying records.
- Feedback sought: whether developers like using Heidrun, which workflows fail to fit their work, what is difficult, and what essential capabilities are missing.
- Interview estimates: approximately 30 pull requests per day, 210 pull requests and 400 issues in a week. These were not verified figures. The articles instead use a measured period and explicit counting definitions.

## Recommended Structure

Three posts answer three reader questions: how does Heidrun help today, can Heidrun recover context, and what can a developer learn from the history?

### 1. Three Features in Progress. Which One Needs Me?

**Synopsis:** Open with the creator's experience of starting several features while coding agents work. Show a representative session moving between panes, responding through the Needs you sidebar section, and reviewing the proposed work. Explain that a finished coding agent does not establish that a feature is merged or delivered.

**Intended audience:** Developers beginning to use coding agents, and developers already managing several coding agents.

**Key message:** As coding agents take on more implementation work, developers need a clear way to direct the work and review the results.

**Why this post belongs:** Establish a recognisable problem and a practical reason to try Heidrun, with feature descriptions tied to a working session.

### 2. Why Did We Write This Code? Ask the Development History

**Synopsis:** Reconstruct why token usage moved into indexed data-layer storage using the original conversation, issue, pull request, and changed files. Explain how indexed facts identify candidates and original sources supply the evidence. Use the example to explain shared data layers and the separation between collection and retrieval.

**Intended audience:** Developers who lose track of conversations, maintain unfamiliar code, or want to understand how Heidrun works.

**Key message:** Saved conversations can preserve reasoning that helps explain a change after the developer has forgotten the details.

**Why this post belongs:** The example demonstrates Heidrun's distinctive value and explains the engineering decisions through a verifiable investigation.

### 3. What Does a Day of Development With Coding Agents Actually Look Like?

**Synopsis:** Examine 16 October within a measured week, 10–16 October 2026 in Paris time. Separate commits, opened and merged pull requests, opened issues, tokens, estimated cost, and recorded active time. Use the exclusion of approval-review conversations to explain why counting definitions matter, and invite early users to test their own histories.

**Intended audience:** Developers considering daily use of Heidrun and developers curious about how coding agents change working habits.

**Key message:** Development records support better questions about a workflow when their scope and limitations are understood.

**Why this post belongs:** Show sustained use and give early users a concrete way to evaluate Heidrun and report useful feedback.

## Critique and Improvements

Two posts would compress the demonstrations and the engineering explanation. A fourth post is worthwhile only if the second post yields enough material for a separate technical article. Keep one continuous example in the second post and a compact retrieval diagram instead of a catalogue of packages.

The third post needs evidence and an interesting interpretation. Commits, token usage, and estimated cost do not establish software quality or productivity. Define dates, authors, repositories, time zones, and whether pull requests were opened or merged. Do not repeat the interview estimates as measured facts.

Earn enthusiasm through demonstrations. Explain the early state of the project and invite early users to bring a real workflow, try Heidrun, and identify the steps that need improvement.
