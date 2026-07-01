const WRITE_ACTIONS = new Set(["create", "update", "delete", "send", "publish", "merge", "comment"]);

export function auditPlan(plan, policy, options = {}) {
  const normalized = normalizePlan(plan);
  const normalizedPolicy = normalizePolicy(policy);
  const findings = [
    ...auditAllowed("scope", normalized.scopes, normalizedPolicy.allowedScopes),
    ...auditAllowed("data class", normalized.dataClasses, normalizedPolicy.allowedDataClasses),
    ...auditActions(normalized.actions, normalizedPolicy),
    ...auditApprovals(normalized, normalizedPolicy)
  ];

  findings.unshift({
    severity: "info",
    message: `Connector: ${normalized.connector || "unspecified"}`
  });

  return {
    source: options.source ?? "inline",
    policySource: options.policySource ?? "inline",
    connector: normalized.connector,
    decision: decide(findings),
    scopes: normalized.scopes,
    dataClasses: normalized.dataClasses,
    actions: normalized.actions,
    approval: normalized.approval,
    findings,
    evidence: buildEvidence(findings)
  };
}

export function renderMarkdown(report) {
  const lines = [
    "# Connector Scope Audit",
    "",
    `- Source: ${report.source}`,
    `- Policy: ${report.policySource}`,
    `- Connector: ${report.connector || "unspecified"}`,
    `- Decision: ${report.decision}`,
    "",
    "## Plan",
    ...renderList("Scopes", report.scopes),
    ...renderList("Data Classes", report.dataClasses),
    ...renderList("Actions", report.actions),
    `- Approval: ${report.approval || "not provided"}`,
    "",
    "## Findings",
    ...report.findings.map((finding) => `- ${finding.severity.toUpperCase()}: ${finding.message}`),
    "",
    "## Evidence To Retain",
    ...report.evidence.map((item) => `- ${item}`)
  ];
  return `${lines.join("\n")}\n`;
}

export function normalizePlan(plan) {
  return {
    connector: String(plan.connector ?? "").trim(),
    scopes: normalizeList(plan.scopes),
    dataClasses: normalizeList(plan.dataClasses ?? plan.data),
    actions: normalizeList(plan.actions),
    approval: String(plan.approval ?? plan.approvalNote ?? "").trim()
  };
}

function normalizePolicy(policy) {
  return {
    allowedScopes: new Set(normalizeList(policy.allowedScopes)),
    allowedDataClasses: new Set(normalizeList(policy.allowedDataClasses ?? policy.allowedData)),
    allowedWriteActions: new Set(normalizeList(policy.allowedWriteActions)),
    requireApprovalForWrites: Boolean(policy.requireApprovalForWrites)
  };
}

function auditAllowed(label, requested, allowed) {
  if (requested.length === 0) {
    return [{ severity: "warn", message: `No ${label}s listed in plan.` }];
  }
  return requested
    .filter((item) => !allowed.has(item))
    .map((item) => ({ severity: "block", message: `Unknown or disallowed ${label}: ${item}` }));
}

function auditActions(actions, policy) {
  if (actions.length === 0) return [{ severity: "warn", message: "No actions listed in plan." }];
  const findings = [];
  for (const action of actions) {
    if (WRITE_ACTIONS.has(action) && !policy.allowedWriteActions.has(action)) {
      findings.push({ severity: "block", message: `Write action is not allowed by policy: ${action}` });
    }
  }
  return findings;
}

function auditApprovals(plan, policy) {
  const hasWrite = plan.actions.some((action) => WRITE_ACTIONS.has(action));
  if (hasWrite && policy.requireApprovalForWrites && !plan.approval) {
    return [{ severity: "warn", message: "Write action requested without approval evidence." }];
  }
  if (hasWrite && plan.approval) {
    return [{ severity: "info", message: "Write approval evidence is present." }];
  }
  return [];
}

function decide(findings) {
  if (findings.some((finding) => finding.severity === "block")) return "block";
  if (findings.some((finding) => finding.severity === "warn")) return "warn";
  return "pass";
}

function buildEvidence(findings) {
  const evidence = ["Plan and policy files reviewed locally."];
  if (findings.some((finding) => finding.severity === "block")) {
    evidence.push("Blocked findings resolved or explicitly waived before live action.");
  }
  if (findings.some((finding) => finding.message.includes("approval"))) {
    evidence.push("Approval note retained with connector dry-run packet.");
  }
  return evidence;
}

function renderList(label, values) {
  return [`### ${label}`, ...(values.length ? values.map((item) => `- ${item}`) : ["- Not specified"])];
}

function normalizeList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((item) => String(item).toLowerCase().trim()).filter(Boolean))];
}
