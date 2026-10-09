# Inputs for code analytics

The card contains information about a piece of work. To understand where that information came from and how the work progressed, connect the card to these three inputs:

1. **Source code and its history** — the code and its changes recorded in Git commits over time.
2. **GitHub issues, pull requests, and reviews** — how people discussed, proposed, and reviewed changes.
3. **Agent sessions** — the conversations that took place while generating the card, including the requests and decisions that shaped its contents.

## Section Format
Each source section follows the same format:

- **Title** names the source.
- **Contains** describes the information or evidence available from that source.
- **How to use it** explains which parts of the card that evidence can support.
- **Links to** lists the original records to link so readers can check the evidence.
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
- Specific comments or reviews that support details in the card.

**Limits**
- Distinguish proposals from accepted decisions, and reported test results from checked results.
- A merged pull request shows that a change entered a branch; deployment needs separate evidence.

## Agent sessions

**Contains**
- The requests and decisions that shaped the work and the card.
- Which sources the agent examined and what checks or revisions the session recorded.

**How to use it**
- Explain how the card was prepared and how the request was clarified or changed.
- Describe checks using the session’s recorded messages and output.

**Links to**
- The relevant agent session.
- Specific messages or command results, where available.

**Limits**
- A statement in a session is not proof by itself; support claims about completed work with recorded output or source code.
- Note when part of the session is unavailable.
