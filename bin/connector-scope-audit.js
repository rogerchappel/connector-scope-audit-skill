#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { auditPlan, renderMarkdown } from "../src/index.js";

async function main(argv) {
  const [command, planPath, ...rest] = argv;
  if (command !== "audit" || !planPath) {
    usage();
    process.exitCode = 1;
    return;
  }
  const options = parseArgs(rest);
  if (!options.policy) throw new Error("--policy is required");

  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const policy = JSON.parse(await readFile(options.policy, "utf8"));
  const report = auditPlan(plan, policy, { source: planPath, policySource: options.policy });
  process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report));
  if (report.decision === "block") process.exitCode = 2;
}

function parseArgs(args) {
  const options = { json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--policy") {
      options.policy = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function usage() {
  process.stderr.write("Usage: connector-scope-audit audit <plan.json> --policy <policy.json> [--json]\n");
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
