import test from "node:test";
import assert from "node:assert/strict";
import { auditPlan, normalizePlan, renderMarkdown, renderSarif } from "../src/index.js";

const policy = {
  allowedScopes: ["contacts.read", "contacts.write"],
  allowedDataClasses: ["contact"],
  allowedReadActions: ["read"],
  allowedWriteActions: ["update"],
  requireApprovalForWrites: true
};

test("normalizes plan arrays and aliases", () => {
  const plan = normalizePlan({ scopes: "Contacts.Read", data: ["Contact"], actions: ["UPDATE"] });
  assert.deepEqual(plan.scopes, ["contacts.read"]);
  assert.deepEqual(plan.dataClasses, ["contact"]);
  assert.deepEqual(plan.actions, ["update"]);
});

test("blocks a disallowed data class hidden behind a simultaneous alias", () => {
  const report = auditPlan({
    connector: "crm", scopes: ["contacts.read"], actions: ["read"],
    dataClasses: ["contact"], data: ["secret"]
  }, policy);
  assert.deepEqual(report.dataClasses, ["contact", "secret"]);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some(({ message }) => message === "Plan dataClasses conflicts with data."));
  assert.ok(report.findings.some(({ message }) => message === "Unknown or disallowed data class: secret"));
});

test("accepts matching simultaneous aliases after normalization", () => {
  const report = auditPlan({
    connector: "crm", scopes: ["contacts.write"], actions: ["update"],
    dataClasses: ["Contact"], data: " contact ",
    approval: " APP-42 ", approvalNote: "APP-42"
  }, { ...policy, allowedData: ["CONTACT"] });
  assert.equal(report.decision, "pass");
});

test("blocks conflicting policy and approval aliases", () => {
  const report = auditPlan({
    connector: "crm", scopes: ["contacts.write"], actions: ["update"],
    dataClasses: ["contact"], approval: "APP-42", approvalNote: "APP-99"
  }, { ...policy, allowedData: ["secret"] });
  assert.equal(report.decision, "block");
  for (const message of [
    "Policy allowedDataClasses conflicts with allowedData.",
    "Plan approval conflicts with approvalNote."
  ]) assert.ok(report.findings.some((finding) => finding.message === message));
});

test("validates both members of every simultaneous alias pair", () => {
  const report = auditPlan({
    connector: "crm", scopes: ["contacts.write"], actions: ["update"],
    dataClasses: ["contact"], data: { hidden: "secret" },
    approval: "APP-42", approvalNote: ["APP-42"]
  }, { ...policy, allowedData: { hidden: "secret" } });
  assert.equal(report.decision, "block");
  for (const message of [
    "Plan data must be a string or an array of strings.",
    "Plan approvalNote must be a string.",
    "Policy allowed data must be a string or an array of strings."
  ]) assert.ok(report.findings.some((finding) => finding.message === message));
});

test("passes approved in-policy write plan", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read", "contacts.write"],
    dataClasses: ["contact"],
    actions: ["update"],
    approval: "User approved contact note update."
  }, policy);
  assert.equal(report.decision, "pass");
});

test("blocks an otherwise valid plan without a connector identity", () => {
  const report = auditPlan({
    connector: "   ",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["read"]
  }, policy);

  assert.equal(report.connector, "");
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.severity === "block"
    && finding.message === "Connector identity is required."
  ));
  assert.match(renderMarkdown(report), /Connector: missing \(required\)/);
});

for (const [name, connector] of [
  ["object", { name: "crm" }],
  ["array", ["crm"]],
  ["number", 42],
  ["boolean", true],
  ["null", null]
]) {
  test(`blocks a ${name} connector identity instead of coercing it`, () => {
    const report = auditPlan({
      connector,
      scopes: ["contacts.read"],
      dataClasses: ["contact"],
      actions: ["read"]
    }, policy);

    assert.equal(report.connector, "");
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) =>
      finding.severity === "block"
      && finding.message === "Connector identity must be a string."
    ));
  });
}

test("trims a valid string connector identity", () => {
  const report = auditPlan({
    connector: "  crm  ",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["read"]
  }, policy);

  assert.equal(report.connector, "crm");
  assert.equal(report.decision, "pass");
});

test("blocks missing write approval when policy requires it", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["update"]
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.severity === "block"
    && finding.message === "Write action requested without approval evidence."
  ));
});

for (const [name, approval] of [
  ["object", { ticket: "APP-42" }],
  ["array", ["APP-42"]],
  ["number", 42],
  ["boolean", true],
  ["null", null]
]) {
  test(`${name} approval evidence does not satisfy a required approval`, () => {
    const report = auditPlan({
      connector: "crm",
      scopes: ["contacts.write"],
      dataClasses: ["contact"],
      actions: ["update"],
      approval
    }, policy);

    assert.equal(report.approval, "");
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) =>
      finding.severity === "block"
      && finding.message === "Write action requested without approval evidence."
    ));
  });
}

test("trims valid string approval evidence", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["update"],
    approval: "  Approved in APP-42.  "
  }, policy);

  assert.equal(report.approval, "Approved in APP-42.");
  assert.equal(report.decision, "pass");
});

test("allows missing write approval when policy does not require it", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read"],
    dataClasses: ["contact"],
    actions: ["update"]
  }, { ...policy, requireApprovalForWrites: false });
  assert.equal(report.decision, "pass");
  assert.ok(!report.findings.some((finding) => finding.message.includes("approval")));
});

test("blocks actions that policy does not classify", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["archive"],
    approval: "User approved archiving the contact."
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) =>
    finding.message === "Action is not allowed by policy: archive"
  ));
});

test("requires approval for policy-defined write actions", () => {
  const archivePolicy = {
    ...policy,
    allowedWriteActions: [...policy.allowedWriteActions, "archive"]
  };
  const plan = {
    connector: "crm",
    scopes: ["contacts.write"],
    dataClasses: ["contact"],
    actions: ["archive"]
  };

  const missingApproval = auditPlan(plan, archivePolicy);
  assert.equal(missingApproval.decision, "block");
  assert.ok(missingApproval.findings.some((finding) =>
    finding.message === "Write action requested without approval evidence."
  ));

  const approved = auditPlan({
    ...plan,
    approval: "User approved archiving the contact."
  }, archivePolicy);
  assert.equal(approved.decision, "pass");
  assert.ok(approved.findings.some((finding) =>
    finding.message === "Write approval evidence is present."
  ));
});

test("blocks unknown scope and write action", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["deals.delete"],
    dataClasses: ["deal"],
    actions: ["delete"]
  }, policy);
  assert.equal(report.decision, "block");
  assert.ok(report.findings.some((finding) => finding.message.includes("deals.delete")));
});

test("blocks non-object plan and policy roots without throwing", () => {
  for (const [plan, suppliedPolicy, message] of [
    [null, policy, "Plan must be a JSON object."],
    [{}, null, "Policy must be a JSON object."],
    [[], policy, "Plan must be a JSON object."],
    [{}, [], "Policy must be a JSON object."]
  ]) {
    const report = auditPlan(plan, suppliedPolicy);
    assert.equal(report.decision, "block");
    assert.ok(report.findings.some((finding) => finding.message === message));
    assert.match(renderMarkdown(report), new RegExp(message.replaceAll(".", "\\.")));
  }
});

test("does not coerce malformed plan and policy identifiers into a pass", () => {
  const invalidIdentifier = { bad: true };
  const report = auditPlan({
    connector: "crm",
    scopes: invalidIdentifier,
    dataClasses: [invalidIdentifier],
    actions: [invalidIdentifier]
  }, {
    allowedScopes: [invalidIdentifier],
    allowedDataClasses: invalidIdentifier,
    allowedReadActions: [invalidIdentifier],
    allowedWriteActions: [],
    requireApprovalForWrites: false
  });

  assert.equal(report.decision, "block");
  assert.deepEqual(report.scopes, []);
  assert.deepEqual(report.dataClasses, []);
  assert.deepEqual(report.actions, []);
  for (const message of [
    "Plan scopes must be a string or an array of strings.",
    "Plan data classes must contain only strings.",
    "Plan actions must contain only strings.",
    "Policy allowed scopes must contain only strings.",
    "Policy allowed data classes must be a string or an array of strings.",
    "Policy allowed read actions must contain only strings."
  ]) {
    assert.ok(report.findings.some((finding) => finding.message === message));
  }
});

test("blocks blank members in every plan and policy list field", () => {
  const report = auditPlan({
    connector: "crm",
    scopes: ["contacts.read", ""],
    dataClasses: ["contact", "   "],
    data: ["contact", "\t"],
    actions: ["read", "\n"]
  }, {
    allowedScopes: ["contacts.read", " "],
    allowedDataClasses: ["contact", ""],
    allowedData: ["contact", "\t"],
    allowedReadActions: ["read", "   "],
    allowedWriteActions: ["update", "\n"],
    requireApprovalForWrites: false
  });

  assert.equal(report.decision, "block");
  assert.deepEqual(report.scopes, ["contacts.read"]);
  assert.deepEqual(report.dataClasses, ["contact"]);
  assert.deepEqual(report.actions, ["read"]);
  for (const label of [
    "Plan scopes", "Plan data classes", "Plan data", "Plan actions",
    "Policy allowed scopes", "Policy allowed data classes", "Policy allowed data",
    "Policy allowed read actions", "Policy allowed write actions"
  ]) {
    assert.ok(report.findings.some(({ message }) =>
      message === `${label} must contain only non-empty strings.`));
  }
});

test("renders markdown report", () => {
  const report = auditPlan({ connector: "crm", scopes: ["contacts.read"], dataClasses: ["contact"], actions: ["read"] }, policy);
  assert.match(renderMarkdown(report), /Connector Scope Audit/);
});

test("renders deterministic SARIF 2.1.0 with severity mappings and decision metadata", () => {
  const clean = auditPlan({ connector: "crm", scopes: ["contacts.read"], dataClasses: ["contact"], actions: ["read"] }, policy);
  const cleanSarif = renderSarif(clean);
  assert.equal(cleanSarif.version, "2.1.0");
  assert.equal(cleanSarif.$schema, "https://json.schemastore.org/sarif-2.1.0.json");
  assert.equal(cleanSarif.runs[0].invocations[0].properties.decision, "pass");
  assert.deepEqual(renderSarif(clean), cleanSarif);
  assert.equal(cleanSarif.runs[0].results.length, clean.findings.length);

  const blocked = auditPlan({ connector: "crm", scopes: ["contacts.write"], dataClasses: ["contact"], actions: ["update"] }, policy);
  const sarif = renderSarif(blocked);
  assert.equal(sarif.runs[0].invocations[0].properties.decision, "block");
  const result = sarif.runs[0].results.find(({ level }) => level === "error");
  assert.ok(result);
  assert.equal(result.ruleId, "audit-block");
  assert.ok(result.message.text.includes("approval"));
  assert.ok(sarif.runs[0].tool.driver.rules.some(({ id }) => id === result.ruleId));
});

import Ajv2020 from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";

const ajv = new Ajv2020({ allErrors: true });
const planSchema = JSON.parse(await readFile(new URL("../schemas/plan.schema.json", import.meta.url)));
const policySchema = JSON.parse(await readFile(new URL("../schemas/policy.schema.json", import.meta.url)));
const validatePlan = ajv.compile(planSchema);
const validatePolicy = ajv.compile(policySchema);

test("plan and policy schemas accept the documented fixtures and supported aliases", async () => {
  assert.equal(validatePlan(JSON.parse(await readFile(new URL("../fixtures/action-plan.json", import.meta.url)))), true);
  assert.equal(validatePolicy(JSON.parse(await readFile(new URL("../fixtures/policy.json", import.meta.url)))), true);
  assert.equal(validatePlan({ connector: "crm", scopes: "contacts.read", actions: ["read"], data: ["contact"], approvalNote: "APP-42" }), true);
  assert.equal(validatePolicy({ allowedScopes: ["contacts.read"], allowedData: "contact", allowedWriteActions: [], requireApprovalForWrites: false }), true);
});

test("plan and policy schemas reject malformed and conflicting input shapes", () => {
  for (const value of [
    { connector: "crm", scopes: [""], actions: ["read"] },
    { connector: "crm", scopes: ["contacts.read"], actions: ["read"], dataClasses: ["contact"], data: ["contact"] },
    { connector: "crm", scopes: ["contacts.read"], actions: ["read"], approval: "one", approvalNote: "two" },
    { connector: "crm", scopes: [2], actions: ["read"] }
  ]) assert.equal(validatePlan(value), false);
  for (const value of [
    { allowedScopes: [], allowedWriteActions: [], requireApprovalForWrites: "false" },
    { allowedScopes: [], allowedWriteActions: [], requireApprovalForWrites: false, allowedData: [], allowedDataClasses: [] },
    { allowedScopes: [""], allowedWriteActions: [], requireApprovalForWrites: false }
  ]) assert.equal(validatePolicy(value), false);
});
