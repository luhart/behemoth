import { describe, expect, test } from "bun:test";

import { createAthenaAppointmentNote } from "../src/lib/athena/note";
import { getScenario } from "../src/lib/demo/fixtures";
import type { RunResult } from "../src/lib/workflow/contracts";

describe("Athena appointment note", () => {
  test("is compact and scan-friendly when Athena flattens whitespace", () => {
    const scenario = getScenario("maya-previsit");
    const result: RunResult = {
      runId: "run_demo123",
      workflowId: "previsit-intake-v1",
      scenarioId: scenario.id,
      startedAt: "2026-07-18T12:00:00.000Z",
      completedAt: "2026-07-18T12:00:02.000Z",
      patient: { ...scenario.patient, appointmentId: "2589077", identitySource: "athena" },
      concerns: scenario.concerns.map((concern, index) => ({
        ...concern,
        patientPriority: index === 0 ? "top" as const : "mentioned" as const,
      })),
      evidence: scenario.evidence,
      handoff: scenario.handoff,
      execution: { athena: "live", model: "live", safetyBranch: "standard" },
      approval: { required: true, status: "pending" },
    };

    const note = createAthenaAppointmentNote(result);

    expect(note).toStartWith("Cely pre-visit intake (clinician approved) | Patient priority:");
    expect(note).toContain(" | Confirmed concerns:");
    expect(note).toContain(" | Visit agenda:");
    expect(note).toContain(" | Reconcile:");
    expect(note).toEndWith(" | Run: run_demo123");
    expect(note).not.toContain("\n");
    expect(note).not.toContain("Evidence:");
    expect(note).not.toContain("Original:");
    expect(note.length).toBeLessThan(1800);
  });
});
