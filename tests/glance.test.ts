import { describe, expect, test } from "bun:test";

import { getScenario } from "../src/lib/demo/fixtures";
import type { RunResult } from "../src/lib/workflow/contracts";
import { buildClinicianGlance } from "../src/lib/workflow/glance";

const scenario = getScenario("maya-previsit");

function makeRun(overrides: Partial<RunResult> = {}): RunResult {
  return {
    runId: "run_glance",
    workflowId: "previsit-intake-v1",
    scenarioId: scenario.id,
    startedAt: "2026-07-18T12:00:00.000Z",
    completedAt: "2026-07-18T12:00:01.250Z",
    patient: scenario.patient,
    concerns: scenario.concerns,
    evidence: scenario.evidence,
    handoff: scenario.handoff,
    execution: { athena: "fixture", model: "fixture", safetyBranch: "standard" },
    approval: { required: true, status: "pending" },
    ...overrides,
  };
}

describe("clinician glance", () => {
  test("orders the patient's top concern first and flags it", () => {
    const concerns = scenario.concerns.map((concern, index) => ({
      ...concern,
      mentionOrder: index + 1,
      patientPriority: index === 1 ? ("top" as const) : ("mentioned" as const),
    }));
    const glance = buildClinicianGlance(makeRun({ concerns }));
    expect(glance.complaints[0].isTop).toBe(true);
    expect(glance.topConcern?.english).toBe(concerns[1].translated ?? concerns[1].patientWords);
  });

  test("groups chart history from Athena evidence without inventing entries", () => {
    const glance = buildClinicianGlance(makeRun());
    expect(glance.history.problems).toEqual(["Essential hypertension"]);
    expect(glance.history.medications).toEqual(["Lisinopril 10 mg tablet"]);
    expect(glance.history.allergies).toEqual([]);
  });

  test("combines handoff discrepancies and interpretation ambiguities into reconcile items", () => {
    const ambiguityEvidence = {
      id: "derived-interpretation-ambiguities",
      label: "Interpretation ambiguities requiring review",
      value: "Onset timing unclear; Fever relation unclear",
      source: "derived" as const,
    };
    const handoff = { ...scenario.handoff, discrepancies: ["Patient reports stopping a medication."] };
    const glance = buildClinicianGlance(makeRun({ handoff, evidence: [...scenario.evidence, ambiguityEvidence] }));
    expect(glance.reconcile).toEqual([
      "Patient reports stopping a medication.",
      "Interpretation ambiguity: Onset timing unclear",
      "Interpretation ambiguity: Fever relation unclear",
    ]);
  });

  test("keeps the estimated read inside the promised 1-to-3-minute window", () => {
    const glance = buildClinicianGlance(makeRun());
    expect(glance.estimatedReadSeconds).toBeGreaterThanOrEqual(60);
    expect(glance.estimatedReadSeconds).toBeLessThanOrEqual(180);
  });
});
