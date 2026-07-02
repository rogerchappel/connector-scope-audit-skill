# connector-scope-audit-skill

`connector-scope-audit-skill` reviews a local connector action plan before an agent asks for approval or performs a write. It compares requested scopes, data classes, and side effects against a local policy fixture and returns a `pass`, `warn`, or `block` decision.

## Quickstart

```sh
npm install
npm run release:check
node bin/connector-scope-audit.js audit fixtures/action-plan.json --policy fixtures/policy.json
```

## CLI

```sh
connector-scope-audit audit <plan.json> --policy <policy.json> [--json]
```

Plans should describe the connector, scopes, data classes, actions, and approval note. Policies define allowed scopes, data classes, write actions, and approvals that are required for writes.

## Library

```js
import { auditPlan } from "connector-scope-audit-skill";

const report = auditPlan(plan, policy);
console.log(report.decision);
```

## Safety Notes

This package only reads local JSON files. It does not call connectors, grant permissions, create remote records, or send messages.

## Release Readiness

`npm run release:check` runs the metadata check, tests, fixture-backed CLI smoke,
and an npm package smoke that verifies the published tarball includes the CLI,
library entry, docs, fixtures, README, license, security policy, and contributing
guide.

## Limitations

The audit is policy-driven and cannot prove that a live connector will enforce the same permissions. Treat the output as a dry-run approval aid, not a substitute for platform controls.
