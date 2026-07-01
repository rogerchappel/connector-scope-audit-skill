# Connector Scope Audit Skill

## When To Use

Use this skill before an agent performs or requests approval for connector-backed actions in CRM, project-management, messaging, document, or repository systems. It is designed for dry-run review of local plans.

## Required Tools Or Inputs

- A connector action plan JSON file.
- A local policy JSON file listing allowed scopes, data classes, write actions, and required approvals.
- Local shell access to run `connector-scope-audit audit`.

## Side-Effect Boundaries

The skill reads local files and writes reports to stdout only. It must not call live connectors, send messages, update records, change permissions, or make network requests.

## Approval Requirements

Write actions require explicit approval evidence when the policy lists `requireApprovalForWrites`. Unknown scopes, unknown data classes, and unapproved write actions should block execution until a human resolves them.

## Examples

```sh
node bin/connector-scope-audit.js audit fixtures/action-plan.json --policy fixtures/policy.json
```

```sh
node bin/connector-scope-audit.js audit plan.json --policy policy.json --json > connector-audit.json
```

## Validation Workflow

Run `npm test`, `npm run check`, `npm run build`, and `npm run smoke`. Attach the audit report to the action approval record before any live connector action.
