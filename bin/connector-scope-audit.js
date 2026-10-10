#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { auditPlan, renderMarkdown, renderSarif } from "../src/index.js";

async function main(argv) {
  const [command, planPath, ...rest] = argv;
  if (command !== "audit" || !planPath) {
    throw new UsageError("Expected the audit command and a plan JSON path.");
  }
  const options = parseArgs(rest);

  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const policy = JSON.parse(await readFile(options.policy, "utf8"));
  const report = auditPlan(plan, policy, { source: planPath, policySource: options.policy });
  const output = options.sarif ? renderSarif(report) : options.json ? report : null;
  process.stdout.write(output ? `${JSON.stringify(output, null, 2)}\n` : renderMarkdown(report));
  if (report.decision === "block") process.exitCode = 2;
}

function parseArgs(args) {
  const options = { json: false, sarif: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--sarif") {
      if (options.sarif) throw new UsageError("--sarif may only be specified once.");
      options.sarif = true;
    } else if (arg === "--json") {
      if (options.json) throw new UsageError("--json may only be specified once.");
      options.json = true;
    } else if (arg === "--policy") {
      if (options.policy) throw new UsageError("--policy may only be specified once.");
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new UsageError("--policy requires a policy JSON path.");
      }
      options.policy = value;
      index += 1;
    } else {
      throw new UsageError(`Unknown argument: ${arg}`);
    }
  }
  if (!options.policy) throw new UsageError("--policy is required.");
  if (options.json && options.sarif) throw new UsageError("--json and --sarif cannot be combined.");
  return options;
}

class UsageError extends Error {}

function usage() {
  process.stderr.write("Usage: connector-scope-audit audit <plan.json> --policy <policy.json> [--json|--sarif]\n");
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  if (error instanceof UsageError) usage();
  process.exitCode = 1;
});
