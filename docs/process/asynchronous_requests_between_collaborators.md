# Asynchronous requests between collaborators

- Created: 12 October 2026
- Last updated: 13 October 2026
- Status: Proposal with open points
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 274](https://github.com/heidrun-org/heidrun/issues/274), [issue 278](https://github.com/heidrun-org/heidrun/issues/278)

This document describes a way for collaborators on one repository to send requests to each other without a meeting and without a call. A coding agent writes the request as a GitHub issue, and a coding agent helps the receiver read it. The idea comes from [issue 278](https://github.com/heidrun-org/heidrun/issues/278), which comes from [issue 274](https://github.com/heidrun-org/heidrun/issues/274).

## What is already agreed

- The collaborators communicate asynchronously.
- They talk at the product level.
- Everything technical is in the rules of the coding agents. These rules are already in the files of the repository, for example `AGENTS.md`.

## Method

Example: Eric sends a request to Jérôme.

1. Eric opens a chat with a coding agent, Claude or Codex, and speaks to it with the push-to-talk key.
2. Eric speaks for as long as needed. Five minutes is normal. Eric can add screenshots.
3. Eric ends with a sentence like: "Create an issue for Jérôme. Include the screenshots. Write a document that explains what I just said." Then Eric presses enter.
4. The coding agent writes a document that explains the request, and creates a GitHub issue with this document and, if wanted, the screenshots.
5. The document tags Jérôme, the receiver. Jérôme finds the issues that wait for him with a GitHub search.
6. The document can be very long, for example five pages. Jérôme does not read it by hand. Jérôme gives the address of the issue to a coding agent, Claude or Codex, and writes "read this, we are going to talk about it".
7. The coding agent gives a summary. Then Jérôme speaks with the coding agent about the document, with the push-to-talk key. Jérôme reads the document through this conversation.

## Why

- The sender speaks freely and does not write by hand.
- The receiver reads at the speed of a conversation, not at the speed of a long document.
- The collaborators do not need to be available at the same time.

## Test

[Issue 278](https://github.com/heidrun-org/heidrun/issues/278) is the first test of the method. Jérôme dictated the request to a coding agent, and the coding agent wrote the document and created the issue.

## Open points

- The other collaborator has not yet said what the collaborator thinks of this method.
