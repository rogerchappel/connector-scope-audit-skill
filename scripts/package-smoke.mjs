#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const output = execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" });
const [pack] = JSON.parse(output);
const files = new Set(pack.files.map((file) => file.path));

const required = [
  "bin/connector-scope-audit.js",
  "src/index.js",
  "fixtures/action-plan.json",
  "fixtures/policy.json",
  "examples/blocked-plan.json",
  "docs/RELEASE_CANDIDATE.md",
  "SKILL.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md"
];

const missing = required.filter((file) => !files.has(file));
if (missing.length) {
  throw new Error(`package missing required files: ${missing.join(", ")}`);
}

console.log(`package smoke ok: ${pack.filename} includes ${pack.files.length} files`);

const directory = mkdtempSync(join(tmpdir(), "connector-scope-audit-pack-"));
try {
  const packed = execFileSync("npm", ["pack", "--pack-destination", directory, "--silent"], {
    encoding: "utf8"
  }).trim();
  execFileSync("tar", ["-xzf", join(directory, packed), "-C", directory]);
  const packedCli = join(directory, "package", "bin", "connector-scope-audit.js");
  const result = spawnSync(process.execPath, [
    packedCli,
    "audit",
    "missing-plan.json",
    "--policy",
    "first.json",
    "--policy",
    "second.json"
  ], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--policy may only be specified once\./);
  assert.match(result.stderr, /^Usage: /m);
  assert.doesNotMatch(result.stderr, /ENOENT/);
  console.log("packed CLI rejects malformed option grammar before file access");
} finally {
  rmSync(directory, { recursive: true, force: true });
}
