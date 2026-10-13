# Agreement on product decisions

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Proposal with open points
- Related framing: [Project instructions](../../AGENTS.md)

This document describes a way for collaborators on one repository to agree on product decisions without a meeting and without a call. It uses the method of [Asynchronous communication](asynchronous_communication.md). Step 1 of [Team workflow](team_workflow.md) uses this document.

## What is a product decision

A product decision is a decision about the direction or the priorities of the product. A technical decision is not a product decision: the technical decisions are in the rules of the coding agents, for example in `AGENTS.md`.

## Method

Example: Alice proposes a product decision to Bob.

1. Alice creates a GitHub issue with the label "product decision". The issue states the proposal and tags every collaborator. Alice creates the issue with the method of asynchronous communication.
2. Each collaborator answers in a comment on the issue: "agree", or "disagree, because ...".
3. When all the collaborators agree, Alice closes the issue with a last comment that states the decision.

## Why

- Each product decision has one address, a GitHub issue, that every collaborator can find with a GitHub search.
- Each collaborator answers when the collaborator is available.
- The decision and the reasons for the decision stay in writing.

## Open points

- It is not decided if silence counts as agreement. Example: no answer after three days.
- It is not decided what the collaborators do when one collaborator disagrees.
