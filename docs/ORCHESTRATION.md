# Orchestration

## Inputs

- `plan.json`: local connector action plan.
- `policy.json`: local approval and scope policy.

## Flow

1. Read local JSON files.
2. Normalize plan scopes, data classes, and actions.
3. Compare the plan with policy allowlists.
4. Classify each finding as info, warn, or block.
5. Emit Markdown or JSON report.
6. Attach report to approval evidence before live execution.

## Side Effects

The tool has no side effects beyond stdout and stderr.

## Failure Modes

- Missing files exit non-zero.
- Invalid JSON exits non-zero.
- Valid JSON with a non-object plan or policy root produces a block report.
- Identifier fields accept a string or an array of strings; wrong-type fields
  and non-string array members produce block findings without coercion.
- Unknown scopes, data classes, or actions create block findings. Policies must
  classify each permitted action exactly once as read-only or write.

## Planned automation report format

SARIF-like output is a future capability, not a current output mode. The target
contract is a result per finding (stable rule identifier, severity, message,
and source location when available) plus the overall decision in run metadata.
There is currently no `--sarif` flag and no SARIF conformance claim. Automation
must use Markdown or native JSON until this capability is implemented and
verified.
