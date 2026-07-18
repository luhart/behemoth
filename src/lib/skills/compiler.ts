import type { RunResult } from "@/lib/workflow/contracts";

export type CompiledSkill = {
  name: string;
  version: string;
  files: Array<{ path: string; content: string }>;
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

export function compileRunToSkill(result: RunResult, corrections: string[] = []): CompiledSkill {
  const name = slug(`previsit-${result.handoff.disposition}`);
  const description =
    "Prepare a safe, evidence-linked pre-visit handoff from patient concerns and Athena chart context. Use for new, returning, or long-absent outpatient intake when a clinician needs a concise agenda, discrepancies, and explicit escalation before the visit.";
  const skill = `---
name: ${name}
description: ${description}
---

# Pre-visit handoff

## Workflow

1. Capture each concern in the patient's preferred language and preserve the original words.
2. Ask only bounded questions needed for duration, severity, functional impact, and red-flag screening.
3. Stop and follow the emergency escalation policy when a red flag matches. Never continue routine intake.
4. Retrieve the minimum relevant Athena problems, medications, allergies, and appointments.
5. Attach a resource identifier and observation date to every chart-derived fact.
6. Surface patient/chart conflicts as discrepancies. Never silently reconcile them.
7. Produce a one-minute handoff with an agenda, relevant history, discrepancies, and open questions.
8. Require a qualified human to edit and approve the artifact at an explicit approval gate before any Athena write.

## Safety contract

- Do not diagnose, prescribe, or represent the handoff as medical advice.
- Do not let the agent approve its own output.
- Do not write outside Athena Preview.
- Treat missing or unsupported chart data as unavailable, not negative.
- Keep patient-reported and chart-derived evidence visibly distinct.

## Output contract

Return a structured handoff with: headline, summary, agenda, relevant history, discrepancies, open questions, disposition, confidence, and evidence IDs.
${corrections.length ? `\n## Clinician corrections learned from the approved trace\n\n${corrections.map((item) => `- ${item}`).join("\n")}\n` : ""}`;

  const policy = {
    version: "1.0.0",
    allowedEnvironments: ["athena-preview"],
    readResources: ["Patient", "Appointment", "Problem", "Medication", "Allergy"],
    writeActions: ["create-appointment-note"],
    writeGate: { approvalRequired: true, allowedRoles: ["clinician", "nurse"], selfApproval: false },
    onUncertainty: "route-to-human",
  };
  const goldenTrace = {
    sourceRun: result.runId,
    workflow: result.workflowId,
    scenario: result.scenarioId,
    inputShape: { concerns: result.concerns.length, evidence: result.evidence.map((item) => item.source) },
    expected: {
      disposition: result.handoff.disposition,
      discrepancyCount: result.handoff.discrepancies.length,
      approvalRequired: true,
    },
  };
  const openaiYaml = `interface:
  display_name: "Compiled Pre-visit Handoff"
  short_description: "Run a governed, evidence-linked intake"
  default_prompt: "Use $${name} to prepare a safe pre-visit handoff for clinician review."
`;

  return {
    name,
    version: "1.0.0-draft",
    files: [
      { path: "SKILL.md", content: skill },
      { path: "agents/openai.yaml", content: openaiYaml },
      { path: "references/policy.json", content: JSON.stringify(policy, null, 2) },
      { path: "references/golden-trace.json", content: JSON.stringify(goldenTrace, null, 2) },
    ],
  };
}
