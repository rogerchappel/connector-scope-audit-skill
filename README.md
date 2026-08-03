# connector-scope-audit-skill

`connector-scope-audit-skill` reviews a local connector action plan before an agent asks for approval or performs a write. It compares requested scopes, data classes, and side effects against a local policy fixture and returns a `pass`, `warn`, or `block` decision.

## Quickstart

```sh
npm install
npm run smoke
node bin/connector-scope-audit.js audit fixtures/action-plan.json --policy fixtures/policy.json
```

Run the full release-candidate gate before publishing or opening a release PR:

```sh
npm run release:check
```

## CLI

```sh
connector-scope-audit audit <plan.json> --policy <policy.json> [--json]
```

The `audit` command accepts exactly one plan path, exactly one `--policy`
option with a following policy path, and at most one `--json` flag. Options may
appear in either order after the plan path. Repeated options, a missing policy
value, and unknown arguments are usage errors; they exit with status `1` and
print the accepted grammar without trying to read either JSON file.

Plans must identify the connector with a nonempty JSON string and describe
scopes, data classes, actions, and any approval note. Approval evidence, when
provided, must also be a JSON string. Both fields are trimmed; objects, arrays,
numbers, booleans, and `null` are never coerced into evidence. A wrong-type,
missing, or whitespace-only connector identity is blocked so an otherwise valid
plan cannot be mistaken for a connector-specific audit. Wrong-type, missing, or
whitespace-only approval does not satisfy a required write approval. Policies
classify every permitted action in either `allowedReadActions` or
`allowedWriteActions`, in addition to defining allowed scopes, data classes,
and whether approval is required for writes.

Action evaluation is fail closed: an action omitted from both lists is blocked, as is an action placed in both lists. Names are not assumed to be safe based on a built-in action vocabulary. Any action in `allowedWriteActions` participates in `requireApprovalForWrites` enforcement, including connector-specific actions such as `archive`.

```json
{
  "allowedScopes": ["contacts.read", "contacts.write"],
  "allowedDataClasses": ["contact"],
  "allowedReadActions": ["read"],
  "allowedWriteActions": ["update", "archive"],
  "requireApprovalForWrites": true
}
```

The decision is `block` when the connector identity is missing, when a requested scope, data class, or write action is
outside policy, or when a write lacks approval evidence while
`requireApprovalForWrites` is `true`. Missing approval evidence does not affect
the decision when that policy setting is `false`. The CLI exits with status `2`
for `block`, `0` for `pass` or `warn`, and `1` for usage or input errors.

## Library

```js
import { auditPlan } from "connector-scope-audit-skill";

const report = auditPlan(plan, policy);
console.log(report.decision);
```

## Safety Notes

This package only reads local JSON files. It does not call connectors, grant permissions, create remote records, or send messages.

## Verification

```sh
npm run check
npm run lint
npm test
npm run smoke
npm run package:smoke
npm run release:check
```

`npm run package:smoke` performs a dry-run npm pack and asserts that the CLI,
library source, fixtures, example plan, skill instructions, changelog, license,
and security policy are present in the tarball.

## Limitations

The audit is policy-driven and cannot prove that a live connector will enforce the same permissions. Treat the output as a dry-run approval aid, not a substitute for platform controls.
## Development checks

Run the same local gates that CI runs before opening a PR:

```bash
npm run check --if-present
npm run build --if-present
npm test --if-present
npm run smoke --if-present
```
