# Inputs for code analytics

The code reflects a piece of work. To understand where the code came from and how the work progressed, connect it to these three inputs:

1. **Source code and its history** — the code and its changes recorded in Git commits over time.
2. **GitHub issues, pull requests, and reviews** — how people discussed, proposed, and reviewed changes.
3. **Agent sessions** — the conversations that took place while producing the code, including the requests and decisions that shaped it.

## Section Format
Each source section follows the same format:

- **Title** names the source.
- **Contains** describes the information or evidence available from that source.
- **How to use it** explains which statements about the code that evidence can support.
- **Links to** lists the original records to link so readers can check the evidence.
- **Relation with other sources** explains how this source supports or adds context to the other sources.
- **Limits** states what the source cannot establish on its own, to avoid claims that go beyond the evidence.

## Source code and its history

**Contains**
- The application’s behaviour at a particular point in time.
- The files and commits that added, changed, or removed that behaviour.

**How to use it**
- Describe what changed in the application and how the change developed across commits.
- Use tests or related code to support the description.

**Links to**
- Relevant files at the recorded version.
- Commits that changed those files.

**Relation with other sources**
- GitHub issues and pull requests explain why the code changed; reviews can discuss the implementation.
- Agent sessions can record how the code was produced and decisions made during the work.

**Limits**
- Source code can show what changed, but may not explain why.
- A test in the code does not show that the test passed; use a recorded test result for that claim.

## GitHub issues, pull requests, and reviews

**Contains**
- The original problem or request, its constraints, and how its scope was clarified.
- The proposed change, review feedback, and decisions made before the change was accepted.

**How to use it**
- Explain the requested outcome and the approach people discussed.
- Use review comments to explain why particular changes were requested or accepted.

**Links to**
- The issue and pull request.
- Specific comments or reviews that support statements about the code.

**Relation with other sources**
- The source code and its history show which parts of the request were implemented and how.
- Agent sessions can add context about requests, decisions, and checks that may not appear in GitHub discussions.

**Limits**
- Distinguish proposals from accepted decisions, and reported test results from checked results.
- A merged pull request shows that a change entered a branch; deployment needs separate evidence.

## Agent sessions

**Contains**
- The requests and decisions that shaped the work and the code.
- Which sources the agent examined and what checks or revisions the session recorded.

**How to use it**
- Explain how the code was produced and how the request was clarified or changed.
- Describe checks using the session’s recorded messages and output.

**Links to**
- The relevant agent session.
- Specific messages or command results, where available.

**Relation with other sources**
- Compare the session’s descriptions of changes and checks with the source code and its history.
- Use GitHub issues, pull requests, and reviews to verify or add context to recorded requests and decisions.

**Limits**
- A statement in a session is not proof by itself; support claims about completed work with recorded output or source code.
- Note when part of the session is unavailable.
