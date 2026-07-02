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

Plans should describe the connector, scopes, data classes, actions, and approval note. Policies define allowed scopes, data classes, write actions, and approvals that are required for writes.

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
