# Connector Scope Audit Skill

## When To Use

Use this skill before an agent performs or requests approval for connector-backed actions in CRM, project-management, messaging, document, or repository systems. It is designed for dry-run review of local plans.

## Required Tools Or Inputs

- A connector action plan JSON file with a nonempty string connector identity.
- A local policy JSON file listing allowed scopes, data classes, read actions,
  write actions, and required approvals.
- Local shell access to run `connector-scope-audit audit`.

## Side-Effect Boundaries

The skill reads local files and writes reports to stdout only. It must not call live connectors, send messages, update records, change permissions, or make network requests.

## Approval Requirements

Write actions require nonempty explicit approval evidence when the policy sets
`requireApprovalForWrites` to `true`; a missing approval then produces a
`block` decision and CLI exit status 2. When that setting is `false`, missing
approval evidence does not affect the decision. Unknown scopes, unknown data
classes, and actions not classified exactly once in `allowedReadActions` or
`allowedWriteActions` also block execution until a human resolves them. Every
action classified in `allowedWriteActions`, including connector-specific action
names, is subject to write approval requirements. A missing or whitespace-only
connector identity also blocks the audit and produces CLI exit status 2.

Connector identity and approval evidence use this JSON grammar: each value must
be a string, surrounding whitespace is trimmed, and the trimmed value must be
nonempty to count as evidence. Objects, arrays, numbers, booleans, and `null`
are not converted to strings. A wrong-type connector value blocks the audit; a
wrong-type approval value is treated as absent and cannot satisfy required
approval.

Both JSON roots must be objects. Plan identifier fields (`scopes`,
`dataClasses`/`data`, and `actions`) and policy allowlists (`allowedScopes`,
`allowedDataClasses`/`allowedData`, `allowedReadActions`, and
`allowedWriteActions`) accept one string or an array containing only strings.
Other explicit values produce blocking schema findings instead of being
coerced. `requireApprovalForWrites`, when present, must be a boolean.

## Examples

```sh
node bin/connector-scope-audit.js audit fixtures/action-plan.json --policy fixtures/policy.json
```

```sh
node bin/connector-scope-audit.js audit plan.json --policy policy.json --json > connector-audit.json
```

## Validation Workflow

Run `npm test`, `npm run check`, `npm run build`, and `npm run smoke`. Attach the audit report to the action approval record before any live connector action.
