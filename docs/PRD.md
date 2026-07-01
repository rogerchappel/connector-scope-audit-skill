# PRD: Connector Scope Audit Skill

## Problem

Agent connector actions often combine permissions, data classes, and side effects in a way that is difficult to review from a plain language plan. Operators need a local dry-run report before they approve writes.

## Goal

Provide a local CLI and library that classify connector action plans as `pass`, `warn`, or `block` based on scope, data, action, and approval policy.

## Non-Goals

- No live connector calls.
- No permission grants.
- No remote writes or messages.
- No policy fetched from external systems.

## Users

- Agents drafting dry-run action plans.
- Reviewers approving connector writes.
- Skill authors packaging connector safety workflows.

## MVP Requirements

- Read plan and policy JSON.
- Normalize scopes, data classes, and actions.
- Block unknown scopes/data/write actions.
- Warn when approval evidence is missing for writes.
- Render Markdown and JSON reports.

## Success Criteria

- A reviewer can see exactly why a plan passed, warned, or blocked.
- Fixture tests cover pass, warn, and block decisions.
- Smoke command proves the package works locally.
