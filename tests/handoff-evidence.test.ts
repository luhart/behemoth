import { describe, expect, test } from "bun:test";

import type { AgendaItem, Evidence } from "../src/lib/workflow/contracts";
import { patientAnchoredAgenda } from "../src/lib/workflow/handoff-evidence";

describe("handoff agenda evidence guard", () => {
  test("removes chart-only agenda additions while retaining patient concerns with chart support", () => {
    const evidence: Evidence[] = [
      { id: "patient-chief-complaint", label: "Patient report", value: "Foot pain", source: "patient" },
      { id: "patient-priority-1", label: "Confirmed priority", value: "Foot pain", source: "derived" },
      { id: "athena-medication-1", label: "Active medication", value: "lisinopril", source: "athena" },
    ];
    const agenda: AgendaItem[] = [
      {
        label: "Evaluate persistent foot pain",
        rationale: "The patient selected this concern.",
        evidenceIds: ["patient-priority-1"],
      },
      {
        label: "Review a patient concern with chart support",
        rationale: "Patient and chart evidence both support review.",
        evidenceIds: ["patient-chief-complaint", "athena-medication-1"],
      },
      {
        label: "Speculate about lisinopril and the foot-pain presentation",
        rationale: "This chart-only addition is not anchored to the patient's report.",
        evidenceIds: ["athena-medication-1"],
      },
    ];

    expect(patientAnchoredAgenda(agenda, evidence).map((item) => item.label)).toEqual([
      "Evaluate persistent foot pain",
      "Review a patient concern with chart support",
    ]);
  });
});
