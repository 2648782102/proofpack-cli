# Decision 0001: Local evidence-first product

- Status: accepted for project bootstrap
- Date: 2026-11-07

## Context

Personal developers want to review coding-agent changes, while adjacent projects already provide AI review, agent dashboards, command interception, and sandboxing. A small first project must be useful without an account, hosted service, or new agent runtime.

## Decision

Proofpack is a local CLI that summarizes Git changes and records only user-requested check evidence. It never decides that code is correct. Default inspection is read-only, offline, and executes no project commands.

## Consequences

- The first release is smaller than a full agent auditor or reviewer.
- Reports can be shared as Markdown, but may expose source details; sharing remains the user's choice.
- Security signals are prompts with reasons, not findings or guarantees.
- A future Conchbase adapter is optional and must use a public event contract.

## Revisit when

Real users find no value without automatic check execution, or a concrete import format is stable enough to integrate.
