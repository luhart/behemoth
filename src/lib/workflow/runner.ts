import "server-only";

import { AthenaPreviewClient } from "@/lib/athena/client";
import { getAthenaConfig, hasAthenaCredentials } from "@/lib/athena/config";
import type { AthenaChartContext, AthenaRecord } from "@/lib/athena/types";
import { generateClinicalHandoff } from "@/lib/ai/handoff";
import { getScenario } from "@/lib/demo/fixtures";
import type { Evidence, RunInput, RunResult } from "@/lib/workflow/contracts";

function stringValue(record: AthenaRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function athenaEvidence(context: AthenaChartContext): Evidence[] {
  const evidence: Evidence[] = [];
  context.problems.slice(0, 4).forEach((problem, index) => {
    const value = stringValue(problem, ["name", "description", "code"]);
    if (value) evidence.push({
      id: `athena-live-problem-${index + 1}`,
      label: "Problem list",
      value,
      source: "athena",
      resource: `Problem / Athena Preview${stringValue(problem, ["problemid"]) ? ` / ${stringValue(problem, ["problemid"])}` : ""}`,
      observedAt: stringValue(problem, ["lastmodifieddatetime", "lastupdated"]),
    });
  });
  context.medications.slice(0, 4).forEach((medication, index) => {
    const value = stringValue(medication, ["medication", "medicationname", "name"]);
    if (value) evidence.push({
      id: `athena-live-medication-${index + 1}`,
      label: "Active medication",
      value,
      source: "athena",
      resource: "Medication / Athena Preview",
    });
  });
  context.allergies.slice(0, 3).forEach((allergy, index) => {
    const value = stringValue(allergy, ["allergenname", "allergy", "name"]);
    if (value) evidence.push({
      id: `athena-live-allergy-${index + 1}`,
      label: "Allergy",
      value,
      source: "athena",
      resource: "Allergy / Athena Preview",
    });
  });
  return evidence;
}

export async function runPrevisitWorkflow(input: RunInput): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const scenario = getScenario(input.scenarioId);
  const config = getAthenaConfig();
  const shouldReadAthena = input.preferLiveAthena && config.mode === "live" && hasAthenaCredentials(config);
  let evidence = scenario.evidence;
  let athenaMode: RunResult["execution"]["athena"] = "fixture";

  if (shouldReadAthena) {
    try {
      const context = await new AthenaPreviewClient(config).chartContext(scenario.patient.id);
      const liveEvidence = athenaEvidence(context);
      const patientEvidence = scenario.evidence.filter((item) => item.source === "patient" || item.source === "derived");
      if (liveEvidence.length > 0) {
        evidence = [...patientEvidence, ...liveEvidence];
        athenaMode = context.partialFailures.length > 0 ? "partial" : "live";
      } else {
        athenaMode = "degraded";
      }
    } catch {
      athenaMode = "degraded";
    }
  }

  const generation = await generateClinicalHandoff({
    scenario,
    evidence,
    preferLive: input.preferLiveModel,
  });
  const isEscalated = generation.handoff.disposition !== "clinician-review";

  return {
    runId: `run_${crypto.randomUUID().slice(0, 8)}`,
    workflowId: "previsit-intake-v1",
    scenarioId: scenario.id,
    startedAt,
    completedAt: new Date().toISOString(),
    patient: {
      id: scenario.patient.id,
      displayName: scenario.patient.displayName,
      age: scenario.patient.age,
      language: scenario.patient.language,
      appointment: scenario.patient.appointment,
    },
    concerns: scenario.concerns,
    evidence,
    handoff: generation.handoff,
    execution: {
      athena: athenaMode,
      model: generation.mode,
      safetyBranch: isEscalated ? "escalated" : "standard",
    },
    approval: { required: true, status: "pending" },
  };
}

export function formatAppointmentNote(result: RunResult): string {
  const lines = [
    "BEHEMOTH PRE-VISIT INTAKE — CLINICIAN APPROVED",
    "",
    result.handoff.summary,
    "",
    "VISIT AGENDA",
    ...result.handoff.agenda.map((item) => `- ${item}`),
  ];
  if (result.handoff.discrepancies.length) {
    lines.push("", "DISCREPANCIES TO RECONCILE", ...result.handoff.discrepancies.map((item) => `- ${item}`));
  }
  if (result.handoff.openQuestions.length) {
    lines.push("", "OPEN QUESTIONS", ...result.handoff.openQuestions.map((item) => `- ${item}`));
  }
  lines.push("", `Audit: ${result.runId} · Evidence: ${result.handoff.evidenceIds.join(", ")}`);
  return lines.join("\n").slice(0, 4000);
}
