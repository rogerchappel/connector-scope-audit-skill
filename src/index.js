export function auditPlan(plan, policy, options = {}) {
  const planInput = isRecord(plan) ? plan : {};
  const policyInput = isRecord(policy) ? policy : {};
  const normalized = normalizePlan(planInput);
  const normalizedPolicy = normalizePolicy(policyInput);
  const findings = [
    ...auditInputSchema(plan, policy),
    ...auditConnector(normalized.connector, planInput.connector),
    ...auditAllowed("scope", normalized.scopes, normalizedPolicy.allowedScopes),
    ...auditAllowed("data class", normalized.dataClasses, normalizedPolicy.allowedDataClasses),
    ...auditActions(normalized.actions, normalizedPolicy),
    ...auditApprovals(normalized, normalizedPolicy)
  ];

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

function auditConnector(connector, input) {
  if (input !== undefined && typeof input !== "string") {
    return [{ severity: "block", message: "Connector identity must be a string." }];
  }
  if (!connector) {
    return [{ severity: "block", message: "Connector identity is required." }];
  }
  return [{ severity: "info", message: `Connector: ${connector}` }];
}

export function renderMarkdown(report) {
  const lines = [
    "# Connector Scope Audit",
    "",
    `- Source: ${report.source}`,
    `- Policy: ${report.policySource}`,
    `- Connector: ${report.connector || "missing (required)"}`,
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
  const input = isRecord(plan) ? plan : {};
  return {
    connector: normalizeString(input.connector),
    scopes: normalizeList(input.scopes),
    dataClasses: normalizeAliasedList(input.dataClasses, input.data),
    actions: normalizeList(input.actions),
    approval: normalizeAliasedString(input.approval, input.approvalNote)
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePolicy(policy) {
  return {
    allowedScopes: new Set(normalizeList(policy.allowedScopes)),
    allowedDataClasses: new Set(normalizeAliasedList(policy.allowedDataClasses, policy.allowedData)),
    allowedReadActions: new Set(normalizeList(policy.allowedReadActions)),
    allowedWriteActions: new Set(normalizeList(policy.allowedWriteActions)),
    requireApprovalForWrites: policy.requireApprovalForWrites === true
  };
}

function auditInputSchema(plan, policy) {
  const findings = [];
  if (!isRecord(plan)) findings.push(block("Plan must be a JSON object."));
  if (!isRecord(policy)) findings.push(block("Policy must be a JSON object."));

  if (isRecord(plan)) {
    validateListField(findings, "Plan scopes", plan.scopes);
    validateAliasedList(findings, "Plan data classes", plan.dataClasses,
      "Plan data", plan.data, "Plan dataClasses conflicts with data.");
    validateListField(findings, "Plan actions", plan.actions);
    validateAliasedString(findings, "Plan approval", plan.approval, "approvalNote", plan.approvalNote);
  }
  if (isRecord(policy)) {
    validateListField(findings, "Policy allowed scopes", policy.allowedScopes);
    validateAliasedList(findings, "Policy allowed data classes", policy.allowedDataClasses,
      "Policy allowed data", policy.allowedData,
      "Policy allowedDataClasses conflicts with allowedData.");
    validateListField(findings, "Policy allowed read actions", policy.allowedReadActions);
    validateListField(findings, "Policy allowed write actions", policy.allowedWriteActions);
    if (policy.requireApprovalForWrites !== undefined
      && typeof policy.requireApprovalForWrites !== "boolean") {
      findings.push(block("Policy requireApprovalForWrites must be a boolean."));
    }
  }
  return findings;
}

function validateAliasedList(findings, canonicalLabel, canonical, aliasLabel, alias, conflictMessage) {
  validateListField(findings, canonicalLabel, canonical);
  validateListField(findings, aliasLabel, alias);
  if (canonical !== undefined && alias !== undefined
    && isValidList(canonical) && isValidList(alias)
    && !sameValues(normalizeList(canonical), normalizeList(alias))) {
    findings.push(block(conflictMessage));
  }
}

function validateAliasedString(findings, canonicalLabel, canonical, aliasLabel, alias) {
  if (canonical !== undefined && typeof canonical !== "string") {
    findings.push(block(`${canonicalLabel} must be a string.`));
  }
  if (alias !== undefined && typeof alias !== "string") {
    findings.push(block(`Plan ${aliasLabel} must be a string.`));
  }
  if (canonical !== undefined && alias !== undefined
    && typeof canonical === "string" && typeof alias === "string"
    && normalizeString(canonical) !== normalizeString(alias)) {
    findings.push(block(`${canonicalLabel} conflicts with ${aliasLabel}.`));
  }
}

function validateListField(findings, label, value) {
  if (value === undefined) return;
  if (typeof value === "string") return;
  if (!Array.isArray(value)) {
    findings.push(block(`${label} must be a string or an array of strings.`));
  } else if (value.some((item) => typeof item !== "string")) {
    findings.push(block(`${label} must contain only strings.`));
  }
}

function isValidList(value) {
  return typeof value === "string"
    || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function sameValues(left, right) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function block(message) {
  return { severity: "block", message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
    const isRead = policy.allowedReadActions.has(action);
    const isWrite = policy.allowedWriteActions.has(action);
    if (!isRead && !isWrite) {
      findings.push({ severity: "block", message: `Action is not allowed by policy: ${action}` });
    } else if (isRead && isWrite) {
      findings.push({ severity: "block", message: `Action has conflicting policy classifications: ${action}` });
    }
  }
  return findings;
}

function auditApprovals(plan, policy) {
  const hasWrite = plan.actions.some((action) => policy.allowedWriteActions.has(action));
  if (hasWrite && policy.requireApprovalForWrites && !plan.approval) {
    return [{ severity: "block", message: "Write action requested without approval evidence." }];
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
  if (typeof value !== "string" && !Array.isArray(value)) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list
    .filter((item) => typeof item === "string")
    .map((item) => item.toLowerCase().trim())
    .filter(Boolean))];
}

function normalizeAliasedList(canonical, alias) {
  return normalizeList([...(isValidList(canonical) ? normalizeList(canonical) : []),
    ...(isValidList(alias) ? normalizeList(alias) : [])]);
}

function normalizeAliasedString(canonical, alias) {
  return normalizeString(canonical) || normalizeString(alias);
}
